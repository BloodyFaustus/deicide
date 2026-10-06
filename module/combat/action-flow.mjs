import {DEICIDE, SYSTEM_ID} from "../config.mjs";
import {Pipeline} from "../core/pipeline.mjs";
import {rollUnder} from "../core/random.mjs";
import {test} from "../core/predicate.mjs";
import {fromSource} from "../core/modifiers.mjs";
import {
  BASIC_ATTACK, absorb, critChance, critMultiplier, damage, describeAction, healAmount, hitChance, payChannel, soulPrice, strikeCount
} from "../rules/resolve.mjs";
import {companyDamage, companyHit} from "../rules/company.mjs";
import {dungeonProfile} from "../rules/collapse.mjs";
import {formatGraded} from "../rules/grades.mjs";
import {resolveEffects, describeEffects} from "../rules/effects.mjs";
import {eligibleReactions, orderReactions} from "../rules/reactions.mjs";
import {commandTargets} from "../rules/commands.mjs";
import {sceneMode} from "../hooks/scene-mode.mjs";
import {applyStatus, trackWarded} from "./statuses.mjs";
import {promptReactions} from "./reaction-prompt.mjs";
import {applyOutcomes} from "./effects-apply.mjs";
import {fieldSnapshot, groupsFor, distance} from "./field.mjs";

async function rollD100(flavor) {
  const roll = await new Roll("1d100").evaluate();
  roll.options.flavor = flavor;
  return roll;
}

function profileOf(target) {
  const actor = target?.actor ?? target;
  return actor?.profile ?? actor?.system?.profile ?? null;
}

const INTERNAL = new Set(["cancel", "strikeFirst", "redirect", "absorb", "counter", "extraStrike", "aura", "soulPriceCatalyst", "unknown"]);

const IMMEDIATE = new Set(["reveal", "nationTrack", "standing", "summon", "terrain", "barrier", "flag", "refundAction", "grantAction"]);

async function stepGather(state) {
  const {actor} = state;
  state.mode = sceneMode();
  state.engine = DEICIDE.modes[state.mode]?.engine ?? "war";
  state.derived = {modifiers: [], immunities: [], flags: {}, ...actor.derived};
  state.attacker = actor.profile;
  state.ability = state.abilityId ? (actor.lookup("ability", state.abilityId) ?? null) : null;
  if ( state.abilityId && !state.ability ) throw new Error(`Unknown ability "${state.abilityId}"`);
  const equipment = actor.system.equipment ?? {};
  state.weapon = equipment.weapon ?? null;
  state.offhand = equipment.offhand ?? null;
  const source = state.ability?.attack?.source ?? (state.ability ? "none" : "weapon");

  if ( (source === "weapon") && state.weapon?.caster ) state.weapon = equipment.offhand?.line && !equipment.offhand.caster ? equipment.offhand : null;
  state.combat = game.combat?.started ? game.combat : null;
  state.combatant = state.combat?.combatantFor(actor) ?? null;
  state.targets = (state.targets ?? []).map(target => {
    const targetActor = target.actor ?? target;
    return {actor: targetActor, token: target.document ?? target.token ?? null, profile: profileOf(target), name: targetActor?.name ?? "?"};
  }).filter(entry => entry.profile);
  state.result = {
    kind: state.ability ? (state.ability.type === "command" ? "command" : state.ability.heal ? "heal" : state.ability.attack ? "attack" : "use") : "attack",
    lines: [], targets: [], costs: {}, notes: [], reactions: [], outcomes: [], extra: []
  };
  state.rolls ??= [];
}

async function stepCheck(state) {
  const {ability, engine} = state;
  if ( !ability ) {
    if ( !state.weapon || state.weapon.caster ) { state.result.notes.push("noWeapon"); }
    return;
  }
  const typeConfig = DEICIDE.skillTypes[ability.type];
  if ( !typeConfig?.engines.includes(engine) ) {
    ui.notifications?.warn(`${ability.name} cannot be used in ${engine === "war" ? "War" : "Dungeon"} Mode.`);
    return false;
  }
  if ( engine === "dungeon" ) {
    const profile = dungeonProfile(ability, {weapon: state.weapon, mag: state.attacker.attributes.mag});
    state.dungeonProfile = profile;
    if ( profile.available === false ) { ui.notifications?.warn(`${ability.name} has no Dungeon profile.`); return false; }
    if ( profile.requiresArena && (state.mode !== "arena") ) { ui.notifications?.warn(`${ability.name} needs an Arena.`); return false; }
  }
  if ( ability.usage?.limit && (ability.usage.used >= ability.usage.limit) ) {
    ui.notifications?.warn(`${ability.name} is spent for this ${ability.usage.per}.`);
    return false;
  }
  if ( ability.type === "stance" ) {
    await game.deicide.stances.toggle(state.actor, ability.identifier);
    return false;
  }
}

