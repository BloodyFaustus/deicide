import {DEICIDE} from "../config.mjs";
import {tickStatus} from "../rules/statuses.mjs";

export function findStatus(actor, statusId) {
  return actor?.effects.find(effect => (effect.type === "status") && (effect.system.statusId === statusId)) ?? null;
}

export async function applyStatus(actor, statusId, {turns, pool = null, element = null, sourceUuid = null, modifiers = null, flags = null, params = null, expires = null} = {}) {
  const table = DEICIDE.statuses[statusId];
  if ( !table || !actor ) return null;
  if ( actor.derived?.immunities?.includes(statusId) ) {
    ui.notifications?.info(`${actor.name} is immune to ${statusId}.`);
    return null;
  }
  const duration = turns ?? table.duration?.turns ?? null;
  const existing = findStatus(actor, statusId);
  const data = {
    name: game.i18n.localize(table.label),
    img: table.img,
    type: "status",
    statuses: [statusId],
    duration: {value: duration, units: "turns", expiry: null},
    system: {
      statusId, stackRule: "refresh", pool, absorbed: 0, element, sourceUuid, changes: [],
      modifiers: modifiers ?? [], flags: {...(flags ?? {}), ...(params ?? {})}, expires
    }
  };
  if ( existing ) {

    const stacked = (statusId === "ordered") ? [...existing.system.modifiers, ...(modifiers ?? [])] : (modifiers ?? existing.system.modifiers);
    await existing.update({
      duration: data.duration, "system.pool": pool ?? existing.system.pool, "system.element": element ?? existing.system.element,
      "system.modifiers": stacked, "system.flags": {...existing.system.flags, ...data.system.flags}, "system.expires": expires ?? existing.system.expires
    });
    return existing;
  }
  const [effect] = await actor.createEmbeddedDocuments("ActiveEffect", [data]);
  return effect ?? null;
}

export async function expireStatuses(actor, now) {
  const removed = [];
  const event = {kind: now.kind === "round" ? "roundEnd" : now.kind, round: now.round, phase: now.phase};
  for ( const effect of [...(actor?.effects ?? [])] ) {
    if ( effect.type !== "status" ) continue;
    if ( !effect.system.expires && (event.kind !== "battle") ) continue;
    const result = tickStatus({statusId: effect.system.statusId, duration: effect.duration.value, expires: effect.system.expires}, event);
    if ( result.ended ) {
      await effect.delete();
      removed.push(effect.system.statusId);
    }
  }
  return removed;
}

export function effectModifiers(actor) {
  const modifiers = [];
  const flags = {};
  for ( const effect of actor?.effects ?? [] ) {
    if ( effect.type !== "status" ) continue;
    const statusId = effect.system.statusId;
    const table = DEICIDE.statuses[statusId];

    if ( !effect.system.stance ) for ( const modifier of effect.system.modifiers ?? [] ) modifiers.push({...modifier, source: `status.${statusId}`, label: modifier.label ?? effect.name});
    Object.assign(flags, table?.flags ?? {}, effect.system.flags ?? {});
  }
  return {modifiers, flags};
}

export async function removeStatus(actor, statusId) {
  const existing = findStatus(actor, statusId);
  if ( existing ) await existing.delete();
  return Boolean(existing);
}

export async function tickStatuses(actor, event) {
  const log = [];
  if ( !actor ) return log;
  for ( const effect of [...actor.effects] ) {
    if ( effect.type !== "status" ) continue;
    const statusId = effect.system.statusId;
    if ( !DEICIDE.statuses[statusId] ) continue;
    const result = tickStatus({statusId, duration: effect.duration.value, expires: effect.system.expires}, {kind: event});
    if ( result.burn ) {
      await actor.applyDamage(result.burn);
      log.push({statusId, burn: result.burn});
    }
    if ( result.ended ) {
      await effect.delete();
      log.push({statusId, ended: true});
    }
    else if ( (result.remaining !== null) && (result.remaining !== effect.duration.value) ) {
      await effect.update({"duration.value": result.remaining});
    }
  }
  return log;
}

export async function trackWarded(actor, amount) {
  const effect = findStatus(actor, "warded");
  if ( !effect ) return null;
  const mag = actor.profile?.attributes?.mag ?? 0;
  const threshold = Math.floor(game.deicide.core.expression.evaluate(DEICIDE.statuses.warded.breakFormula, {mag}));
  const absorbed = effect.system.absorbed + amount;
  if ( absorbed >= threshold ) {
    await effect.delete();
    return {broken: true, absorbed, threshold};
  }
  await effect.update({"system.absorbed": absorbed});
  return {broken: false, absorbed, threshold};
}

export const statuses = {apply: applyStatus, remove: removeStatus, find: findStatus, tick: tickStatuses, trackWarded, expire: expireStatuses, modifiers: effectModifiers};
