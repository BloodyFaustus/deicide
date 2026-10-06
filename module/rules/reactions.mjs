import {DEICIDE} from "../config.mjs";
import {test} from "../core/predicate.mjs";
import {opposedChance} from "./resolve.mjs";

export const TRIGGERS = {
  targetedByAttack: "before",
  allyTargeted: "before",
  enemyCast: "before",
  enemyCommand: "before",
  enemyMoved: "before",
  enemyEnteredRange: "before",
  attackedAfterMoving: "before",
  mountedAttacker: "before",
  allyAttacking: "before",
  hitByAttack: "after",
  hitByPhysical: "after",
  hitByDivine: "after",
  hitBySpell: "after",
  missedByMelee: "after",
  allyHit: "after",
  allyDowned: "after",
  lethalHit: "after"
};

export function distanceBetween(a, b) {
  if ( !a || !b ) return Infinity;
  if ( (typeof a.x === "number") && (typeof b.x === "number") ) return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
  return Infinity;
}

export function inWindow(window, reactor, other, engine) {
  if ( !window ) return true;
  if ( engine === "dungeon" ) {
    if ( window.row === "any" ) return true;
    if ( window.adjacent || window.sameRow ) return reactor.row === other?.row;
    if ( typeof window.tiles === "number" ) return window.tiles >= 2 ? true : (reactor.row === other?.row);
    return true;
  }
  const distance = distanceBetween(reactor, other);
  if ( window.adjacent ) return distance <= 1;
  if ( typeof window.tiles === "number" ) return distance <= window.tiles;
  return true;
}

export function triggersFor({reactor, event}) {
  const raised = new Set();
  const {attacker, action, targets = [], engine, phase} = event;
  const isTarget = targets.find(target => target.id === reactor.id) ?? null;
  const enemyOfAttacker = reactor.side !== attacker?.side;
  const isSpell = (action?.source === "spell") || Boolean(action?.tags?.includes?.("reason") || action?.tags?.includes?.("faith") || action?.tags?.includes?.("void"));
  const isPhysical = !isSpell && !action?.direct && (action?.source !== "alchemy");
  const isMelee = (action?.range?.[1] ?? 1) <= 1;
  if ( phase === "before" ) {
    if ( isTarget ) {
      raised.add("targetedByAttack");
      if ( (attacker?.tilesMoved ?? 0) > 0 ) raised.add("attackedAfterMoving");
      if ( attacker?.mounted ) raised.add("mountedAttacker");
    }
    if ( enemyOfAttacker ) {
      if ( isSpell ) raised.add("enemyCast");
      if ( action?.type === "command" ) raised.add("enemyCommand");
      if ( targets.some(target => (target.id !== reactor.id) && (target.side === reactor.side)) ) raised.add("allyTargeted");
    }
    else if ( attacker && (attacker.id !== reactor.id) ) raised.add("allyAttacking");
  }
  else {
    if ( isTarget && isTarget.hit ) {
      raised.add("hitByAttack");
      if ( isPhysical ) raised.add("hitByPhysical");
      if ( isSpell ) raised.add("hitBySpell");
      if ( action?.element === "divine" ) raised.add("hitByDivine");
      if ( isTarget.lethal ) raised.add("lethalHit");
    }
    if ( isTarget && !isTarget.hit && isMelee ) raised.add("missedByMelee");
    if ( enemyOfAttacker ) {
      for ( const target of targets ) {
        if ( (target.id === reactor.id) || (target.side !== reactor.side) ) continue;
        if ( target.hit ) raised.add("allyHit");
        if ( target.downed ) raised.add("allyDowned");
      }
    }
  }
  return raised;
}

