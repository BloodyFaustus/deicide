import {DEICIDE} from "../config.mjs";
import {evaluate} from "../core/expression.mjs";

const capitalize = text => text.charAt(0).toUpperCase() + text.slice(1);

export function titleFromId(id) {
  return id.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, c => c.toUpperCase());
}

export function price(pp) {
  return evaluate(DEICIDE.weaponGenerator.price, {pp});
}

export function weaponId({line, tier, prefix = null}) {
  return `${tier}${prefix ? capitalize(prefix) : ""}${capitalize(line)}`;
}

export function parseWeaponId(id) {
  const {lines, tiers, prefixes} = DEICIDE.weaponGenerator;
  for ( const tier of Object.keys(tiers) ) {
    if ( !id.startsWith(tier) ) continue;
    const rest = id.slice(tier.length);
    for ( const line of Object.keys(lines) ) {
      if ( rest === capitalize(line) ) return {tier, prefix: null, line};
      for ( const prefix of Object.keys(prefixes) ) {
        if ( rest === capitalize(prefix) + capitalize(line) ) return {tier, prefix, line};
      }
    }
  }
  return null;
}

export function prefixAllowed(prefix, line, tier) {
  const definition = DEICIDE.weaponGenerator.prefixes[prefix];
  if ( !definition ) return false;
  if ( (definition.allowed !== "any") && !definition.allowed.includes(line) ) return false;
  if ( definition.tiers && !definition.tiers.includes(tier) ) return false;
  return true;
}

export function weaponProfile({line, tier, prefix = null, forge = 0, element = null}) {
  const generator = DEICIDE.weaponGenerator;
  const base = generator.lines[line];
  const tierData = generator.tiers[tier];
  if ( !base ) throw new Error(`Unknown weapon line "${line}"`);
  if ( !tierData ) throw new Error(`Unknown weapon tier "${tier}"`);
  const prefixData = prefix ? generator.prefixes[prefix] : null;
  if ( prefix && !prefixData ) throw new Error(`Unknown weapon prefix "${prefix}"`);
  if ( prefix && !prefixAllowed(prefix, line, tier) ) {
    throw new Error(`Prefix "${prefix}" is not allowed on a ${tier} ${line}`);
  }

  const caster = DEICIDE.casterLines.includes(line);
  const forgeLevel = Math.min(Math.max(forge, 0), generator.forge.maxLevel);
  const prefixMight = prefixData?.might ?? 0;
  const forgeMight = forgeLevel * generator.forge.mightPerLevel;

  const profile = {
    identifier: weaponId({line, tier, prefix}),
    name: titleFromId(weaponId({line, tier, prefix})),
    line, tier, prefix, forge: forgeLevel,
    prof: base.prof,
    gate: tierData.gate,
    caster,
    acc: base.acc + tierData.acc + (prefixData?.acc ?? 0) + forgeLevel * generator.forge.accPerLevel,
    crit: (base.crit ?? 0) + tierData.crit + (prefixData?.crit ?? 0),
    pp: base.pp + tierData.pp + (prefixData?.pp ?? 0),
    res: prefixData?.res ?? 0,
    effectiveVs: prefixData?.effectiveVs ?? null,
    attacksTwice: Boolean(prefixData?.attacksTwice),
    element: prefixData?.elementTag ? (element ?? null) : null,
    channelPerAttack: prefixData?.channelPerAttack ?? 0,
    drawbacks: base.drawback ? [base.drawback] : []
  };

  if ( caster ) {

    const bonus = tierData.casterBonus + prefixMight + forgeMight;
    profile.might = 0;
    profile.range = null;
    profile.weight = null;
    profile.spellBonus = ("spellBonus" in base) ? bonus : 0;
    profile.healBonus = ("healBonus" in base) ? bonus : 0;
    profile.alchemyBonus = ("alchemyBonus" in base) ? bonus : 0;
    profile.channel = ("channel" in base) ? tierData.casterChannel : 0;
    profile.matter = ("matter" in base) ? tierData.casterMatter : 0;
    profile.spellWeight = tierData.casterSpellWeight ?? 0;
  }
  else {
    profile.might = base.might + tierData.might + prefixMight + forgeMight;
    const range = prefixData?.range ? [...prefixData.range] : [...base.range];
    range[1] += prefixData?.rangeMax ?? 0;
    profile.range = range;
    profile.weight = base.weight + tierData.weight + (prefixData?.weight ?? 0);
    profile.spellBonus = 0;
    profile.healBonus = 0;
    profile.alchemyBonus = 0;
    profile.channel = 0;
    profile.matter = 0;
    profile.spellWeight = 0;
  }

  profile.price = price(profile.pp);
  profile.modifiers = weaponModifiers(profile);
  return profile;
}

