import {DEICIDE} from "../../config.mjs";
import {hashString, pick, seededRng, weightedPick} from "../../core/random.mjs";
import {createCharacter} from "../creation.mjs";
import {
  applyLevel, applyPromotion, applyRankBonus, classCaps, cp100ForRank, highestGrowthStats, rankForCp
} from "../growth.mjs";
import {deriveCharacter} from "../derive.mjs";
import {gradeAtLeast, gradeIndex} from "../grades.mjs";
import {pacingMultiplier} from "../pacing.mjs";
import {CHOSEN_WEAPON, meetsRequirement, meetsWeaponGate, tierGatesFor, weaponProficiencies} from "../proficiency.mjs";
import {accessoryProfile, armorProfile, forgeCost, offhandId, offhandProfile, prefixAllowed, weaponProfile} from "../economy.mjs";

const ATTRS = DEICIDE.attributeIds;
const SHOP_ORDER = ["village", "town", "city", "capital"];
const ICONS = {weapon: "icons/svg/sword.svg", armor: "icons/svg/shield.svg", offhand: "icons/svg/shield.svg", accessory: "icons/svg/item-bag.svg", ability: "icons/svg/upgrade.svg", named: "icons/svg/holy-shield.svg", actor: "icons/svg/mystery-man.svg"};
const FACTION_NAMES = {lathander: "Lathander", offweiss: "Offweiss"};
const TITLES = ["marshal", "captain", "general", "admiral", "king", "queen", "lord", "lady", "sir", "dame", "sister", "brother", "father", "mother"];

export function givenName(name) {
  const words = name.split(" ").filter(Boolean);
  return words.find(word => !TITLES.includes(word.toLowerCase())) ?? words[0] ?? name;
}
const capitalize = text => text.charAt(0).toUpperCase() + text.slice(1);

export function growthOrder(classData) {
  return [...ATTRS].sort((a, b) => gradeIndex(classData.growth?.[b] ?? "F") - gradeIndex(classData.growth?.[a] ?? "F"));
}

export function firstWeaponProficiency(classes) {
  const weapons = weaponProficiencies();
  for ( const data of classes ) {
    for ( const entry of [...(data.trains?.primary ?? []), ...(data.trains?.secondary ?? [])] ) {
      if ( weapons.includes(entry) ) return entry;
    }
  }
  return "sword";
}

export function talentChoiceFor(talentId, base, final) {
  const choice = {id: talentId, stat: null, penaltyStat: null, placement: {}, proficiency: null};
  if ( talentId === "earlyPeak" ) {
    const [first, second] = growthOrder(base);
    choice.placement = {[first]: 4, [second]: 4};
  }
  else if ( talentId === "prodigy" ) {
    const order = growthOrder(final);
    choice.stat = order[0];
    choice.penaltyStat = order.at(-1);
  }
  else if ( talentId === "savant" ) {
    choice.proficiency = base.trains?.primary?.find(entry => entry !== CHOSEN_WEAPON) ?? firstWeaponProficiency([base]);
  }
  return choice;
}

export function personalGrowthFor(final, rng) {
  const order = growthOrder(final);
  const strong = order.filter(attr => DEICIDE.promotionGrades.includes(final.growth?.[attr]));
  const pool = strong.length >= 2 ? [...strong] : [...new Set([...strong, ...order])].slice(0, 2);

  for ( let i = pool.length - 1; i > 0; i-- ) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const line = Object.fromEntries(ATTRS.map(attr => [attr, 0]));
  line[pool[0]] = DEICIDE.personalGrowthMaxPerStat;
  line[pool[1]] = DEICIDE.personalGrowthTenths - DEICIDE.personalGrowthMaxPerStat;
  return line;
}

export function budgetForLevel(level) {
  for ( const band of DEICIDE.generate.npcBudget.bands ) {
    if ( level <= band.maxLevel ) return band.dust;
  }
  return DEICIDE.generate.npcBudget.bands.at(-1).dust;
}

