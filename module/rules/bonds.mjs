import {DEICIDE} from "../config.mjs";

export function bondRankFor(points) {
  let rank = null;
  for ( const entry of DEICIDE.bonds.ranks ) {
    if ( points >= entry.points ) rank = entry;
  }
  return rank;
}

export function bondModifiers(rank) {
  const entry = typeof rank === "string" ? DEICIDE.bonds.ranks.find(r => r.id === rank) : rank;
  if ( !entry ) return [];
  const label = `Bond ${entry.id}`;
  const list = [];
  if ( entry.hit ) list.push({key: "hit", value: entry.hit, source: "bond", label});
  if ( entry.avoid ) list.push({key: "avoid", value: entry.avoid, source: "bond", label});
  if ( entry.might ) list.push({key: "might", value: entry.might, source: "bond", label});
  if ( entry.def ) list.push({key: "defense.def", value: entry.def, source: "bond", label});
  return list;
}

export function bondAdjacent(a, b, engine) {
  if ( !a || !b ) return false;
  if ( engine === "dungeon" ) return Boolean(a.row) && (a.row === b.row) && (a.side === b.side);
  if ( (typeof a.x !== "number") || (typeof b.x !== "number") ) return false;
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) <= 1;
}

export function activeBonds(units, engine) {
  const pairs = [];
  const seen = new Set();
  const byActor = new Map(units.map(unit => [unit.actorId, unit]));
  for ( const unit of units ) {
    for ( const bond of unit.bonds ?? [] ) {
      if ( bond.broken ) continue;
      const partner = byActor.get(bond.actorId);
      if ( !partner || (partner.id === unit.id) ) continue;
      const key = [unit.id, partner.id].sort().join(":");
      if ( seen.has(key) ) continue;
      const rank = bondRankFor(bond.points ?? 0);
      if ( !rank ) continue;
      if ( !bondAdjacent(unit, partner, engine) ) continue;
      seen.add(key);
      pairs.push({a: unit.id, b: partner.id, actorA: unit.actorId, actorB: partner.actorId, rank, modifiers: bondModifiers(rank)});
    }
  }
  return pairs;
}

export function bondsOf(unitId, pairs) {
  const modifiers = [];
  const partners = [];
  let best = null;
  for ( const pair of pairs ) {
    if ( (pair.a !== unitId) && (pair.b !== unitId) ) continue;
    partners.push(pair.a === unitId ? pair.b : pair.a);

    if ( !best || (pair.rank.points > best.points) ) best = pair.rank;
  }
  if ( best ) modifiers.push(...bondModifiers(best));
  return {modifiers, rank: best?.id ?? null, partners};
}

export function logAdjacency(log, pairs) {
  const next = {...(log ?? {})};
  for ( const pair of pairs ) {
    const key = [pair.actorA, pair.actorB].sort().join(":");
    next[key] = (next[key] ?? 0) + 1;
  }
  return next;
}

export function accrueBondPoints(log) {
  const min = DEICIDE.bonds.points.battleMinRounds;
  const result = [];
  for ( const [key, rounds] of Object.entries(log ?? {}) ) {
    if ( rounds < min ) continue;
    const [actorA, actorB] = key.split(":");
    result.push({actorA, actorB, rounds, points: DEICIDE.bonds.points.battle});
  }
  return result;
}