function weaponModifiers(profile) {
  const modifiers = [];
  if ( profile.channel ) modifiers.push({key: "channel.max", value: profile.channel});
  if ( profile.matter ) modifiers.push({key: "matter.max", value: profile.matter});
  if ( profile.res ) modifiers.push({key: "defense.res", value: profile.res});
  if ( profile.spellWeight ) modifiers.push({key: "weight", value: profile.spellWeight, when: {actionSource: "spell"}});
  return modifiers;
}

export function generatedWeaponSpecs() {
  const generator = DEICIDE.weaponGenerator;
  const tiers = Object.keys(generator.tiers);
  const specs = [];
  for ( const line of DEICIDE.martialLines ) {
    for ( const tier of tiers ) {
      specs.push({line, tier, prefix: null});
      for ( const prefix of Object.keys(generator.prefixes) ) {
        if ( prefixAllowed(prefix, line, tier) ) specs.push({line, tier, prefix});
      }
    }
  }
  for ( const line of DEICIDE.casterLines ) {
    for ( const tier of tiers ) specs.push({line, tier, prefix: null});
  }
  return specs;
}

export function forgeCost(level) {
  return DEICIDE.weaponGenerator.forge.cost[level - 1] ?? null;
}

export function armorProfile(id) {
  const row = DEICIDE.armor[id];
  if ( !row ) throw new Error(`Unknown armor "${id}"`);
  const burden = DEICIDE.burden[row.burden] ?? DEICIDE.burden[0];
  const modifiers = [];
  if ( row.def ) modifiers.push({key: "defense.def", value: row.def});
  if ( row.res ) modifiers.push({key: "defense.res", value: row.res});
  if ( row.avoid ) modifiers.push({key: "avoid", value: row.avoid});
  if ( row.hp ) modifiers.push({key: "hp.max", value: row.hp});
  if ( burden.delay ) modifiers.push({key: "delay", value: burden.delay, when: {engine: "dungeon"}});
  if ( burden.avoid ) modifiers.push({key: "avoid", value: burden.avoid, when: {engine: "war"}});
  return {identifier: id, name: `${titleFromId(id)} Armor`, ...row, modifiers};
}

export function offhandId(line, tier) {
  return `${tier}${capitalize(line)}`;
}

export function offhandProfile(line, tier) {
  const definition = DEICIDE.offhand[line];
  const cell = definition?.tiers?.[tier];
  if ( !cell ) throw new Error(`No ${tier} ${line} offhand exists`);
  const modifiers = [];
  if ( cell.def ) modifiers.push({key: "defense.def", value: cell.def});
  if ( cell.res ) modifiers.push({key: "defense.res", value: cell.res});
  if ( cell.avoid ) modifiers.push({key: "avoid", value: cell.avoid});
  if ( cell.move ) modifiers.push({key: "move", value: cell.move});
  if ( cell.channel ) modifiers.push({key: "channel.max", value: cell.channel});
  if ( cell.matter ) modifiers.push({key: "matter.max", value: cell.matter});
  if ( cell.harvest ) modifiers.push({key: "harvest.yield", value: cell.harvest});
  if ( cell.acc ) modifiers.push({key: "hit", value: cell.acc, when: {actionSource: "weapon"}});
  if ( cell.spellAcc ) modifiers.push({key: "hit", value: cell.spellAcc, when: {actionSource: "spell"}});
  if ( cell.commandRadius ) modifiers.push({key: "commandRadius", value: cell.commandRadius});
  const identifier = offhandId(line, tier);
  return {
    identifier,
    name: titleFromId(identifier),
    line, tier,
    requires: definition.requires ?? null,
    price: cell.price ?? DEICIDE.tiers[tier].offhandPrice,
    ...cell,
    modifiers
  };
}