export function equipmentTypeFor(classData, profs) {
  const types = classData.types ?? [];
  const officer = types.includes("officer");
  const trained = [...(classData.trains?.primary ?? []), ...(classData.trains?.secondary ?? [])];
  const weaponRow = () => {
    const first = trained.find(entry => ["bow", "gun", "sword", "lance", "axe"].includes(entry));
    return ["bow", "gun"].includes(first) ? "infantryRanged" : "infantryMelee";
  };
  const casterRow = () => {
    const school = trained.find(entry => ["reason", "faith", "void", "alchemy"].includes(entry)) ?? "reason";
    return {reason: "casterReason", faith: "casterFaith", void: "casterVoid", alchemy: "casterAlchemy"}[school];
  };
  let base = null;
  for ( const type of types ) {
    if ( type === "officer" ) continue;
    if ( type === "caster" ) { base = casterRow(); break; }
    if ( type === "infantry" ) { base = weaponRow(); break; }
    if ( type in DEICIDE.generate.npcEquipment ) { base = type; break; }
  }
  if ( !base ) base = trained.some(entry => ["reason", "faith", "void", "alchemy"].includes(entry)) && !trained.some(entry => ["sword", "lance", "axe", "bow", "gun"].includes(entry)) ? casterRow() : weaponRow();
  return {type: officer ? "officer" : base, officer, base};
}

const LINE_PROF = line => DEICIDE.weaponGenerator.lines[line]?.prof;

function wieldableLines(weights, profs) {
  const out = {};
  for ( const [line, weight] of Object.entries(weights ?? {}) ) {
    const prof = LINE_PROF(line);
    if ( prof && gradeAtLeast(profs[prof], DEICIDE.weaponTierGates.iron) ) out[line] = weight;
  }
  return out;
}

function fallbackLine(profs) {
  let best = null;
  for ( const [line, data] of Object.entries(DEICIDE.weaponGenerator.lines) ) {
    if ( line === "dagger" ) continue;
    const grade = profs[data.prof];
    if ( grade && (!best || (gradeIndex(grade) > gradeIndex(profs[LINE_PROF(best)]))) ) best = line;
  }
  return best ?? "sword";
}

function parseOffhand(id) {
  for ( const tier of Object.keys(DEICIDE.weaponGenerator.tiers) ) {
    if ( !id.startsWith(tier) ) continue;
    const rest = id.slice(tier.length);
    for ( const line of Object.keys(DEICIDE.offhand) ) if ( rest === capitalize(line) ) return {tier, line};
  }
  return null;
}

const armorId = (weight, tier) => `${tier}${capitalize(weight)}`;

