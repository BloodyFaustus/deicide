import {DEICIDE} from "../config.mjs";

export function tickStatus(status, event) {
  const table = DEICIDE.statuses[status.statusId] ?? {};
  const result = {burn: 0, ended: false, remaining: status.duration ?? null};
  const kind = event.kind;

  const expires = status.expires;
  if ( expires ) {
    if ( (kind === "phase") && (expires.kind === "phase") ) {
      result.ended = (expires.round < event.round) || ((expires.round === event.round) && (expires.phase !== event.phase));
    }
    else if ( (kind === "roundEnd") && ["phase", "round"].includes(expires.kind) ) result.ended = expires.round <= event.round;
    else if ( (kind === "turnStart") && (expires.kind === "ownTurn") ) result.ended = true;
    else if ( (kind === "battle") && ["phase", "round", "battle", "ownTurn", "encounter"].includes(expires.kind) ) result.ended = true;
    if ( result.ended ) return result;
  }

  if ( kind === "turnStart" ) {
    if ( table.tick?.burn && (table.tick.at === "turnStart") ) result.burn = table.tick.burn;
    if ( table.duration?.until === "nextTurn" ) { result.ended = true; return result; }
    if ( typeof status.duration === "number" ) {
      result.remaining = status.duration - 1;
      if ( result.remaining <= 0 ) result.ended = true;
    }
  }
  if ( (kind === "roundEnd") && (typeof status.duration === "number") && table.tickAtRoundEnd ) {
    result.remaining = status.duration - 1;
    if ( result.remaining <= 0 ) result.ended = true;
  }
  if ( (kind === "battle") && (table.duration?.until === "emptyOrEncounterEnd") ) result.ended = true;
  return result;
}

export function simulateStatus(status, events) {
  let current = {...status};
  const log = [];
  let burnTotal = 0;
  for ( const event of events ) {
    const result = tickStatus(current, event);
    log.push({event: event.kind, ...result});
    burnTotal += result.burn;
    if ( result.ended ) return {log, ended: true, burnTotal};
    current = {...current, duration: result.remaining};
  }
  return {log, ended: false, burnTotal};
}
