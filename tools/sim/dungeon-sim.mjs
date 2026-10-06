import {DEICIDE} from "../../module/config.mjs";
import {actionDelay, compareTicks, startingTicks} from "../../module/rules/delay.mjs";
import {reachableRows} from "../../module/rules/collapse.mjs";
import {attackPower, hitChance} from "../../module/rules/resolve.mjs";
import {Sim} from "./engine.mjs";
import {profileOf, rederive} from "./world.mjs";

function reachableEnemies(sim, actor, ability) {
  const profile = sim.dungeonProfile(actor, ability ?? {type: "action", war: {range: actor.weapon?.range ?? [1, 1], area: {shape: "single", size: 1}}});
  if ( profile.available === false ) return {profile, enemies: []};
  const enemies = sim.alive().filter(a => a.side !== actor.side);
  const enemyFrontEmpty = !enemies.some(a => a.row === "front");
  const ownFrontEmpty = !sim.alive(actor.side).some(a => a.row === "front");
  const rows = reachableRows(profile, actor.row, {enemyFrontEmpty, ownFrontEmpty});
  return {profile, enemies: enemies.filter(a => rows.includes(a.row) || (enemyFrontEmpty && a.row === "back" && rows.length))};
}

function areaTargets(sim, actor, profile, primary) {
  const enemies = sim.alive().filter(a => a.side !== actor.side);
  switch ( profile.target ) {
    case "row": return enemies.filter(a => a.row === primary.row);
    case "all": return enemies;
    case "column": {
      const behind = enemies.find(a => (a.row !== primary.row) && (a.id !== primary.id));
      return behind ? [primary, behind] : [primary];
    }
    default: return [primary];
  }
}

function expected(sim, actor, ability, target) {
  const params = {attacker: profileOf(actor), target: profileOf(target), weapon: actor.weapon ?? null, ability, mode: "dungeon", context: {}};
  const power = attackPower(params).attack;
  const def = ability?.attack?.defense === "res" ? target.res ?? profileOf(target).defense.res : (ability?.attack?.defense === "none" ? 0 : profileOf(target).defense.def);
  const hit = hitChance(params).chance / 100;
  return Math.max(power - def, 1) * hit * (ability?.attack?.strikes ?? 1);
}

function partyChoice(sim, actor, policies) {
  const boss = sim.alive().find(a => (a.side !== actor.side) && a.boss) ?? null;
  const bossBelowHalf = boss ? (boss.hp <= boss.hpMax * 0.5) : false;
  const allies = sim.alive(actor.side);
  const lowest = [...allies].sort((a, b) => (a.hp / a.hpMax) - (b.hp / b.hpMax))[0];
  const actions = actor.abilities.filter(a => (a.type === "action") && actor.derived.skills.available.actions.includes(a.identifier));

  const heals = actions.filter(a => a.heal);
  if ( policies.keepHealerBack && heals.length ) {
    if ( actor.row !== "back" && sim.alive(actor.side).some(a => (a.id !== actor.id) && (a.row === "front")) ) return {swapRow: true};
    if ( lowest && (lowest.hp <= lowest.hpMax * 0.5) ) {
      const heal = heals.find(h => (h.cost?.channel ?? 0) <= actor.channel) ?? null;
      if ( heal ) return {ability: heal, targets: [lowest], weight: heal.weight ?? 8};
    }
  }

  if ( policies.alchemistHarvestWhenMatterUnder4 && actor.derived.isAlchemist ) {
    const stone = policies.matterSurface ?? "stone";
    if ( (actor.matter < 4) && stone ) return {harvest: true, weight: DEICIDE.dungeonActions.harvest.weight};
  }

  let best = null;
  const candidates = [null, ...actions.filter(a => a.attack)];
  for ( const ability of candidates ) {
    if ( ability?.cost?.matter && actor.matter < ability.cost.matter ) continue;
    const channelCost = ability?.cost?.channel ?? 0;
    const affordable = channelCost <= actor.channel;
    const overcast = !affordable && policies.spendOvercastWhenBossBelowHalf && bossBelowHalf && (actor.channel > 0 || channelCost <= 4);
    if ( channelCost && !affordable && !overcast ) continue;
    if ( ability?.cost?.soulPrice && (actor.derived.soulPricePayer === "hp") && (actor.hp <= ability.cost.soulPrice + 5) ) continue;
    const {profile, enemies} = reachableEnemies(sim, actor, ability);
    if ( !enemies.length ) continue;
    const primary = policies.focusFire ? [...enemies].sort((a, b) => (a.hp ?? a.strength) - (b.hp ?? b.strength))[0] : enemies[0];
    const targets = areaTargets(sim, actor, profile, primary);
    const value = targets.reduce((sum, t) => sum + expected(sim, actor, ability, t), 0);
    if ( !best || (value > best.value) ) best = {ability, targets, value, weight: profile.weight ?? ability?.weight ?? actor.weapon?.weight ?? 8, overcast: overcast ? Math.max(channelCost - actor.channel, 0) : 0};
  }
  if ( best ) return best;

  if ( actor.row === "back" ) {
    const front = sim.alive(actor.side).filter(a => a.row === "front");
    const couldReachFromFront = candidates.some(ability => {
      const profile = sim.dungeonProfile(actor, ability ?? {type: "action", war: {range: actor.weapon?.range ?? [1, 1], area: {shape: "single", size: 1}}});
      return (profile.available !== false) && (profile.reach !== "self");
    });
    if ( couldReachFromFront && (front.length < DEICIDE.dungeon.rowCapacity) ) return {swapRow: true};
  }
  return {guard: true, weight: DEICIDE.dungeonActions.guard.weight};
}