async function stepCosts(state) {
  const {actor, ability, derived} = state;
  const costs = state.result.costs;
  const updates = {};
  if ( !ability ) return;
  const cost = ability.cost ?? {};
  const options = state.options ?? {};
  const conditions = {engine: state.engine, mode: state.mode, subject: state.attacker, action: describeAction(ability, state.weapon), firstThisEncounter: !(state.combatant?.system.firedThisEncounter ?? []).includes(ability.identifier)};
  const costMods = key => derived.modifiers.filter(m => (m.key === key) && test(m.when, conditions));

  if ( cost.channel ) {
    const channel = actor.system.channel;
    if ( derived.noChannel ) { ui.notifications?.warn(`${actor.name} has no Channel.`); return false; }
    const reduce = costMods("cost.channel").reduce((sum, m) => sum + Number(m.value), 0);
    const paid = payChannel({
      cost: Math.max(cost.channel + reduce + (options.extraChannel ?? 0), 0), channel: channel.value, burnPerPoint: derived.overcastBurnPerPoint,
      immune: derived.modifiers.some(m => m.key === "overcast.immune"),
      multiplier: derived.modifiers.find(m => m.key === "overcast.multiplier")?.value ?? 1
    });
    costs.channel = paid;
    updates["system.channel.value"] = paid.channel;
    if ( paid.overcast && state.derived.flags?.overcastMight ) state.overcastMight = paid.overcast * state.derived.flags.overcastMight;
  }
  if ( cost.matter ) {
    const matter = actor.system.matter;
    let matterCost = options.freeMatter ? 0 : cost.matter;
    const setMods = costMods("cost.matter").filter(m => m.op === "set");
    if ( setMods.length ) matterCost = Math.min(...setMods.map(m => Number(m.value)));
    if ( matter.value < matterCost ) { ui.notifications?.warn(`${actor.name} needs ${matterCost} Matter.`); return false; }
    costs.matter = matterCost;
    updates["system.matter.value"] = matter.value - matterCost;
  }
  if ( cost.hp ) {
    let hpCost = cost.hp;
    for ( const m of costMods("cost.hp") ) {
      if ( m.op === "mul" ) hpCost = Math.floor(hpCost * Number(m.value));
      else if ( m.op === "set" ) hpCost = Number(m.value);
      else hpCost += Number(m.value);
    }
    costs.hp = Math.max(hpCost, 0);
    updates["system.hp.value"] = Math.max(actor.system.hp.value - costs.hp, 0);
  }
  if ( cost.dust ) {
    if ( actor.system.dust < cost.dust ) { ui.notifications?.warn(`${actor.name} needs ${cost.dust} Dust.`); return false; }
    costs.dust = cost.dust;
    updates["system.dust"] = actor.system.dust - cost.dust;
  }
  if ( cost.soulPrice ) {
    const multiplier = derived.modifiers.find(m => m.key === "soulPrice.multiplier")?.value ?? 1;
    const reduction = derived.modifiers.filter(m => m.key === "soulPrice").reduce((sum, m) => sum - Number(m.value), 0);
    const price = soulPrice({price: cost.soulPrice, payer: derived.soulPricePayer, catalyst: options.catalyst ?? null, reduction, multiplier});
    costs.soulPrice = price;
    if ( price.hp ) updates["system.hp.value"] = Math.max((updates["system.hp.value"] ?? actor.system.hp.value) - price.hp, 0);
    if ( price.channel ) updates["system.channel.value"] = Math.max((updates["system.channel.value"] ?? actor.system.channel.value) - price.channel, 0);
    state.catalyst = price.catalyst;
  }
  if ( options.staticSpent ) {
    costs.static = options.staticSpent;
    updates["system.static"] = Math.max(actor.system.static - options.staticSpent, 0);
  }
  if ( Object.keys(updates).length ) await actor.update(updates);
  if ( costs.channel?.burn ) {
    await actor.applyDamage(costs.channel.burn);
    state.result.notes.push("overcastBurn");
  }
  if ( ability.usage?.limit ) {
    const item = actor.items.find(i => (i.type === "ability") && (i.system.identifier === ability.identifier));
    if ( item ) await item.update({"system.usage.used": ability.usage.used + 1});
  }
}

async function stepSnapshot(state) {
  const {actor, ability, weapon, combat} = state;
  state.field = fieldSnapshot(combat);
  state.me = state.field?.byActor.get(actor.id) ?? null;
  state.groups = groupsFor(actor, state.field, {radius: ability?.war?.area?.size ?? 1});
  const action = describeAction(ability, weapon);
  state.action = {
    ...action, tags: Array.from(action.tags),
    type: ability?.type ?? "action",
    area: ability?.war?.area ?? {shape: "single", size: 1},
    range: ability?.war?.range ?? weapon?.range ?? [1, 1],
    weight: state.dungeonProfile?.weight ?? ability?.weight ?? null
  };
  state.targetModifiers = {};
  state.extraStrikes = [];
  state.absorbs = {};
  state.survivors = new Set();

  if ( ability?.type === "command" ) {
    const unitOf = c => state.field?.units.find(u => u.id === c.id);
    const officer = state.me ?? {id: actor.id, side: "party", x: 0, y: 0, commandRadius: state.derived.commandRadius ?? 0};
    const chosen = state.targets[0]?.actor ? state.field?.byActor.get(state.targets[0].actor.id)?.id ?? null : null;
    const snapshot = {units: (state.field?.units ?? []).map(u => ({...u, commandRadius: u.commandRadius}))};
    let units = commandTargets({...ability.command, radius: ability.command.radius ?? state.derived.commandRadius}, snapshot, {...officer, commandRadius: ability.command.radius ?? state.derived.commandRadius}, {chosenId: chosen});
    if ( ability.command.target === "oneEnemyCompany" ) {
      units = (state.field?.units ?? []).filter(u => (u.kind === "company") && (u.side !== officer.side) && !u.defeated && (distance(u, officer, "war") <= (ability.command.radius ?? 99)));
      if ( chosen ) units = units.filter(u => u.id === chosen);
      else units = units.slice(0, 1);
    }
    if ( ability.command.includeRouted ) {
      const routed = (state.field?.units ?? []).filter(u => (u.kind === "company") && (u.side === officer.side) && u.defeated);
      if ( chosen ) units = routed.filter(u => u.id === chosen);
      else if ( !units.length ) units = routed.slice(0, 1);
    }
    state.targets = units.map(unit => {
      const combatant = combat?.combatants.get(unit.id);
      const targetActor = combatant?.actor;
      return targetActor ? {actor: targetActor, token: combatant.token ?? null, profile: targetActor.profile, name: targetActor.name, unit} : null;
    }).filter(Boolean);
    state.groups.companies = state.targets.map(t => t.actor.uuid);
    void unitOf;
  }
}

