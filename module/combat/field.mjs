import {DEICIDE} from "../config.mjs";
import {activeBonds, bondsOf} from "../rules/bonds.mjs";
import {test} from "../core/predicate.mjs";

export function unitOf(combatant, grid) {
  const actor = combatant.actor;
  const token = combatant.token;
  const system = actor?.system;
  return {
    id: combatant.id,
    actorId: actor?.id ?? null,
    actorUuid: actor?.uuid ?? null,
    name: combatant.name,
    side: combatant.system?.side ?? "party",
    kind: actor?.type === "company" ? "company" : (actor?.type === "monster" ? "monster" : "character"),
    type: actor?.type === "company" ? system.type : null,
    x: token ? Math.round(token.x / grid) : null,
    y: token ? Math.round(token.y / grid) : null,
    row: combatant.system?.row ?? actor?.system?.row ?? "front",
    defeated: combatant.isDefeated,
    officer: Boolean(actor?.derived?.isOfficer),
    commandRadius: actor?.derived?.commandRadius ?? 0,
    tilesMoved: combatant.system?.tilesMoved ?? 0,
    mounted: Boolean(actor?.derived?.classTypes?.includes("mounted")),
    bonds: actor?.type === "character" ? (system.bonds ?? []).map(bond => ({actorId: bond.actorId, points: bond.points, broken: bond.broken})) : [],
    strength: actor?.type === "company" ? system.strength : undefined,
    hp: actor?.type !== "company" ? system?.hp?.value : undefined
  };
}

export function fieldSnapshot(combat) {
  if ( !combat ) return null;
  const grid = canvas?.grid?.size ?? 100;
  const engine = combat.type === "dungeon" ? "dungeon" : "war";
  const units = combat.combatants.filter(c => c.actor).map(c => unitOf(c, grid));
  const byActor = new Map(units.map(unit => [unit.actorId, unit]));
  const pairs = activeBonds(units.filter(unit => !unit.defeated && (unit.kind === "character")), engine);
  return {engine, units, byActor, pairs, grid};
}

export function distance(a, b, engine) {
  if ( !a || !b ) return Infinity;
  if ( engine === "dungeon" ) return (a.row === b.row) ? 1 : 2;
  if ( (typeof a.x !== "number") || (typeof b.x !== "number") ) return Infinity;
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

export function fieldModifiers(actor, field) {
  const result = {modifiers: [], flags: {}, bond: {rank: null, partners: []}};
  if ( !field || !actor ) return result;
  const me = field.byActor.get(actor.id);
  if ( !me ) return result;
  const mine = bondsOf(me.id, field.pairs);
  result.modifiers.push(...mine.modifiers);
  result.bond = {rank: mine.rank, partners: mine.partners};

  const lookup = game.deicide?.catalog?.lookup?.() ?? (() => null);
  for ( const unit of field.units ) {
    if ( unit.defeated || (unit.actorId === actor.id) ) continue;
    const other = game.actors.get(unit.actorId);
    const active = other?.derived?.skills?.active ?? [];
    for ( const id of active ) {
      const data = lookup("ability", id);
      for ( const effect of [...(data?.effects ?? []), ...(data?.stance?.effects ?? [])] ) {
        if ( effect.kind !== "aura" ) continue;
        const sameSide = unit.side === me.side;
        const wants = effect.target ?? "allies";
        if ( ["allies", "alliesInRadius", "companiesInRadius"].includes(wants) && !sameSide ) continue;
        if ( (wants === "enemies") && sameSide ) continue;
        if ( (wants === "companiesInRadius") && (me.kind !== "company") ) continue;
        if ( !test(effect.when, {engine: field.engine, mode: game.deicide?.scene?.mode?.() ?? field.engine, subject: other?.profile ?? null}) ) continue;
        const radius = effect.radius ?? 1;
        const within = (wants === "companiesInRadius") ? (distance(unit, me, field.engine) <= Math.max(radius, unit.commandRadius)) : (distance(unit, me, field.engine) <= radius);
        if ( !within ) continue;
        for ( const modifier of effect.modifiers ?? [] ) result.modifiers.push({...modifier, source: `aura.${id}`, label: modifier.label ?? data.name});
        Object.assign(result.flags, effect.flags ?? {});
      }
    }
  }
  return result;
}

export function groupsFor(actor, field, {radius = 1} = {}) {
  const groups = {allies: [], enemies: [], alliesInRadius: [], companies: [], row: [], radius: []};
  if ( !field ) return groups;
  const me = field.byActor.get(actor?.id);
  for ( const unit of field.units ) {
    if ( unit.defeated || !unit.actorUuid ) continue;
    const same = me ? (unit.side === me.side) : false;
    if ( unit.actorId === actor?.id ) continue;
    if ( same ) {
      groups.allies.push(unit.actorUuid);
      if ( me && (distance(unit, me, field.engine) <= (me.commandRadius || radius)) ) groups.alliesInRadius.push(unit.actorUuid);
      if ( (unit.kind === "company") && me && (distance(unit, me, field.engine) <= (me.commandRadius || radius)) ) groups.companies.push(unit.actorUuid);
    }
    else groups.enemies.push(unit.actorUuid);
  }
  return groups;
}

export const field = {snapshot: fieldSnapshot, modifiers: fieldModifiers, groups: groupsFor, distance, unitOf, DEICIDE};
