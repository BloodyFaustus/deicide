import {DEICIDE} from "../../module/config.mjs";
import {decideAll, reachable} from "../../module/rules/doctrine.mjs";
import {inAnyRadius} from "../../module/rules/commands.mjs";
import {needsMorale, rollMorale} from "../../module/rules/company.mjs";
import {attackPower, hitChance} from "../../module/rules/resolve.mjs";
import {Sim} from "./engine.mjs";
import {profileOf, rederive} from "./world.mjs";

function snapshotOf(sim, scenario) {
  return {
    width: scenario.map.width, height: scenario.map.height,
    terrain: (x, y) => scenario.terrainAt(x, y),
    units: sim.actors.map(a => ({
      id: a.id, side: a.side, kind: a.kind === "company" ? "company" : "character", x: a.x, y: a.y, defeated: Boolean(a.downed || a.routed),
      officer: Boolean(a.derived?.isOfficer), commandRadius: a.derived?.commandRadius ?? 0, type: a.type ?? null,
      strength: a.kind === "company" ? a.strength : undefined, hp: a.kind !== "company" ? a.hp : undefined
    }))
  };
}

const chebyshev = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

function stepToward(sim, scenario, unit, target, move) {
  const occupied = new Set(sim.alive().filter(a => a.id !== unit.id).map(a => `${a.x},${a.y}`));
  let budget = move;
  while ( budget > 0 && chebyshev(unit, target) > 1 ) {
    const dx = Math.sign(target.x - unit.x), dy = Math.sign(target.y - unit.y);
    const options = [[dx, dy], [dx, 0], [0, dy]].filter(([x, y]) => x || y);
    let moved = false;
    for ( const [ox, oy] of options ) {
      const x = unit.x + ox, y = unit.y + oy;
      if ( (x < 0) || (y < 0) || (x >= scenario.map.width) || (y >= scenario.map.height) ) continue;
      const terrain = DEICIDE.terrain[scenario.terrainAt(x, y)] ?? DEICIDE.terrain.plain;
      if ( terrain.cost === null ) continue;
      if ( terrain.mountedImpassable && unit.derived?.classTypes?.includes("mounted") ) continue;
      if ( occupied.has(`${x},${y}`) ) continue;
      const cost = terrain.cost;
      if ( cost > budget ) continue;
      occupied.delete(`${unit.x},${unit.y}`);
      unit.x = x; unit.y = y;
      occupied.add(`${x},${y}`);
      budget -= cost;
      unit.tilesMoved = (unit.tilesMoved ?? 0) + 1;
      moved = true;
      break;
    }
    if ( !moved ) break;
  }
}

function bestAttack(sim, actor, scenario) {
  const enemies = sim.alive().filter(a => a.side !== actor.side);
  const actions = (actor.abilities ?? []).filter(a => (a.type === "action") && a.attack && actor.derived.skills.available.actions.includes(a.identifier));
  let best = null;
  for ( const ability of [null, ...actions] ) {
    if ( ability?.cost?.matter && (actor.matter < ability.cost.matter) ) continue;
    if ( ability?.cost?.channel && (actor.channel < ability.cost.channel) ) continue;
    if ( ability?.cost?.soulPrice && (actor.derived.soulPricePayer === "hp") && (actor.hp <= ability.cost.soulPrice + 5) ) continue;
    if ( actor.hoarder && (ability?.cost?.soulPrice || (ability?.cost?.matter ?? 0) > 2) ) continue;
    const range = ability?.war?.range ?? actor.weapon?.range ?? [1, 1];
    const [min, max] = [range[0] ?? 1, range[1] ?? range[0] ?? 1];
    for ( const enemy of enemies ) {
      const d = chebyshev(actor, enemy);
      if ( (d < min) || (d > max) ) continue;
      const params = {attacker: profileOf(actor), target: profileOf(enemy), weapon: actor.weapon ?? null, ability, mode: "war", context: {}};
      const power = attackPower(params).attack;
      const defense = ability?.attack?.defense === "res" ? profileOf(enemy).defense.res : (ability?.attack?.defense === "none" ? 0 : profileOf(enemy).defense.def);
      const value = Math.max(power - defense, 1) * (hitChance(params).chance / 100);
      const area = ability?.war?.area ?? {shape: "single", size: 1};
      const targets = area.shape === "single" ? [enemy] : enemies.filter(e => chebyshev(e, enemy) <= (area.size ?? 1));
      const total = value * (area.shape === "single" ? 1 : targets.length);
      if ( !best || (total > best.value) ) best = {ability, targets, value: total, primary: enemy};
    }
  }
  return best;
}