function collectReactors(state) {
  const {combat, field, actor} = state;
  if ( !combat || !field ) return [];
  const reactors = [];
  for ( const combatant of combat.combatants ) {
    const other = combatant.actor;
    if ( !other || combatant.isDefeated || (other.type === "company") ) continue;
    const unit = field.units.find(u => u.id === combatant.id);
    if ( !unit ) continue;
    const lookup = other.lookup;
    const reactionIds = other.type === "character"
      ? (other.derived?.skills?.available?.reactions ?? [])
      : other.items.filter(item => (item.type === "ability") && (item.system.type === "reaction")).map(item => item.system.identifier);
    const reactions = reactionIds.map(id => {
      const data = other.type === "character" ? lookup("ability", id) : other.items.find(item => item.system.identifier === id)?.system;
      return data ? {id, name: data.name, data} : null;
    }).filter(Boolean);
    const pairs = field.pairs.filter(pair => (pair.a === unit.id) || (pair.b === unit.id));
    reactors.push({
      id: combatant.id, actorUuid: other.uuid, actorId: other.id, name: other.name, side: unit.side, x: unit.x, y: unit.y, row: unit.row,
      profile: other.profile, reactions, used: Boolean(combatant.system.reactionUsed), usedThisRound: combatant.system.reactionsThisRound ?? {},
      tilesMoved: unit.tilesMoved,
      bonds: pairs.map(pair => ({partnerId: pair.a === unit.id ? pair.b : pair.a, rank: pair.rank.id})),
      combatant, actor: other
    });
  }
  return reactors.filter(reactor => reactor.id !== state.combatant?.id);
}

function reactionEvent(state, phase) {
  const me = state.me ?? {id: state.combatant?.id ?? actorKey(state.actor), side: "party"};
  return {
    phase, engine: state.engine, mode: state.mode, round: state.combat?.round ?? 1, flank: Boolean(state.options?.flank),
    attacker: {id: me.id, side: me.side, x: me.x, y: me.y, row: me.row, profile: state.attacker, tilesMoved: me.tilesMoved ?? 0, mounted: Boolean(me.mounted)},
    action: state.action,
    targets: state.targets.map(target => {
      const unit = state.field?.byActor.get(target.actor?.id);
      const entry = state.result.targets.find(e => e.actorUuid === target.actor?.uuid);
      return {
        id: unit?.id ?? target.actor?.uuid, side: unit?.side ?? "enemy", x: unit?.x, y: unit?.y, row: unit?.row, profile: target.profile,
        hit: entry?.anyHit ?? false, crit: entry?.anyCrit ?? false, damage: entry?.total ?? 0,
        downed: entry ? (entry.total >= (target.actor?.system?.hp?.value ?? Infinity)) : false,
        lethal: entry ? (entry.total >= (target.actor?.system?.hp?.value ?? Infinity)) : false
      };
    })
  };
}

const actorKey = actor => actor?.uuid ?? actor?.id ?? "?";

async function runReactions(state, phase) {
  if ( !state.combat || !state.targets.length ) return;
  if ( state.ability?.type === "command" && phase === "after" ) return;
  const reactors = collectReactors(state);
  const prompts = eligibleReactions({event: reactionEvent(state, phase), reactors});
  if ( !prompts.length ) return;
  const byId = new Map(reactors.map(r => [r.id, r]));
  const answers = await promptReactions(prompts.map(prompt => ({
    ...prompt, reactorName: byId.get(prompt.reactorId)?.name ?? "?", actorUuid: byId.get(prompt.reactorId)?.actorUuid ?? null,
    options: prompt.options.map(option => ({...option, summary: byId.get(prompt.reactorId)?.reactions.find(r => r.id === option.abilityId)?.data.summary ?? ""}))
  })), {context: {attackerName: state.actor.name, abilityName: state.ability?.name ?? "Attack"}});
  const accepted = [];
  for ( const answer of answers ) {
    const prompt = prompts.find(p => p.reactorId === answer.reactorId);
    answer.accepted.forEach((abilityId, order) => {
      const option = prompt?.options.find(o => o.abilityId === abilityId);
      if ( option ) accepted.push({reactorId: answer.reactorId, abilityId, priority: option.priority, order, option});
    });
  }
  for ( const entry of orderReactions(accepted) ) {
    const reactor = byId.get(entry.reactorId);
    if ( !reactor ) continue;
    await resolveReaction(state, reactor, entry, phase);
    if ( state.cancelled ) break;
  }
}

