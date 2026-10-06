import {DEICIDE, SYSTEM_ID} from "../config.mjs";
import {Pipeline} from "../core/pipeline.mjs";
import {d100, rollUnder} from "../core/random.mjs";
import {
  BASIC_ATTACK, absorb, critChance, critMultiplier, damage, healAmount, hitChance, payChannel, soulPrice, strikeCount
} from "../rules/resolve.mjs";
import {companyDamage, companyHit} from "../rules/company.mjs";
import {dungeonProfile} from "../rules/collapse.mjs";
import {formatGraded} from "../rules/grades.mjs";
import {sceneMode} from "../hooks/scene-mode.mjs";
import {applyStatus, trackWarded} from "./statuses.mjs";

async function rollD100(flavor) {
  const roll = await new Roll("1d100").evaluate();
  roll.options.flavor = flavor;
  return roll;
}

function profileOf(target) {
  const actor = target?.actor ?? target;
  return actor?.profile ?? actor?.system?.profile ?? null;
}

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
  const source = state.ability?.attack?.source ?? (state.ability ? "none" : "weapon");

  if ( (source === "weapon") && state.weapon?.caster ) state.weapon = equipment.offhand?.line && !equipment.offhand.caster ? equipment.offhand : null;
  state.combat = game.combat?.started ? game.combat : null;
  state.combatant = state.combat?.combatantFor(actor) ?? null;
  state.targets = (state.targets ?? []).map(target => {
    const targetActor = target.actor ?? target;
    return {actor: targetActor, token: target.document ?? target.token ?? null, profile: profileOf(target), name: targetActor?.name ?? "?"};
  }).filter(entry => entry.profile);
  state.result = {kind: state.ability ? (state.ability.heal ? "heal" : state.ability.attack ? "attack" : "use") : "attack", lines: [], targets: [], costs: {}, notes: []};
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
}