export function generatedOffhandSpecs() {
  const specs = [];
  for ( const [line, definition] of Object.entries(DEICIDE.offhand) ) {
    for ( const tier of Object.keys(definition.tiers) ) specs.push({line, tier});
  }
  return specs;
}

export function accessoryProfile(id, {attribute = null, secondAttribute = null} = {}) {
  const row = DEICIDE.accessories[id];
  if ( !row ) throw new Error(`Unknown accessory "${id}"`);
  const modifiers = [];
  if ( row.attribute && attribute ) {
    modifiers.push({key: `attributes.${attribute}`, value: row.attribute, accessory: true});
  }
  if ( row.secondAttribute && secondAttribute ) {
    modifiers.push({key: `attributes.${secondAttribute}`, value: row.secondAttribute, accessory: true});
  }
  if ( row.avoid ) modifiers.push({key: "avoid", value: row.avoid});
  if ( row.move ) modifiers.push({key: "move", value: row.move});
  if ( row.hp ) modifiers.push({key: "hp.max", value: row.hp});
  if ( row.def ) modifiers.push({key: "defense.def", value: row.def});
  if ( row.channel ) modifiers.push({key: "channel.max", value: row.channel});
  if ( row.overcastBurn ) modifiers.push({key: "overcast.burnPerPoint", value: row.overcastBurn});
  if ( row.matter ) modifiers.push({key: "matter.max", value: row.matter});
  if ( row.harvest ) modifiers.push({key: "harvest.yield", value: row.harvest});
  if ( row.acc ) modifiers.push({key: "hit", value: row.acc});
  if ( row.crit ) modifiers.push({key: "crit", value: row.crit});
  if ( row.commandRadius ) modifiers.push({key: "commandRadius", value: row.commandRadius});
  return {
    identifier: id,
    name: DEICIDE.accessoryNames[id] ?? titleFromId(id),
    ...row,
    immune: row.immune ?? [],
    modifiers
  };
}

export function shopPrice(listPrice, {shop = "village", standing = null, dustCollapse = false, patronMultiplier = 1} = {}) {
  let multiplier = DEICIDE.economy.shops[shop]?.multiplier ?? 1;
  if ( standing !== null ) {
    const band = DEICIDE.standing.bands.find(entry => (standing >= entry.min) && (standing <= entry.max));
    if ( band && !band.shops ) return null;
    multiplier *= band?.shopMultiplier ?? 1;
  }
  if ( dustCollapse ) multiplier *= DEICIDE.economy.dustCollapse.priceMultiplier;
  multiplier *= patronMultiplier;
  return Math.ceil(listPrice * multiplier);
}

export function sellPrice(listPrice, {named = false} = {}) {
  if ( named ) return null;
  return Math.floor(listPrice * DEICIDE.economy.sellFraction);
}

export function powerPoints(benefits, drawbacks = []) {
  let benefit = 0;
  for ( const {cost, count = 1} of benefits ) {
    if ( !(cost in DEICIDE.ppCosts) ) throw new Error(`Unknown PP cost "${cost}"`);
    benefit += DEICIDE.ppCosts[cost] * count;
  }
  let refund = 0;
  for ( const {refund: key, count = 1} of drawbacks ) {
    if ( !(key in DEICIDE.ppRefunds) ) throw new Error(`Unknown PP refund "${key}"`);
    refund += DEICIDE.ppRefunds[key] * count;
  }
  return {benefit, refund, total: benefit - refund};
}

export function companyUpgradeCost(newQuality) {
  return DEICIDE.company.upgradeCostPerQuality * newQuality;
}

export function fundTrackCost(value) {
  return DEICIDE.payouts.fundTrackCostPerValue * value;
}

export function promotionCost(tier, {crownPatron = false} = {}) {
  const cost = DEICIDE.commissions[tier];
  if ( !cost ) return null;

  const multiplier = crownPatron ? DEICIDE.commissions.crownPatronMultiplier : 1;
  return {dust: Math.ceil(cost.dust * multiplier), legitimacy: cost.legitimacy};
}