async function resolveReaction(state, reactor, entry, phase) {
  const {option} = entry;
  const line = {reactor: reactor.name, reactorUuid: reactor.actorUuid, abilityId: entry.abilityId, name: option.name, phase, roll: null, success: true, notes: []};
  state.result.reactions.push(line);
  const markUsed = async () => {
    const counts = {...(reactor.combatant.system.reactionsThisRound ?? {})};
    counts[entry.abilityId] = (counts[entry.abilityId] ?? 0) + 1;
    await reactor.combatant.update({"system.reactionUsed": entry.abilityId !== "dualStrike", "system.reactionsThisRound": counts});
  };

  if ( entry.abilityId === "dualStrike" ) {
    const target = state.targets[0];
    if ( target ) {
      const sub = await resolveSubAttack(state, reactor.actor, target, {mightBonus: DEICIDE.bonds.dualStrikeMight, label: "Dual Strike"});
      line.notes.push(`${sub.total} damage`);
      state.result.extra.push(sub);
    }
    await markUsed();
    return;
  }

  const data = reactor.reactions.find(r => r.id === entry.abilityId)?.data;
  if ( !data ) return;
  const block = data.reaction ?? {};

  if ( block.cost?.channel ) {
    const paid = payChannel({cost: block.cost.channel, channel: reactor.actor.system.channel?.value ?? 0, burnPerPoint: reactor.actor.derived?.overcastBurnPerPoint ?? 2});
    await reactor.actor.update({"system.channel.value": paid.channel});
    if ( paid.burn ) await reactor.actor.applyDamage(paid.burn);
    line.notes.push(`${block.cost.channel} Channel`);
  }
  if ( block.cost?.matter ) {
    await reactor.actor.update({"system.matter.value": Math.max((reactor.actor.system.matter?.value ?? 0) - block.cost.matter, 0)});
    line.notes.push(`${block.cost.matter} Matter`);
  }

  if ( option.roll !== null && option.roll !== undefined ) {
    const roll = await rollD100(`${option.name} (under ${option.roll})`);
    state.rolls.push(roll);
    line.roll = roll.total;
    line.threshold = option.roll;
    line.success = rollUnder(roll.total, option.roll);
    if ( !line.success ) { await markUsed(); return; }
  }
  await markUsed();

  const isTarget = state.targets.some(t => t.actor?.id === reactor.actorId);
  const reactionMods = fromSource(data.modifiers ?? [], data.identifier, data.name);
  if ( reactionMods.length ) {
    const key = reactor.actorUuid;
    (state.targetModifiers[key] ??= []).push(...reactionMods);
    if ( !isTarget ) {

    }
  }

  const target = state.targets[0];
  const targetUnit = target ? state.field?.byActor.get(target.actor?.id) : null;
  const ctx = {
    actor: {id: reactor.actorUuid, profile: reactor.profile},
    attacker: {id: state.actor.uuid, profile: state.attacker},
    targets: state.targets.map(t => ({id: t.actor.uuid, profile: t.profile, hit: true, crit: false})),
    engine: state.engine, mode: state.mode, action: state.action, damage: state.result.targets.find(e => e.actorUuid === reactor.actorUuid)?.total ?? state.result.targets[0]?.total ?? 0,
    scope: {casterMag: state.attacker.attributes?.mag ?? 0, allyChannel: target?.actor?.system?.channel?.value ?? 0},
    situation: {trigger: option.trigger, distance: state.me && reactor ? distance(reactor, state.me, state.engine) : 0, selfTilesMoved: reactor.tilesMoved},
    sourceId: data.identifier, groups: state.groups
  };

  const outcomes = resolveEffects(data.effects ?? [], ctx);
  for ( const outcome of outcomes ) {
    switch ( outcome.type ) {
      case "cancel":
        if ( outcome.effect?.when && !test(outcome.effect.when, {...ctx.situation, action: state.action, engine: state.engine}) ) break;
        state.cancelled = {by: reactor.name, ability: data.name, what: outcome.what};
        line.notes.push("cancelled");
        if ( outcome.what === "triggeringAction" && state.ability ) {

        }
        break;
      case "strikeFirst": {
        const sub = await resolveSubAttack(state, reactor.actor, {actor: state.actor, profile: state.attacker, name: state.actor.name}, {label: `${data.name} (strikes first)`});
        state.result.extra.push(sub);
        line.notes.push(`strikes first for ${sub.total}`);
        if ( sub.total >= (state.actor.system.hp?.value ?? Infinity) ) {
          state.cancelled = {by: reactor.name, ability: data.name, what: "attackerDowned"};
        }
        break;
      }
      case "redirect": {
        if ( outcome.to === "self" ) {
          const original = state.targets.map(t => t.name).join(", ");
          state.targets = [{actor: reactor.actor, token: reactor.combatant.token ?? null, profile: reactor.profile, name: reactor.name, redirectedFrom: original}];
          line.notes.push(`takes the hit for ${original}`);
        }
        else if ( outcome.to === "attacker" ) {
          state.targets = [{actor: state.actor, token: state.combatant?.token ?? null, profile: state.attacker, name: state.actor.name, redirectedFrom: reactor.name}];
          line.notes.push("the attack turns on its source");
        }
        else if ( outcome.to === "adjacentCompany" ) {
          const company = (state.field?.units ?? []).find(u => (u.kind === "company") && (u.side === reactor.side) && !u.defeated && (distance(u, reactor, state.engine) <= 1));
          const companyActor = company ? state.combat.combatants.get(company.id)?.actor : null;
          if ( companyActor ) {
            state.targets = [{actor: companyActor, token: null, profile: companyActor.profile, name: companyActor.name, redirectedFrom: reactor.name}];
            line.notes.push(`${companyActor.name} takes it as Strength loss`);
          }
          else line.notes.push("no adjacent company");
        }
        break;
      }
      case "absorb":
        for ( const id of outcome.targets ) state.absorbs[id] = (state.absorbs[id] ?? 0) + outcome.amount;
        line.notes.push(`absorbs ${outcome.amount}`);
        break;
      case "counter": {
        const sub = await resolveSubAttack(state, reactor.actor, {actor: state.actor, profile: state.attacker, name: state.actor.name}, {mightBonus: outcome.might ?? 0, abilityId: outcome.abilityId, label: `${data.name} (counter)`});
        state.result.extra.push(sub);
        line.notes.push(`counters for ${sub.total}`);
        break;
      }
      case "survive":
        for ( const id of outcome.targets ) state.survivors.add(id);
        line.notes.push(`survives at ${outcome.hp}`);
        break;
      case "pool":
        if ( (outcome.key === "stolen") && (outcome.delta === "+ability") ) {
          await applyOutcomes([{...outcome, abilityId: state.ability?.identifier ?? null, casterMag: state.attacker.attributes?.mag ?? 0}], {actor: reactor.actor, combat: state.combat, notes: line.notes});
        }
        else await applyOutcomes([outcome], {actor: reactor.actor, combat: state.combat, notes: line.notes});
        break;
      case "move":
        await applyOutcomes([outcome], {actor: reactor.actor, combat: state.combat, notes: line.notes});
        break;
      default:
        if ( !INTERNAL.has(outcome.type) ) await applyOutcomes([outcome], {actor: reactor.actor, combat: state.combat, notes: line.notes});
        break;
    }
  }

  if ( (phase === "after") && reactionMods.length ) recomputeTarget(state, reactor.actorUuid);
}