export function buyKit({budget, row, baseRow, profs, classTypes, partyTypes = [], weaponsTrack = 0, ringAttribute = "str", issuedKit = null, rng}) {
  const table = DEICIDE.generate.npcEquipment;
  const weights = table[row];
  const other = table[baseRow] ?? table.infantryMelee;
  const weaponWeights = wieldableLines(weights.weapon ?? other.weapon, profs);
  const line = Object.keys(weaponWeights).length ? weightedPick(weaponWeights, rng) : fallbackLine(profs);
  const armorWeight = weightedPick(weights.armor ?? other.armor, rng);
  let offhandPick = weightedPick(weights.offhand ?? other.offhand, rng);
  if ( offhandPick === "other" ) offhandPick = weightedPick(other.offhand, rng);
  const context = {proficiencies: profs, classTypes};

  const resolveOffhand = tier => {
    if ( (tier === "iron") && issuedKit?.offhand ) {
      const issued = parseOffhand(issuedKit.offhand);
      if ( issued ) {
        const profile = offhandProfile(issued.line, issued.tier);
        return {kind: "offhand", id: profile.identifier, line: issued.line, tier: issued.tier, price: profile.price, profile};
      }
    }
    if ( offhandPick === "none" ) return null;
    if ( offhandPick === "sidearm" ) {
      const sidearmLine = gradeAtLeast(profs.gun, DEICIDE.weaponTierGates[tier]) ? "gun" : "dagger";
      if ( !gradeAtLeast(profs[LINE_PROF(sidearmLine)], DEICIDE.weaponTierGates[tier]) ) return null;
      const profile = weaponProfile({line: sidearmLine, tier});
      return {kind: "sidearm", id: profile.identifier, line: sidearmLine, tier, price: profile.price, profile};
    }
    const definition = DEICIDE.offhand[offhandPick];
    if ( !definition?.tiers?.[tier] || !meetsRequirement(definition.requires, context) ) {

      if ( (offhandPick !== "buckler") && DEICIDE.offhand.buckler.tiers[tier] ) {
        const profile = offhandProfile("buckler", tier);
        return {kind: "offhand", id: profile.identifier, line: "buckler", tier, price: profile.price, profile};
      }
      return null;
    }
    const profile = offhandProfile(offhandPick, tier);
    return {kind: "offhand", id: profile.identifier, line: offhandPick, tier, price: profile.price, profile};
  };
  const resolveArmor = tier => {
    if ( (tier === "iron") && issuedKit?.armor && DEICIDE.armor[issuedKit.armor] ) {
      return {id: issuedKit.armor, profile: armorProfile(issuedKit.armor), price: DEICIDE.armor[issuedKit.armor].price};
    }
    const order = [armorWeight, "medium", "light"];
    for ( const weight of order ) {
      const id = armorId(weight, tier);
      const rowData = DEICIDE.armor[id];
      if ( rowData && meetsRequirement(rowData.requires, context) ) return {id, profile: armorProfile(id), price: rowData.price};
    }
    return null;
  };

  let chosen = null;
  for ( const tier of [...DEICIDE.tierOrder].reverse() ) {
    if ( !DEICIDE.weaponGenerator.tiers[tier] ) continue;
    if ( !meetsWeaponGate(LINE_PROF(line), tier, profs) ) continue;
    const weapon = weaponProfile({line, tier});
    const armor = resolveArmor(tier);
    const offhand = resolveOffhand(tier);
    const cost = weapon.price + (armor?.price ?? 0) + (offhand?.price ?? 0);
    if ( cost <= budget ) { chosen = {tier, weapon, armor, offhand, cost}; break; }
  }
  if ( !chosen ) {

    const weapon = weaponProfile({line, tier: "iron"});
    const armor = weapon.price + 10 <= budget ? resolveArmor("iron") : null;
    chosen = {tier: "iron", weapon, armor, offhand: null, cost: weapon.price + (armor?.price ?? 0)};
  }
  let remainder = budget - chosen.cost;
  let prefix = null;
  let accessory = null;
  const shop = DEICIDE.tiers[chosen.tier].shop;
  const shopIndex = SHOP_ORDER.indexOf(shop);

  if ( shopIndex >= SHOP_ORDER.indexOf("city") && DEICIDE.martialLines.includes(line) ) {
    const prefixWeights = {...DEICIDE.generate.npcPrefixWeights};
    const dominant = dominantType(partyTypes);
    const slayer = dominant ? DEICIDE.generate.slayerFor[dominant] : null;
    if ( slayer ) { prefixWeights[slayer] = prefixWeights.slayer; }
    delete prefixWeights.slayer;
    for ( const key of Object.keys(prefixWeights) ) if ( !prefixAllowed(key, line, chosen.tier) ) delete prefixWeights[key];
    const picked = Object.keys(prefixWeights).length ? weightedPick(prefixWeights, rng) : null;
    if ( picked ) {
      const prefixed = weaponProfile({line, tier: chosen.tier, prefix: picked});
      const extra = prefixed.price - chosen.weapon.price;
      if ( extra <= remainder ) { prefix = picked; chosen.weapon = prefixed; remainder -= extra; }
    }
  }
  if ( !prefix ) {
    const family = weightedPick(weights.accessory ?? other.accessory, rng);
    const candidates = Object.entries(DEICIDE.accessories)
      .filter(([, data]) => (data.family === family) && (data.price <= remainder) && (SHOP_ORDER.indexOf(data.shop) <= shopIndex) && meetsRequirement(data.requires, context))
      .sort((a, b) => b[1].price - a[1].price);
    const [id] = candidates[0] ?? [];
    if ( id ) {
      const choices = DEICIDE.accessories[id].choice === "attribute" ? {attribute: ringAttribute} : {};
      accessory = {id, choices, profile: accessoryProfile(id, choices), price: DEICIDE.accessories[id].price};
      remainder -= accessory.price;
    }
  }
  let forge = 0;
  const forgeDust = forgeCost(1);
  if ( (weaponsTrack >= DEICIDE.weaponGenerator.forge.requiresWeaponsTrack) && DEICIDE.martialLines.includes(line) && (forgeDust <= remainder) ) {
    forge = 1;
    chosen.weapon = weaponProfile({line, tier: chosen.tier, prefix, forge});
    remainder -= forgeDust;
  }
  return {
    tier: chosen.tier, line, prefix, forge,
    weapon: chosen.weapon, armor: chosen.armor, offhand: chosen.offhand?.kind === "offhand" ? chosen.offhand : null,
    sidearm: chosen.offhand?.kind === "sidearm" ? chosen.offhand : null, accessory,
    spent: budget - remainder, remainder, budget
  };
}