function monsterChoice(sim, actor) {
  const moves = actor.moves.filter(m => (m.type === "action") && m.attack);
  if ( !moves.length ) return null;
  const index = (actor.actions ?? 0) % moves.length;
  let move = moves[index];
  const party = sim.alive().filter(a => a.side !== actor.side);
  const front = party.filter(a => a.row === "front");
  const reachable = front.length ? front : party;
  const primary = [...reachable].sort((a, b) => (a.hp / a.hpMax) - (b.hp / b.hpMax))[0];
  if ( !primary ) return null;
  const phaseAll = actor.phaseBreaks.some(b => b.triggered && /all/i.test(b.note ?? "")) && (move.dungeon?.target === "row");
  let targets;
  const target = phaseAll ? "all" : (move.dungeon?.target ?? "single");
  if ( target === "all" ) targets = party;
  else if ( target === "row" ) targets = party.filter(a => a.row === primary.row);
  else targets = [primary];
  return {ability: move, targets, weight: 8};
}

export function runDungeon({party, enemies, seed, policies = {}, surprise = "none", maxTicks = 4000}) {
  const sim = new Sim({seed, mode: "dungeon"});
  const ticks = startingTicks(surprise);
  for ( const actor of party ) { rederive(actor, "dungeon"); actor.side = "party"; actor.nextTick = ticks.party; actor.delayLast = null; actor.guardNext = false; actor.actions = 0; actor.firedThisEncounter = new Set(); sim.add(actor); }
  for ( const actor of enemies ) { actor.side = "enemy"; actor.nextTick = ticks.enemy; actor.delayLast = null; actor.guardNext = false; actor.actions = 0; sim.add(actor); }
  const policy = {focusFire: true, keepHealerBack: true, spendOvercastWhenBossBelowHalf: true, alchemistHarvestWhenMatterUnder4: true, ...policies};
  const metrics = {rotations: 0, bossActions: 0, ticksElapsed: 0, outcome: "running", partyActions: {}};
  let tick = 0;
  let rotationMark = new Set();
  let safety = 0;
  while ( safety++ < 2000 ) {
    const live = sim.alive();
    const partyAlive = live.filter(a => a.side === "party");
    const enemyAlive = live.filter(a => a.side === "enemy");
    if ( !partyAlive.length ) { metrics.outcome = "defeat"; break; }
    if ( !enemyAlive.length ) { metrics.outcome = "victory"; break; }
    const order = [...live].sort((a, b) => compareTicks({id: a.id, nextTick: a.nextTick, spd: profileOf(a).attributes.spd}, {id: b.id, nextTick: b.nextTick, spd: profileOf(b).attributes.spd}));
    const actor = order[0];
    if ( actor.nextTick < tick ) sim.metrics.anomalies++;
    tick = Math.max(tick, actor.nextTick);
    if ( tick > maxTicks ) { metrics.outcome = "timeout"; break; }
    sim.round = Math.floor(tick / 100) + 1;

    sim.tickStatuses(actor, {kind: "turnStart"});
    actor.reactionUsed = false;
    actor.reactionsThisRound = {};
    if ( actor.downed ) continue;
    actor.actions = (actor.actions ?? 0) + 1;
    let weight = DEICIDE.delay.defaultWeight;
    let guard = false;
    if ( actor.kind === "character" ) {
      metrics.partyActions[actor.name] = (metrics.partyActions[actor.name] ?? 0) + 1;
      if ( rotationMark.has(actor.id) ) { metrics.rotations++; rotationMark = new Set(); }
      rotationMark.add(actor.id);
      const choice = partyChoice(sim, actor, policy);
      if ( choice.swapRow ) { actor.row = actor.row === "front" ? "back" : "front"; weight = DEICIDE.dungeonActions.swapRow.weight; }
      else if ( choice.harvest ) { actor.matter = Math.min(actor.matter + (actor.derived.harvestYield ?? 2), actor.matterMax); actor.harvests = (actor.harvests ?? 0) + 1; weight = choice.weight; }
      else if ( choice.guard ) { guard = true; weight = choice.weight; sim.applyStatus(actor, "guard"); }
      else {
        sim.useAbility({actor, ability: choice.ability, targets: choice.targets, policy: {overcast: choice.overcast ?? 0}});
        weight = choice.weight;
      }
    }
    else {
      if ( actor.boss ) metrics.bossActions++;
      const choice = monsterChoice(sim, actor);
      if ( choice ) sim.useAbility({actor, ability: choice.ability, targets: choice.targets});
      weight = 8;
    }

    for ( const boss of sim.alive("enemy").filter(a => a.kind === "monster") ) {
      for ( const entry of boss.phaseBreaks ) {
        if ( !entry.triggered && (boss.hp <= boss.hpMax * entry.percent / 100) ) entry.triggered = true;
      }
    }

    const profile = profileOf(actor);
    const fixed = actor.kind === "monster" ? actor.fixedDelay : null;
    let penalty = actor.derived?.delayPenalty ?? 0;
    if ( actor.statuses.has("stagger") ) penalty += DEICIDE.delay.staggerPenalty;
    const delay = actionDelay({weight, spd: profile.attributes.spd, penalty, halved: actor.guardNext, fixed});
    actor.guardNext = guard;
    if ( !guard && actor.statuses.has("guard") ) actor.statuses.delete("guard");
    actor.delayLast = delay;
    actor.nextTick = tick + delay;
    if ( actor.nextTick < tick ) sim.metrics.anomalies++;
  }
  metrics.ticksElapsed = tick;
  const partyHp = party.reduce((sum, a) => sum + Math.max(a.hp, 0), 0);
  const partyMax = party.reduce((sum, a) => sum + a.hpMax, 0);
  return {
    ...metrics,
    seed,
    partyHpPercent: Math.round((partyHp / Math.max(partyMax, 1)) * 100),
    damageBy: Object.fromEntries(party.map(a => [a.name, sim.metrics.damageBy[a.id] ?? 0])),
    enemyDamage: enemies.reduce((sum, e) => sum + (sim.metrics.damageBy[e.id] ?? 0), 0),
    enemyActions: enemies.reduce((sum, e) => sum + (e.actions ?? 0), 0),
    overcast: Object.fromEntries(party.map(a => [a.name, a.overcastPoints ?? 0])),
    burn: Object.fromEntries(party.map(a => [a.name, a.burn ?? 0])),
    harvests: Object.fromEntries(party.map(a => [a.name, a.harvests ?? 0])),
    soulPriceHp: Object.fromEntries(party.map(a => [a.name, a.soulPriceHp ?? 0])),
    reactions: sim.metrics.reactions,
    dualStrikes: sim.metrics.dualStrikes,
    downed: sim.metrics.downed,
    anomalies: sim.metrics.anomalies,
    cards: sim.metrics.cards
  };
}