async function stepCosts(state) {
  const {actor, ability, derived} = state;
  const costs = state.result.costs;
  const updates = {};
  if ( !ability ) return;
  const cost = ability.cost ?? {};
  const options = state.options ?? {};

  if ( cost.channel ) {
    const channel = actor.system.channel;
    if ( derived.noChannel ) { ui.notifications?.warn(`${actor.name} has no Channel.`); return false; }
    const paid = payChannel({
      cost: cost.channel + (options.extraChannel ?? 0), channel: channel.value, burnPerPoint: derived.overcastBurnPerPoint,
      immune: derived.modifiers.some(m => m.key === "overcast.immune"),
      multiplier: derived.modifiers.find(m => m.key === "overcast.multiplier")?.value ?? 1
    });
    costs.channel = paid;
    updates["system.channel.value"] = paid.channel;
    if ( paid.overcast && state.derived.flags?.overcastMight ) state.overcastMight = paid.overcast * state.derived.flags.overcastMight;
  }
  if ( cost.matter ) {
    const matter = actor.system.matter;
    const matterCost = options.freeMatter ? 0 : cost.matter;
    if ( matter.value < matterCost ) { ui.notifications?.warn(`${actor.name} needs ${matterCost} Matter.`); return false; }
    costs.matter = matterCost;
    updates["system.matter.value"] = matter.value - matterCost;
  }
  if ( cost.hp ) {
    const halved = derived.modifiers.some(m => (m.key === "cost.hp") && (m.op === "mul"));
    const hpCost = halved ? Math.floor(cost.hp / 2) : cost.hp;
    costs.hp = hpCost;
    updates["system.hp.value"] = Math.max(actor.system.hp.value - hpCost, 0);
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

async function stepResolve(state) {
  const {attacker, ability, weapon, mode, targets} = state;
  const options = state.options ?? {};
  const baseContext = {
    flank: Boolean(options.flank), backRow: state.combatant?.system.row === "back", highGround: Boolean(options.highGround),
    terrainAvoid: options.terrainAvoid ?? 0, tilesMoved: state.combatant?.system.tilesMoved ?? 0,
    staticSpent: options.staticSpent ?? 0, overcastMight: state.overcastMight ?? 0, catalyst: state.catalyst ?? null,
    marked: Boolean(options.marked), bondMight: options.bondMight ?? 0, mightBonus: options.mightBonus ?? 0
  };
  const isAttack = ability ? Boolean(ability.attack) : Boolean(weapon && !weapon.caster);
  const isHeal = Boolean(ability?.heal);

  for ( const target of targets ) {
    const context = {...baseContext, targetWeaponProf: target.actor?.system?.equipment?.weapon?.prof ?? null, terrainAvoid: options.terrainAvoid ?? target.terrainAvoid ?? 0};
    const entry = {name: target.name, actorUuid: target.actor?.uuid ?? null, tokenId: target.token?.id ?? null, strikes: [], statuses: []};
    if ( isHeal ) {
      const heal = healAmount({formula: ability.heal.formula, healer: attacker, weapon: weapon?.healBonus ? weapon : null});
      entry.heal = heal;
    }
    if ( isAttack ) {
      const params = {attacker, target: target.profile, weapon, ability, mode, context};
      const hit = hitChance(params);
      const crit = critChance(params);
      const result = damage(params);
      entry.hit = hit;
      entry.crit = crit;
      entry.damage = result;
      const count = strikeCount(params);
      let total = 0;
      for ( let i = 0; i < count; i++ ) {
        const autoHit = Boolean(ability?.attack?.autoHit);
        const hitRoll = autoHit ? null : await rollD100("Hit");
        const didHit = autoHit || rollUnder(hitRoll.total, hit.chance);
        let critRoll = null;
        let didCrit = false;
        if ( didHit ) {
          const autoCrit = Boolean(options.autoCrit) || Boolean(ability?.attack?.autoCritWhen && options.flank);
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
    state.result.targets.push({name: state.actor.name, actorUuid: state.actor.uuid, self: true, strikes: [], statuses: ability.statuses.filter(status => status.target === "self")});
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
    dungeon: state.dungeonProfile ?? null
  };
  const content = await foundry.applications.handlebars.renderTemplate("systems/deicide/templates/chat/action-card.hbs", context);
  state.message = await ChatMessage.implementation.create({
    type: "action",
    content,
    speaker: ChatMessage.implementation.getSpeaker({actor}),
    rolls: state.rolls,
    system: {
      kind: result.kind, actorUuid: actor.uuid, abilityId: ability?.identifier ?? "", mode: state.mode,
      targets: result.targets, result: {costs: result.costs, notes: result.notes}, costs: result.costs, applied: []
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
  ["resolve", stepResolve],
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
  const hit = companyHit({quality: company.system.quality, targetSpd: profile?.attributes?.spd ?? 0, targetAvoid: profile?.defense?.avoid ?? 0});
  const roll = await rollD100("Hit");
  const success = rollUnder(roll.total, hit);
  const dmg = companyDamage({attacker: company.system, target: targetKind === "company" ? targetActor.system : profile, targetKind, charge});
  const content = await foundry.applications.handlebars.renderTemplate("systems/deicide/templates/chat/company-card.hbs", {
    attacker: company, target: targetActor, hit, roll: roll.total, success, damage: dmg, targetKind, charge
  });
  return ChatMessage.implementation.create({
    type: "action",
    content, rolls: [roll],
    speaker: ChatMessage.implementation.getSpeaker({actor: company}),
    system: {
      kind: "companyAttack", actorUuid: company.uuid, mode: "war",
      targets: [{name: targetActor.name, actorUuid: targetActor.uuid, tokenId: target.token?.id ?? null, total: success ? dmg.total : 0, strikes: [{hit: success, damage: success ? dmg.total : 0}], statuses: []}],
      result: {hit, roll: roll.total, success, damage: dmg}, costs: {}, applied: []
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
      await actor.applyDamage(amount);
    }
  }
  if ( entry.heal ) await actor.changePool("hp", entry.heal.total);
  for ( const status of entry.statuses ?? [] ) {
    const recipient = status.target === "self" ? (await fromUuid(message.system.actorUuid)) : actor;
    if ( recipient ) await applyStatus(recipient, status.id, {turns: status.turns ?? undefined});
  }
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
  });
}

export const actions = {useAbility, companyAttack, applyCardTarget, pipeline: actionPipeline};
export {SYSTEM_ID, BASIC_ATTACK, critMultiplier};