export function dominantType(types = []) {
  const counts = new Map();
  for ( const type of types ) counts.set(type, (counts.get(type) ?? 0) + 1);
  let best = null;
  for ( const [type, count] of counts ) if ( !best || (count > counts.get(best)) ) best = type;
  return best;
}

function supportMatches(data, classTypes) {
  const whens = [...(data.modifiers ?? []).map(m => m.when), ...(data.effects ?? []).map(e => e.when)].filter(Boolean);
  return whens.some(when => Object.values(when).flat().some(value => classTypes.includes(value)));
}

export function loadoutFor({classes, activeClass, level, classTypes, lookup}) {
  const known = [];
  for ( const entry of classes ) {
    for ( const skill of entry.data.skills ?? [] ) {
      if ( entry.rank < skill.rank ) continue;
      const data = lookup("ability", skill.id);
      if ( data ) known.push({id: skill.id, rank: skill.rank, classId: entry.id, data});
    }
  }
  const byRank = (a, b) => (b.rank - a.rank) || a.id.localeCompare(b.id);
  const reactions = known.filter(skill => skill.data.type === "reaction").sort(byRank);
  const supports = known.filter(skill => skill.data.type === "support")
    .sort((a, b) => (Number(supportMatches(b.data, classTypes)) - Number(supportMatches(a.data, classTypes))) || byRank(a, b));
  const slots = DEICIDE.loadout.supports.reduce((count, band) => (level >= band.level) ? band.count : count, 0);
  const previous = classes.filter(entry => (entry.id !== activeClass) && (entry.rank >= DEICIDE.secondaryActionMinRank) && !entry.data.layered)
    .sort((a, b) => b.rank - a.rank)[0];
  return {
    secondary: previous?.id ?? null,
    reaction: reactions[0]?.id ?? null,
    supports: supports.slice(0, slots).map(skill => skill.id),
    stance: null
  };
}

export function personalSkillItem(id, lookup, npcId) {
  const config = DEICIDE.personalSkills.byId[id];
  if ( config ) {
    return {
      name: config.name, type: "ability", img: ICONS.ability,
      system: {
        identifier: config.id, type: config.type, source: {kind: "personal", id: npcId, rank: null},
        description: `<p>${capitalize(config.summary)}.</p>`, summary: config.summary, tags: [], direct: false, trigger: "",
        usage: config.usage, cost: {channel: 0, matter: 0, hp: 0, dust: 0, soulPrice: 0}, weight: config.weight,
        attack: config.attack, heal: null, war: config.war, dungeon: config.dungeon, statuses: config.statuses,
        modifiers: config.modifiers, roll: null, art: null, effects: config.effects, reaction: config.reaction,
        command: null, stance: null, coverage: config.coverage, automation: "partial"
      }
    };
  }
  const data = lookup("ability", id);
  if ( !data ) return null;
  const {name, ...system} = data;
  return {name: name ?? id, type: "ability", img: ICONS.ability, system: {...system, identifier: id}};
}