export function runWar({scenario, units, seed, hooks = {}}) {
  const sim = new Sim({seed, mode: "war"});
  for ( const unit of units ) { if ( unit.kind === "character" ) rederive(unit, "war"); sim.add(unit); }
  const metrics = {rounds: 0, outcome: "running", decisionsPerPhase: [], tilesPerDecision: [], cardsPerPhase: [], noRadiusPerRound: [], strengthByPc: {}, stoneLance: [], downed: 0, resupplyDust: 0};
  const pcs = units.filter(u => u.kind === "character" && u.side === "party");
  for ( const pc of pcs ) metrics.strengthByPc[pc.name] = 0;
  const strengthBefore = () => Object.fromEntries(sim.actors.filter(a => a.kind === "company").map(a => [a.id, a.strength]));

  for ( let round = 1; round <= scenario.rounds; round++ ) {
    sim.round = round;
    metrics.rounds = round;
    for ( const actor of sim.actors ) { actor.acted = false; actor.tilesMoved = 0; actor.reactionUsed = false; actor.reactionsThisRound = {}; actor.activations = 0; }
    for ( const entry of scenario.reinforcements ?? [] ) {
      if ( entry.round === round ) for ( const unit of entry.units ) sim.add(unit);
    }

    sim.phase = "lathander";
    let cards = sim.metrics.cards;
    for ( const actor of sim.alive("party") ) {
      if ( actor.kind === "character" ) {
        const before = strengthBefore();
        const commands = (actor.abilities ?? []).filter(a => (a.type === "command") && actor.derived.skills.available.commands.includes(a.identifier));
        let attack = bestAttack(sim, actor, scenario);
        if ( !attack ) {
          const nearest = [...sim.alive("enemy")].sort((a, b) => chebyshev(a, actor) - chebyshev(b, actor))[0];
          if ( nearest ) stepToward(sim, scenario, actor, nearest, actor.derived.move);
          attack = bestAttack(sim, actor, scenario);
        }
        if ( attack ) {
          const result = sim.useAbility({actor, ability: attack.ability, targets: attack.targets});
          const removed = attack.targets.filter(t => t.kind === "company").reduce((sum, t) => sum + ((before[t.id] ?? 0) - t.strength), 0);
          metrics.strengthByPc[actor.name] += removed;
          if ( hooks.stoneLanceId && (attack.ability?.identifier === hooks.stoneLanceId) ) metrics.stoneLance.push(removed);
          void result;
        }
        else if ( commands.length && actor.derived.isOfficer ) {
          const command = commands[0];
          const companies = sim.alive("party").filter(a => (a.kind === "company") && (chebyshev(a, actor) <= actor.derived.commandRadius));
          if ( companies.length ) sim.useAbility({actor, ability: command, targets: companies});
        }
      }
      else if ( actor.kind === "company" ) {
        const snapshot = snapshotOf(sim, scenario);
        const [decision] = decideAll(snapshot, [{id: actor.id, side: actor.side, x: actor.x, y: actor.y, type: actor.type, doctrine: actor.doctrine ?? "advance", move: actor.move, range: actor.range, screenOfficerId: null, classTypes: []}]);
        if ( decision.move ) { actor.x = decision.move.x; actor.y = decision.move.y; }
        if ( decision.attack ) {
          const target = sim.byId(decision.attack.targetId);
          if ( target ) sim.companyAttack(actor, target, {charge: Boolean(decision.move)});
        }
      }
      actor.acted = true;
    }
    const partyCards = sim.metrics.cards - cards;

    sim.phase = "enemy";
    cards = sim.metrics.cards;
    const snapshot = snapshotOf(sim, scenario);
    const companies = sim.alive("enemy").filter(a => a.kind === "company").map(a => ({id: a.id, side: a.side, x: a.x, y: a.y, type: a.type, doctrine: a.doctrine ?? "advance", move: a.move, range: a.range, screenOfficerId: null, classTypes: []}));
    let tiles = 0;
    for ( const company of companies ) tiles += reachable(snapshot, company).size;
    const decisions = decideAll(snapshot, companies);
    metrics.decisionsPerPhase.push(decisions.length);
    metrics.tilesPerDecision.push(decisions.length ? tiles / decisions.length : 0);
    let noRadius = 0;
    for ( const decision of decisions ) {
      const company = sim.byId(decision.companyId);
      if ( !company || company.downed ) continue;
      if ( decision.reason === "outsideCommandRadius" ) noRadius++;
      if ( decision.move ) { company.x = decision.move.x; company.y = decision.move.y; }
      if ( decision.attack ) {
        const target = sim.byId(decision.attack.targetId);
        if ( target ) sim.companyAttack(company, target, {charge: Boolean(decision.move)});
      }
      company.acted = true;
    }
    for ( const officer of sim.alive("enemy").filter(a => a.kind === "character") ) {
      let attack = bestAttack(sim, officer, scenario);
      if ( !attack ) {
        const nearest = [...sim.alive("party")].sort((a, b) => chebyshev(a, officer) - chebyshev(b, officer))[0];
        if ( nearest ) stepToward(sim, scenario, officer, nearest, officer.derived.move);
        attack = bestAttack(sim, officer, scenario);
      }
      if ( attack ) sim.useAbility({actor: officer, ability: attack.ability, targets: attack.targets});
    }
    metrics.noRadiusPerRound.push(noRadius);
    metrics.cardsPerPhase.push(sim.metrics.cards - cards);
    metrics.cardsPerPhase.push(partyCards);

    const endSnapshot = snapshotOf(sim, scenario);
    for ( const company of sim.alive().filter(a => a.kind === "company") ) {
      if ( needsMorale(company.strength) ) {
        const unit = endSnapshot.units.find(u => u.id === company.id);
        const flags = Object.assign({}, ...Array.from(company.statuses.values()).map(s => s.flags ?? {}));
        const result = flags.passMorale ? {passed: true} : rollMorale({quality: company.quality, inRadius: inAnyRadius(unit, endSnapshot)}, sim.rng);
        if ( !result.passed ) { company.routed = true; company.downed = true; company.strength = 0; }
      }
    }
    for ( const actor of sim.alive() ) sim.tickStatuses(actor, {kind: "roundEnd", round});
    if ( !sim.alive("party").some(a => a.kind === "character") ) { metrics.outcome = "defeat"; break; }
    if ( !sim.alive("enemy").length ) { metrics.outcome = "victory"; break; }
  }
  if ( metrics.outcome === "running" ) metrics.outcome = "held";
  metrics.downed = sim.metrics.downed;
  metrics.seed = seed;
  metrics.reactions = sim.metrics.reactions;
  metrics.anomalies = sim.metrics.anomalies;
  metrics.enemyStrengthLeft = sim.actors.filter(a => (a.kind === "company") && (a.side === "enemy")).reduce((sum, a) => sum + a.strength, 0);
  metrics.partyHpPercent = Math.round(pcs.reduce((s, p) => s + Math.max(p.hp, 0), 0) / Math.max(pcs.reduce((s, p) => s + p.hpMax, 0), 1) * 100);
  return metrics;
}
