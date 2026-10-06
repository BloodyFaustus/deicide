import {DEICIDE} from "../config.mjs";
import {Registry} from "../core/registry.mjs";

export function distance(a, b) {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

const key = (x, y) => `${x},${y}`;

function terrainAt(snapshot, x, y) {
  const source = snapshot.terrain;
  let id = "plain";
  if ( typeof source === "function" ) id = source(x, y) ?? "plain";
  else if ( Array.isArray(source) ) id = source[y]?.[x] ?? "plain";
  return DEICIDE.terrain[id] ? id : "plain";
}

export function entryCost(snapshot, company, x, y) {
  if ( (x < 0) || (y < 0) || (x >= snapshot.width) || (y >= snapshot.height) ) return null;
  const terrain = DEICIDE.terrain[terrainAt(snapshot, x, y)];
  if ( terrain.cost === null ) return null;
  const mounted = (company.type === "cavalry") || (company.classTypes ?? []).includes("mounted");
  const flying = (company.classTypes ?? []).includes("flying");
  if ( terrain.mountedImpassable && mounted ) return null;
  if ( flying ) return 1;
  return terrain.cost;
}

export function reachable(snapshot, company, budget = company.move) {
  const occupied = new Map();
  for ( const unit of snapshot.units ) {
    if ( unit.defeated || (unit.id === company.id) ) continue;
    occupied.set(key(unit.x, unit.y), unit);
  }
  const best = new Map([[key(company.x, company.y), {x: company.x, y: company.y, cost: 0, from: null}]]);
  const frontier = [{x: company.x, y: company.y, cost: 0}];
  while ( frontier.length ) {
    frontier.sort((a, b) => a.cost - b.cost);
    const current = frontier.shift();
    if ( current.cost > (best.get(key(current.x, current.y))?.cost ?? Infinity) ) continue;
    for ( let dx = -1; dx <= 1; dx++ ) {
      for ( let dy = -1; dy <= 1; dy++ ) {
        if ( !dx && !dy ) continue;
        const x = current.x + dx;
        const y = current.y + dy;
        const step = entryCost(snapshot, company, x, y);
        if ( step === null ) continue;
        const blocker = occupied.get(key(x, y));
        if ( blocker && (blocker.side !== company.side) ) continue;
        const cost = current.cost + step;
        if ( cost > budget ) continue;
        const known = best.get(key(x, y));
        if ( known && (known.cost <= cost) ) continue;
        best.set(key(x, y), {x, y, cost, from: key(current.x, current.y), passThrough: Boolean(blocker)});
        frontier.push({x, y, cost});
      }
    }
  }

  for ( const [tileKey, tile] of best ) {
    if ( tile.passThrough ) best.set(tileKey, {...tile, blocked: true});
  }
  return best;
}

function pathTo(tiles, target) {
  const path = [];
  let cursor = tiles.get(key(target.x, target.y));
  while ( cursor ) {
    path.unshift({x: cursor.x, y: cursor.y});
    cursor = cursor.from ? tiles.get(cursor.from) : null;
  }
  return path;
}

export function inCommandRadius(snapshot, company) {
  return snapshot.units.some(unit => !unit.defeated && unit.officer && (unit.side === company.side)
    && (unit.id !== company.id) && (distance(unit, company) <= (unit.commandRadius ?? 0)));
}

function liveEnemies(snapshot, company) {
  return snapshot.units.filter(unit => !unit.defeated && (unit.side !== company.side));
}

function nearestEnemy(enemies, point) {
  let best = null;
  for ( const enemy of enemies ) {
    const d = distance(enemy, point);
    if ( !best || (d < best.d) || ((d === best.d) && (String(enemy.id) < String(best.enemy.id))) ) best = {enemy, d};
  }
  return best;
}

export function chooseTarget(snapshot, company, position) {
  const [min, max] = company.range ?? [1, 1];
  const durability = unit => unit.strength ?? unit.hp ?? Infinity;
  const candidates = liveEnemies(snapshot, company)
    .map(enemy => ({enemy, d: distance(enemy, position)}))
    .filter(({d}) => (d >= min) && (d <= max));
  candidates.sort((a, b) => (a.d - b.d) || (durability(a.enemy) - durability(b.enemy))
    || String(a.enemy.id).localeCompare(String(b.enemy.id)));
  return candidates[0]?.enemy ?? null;
}

function bestTile(tiles, score) {
  let best = null;
  for ( const tile of tiles.values() ) {
    if ( tile.blocked ) continue;
    const value = score(tile);
    if ( value === null ) continue;
    if ( !best || (value < best.value) || ((value === best.value) && (tile.cost < best.tile.cost)) ) best = {tile, value};
  }
  return best?.tile ?? null;
}

export const doctrineBehaviors = new Registry("doctrineBehaviors");

doctrineBehaviors.registerAll({
  hold: () => null,

  advance: ({snapshot, company, tiles, enemies}) => {
    const target = nearestEnemy(enemies, company)?.enemy;
    if ( !target ) return null;
    const [min, max] = company.range ?? [1, 1];

    return bestTile(tiles, tile => {
      const d = distance(tile, target);
      const inBand = (d >= min) && (d <= max);
      return inBand ? d - 1000 : d;
    });
  },

  volley: ({snapshot, company, tiles, enemies}) => {
    const [, max] = company.range ?? [1, 1];
    const adjacent = enemies.some(enemy => distance(enemy, company) <= 1);
    const budget = adjacent ? DEICIDE.doctrines.volley.retreat : company.move;
    const options = adjacent ? reachable(snapshot, company, budget) : tiles;

    return bestTile(options, tile => {
      const nearest = nearestEnemy(enemies, tile);
      if ( !nearest ) return null;
      if ( adjacent ) return -nearest.d;
      return Math.abs(nearest.d - max) + (nearest.d < max ? 0.5 : 0);
    });
  },

  screen: ({snapshot, company, tiles, enemies}) => {
    const officer = snapshot.units.find(unit => unit.id === company.screenOfficerId)
      ?? snapshot.units.find(unit => !unit.defeated && unit.officer && (unit.side === company.side));
    if ( !officer ) return null;

    return bestTile(tiles, tile => {
      if ( distance(tile, officer) !== 1 ) return null;
      return nearestEnemy(enemies, tile)?.d ?? 0;
    });
  }
});

export function decide(snapshot, company) {
  const doctrine = doctrineBehaviors.has(company.doctrine) ? company.doctrine : "hold";
  const inRadius = inCommandRadius(snapshot, company);
  const enemies = liveEnemies(snapshot, company);

  const effective = inRadius ? doctrine : "hold";
  let reason = inRadius ? doctrine : "outsideCommandRadius";

  let destination = null;
  if ( enemies.length && (effective !== "hold") && ((company.move ?? 0) > 0) ) {
    const tiles = reachable(snapshot, company);
    destination = doctrineBehaviors.get(effective)({snapshot, company, tiles, enemies});
    if ( destination && (destination.x === company.x) && (destination.y === company.y) ) destination = null;
    if ( destination ) destination = {...destination, path: pathTo(tiles, destination)};
  }

  const position = destination ?? company;
  let target = chooseTarget(snapshot, company, position);

  if ( destination && DEICIDE.companyTypes[company.type]?.cannotMoveAndFire ) {
    target = null;
    reason = `${reason}.movedNoFire`;
  }

  return {
    companyId: company.id,
    doctrine,
    effective,
    inRadius,
    move: destination ? {x: destination.x, y: destination.y, cost: destination.cost, path: destination.path} : null,
    attack: target ? {targetId: target.id, distance: distance(target, position)} : null,
    reason
  };
}

export function decideAll(snapshot, companies) {
  const working = {...snapshot, units: snapshot.units.map(unit => ({...unit}))};
  const decisions = [];
  for ( const company of companies ) {
    const live = working.units.find(unit => unit.id === company.id);
    const current = live ? {...company, x: live.x, y: live.y} : company;
    const decision = decide(working, current);
    if ( decision.move && live ) {
      live.x = decision.move.x;
      live.y = decision.move.y;
    }
    decisions.push(decision);
  }
  return decisions;
}