async function resolveSubAttack(state, attacker, target, {mightBonus = 0, abilityId = null, label = ""} = {}) {
  const ability = abilityId ? attacker.lookup("ability", abilityId) : null;
  const equipment = attacker.system.equipment ?? {};
  let weapon = equipment.weapon ?? null;
  if ( weapon?.caster && !ability ) weapon = equipment.offhand?.line && !equipment.offhand.caster ? equipment.offhand : null;
  const params = {attacker: attacker.profile, target: target.profile, weapon, ability, mode: state.mode, context: {mightBonus}};
  const hit = hitChance(params);
  const crit = critChance(params);
  const result = damage(params);
  const hitRoll = await rollD100(`${label} Hit`);
  const didHit = rollUnder(hitRoll.total, hit.chance);
  let critRoll = null;
  let didCrit = false;
  if ( didHit && (crit.chance > 0) ) {
    critRoll = await rollD100(`${label} Crit`);
    didCrit = rollUnder(critRoll.total, crit.chance);
  }
  state.rolls.push(...[hitRoll, critRoll].filter(Boolean));
  const dealt = didHit ? (didCrit ? result.critTotal : result.total) : 0;
  return {
    label, attacker: attacker.name, attackerUuid: attacker.uuid, name: target.name, actorUuid: target.actor?.uuid ?? null,
    hit, crit, damage: result, strikes: [{hitRoll: hitRoll.total, hit: didHit, critRoll: critRoll?.total ?? null, crit: didCrit, damage: dealt}],
    total: dealt, anyHit: didHit, anyCrit: didCrit, statuses: [], outcomes: []
  };
}

function targetProfileWithReactions(state, target) {
  const extra = state.targetModifiers[target.actor?.uuid] ?? [];
  if ( !extra.length ) return target.profile;
  const profile = {...target.profile, modifiers: [...(target.profile.modifiers ?? []), ...extra], defense: {...target.profile.defense}};
  const sum = key => extra.filter(m => (m.key === key) && ((m.op ?? "add") === "add")).reduce((s, m) => s + Number(m.value), 0);
  profile.defense.def = (profile.defense.def ?? 0) + sum("defense.def");
  profile.defense.res = (profile.defense.res ?? 0) + sum("defense.res");
  profile.defense.avoid = (profile.defense.avoid ?? 0) + sum("avoid");
  return profile;
}

function baseContext(state) {
  const options = state.options ?? {};
  const bond = state.derived.bond ?? {};
  return {
    flank: Boolean(options.flank), backRow: state.combatant?.system.row === "back", highGround: Boolean(options.highGround),
    terrainAvoid: options.terrainAvoid ?? 0, tilesMoved: state.combatant?.system.tilesMoved ?? 0,
    staticSpent: options.staticSpent ?? 0, overcastMight: state.overcastMight ?? 0, catalyst: state.catalyst ?? null,
    marked: Boolean(options.marked), bondMight: options.bondMight ?? 0, mightBonus: options.mightBonus ?? 0,
    bondRank: bond.rank ?? null, firstThisEncounter: !(state.combatant?.system.firedThisEncounter ?? []).includes(state.ability?.identifier ?? "attack"),
    round: state.combat?.round ?? 1
  };
}

async function stepReactionsBefore(state) {
  await runReactions(state, "before");
  if ( state.cancelled ) {
    state.result.notes.push("cancelled");
    state.result.cancelled = state.cancelled;
  }
}

async function stepResolve(state) {
  const {attacker, ability, weapon, mode, targets} = state;
  if ( state.cancelled ) return;
  const options = state.options ?? {};
  const context = baseContext(state);
  const isAttack = ability ? Boolean(ability.attack) : Boolean(weapon && !weapon.caster);
  const isHeal = Boolean(ability?.heal);
  const healerMods = (state.derived.modifiers ?? []);

  for ( const target of targets ) {
    const profile = targetProfileWithReactions(state, target);
    const targetContext = {...context, targetWeaponProf: target.actor?.system?.equipment?.weapon?.prof ?? null, terrainAvoid: options.terrainAvoid ?? target.terrainAvoid ?? 0};
    const entry = {name: target.name, actorUuid: target.actor?.uuid ?? null, tokenId: target.token?.id ?? null, strikes: [], statuses: [], outcomes: [], redirectedFrom: target.redirectedFrom ?? null};
    if ( isHeal ) {
      const healContext = {target: profile, targetHpBelow: undefined};
      const heal = healAmount({formula: ability.heal.formula, healer: attacker, weapon: weapon?.healBonus ? weapon : null, context: {...healContext, action: state.action}});
      entry.heal = heal;
      void healerMods;
    }
    if ( isAttack ) {
      const params = {attacker, target: profile, weapon, ability, mode, context: targetContext};
      const hit = hitChance(params);
      const crit = critChance(params);
      const result = damage(params);
      entry.hit = hit;
      entry.crit = crit;
      entry.damage = result;
      entry.params = {targetContext};
      const count = strikeCount(params);
      let total = 0;
      for ( let i = 0; i < count; i++ ) {
        const autoHit = Boolean(ability?.attack?.autoHit);
        const hitRoll = autoHit ? null : await rollD100("Hit");
        const didHit = autoHit || rollUnder(hitRoll.total, hit.chance);
        let critRoll = null;
        let didCrit = false;
        if ( didHit ) {
          const autoCrit = Boolean(options.autoCrit) || Boolean(ability?.attack?.autoCritWhen && options.flank) || (crit.chance >= 100);
          if ( autoCrit ) didCrit = true;
          else if ( crit.chance > 0 ) {
            critRoll = await rollD100("Crit");
            didCrit = rollUnder(critRoll.total, crit.chance);
          }
        }
        const dealt = didHit ? (didCrit ? result.critTotal : result.total) : 0;
        total += dealt;
        entry.strikes.push({hitRoll: hitRoll?.total ?? null, hit: didHit, critRoll: critRoll?.total ?? null, crit: didCrit, damage: dealt});
        state.rolls.push(...[hitRoll, critRoll].filter(Boolean));
      }
      entry.total = total;
      entry.anyHit = entry.strikes.some(strike => strike.hit);
      entry.anyCrit = entry.strikes.some(strike => strike.crit);
    }
    for ( const status of ability?.statuses ?? [] ) {
      if ( status.onCrit && !entry.anyCrit ) continue;
      if ( isAttack && !entry.anyHit && (status.target !== "self") ) continue;
      entry.statuses.push(status);
    }
    state.result.targets.push(entry);
  }
  if ( !targets.length && ability?.statuses?.some(status => status.target === "self") ) {
    state.result.targets.push({name: state.actor.name, actorUuid: state.actor.uuid, self: true, strikes: [], statuses: ability.statuses.filter(status => status.target === "self"), outcomes: []});
  }
}

