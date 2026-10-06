import {DEICIDE} from "../config.mjs";

export function findStatus(actor, statusId) {
  return actor?.effects.find(effect => (effect.type === "status") && (effect.system.statusId === statusId)) ?? null;
}

export async function applyStatus(actor, statusId, {turns, pool = null, element = null, sourceUuid = null} = {}) {
  const table = DEICIDE.statuses[statusId];
  if ( !table || !actor ) return null;
  if ( actor.derived?.immunities?.includes(statusId) ) {
    ui.notifications?.info(`${actor.name} is immune to ${statusId}.`);
    return null;
  }
  const duration = turns ?? table.duration?.turns ?? null;
  const existing = findStatus(actor, statusId);
  const changes = (table.modifiers ?? []).length ? [] : [];
  const data = {
    name: game.i18n.localize(table.label),
    img: table.img,
    type: "status",
    statuses: [statusId],
    duration: {value: duration, units: "turns", expiry: null},
    system: {statusId, stackRule: "refresh", pool, absorbed: 0, element, sourceUuid, changes}
  };
  if ( existing ) {
    await existing.update({duration: data.duration, "system.pool": pool ?? existing.system.pool, "system.element": element ?? existing.system.element});
    return existing;
  }
  const [effect] = await actor.createEmbeddedDocuments("ActiveEffect", [data]);
  return effect ?? null;
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
    const table = DEICIDE.statuses[statusId];
    if ( !table ) continue;
    const atTurnStart = event === "turnStart";
    if ( atTurnStart && table.tick?.burn && (table.tick.at === "turnStart") ) {
      await actor.applyDamage(table.tick.burn);
      log.push({statusId, burn: table.tick.burn});
    }
    if ( atTurnStart && (statusId === "guard") ) {
      await effect.delete();
      log.push({statusId, ended: true});
      continue;
    }
    if ( atTurnStart && (typeof effect.duration.value === "number") ) {
      const remaining = effect.duration.value - 1;
      if ( remaining <= 0 ) {
        await effect.delete();
        log.push({statusId, ended: true});
      }
      else await effect.update({"duration.value": remaining});
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

export const statuses = {apply: applyStatus, remove: removeStatus, find: findStatus, tick: tickStatuses, trackWarded};