export function generateNpc(input, lookup) {
  const errors = [];
  const level = Math.max(1, Math.min(Math.floor(input.level ?? 1), 30));
  const line = (input.classLine ?? []).map(id => ({id, data: lookup("class", id)}));
  for ( const entry of line ) if ( !entry.data ) errors.push(`Unknown class "${entry.id}"`);
  if ( !line.length ) errors.push("A class line needs a base class");
  else if ( line[0].data && (line[0].data.tier !== 1) ) errors.push(`"${line[0].id}" is not a Tier 1 class`);
  const people = lookup("origin", input.people);
  if ( !people ) errors.push(`Unknown people "${input.people}"`);
  if ( errors.length ) return {actor: null, summary: "", errors, detail: {}};

  const profile = DEICIDE.generate.npcProfiles[input.profile] ? input.profile : "standard";
  const profileData = DEICIDE.generate.npcProfiles[profile];
  const seed = input.seed ?? 1;
  const rng = seededRng(typeof seed === "number" ? seed : hashString(String(seed)));
  const base = line[0].data;
  const final = line.at(-1).data;
  const talentId = input.talent ?? profileData.talent;
  const talent = lookup("origin", talentId);
  if ( !talent ) errors.push(`Unknown Talent "${talentId}"`);
  const talentChoice = talentChoiceFor(talentId, base, final);
  const dials = input.dials ?? {S: DEICIDE.pacing.defaults.S, L: DEICIDE.pacing.defaults.L};
  const gates = tierGatesFor(dials.L ?? DEICIDE.pacing.defaults.L);

  const created = createCharacter({
    people: input.people, peopleSubtype: input.subtype ?? "", background: null, baseClass: base.identifier,
    talent: talentChoice, personalGrowth: personalGrowthFor(final, rng)
  }, lookup);
  errors.push(...created.errors);
  if ( !created.system ) return {actor: null, summary: "", errors, detail: {}};
  let source = created.system;

  const takeAt = entry => input.classAt?.[entry.id] ?? (entry.data.tier <= 1 ? 1 : (gates[entry.data.tier - 2] ?? 99));
  const chosenWeapon = entry => input.choices?.[entry.id]?.weapon ?? firstWeaponProficiency(line.slice(0, line.indexOf(entry) + 1).map(e => e.data));
  const addClass = entry => {
    if ( source.classes.some(c => c.id === entry.id) ) return;
    const caps = classCaps(entry.data, {talent, talentChoice: source.talent, people});
    const promotionBonuses = applyPromotion(source, entry.data, caps);
    const choices = {...(input.choices?.[entry.id] ?? {})};
    if ( [...(entry.data.trains?.primary ?? []), ...(entry.data.trains?.secondary ?? [])].includes(CHOSEN_WEAPON) ) choices.weapon = chosenWeapon(entry);
    source = {...source, classes: [...source.classes, {id: entry.id, rank: 1, cp100: 0, choices}], promotionBonuses, activeClass: entry.id};
  };
  const flexStat = growthOrder(final)[0];
  for ( const entry of line ) if ( takeAt(entry) <= 1 ) addClass(entry);
  for ( let next = 2; next <= level; next++ ) {
    for ( const entry of line ) if ( takeAt(entry) === next ) addClass(entry);
    const active = lookup("class", source.activeClass);
    const result = applyLevel(source, active, people, source.personalGrowth, talent, {rng, flex: flexStat});
    source = {...source, level: result.level, growthTenths: result.growthTenths, growthLog: result.growthLog};
  }

  const P = pacingMultiplier(dials);
  const totalCp100 = Math.round(DEICIDE.generate.npcCp.perLevel * level * P * 100);
  const owned = line.filter(entry => source.classes.some(c => c.id === entry.id));
  const shares = owned.length === 1 ? [1] : DEICIDE.generate.npcCp.split.slice(0, owned.length).reverse();
  const ranks = {};
  owned.forEach((entry, index) => {
    const share = shares[index] ?? 0;
    let cp100 = Math.round(totalCp100 * share);
    let rank = Math.min(rankForCp(cp100), DEICIDE.maxRank);
    if ( input.ranks?.[entry.id] ) { rank = Math.min(Math.max(input.ranks[entry.id], 1), DEICIDE.maxRank); cp100 = Math.max(cp100, cp100ForRank(rank)); }
    ranks[entry.id] = {rank, cp100};
  });
  for ( const entry of owned ) {
    const {rank, cp100} = ranks[entry.id];
    const caps = classCaps(entry.data, {talent, talentChoice: source.talent, people});
    let rankBonuses = source.rankBonuses;
    for ( let r = 2; r <= rank; r++ ) rankBonuses = applyRankBonus({...source, rankBonuses}, entry.data, r, caps, null);
    source = {...source, rankBonuses, classes: source.classes.map(c => c.id === entry.id ? {...c, rank, cp100} : c)};
  }
  source = {...source, activeClass: owned.at(-1).id};
  const activeData = owned.at(-1).data;
  const classTypes = [...(activeData.types ?? [])];

  const classEntries = owned.map(entry => ({id: entry.id, rank: ranks[entry.id].rank, data: entry.data, choices: source.classes.find(c => c.id === entry.id)?.choices ?? {}}));
  source = {...source, loadout: loadoutFor({classes: classEntries, activeClass: source.activeClass, level, classTypes, lookup})};

  const bare = deriveCharacter(source, {lookup, equipment: {}, context: {mode: "war", classCatalog: []}});
  const profs = bare.proficiencies;
  const multiplier = input.named ? DEICIDE.generate.npcBudget.multipliers.named : (DEICIDE.generate.npcBudget.multipliers[profile] ?? 1);
  const budget = Math.round((input.budgetDust ?? budgetForLevel(level)) * multiplier);
  const {type: row, base: baseRow} = equipmentTypeFor(activeData, profs);
  const kit = buyKit({
    budget, row, baseRow, profs, classTypes, partyTypes: input.partyTypes ?? [], weaponsTrack: input.weaponsTrack ?? 0,
    ringAttribute: highestGrowthStats(activeData)[0] ?? "str", issuedKit: activeData.kit?.armor ? activeData.kit : null, rng
  });

  const namedItems = [];
  for ( const id of input.namedItems ?? [] ) {
    const data = lookup("named", id);
    if ( !data ) { errors.push(`Unknown Named item "${id}"`); continue; }
    namedItems.push({id, data});
    if ( data.fills === "weapon" ) kit.weapon = null;
    else if ( data.fills === "offhand" ) { kit.offhand = null; kit.sidearm = null; }
    else if ( data.fills === "armor" ) kit.armor = null;
  }

  const items = [];
  const equipment = {weapon: null, offhand: null, armor: null, accessories: [], pin: null, belt: []};
  if ( kit.weapon ) {
    items.push({name: kit.weapon.name, type: "weapon", img: ICONS.weapon, system: {identifier: kit.weapon.identifier, line: kit.line, tier: kit.tier, prefix: kit.prefix, forge: kit.forge, element: null, asSidearm: false, equipped: true, quantity: 1, description: ""}});
    equipment.weapon = kit.weapon;
  }
  if ( kit.armor ) {
    items.push({name: kit.armor.profile.name, type: "armor", img: ICONS.armor, system: {identifier: kit.armor.id, equipped: true, description: ""}});
    equipment.armor = kit.armor.profile;
  }
  if ( kit.offhand ) {
    items.push({name: kit.offhand.profile.name, type: "offhand", img: ICONS.offhand, system: {identifier: kit.offhand.id, line: kit.offhand.line, tier: kit.offhand.tier, equipped: true, description: ""}});
    equipment.offhand = kit.offhand.profile;
  }
  if ( kit.sidearm ) {
    items.push({name: kit.sidearm.profile.name, type: "weapon", img: ICONS.weapon, system: {identifier: kit.sidearm.id, line: kit.sidearm.line, tier: kit.sidearm.tier, prefix: null, forge: 0, element: null, asSidearm: true, equipped: true, quantity: 1, description: ""}});
    equipment.offhand = kit.sidearm.profile;
  }
  if ( kit.accessory ) {
    items.push({name: kit.accessory.profile.name, type: "accessory", img: ICONS.accessory, system: {identifier: kit.accessory.id, key: kit.accessory.id, choices: {attribute: null, secondAttribute: null, skill: null, ...kit.accessory.choices}, equipped: true, description: ""}});
    equipment.accessories.push(kit.accessory.profile);
  }
  for ( const {id, data} of namedItems ) {
    const {name, ...system} = data;
    items.push({name: name ?? id, type: "named", img: ICONS.named, system: {...system, identifier: id, equipped: true}});
    const profile = {identifier: id, name: name ?? id, modifiers: data.modifiers ?? [], ...(data.stats ?? {})};
    if ( data.fills === "accessory" ) equipment.accessories.push(profile);
    else equipment[data.fills] = profile;
  }

  const npcId = `npc${capitalize(String(seed).replace(/[^A-Za-z0-9]/g, ""))}`;
  let personalSkillId = "";
  const wantsSkill = input.personalSkill || (profile !== "enemy");
  if ( wantsSkill ) {
    const pool = DEICIDE.personalSkills.pools[base.identifier] ?? [];
    const id = input.personalSkill ?? (pool.length ? pick(pool, rng).id : null);
    const item = id ? personalSkillItem(id, lookup, npcId) : null;
    if ( id && !item ) errors.push(`Unknown personal skill "${id}"`);
    if ( item ) { items.push(item); personalSkillId = id; }
  }
  const ownedAbilities = items.filter(item => item.type === "ability").map(item => item.system);

  const derived = deriveCharacter(source, {lookup, equipment, owned: ownedAbilities, context: {mode: "war", classCatalog: []}});
  source = {
    ...source,
    hp: {value: derived.hp.max}, channel: {value: derived.channel?.max ?? 0}, matter: {value: derived.matter?.max ?? 0},
    recruit: {profile: profile === "enemy" ? "" : profile, ownerId: null, status: profile === "enemy" ? "" : "known", personalSkillId, story: false, gmRun: true},
    standingPersonal: {}
  };

  const faction = input.faction ?? "lathander";
  const names = DEICIDE.generate.names[input.nameList ?? faction] ?? DEICIDE.generate.names.lathander;
  const name = input.name ?? `${pick(names.first, rng)} ${pick(names.family, rng)}`;
  const trait = pick(DEICIDE.generate.traits, rng);
  const kitNames = [kit.weapon?.name, kit.armor?.profile.name, kit.offhand?.profile.name, kit.sidearm?.profile.name, kit.accessory?.profile.name, ...namedItems.map(n => n.data.name)].filter(Boolean);
  const role = input.role ?? `${capitalize(profile)} ${activeData.name ?? capitalize(activeData.identifier)}`;
  const summary = `${name}, ${people.name ?? capitalize(input.people)} ${activeData.name ?? activeData.identifier} of ${FACTION_NAMES[faction] ?? capitalize(faction)}, level ${level}. ${role}. Carries ${listText(kitNames)}. ${givenName(name)} ${trait}.`;
  const notes = [`<p>${role}.</p>`, input.description ? `<p>${input.description}</p>` : "", personalSkillId ? `<p>Personal skill ${items.find(i => i.system.identifier === personalSkillId)?.name}: ${DEICIDE.personalSkills.byId[personalSkillId]?.summary ?? ""}.</p>` : "", `<p>${summary}</p>`].join("");
  const actor = {
    name, type: "character", img: ICONS.actor,
    system: {...source, notes},
    items,
    effects: [],
    prototypeToken: {name, actorLink: true, disposition: faction === "offweiss" ? -1 : 0, texture: {src: ICONS.actor}},
    flags: {deicide: {generated: {kind: "npc", seed, input: {...input, dials}}, faction}}
  };
  return {
    actor, summary, errors,
    detail: {
      level, P, totalCp100, ranks, budget, spent: kit.spent, remainder: kit.remainder, tier: kit.tier, row,
      kit: {weapon: kit.weapon?.identifier ?? null, armor: kit.armor?.id ?? null, offhand: kit.offhand?.id ?? kit.sidearm?.id ?? null, accessory: kit.accessory?.id ?? null, named: namedItems.map(n => n.id)},
      hp: derived.hp.max, attributes: derived.values, proficiencies: profs, personalSkillId
    }
  };
}

function listText(parts) {
  if ( parts.length <= 1 ) return parts[0] ?? "nothing";
  return `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}`;
}