function recomputeTarget(state, actorUuid) {
  const entry = state.result.targets.find(e => e.actorUuid === actorUuid);
  const target = state.targets.find(t => t.actor?.uuid === actorUuid);
  if ( !entry?.damage || !target ) return;
  const profile = targetProfileWithReactions(state, target);
  const result = damage({attacker: state.attacker, target: profile, weapon: state.weapon, ability: state.ability, mode: state.mode, context: entry.params?.targetContext ?? baseContext(state)});
  entry.damage = result;
  let total = 0;
  for ( const strike of entry.strikes ) {
    strike.damage = strike.hit ? (strike.crit ? result.critTotal : result.total) : 0;
    total += strike.damage;
  }
  entry.total = total;
  entry.reduced = true;
}

async function stepReactionsAfter(state) {
  if ( state.cancelled ) return;
  await runReactions(state, "after");

  for ( const entry of state.result.targets ) {
    const absorbed = state.absorbs[entry.actorUuid] ?? 0;
    if ( absorbed && entry.total ) {
      const kept = Math.max(entry.total - absorbed, 0);
      entry.absorbed = entry.total - kept;
      entry.total = kept;
    }
    if ( state.survivors.has(entry.actorUuid) ) entry.survive = true;
  }
}

async function stepEffects(state) {
  if ( state.cancelled ) return;
  const {actor, ability} = state;
  const lookup = actor.lookup;
  const effects = [...(ability?.effects ?? []), ...((ability?.type === "command") ? (ability.command?.effects ?? []) : [])];
  const passiveIds = actor.derived?.skills?.active ?? [];
  for ( const id of passiveIds ) {
    const data = lookup("ability", id);
    for ( const effect of data?.effects ?? [] ) {
      if ( effect.trigger === "ownAttack" ) effects.push({...effect, _source: id});
    }
  }

  const isAttack = state.result.targets.some(entry => entry.damage);
  const relevant = effects.filter(effect => (effect.trigger !== "ownAttack") || isAttack);
  if ( !relevant.length ) return;
  const ctxTargets = state.result.targets.filter(entry => entry.actorUuid && !entry.self).map(entry => ({
    id: entry.actorUuid, profile: state.targets.find(t => t.actor?.uuid === entry.actorUuid)?.profile ?? null, hit: entry.anyHit ?? true, crit: entry.anyCrit ?? false, damage: entry.total ?? 0
  }));
  const damageTotal = state.result.targets.reduce((sum, entry) => sum + (entry.total ?? 0), 0);
  const ctx = {
    actor: {id: actor.uuid, profile: state.attacker}, targets: ctxTargets, attacker: null, engine: state.engine, mode: state.mode,
    action: state.action, groups: state.groups, damage: damageTotal,
    scope: {damage: damageTotal, saturation: actor.system.saturation ?? 0},
    situation: {...baseContext(state), flank: Boolean(state.options?.flank)}, sourceId: ability?.identifier ?? "attack", events: state.events ?? []
  };
  const outcomes = resolveEffects(relevant, ctx);
  for ( const outcome of outcomes ) {
    if ( outcome.type === "extraStrike" ) {
      const sidearm = state.offhand?.line && !state.offhand.caster ? state.offhand : null;
      if ( !sidearm ) continue;
      for ( const target of state.targets ) {
        const sub = await resolveSubAttack(state, actor, target, {mightBonus: outcome.might, label: "Sidearm"});
        sub.weaponOverride = sidearm;
        state.result.extra.push(sub);
      }
      continue;
    }
    if ( INTERNAL.has(outcome.type) ) continue;
    const selfOnly = outcome.targets.length && outcome.targets.every(id => id === actor.uuid);
    if ( IMMEDIATE.has(outcome.type) || (selfOnly && ["pool", "heal", "applyStatus", "removeStatus", "flag"].includes(outcome.type)) || !outcome.targets.length ) {
      await applyOutcomes([outcome], {actor, combat: state.combat, notes: state.result.notes});
      state.result.outcomes.push({...outcome, applied: true, text: describeEffects([outcome.effect])[0]});
      continue;
    }

    for ( const id of outcome.targets ) {
      const entry = state.result.targets.find(e => e.actorUuid === id);
      const single = {...outcome, targets: [id], entries: outcome.entries?.filter(e => e.id === id)};
      if ( entry ) entry.outcomes.push({...single, text: describeEffects([outcome.effect])[0]});
      else state.result.outcomes.push({...single, text: describeEffects([outcome.effect])[0]});
    }
  }

  if ( ability?.type === "command" ) {
    for ( const entry of state.result.targets ) {
      await applyOutcomes(entry.outcomes.filter(o => !o.applied), {actor, combat: state.combat, notes: state.result.notes});
      entry.outcomes = entry.outcomes.map(o => ({...o, applied: true}));
    }
  }
}