export function eligibleReactions({event, reactors}) {
  const prompts = [];
  const engine = event.engine ?? "war";
  for ( const reactor of reactors ) {
    if ( reactor.used ) continue;
    const raised = triggersFor({reactor, event});
    if ( !raised.size ) continue;
    const options = [];
    const target = event.targets?.[0] ?? null;
    const isTarget = event.targets?.some(t => t.id === reactor.id);
    const allyInDanger = event.targets?.find(t => (t.id !== reactor.id) && (t.side === reactor.side)) ?? null;
    const distance = distanceBetween(reactor, event.attacker);
    const situation = {
      engine, mode: event.mode ?? engine, subject: reactor.profile, target: event.attacker?.profile ?? null,
      action: event.action ?? null, distance, attackerDistance: distance,
      adjacent: engine === "dungeon" ? (reactor.row === event.attacker?.row) : (distance <= 1),
      sameRow: reactor.row === event.attacker?.row, tilesMoved: event.attacker?.tilesMoved ?? 0,
      damage: isTarget ? (event.targets.find(t => t.id === reactor.id)?.damage ?? 0) : (allyInDanger?.damage ?? 0),
      round: event.round ?? 1, trigger: null, flank: Boolean(event.flank), selfTilesMoved: reactor.tilesMoved ?? 0
    };
    for ( const reaction of reactor.reactions ?? [] ) {
      const block = reaction.data?.reaction;
      if ( !block?.trigger ) continue;
      const triggers = Array.isArray(block.trigger) ? block.trigger : [block.trigger];
      const trigger = triggers.find(id => raised.has(id));
      if ( !trigger ) continue;
      const phase = TRIGGERS[trigger];
      if ( phase && (phase !== event.phase) ) continue;

      if ( block.window && !block.window.self ) {
        const anchor = trigger.startsWith("ally") ? allyInDanger : event.attacker;
        if ( !inWindow(block.window, reactor, anchor, engine) ) continue;
      }
      if ( block.window?.self && !isTarget ) continue;
      if ( block.usesPerRound && ((reactor.usedThisRound?.[reaction.id] ?? 0) >= block.usesPerRound) ) continue;
      if ( !test(block.when ?? reaction.data?.when, {...situation, trigger}) ) continue;
      const roll = block.roll?.d100Under
        ? opposedChance(block.roll.d100Under, {...(reactor.profile?.attributes ?? {}), caster: event.attacker?.profile?.attributes ?? {}, casterMag: event.attacker?.profile?.attributes?.mag ?? 0, enemyOfficerCmd: event.attacker?.profile?.attributes?.cmd ?? 0})
        : null;
      options.push({
        abilityId: reaction.id, name: reaction.name ?? reaction.id, trigger, roll, cost: block.cost ?? null,
        kinds: (reaction.data?.effects ?? []).map(effect => effect.kind),
        priority: priorityOf(reaction.data)
      });
    }

    if ( raised.has("allyAttacking") && (event.phase === "before") ) {
      const bond = (reactor.bonds ?? []).find(entry => (entry.partnerId === event.attacker?.id) && (entry.rank === "A"));
      const adjacent = engine === "dungeon" ? (reactor.row === event.attacker?.row) : (distance <= 1);
      if ( bond && adjacent && !(reactor.usedThisRound?.dualStrike) && target && (target.side !== reactor.side) ) {
        options.push({abilityId: "dualStrike", name: "Dual Strike", trigger: "allyAttacking", roll: null, cost: null, kinds: ["dualStrike"], priority: 2});
      }
    }
    if ( options.length ) prompts.push({reactorId: reactor.id, side: reactor.side, options});
  }
  return prompts;
}

export function priorityOf(data) {
  const kinds = (data?.effects ?? []).map(effect => effect.kind);
  if ( kinds.includes("strikeFirst") ) return 0;
  if ( kinds.includes("cancel") ) return 1;
  return 2;
}

export function orderReactions(accepted) {
  return [...accepted].sort((a, b) => (a.priority - b.priority) || ((a.order ?? 0) - (b.order ?? 0)));
}

export const perInterval = DEICIDE.reactions.perInterval;
