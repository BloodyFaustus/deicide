import {DEICIDE} from "../config.mjs";
import {evaluate} from "../core/expression.mjs";

export function baseDelay(weight, spd) {
  return Math.max(DEICIDE.delay.min, evaluate(DEICIDE.formulas.delay, {weight, spd}));
}

export function actionDelay({weight, spd, penalty = 0, halved = false, fixed = null}) {
  let delay = (fixed ?? null) !== null ? fixed : baseDelay(weight ?? DEICIDE.delay.defaultWeight, spd);
  delay += penalty;
  if ( halved ) delay = Math.floor(delay / DEICIDE.delay.guardDivisor);
  return Math.max(delay, DEICIDE.delay.absoluteMin);
}

export function dismountPenalty(classTypes, {arena = false} = {}) {
  if ( arena ) return 0;
  let penalty = 0;
  for ( const type of classTypes ?? [] ) {
    penalty = Math.max(penalty, DEICIDE.classTypes[type]?.dungeon?.delay ?? 0);
  }
  return penalty;
}

export function startingTicks(surprise = "none") {
  const late = DEICIDE.dungeon.surpriseTick;
  return {
    party: surprise === "party" ? late : 0,
    enemy: surprise === "enemy" ? late : 0
  };
}

export function reinforcementTick(currentTick) {
  return currentTick + DEICIDE.dungeon.reinforcementTick;
}

export function compareTicks(a, b) {
  return (a.nextTick - b.nextTick) || ((b.spd ?? 0) - (a.spd ?? 0)) || String(a.id).localeCompare(String(b.id));
}

export function sortQueue(entries) {
  return [...entries].sort(compareTicks);
}

export function projectQueue(entries, count = 10) {
  const working = entries.filter(entry => !entry.defeated).map(entry => ({...entry}));
  const order = [];
  if ( !working.length ) return order;
  while ( order.length < count ) {
    working.sort(compareTicks);
    const next = working[0];
    order.push({id: next.id, tick: next.nextTick});
    next.nextTick += Math.max(next.delay ?? DEICIDE.delay.min, DEICIDE.delay.absoluteMin);
  }
  return order;
}

export function guardPreview(entries, currentId, count = 10) {
  const working = entries.map(entry => {
    if ( entry.id !== currentId ) return {...entry};
    const guardDelay = actionDelay({weight: DEICIDE.dungeonActions.guard.weight, spd: entry.spd ?? 0, fixed: entry.fixed ?? null});
    const halvedNext = Math.max(Math.floor((entry.delay ?? DEICIDE.delay.min) / DEICIDE.delay.guardDivisor), DEICIDE.delay.absoluteMin);
    return {...entry, nextTick: entry.nextTick + guardDelay, delay: halvedNext, guarded: true};
  });
  return projectQueue(working, count);
}