async function stepCard(state) {
  const {actor, ability, weapon, attacker, result} = state;
  const abbr = id => DEICIDE.attributes[id].abbr;
  const grade = (id, value) => formatGraded(abbr(id), value);
  const context = {
    actor, ability, weapon,
    abilityName: ability?.name ?? (weapon ? `Attack (${weapon.name})` : "Attack"),
    automation: ability?.automation ?? "full",
    description: ability?.summary ?? "",
    mode: state.mode,
    costs: result.costs,
    notes: result.notes,
    cancelled: result.cancelled ?? null,
    reactions: result.reactions,
    extra: result.extra.map(sub => ({...sub, parts: sub.damage?.parts?.map(part => ({...part, label: labelPart(part, attacker)})) ?? []})),
    outcomes: result.outcomes,
    attributes: Object.entries(attacker.attributes)
      .filter(([, value]) => (attacker.kind === "character") || (value > 0))
      .map(([id, value]) => grade(id, value)),
    targets: result.targets.map(entry => ({
      ...entry,
      parts: entry.damage?.parts?.map(part => ({...part, label: labelPart(part, attacker)})) ?? [],
      multipliers: entry.damage?.multipliers ?? [],
      typeLabel: entry.damage?.label ?? "",
      isTruth: entry.damage?.isTruth ?? false,
      defenseLabel: entry.damage ? `${entry.damage.defenseId === "none" ? "ignores defense" : `${entry.damage.defenseId.replace("lower.", "").toUpperCase()} ${entry.damage.defense}`}` : ""
    })),
    weight: state.dungeonProfile?.weight ?? ability?.weight ?? (state.engine === "dungeon" ? DEICIDE.delay.defaultWeight : null),
    dungeon: state.dungeonProfile ?? null,
    isCommand: ability?.type === "command"
  };
  const content = await foundry.applications.handlebars.renderTemplate("systems/deicide/templates/chat/action-card.hbs", context);
  state.message = await ChatMessage.implementation.create({
    type: "action",
    content,
    speaker: ChatMessage.implementation.getSpeaker({actor}),
    rolls: state.rolls,
    system: {
      kind: result.kind, actorUuid: actor.uuid, abilityId: ability?.identifier ?? "", mode: state.mode,
      targets: result.targets.map(entry => ({...entry, params: undefined})), result: {costs: result.costs, notes: result.notes, reactions: result.reactions, cancelled: result.cancelled ?? null, extra: result.extra.map(sub => ({...sub, damage: undefined, hit: undefined, crit: undefined}))},
      costs: result.costs, applied: []
    }
  });
}

function labelPart(part, attacker) {
  const [kind, detail] = part.id.split(".");
  switch ( kind ) {
    case "basis": return formatGraded(game.i18n.localize(DEICIDE.attackBases[detail]?.label ?? detail), part.value);
    case "source": return game.i18n.localize(DEICIDE.mightSources[detail]?.label ?? detail);
    case "skillMight": return "Skill Might";
    case "triangle": return "Weapon triangle";
    case "effect": return `Effectiveness (${detail})`;
    case "charge": return "Charge";
    case "attuned": return "Attuned";
    case "marked": return "Marked";
    case "static": return "Static";
    case "overcast": return "Overcast";
    case "catalyst": return `Catalyst (${detail})`;
    case "student": return "Student (Truth halved)";
    case "bond": return "Bond";
    case "modifiers": return "Modifiers";
    case "spellModifiers": return "Spell modifiers";
    case "abilityBonus": return "Ability bonus";
    case "bonus": return "Bonus";
    default: return part.id;
  }
}

async function stepEnd(state) {
  const {combat, combatant, ability} = state;
  if ( combatant && ability?.identifier ) {
    const fired = combatant.system.firedThisEncounter ?? [];
    if ( !fired.includes(ability.identifier) ) await combatant.update({"system.firedThisEncounter": [...fired, ability.identifier]});
  }
  if ( !combat || !combatant ) return;
  if ( ability && DEICIDE.skillTypes[ability.type]?.passive ) return;
  if ( ability?.type === "reaction" ) {
    await combatant.update({"system.reactionUsed": true});
    return;
  }
  const weight = state.dungeonProfile?.weight ?? ability?.weight ?? (state.weapon?.weight ?? DEICIDE.delay.defaultWeight);
  const weightMods = (state.derived.modifiers ?? []).filter(m => m.key === "weight").reduce((sum, m) => sum + Number(m.value), 0);
  await combat.endAction(combatant, {weight: Math.max(weight + weightMods, 1)});
}

export const actionPipeline = new Pipeline("action", [
  ["gather", stepGather],
  ["check", stepCheck],
  ["costs", stepCosts],
  ["snapshot", stepSnapshot],
  ["reactionsBefore", stepReactionsBefore],
  ["resolve", stepResolve],
  ["reactionsAfter", stepReactionsAfter],
  ["effects", stepEffects],
  ["card", stepCard],
  ["end", stepEnd]
]);

export async function useAbility(actor, {abilityId = null, targets = null, options = {}} = {}) {
  const state = {
    actor, abilityId, options, rolls: [],
    targets: targets ?? Array.from(game.user.targets)
  };
  await actionPipeline.runAsync(state);
  return state;
}

export async function companyAttack(attacker, target, {charge = false} = {}) {
  const company = attacker.actor;
  const targetActor = target.actor;
  if ( company?.type !== "company" || !targetActor ) return null;
  const targetKind = targetActor.type === "company" ? "company" : "character";
  const profile = targetActor.profile;
  const d = company.system.derived ?? {};
  const hit = companyHit({quality: d.effectiveQuality ?? company.system.quality, targetSpd: profile?.attributes?.spd ?? 0, targetAvoid: profile?.defense?.avoid ?? 0, bonus: d.hitBonus ?? 0});
  const strikes = d.strikes ?? 1;
  const dmg = companyDamage({attacker: {...company.system, quality: d.effectiveQuality ?? company.system.quality}, target: targetKind === "company" ? targetActor.system : profile, targetKind, charge, mightBonus: d.mightBonus ?? 0});
  const rolls = [];
  const results = [];
  let total = 0;
  for ( let i = 0; i < strikes; i++ ) {
    const roll = await rollD100("Hit");
    rolls.push(roll);
    const success = rollUnder(roll.total, hit);
    results.push({hit: success, roll: roll.total, damage: success ? dmg.total : 0});
    if ( success ) total += dmg.total;
  }
  const content = await foundry.applications.handlebars.renderTemplate("systems/deicide/templates/chat/company-card.hbs", {
    attacker: company, target: targetActor, hit, roll: results[0].roll, success: results.some(r => r.hit), damage: dmg, targetKind, charge, results, strikes, total
  });
  return ChatMessage.implementation.create({
    type: "action",
    content, rolls,
    speaker: ChatMessage.implementation.getSpeaker({actor: company}),
    system: {
      kind: "companyAttack", actorUuid: company.uuid, mode: "war",
      targets: [{name: targetActor.name, actorUuid: targetActor.uuid, tokenId: target.token?.id ?? null, total, strikes: results, statuses: [], outcomes: []}],
      result: {hit, roll: results[0].roll, success: results.some(r => r.hit), damage: dmg}, costs: {}, applied: []
    }
  });
}

export async function applyCardTarget(message, index) {
  const entry = message.system.targets[index];
  if ( !entry ) return;
  const actor = entry.actorUuid ? await fromUuid(entry.actorUuid) : null;
  if ( !actor ) { ui.notifications?.warn("The target no longer exists."); return; }
  const applied = [...message.system.applied];
  const key = `target.${index}`;
  if ( applied.includes(key) ) return;
  let amount = entry.total ?? 0;
  const notes = [];
  const source = message.system.actorUuid ? await fromUuid(message.system.actorUuid) : null;
  if ( amount > 0 ) {

    const barrier = actor.effects.find(effect => (effect.type === "status") && (effect.system.statusId === "barrier"));
    if ( barrier?.system.pool ) {
      const absorbed = absorb(amount, barrier.system.pool);
      amount = absorbed.toHp;
      if ( absorbed.broken ) await barrier.delete();
      else await barrier.update({"system.pool": absorbed.pool});
      notes.push(`Barrier absorbs ${absorbed.absorbed}`);
    }
    if ( amount > 0 ) {
      const warded = await trackWarded(actor, amount);
      if ( warded?.broken ) notes.push("Warded breaks");
      if ( entry.survive && (amount >= (actor.system.hp?.value ?? 0)) ) {
        await actor.update({"system.hp.value": 1});
        notes.push("survives at 1 HP");
      }
      else if ( actor.type === "company" ) await actor.update({"system.strength": Math.max(actor.system.strength - amount, 0)});
      else await actor.applyDamage(amount);
      const combatant = game.combat?.combatantFor?.(actor);
      if ( combatant?.system.undamaged ) await combatant.update({"system.undamaged": false});
    }
  }
  if ( entry.heal ) await actor.changePool("hp", entry.heal.total);
  for ( const status of entry.statuses ?? [] ) {
    const recipient = status.target === "self" ? (await fromUuid(message.system.actorUuid)) : actor;
    if ( recipient ) await applyStatus(recipient, status.id, {turns: status.turns ?? undefined});
  }
  await applyOutcomes((entry.outcomes ?? []).filter(o => !o.applied), {actor: source, combat: game.combat?.started ? game.combat : null, notes});
  applied.push(key);
  await message.update({"system.applied": applied});
  if ( notes.length ) ui.notifications?.info(`${actor.name}: ${notes.join(", ")}.`);
}

export function registerCardHooks() {
  Hooks.on("renderChatMessageHTML", (message, html) => {
    if ( message.type !== "action" ) return;
    for ( const button of html.querySelectorAll("[data-action='applyTarget']") ) {
      const index = Number(button.dataset.index);
      if ( !game.user.isGM ) button.remove();
      else if ( message.system.applied.includes(`target.${index}`) ) button.disabled = true;
      else button.addEventListener("click", () => applyCardTarget(message, index));
    }
    for ( const button of html.querySelectorAll("[data-action='applyExtra']") ) {
      const index = Number(button.dataset.index);
      if ( !game.user.isGM ) button.remove();
      else if ( message.system.applied.includes(`extra.${index}`) ) button.disabled = true;
      else button.addEventListener("click", async () => {
        const sub = message.system.result.extra?.[index];
        const target = sub?.actorUuid ? await fromUuid(sub.actorUuid) : null;
        if ( target && sub.total ) {
          if ( target.type === "company" ) await target.update({"system.strength": Math.max(target.system.strength - sub.total, 0)});
          else await target.applyDamage(sub.total);
        }
        await message.update({"system.applied": [...message.system.applied, `extra.${index}`]});
      });
    }
  });
}

export const actions = {useAbility, companyAttack, applyCardTarget, pipeline: actionPipeline};
export {SYSTEM_ID, BASIC_ATTACK, critMultiplier};
