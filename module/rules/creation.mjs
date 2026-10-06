import {DEICIDE} from "../config.mjs";
import {attributeRecord, cp100ForRank, levelOneEntry, sumRecords, validatePersonalGrowth} from "./growth.mjs";

const ATTRS = DEICIDE.attributeIds;

export function validateTalentPlacement(talent, placement) {
  const errors = [];
  const start = talent?.start;
  if ( !start ) return {valid: true, errors};
  let total = 0;
  for ( const attr of ATTRS ) {
    const value = placement?.[attr] ?? 0;
    if ( !Number.isInteger(value) || (value < 0) ) errors.push(`${attr}: must be a whole number, 0 or more`);
    if ( value > start.maxPerStat ) errors.push(`${attr}: at most ${start.maxPerStat}`);
    total += value;
  }
  if ( total !== start.points ) errors.push(`total must be ${start.points}, got ${total}`);
  return {valid: errors.length === 0, errors};
}

export function startingClasses(baseClass, background, choices = {}) {
  const ranks = new Map([[baseClass.identifier, 1]]);
  for ( const grant of background?.grants?.classes ?? [] ) {
    ranks.set(grant.id, Math.max(ranks.get(grant.id) ?? 0, grant.rank ?? 1));
  }
  const classes = Array.from(ranks.entries()).map(([id, rank]) => ({
    id, rank, cp100: cp100ForRank(rank), choices: choices[id] ?? {}
  }));
  return {classes, activeClass: background?.grants?.activeClass ?? baseClass.identifier};
}

export function createCharacter(inputs, lookup) {
  const errors = [];
  const people = lookup("origin", inputs.people);
  const background = lookup("origin", inputs.background);
  const baseClass = lookup("class", inputs.baseClass);
  const talent = inputs.talent?.id ? lookup("origin", inputs.talent.id) : null;
  if ( !people ) errors.push(`Unknown people "${inputs.people}"`);
  if ( inputs.background && !background ) errors.push(`Unknown background "${inputs.background}"`);
  if ( !baseClass ) errors.push(`Unknown base class "${inputs.baseClass}"`);
  if ( inputs.talent?.id && !talent ) errors.push(`Unknown Talent "${inputs.talent.id}"`);
  if ( !baseClass ) return {system: null, errors};

  const subtype = people?.subtypes?.[inputs.peopleSubtype] ?? null;
  const personalGrowth = sumRecords(inputs.personalGrowth);
  if ( inputs.personalGrowth ) {
    const check = validatePersonalGrowth(personalGrowth);
    if ( !check.valid ) errors.push(...check.errors.map(error => `Personal growth: ${error}`));
  }
  const placement = talent?.start ? sumRecords(inputs.talent?.placement) : null;
  if ( talent?.start ) {
    const check = validateTalentPlacement(talent, placement);
    if ( !check.valid ) errors.push(...check.errors.map(error => `Talent placement: ${error}`));
  }

  const attributes = sumRecords(
    attributeRecord(DEICIDE.attributeBase),
    inputs.startSpread ?? baseClass.startSpread,
    background?.points,
    placement,
    subtype?.startBonus
  );

  const starting = startingClasses(baseClass, background, inputs.classChoices);
  const classes = inputs.classes
    ? inputs.classes.map(entry => ({id: entry.id, rank: entry.rank ?? 1, cp100: entry.cp100 ?? cp100ForRank(entry.rank ?? 1), choices: entry.choices ?? {}}))
    : starting.classes;
  const activeClass = inputs.activeClass ?? starting.activeClass;
  const activeData = lookup("class", activeClass) ?? baseClass;

  const flags = {...(people?.flags ?? {}), ...(subtype?.flags ?? {}), ...(background?.flags ?? {})};
  const grants = background?.grants ?? {};
  const tracksSaturation = Boolean(flags.saturation) && !flags.noSaturation;

  const talentChoice = inputs.talent?.id
    ? {
      id: inputs.talent.id,
      stat: inputs.talent.stat ?? null,
      penaltyStat: inputs.talent.penaltyStat ?? null,
      proficiency: inputs.talent.proficiency ?? null,
      placement: placement ?? {}
    }
    : {id: null, stat: null, penaltyStat: null, proficiency: null, placement: {}};

  const standing = {};
  for ( const faction of Object.keys(DEICIDE.factions) ) standing[faction] = DEICIDE.standing.default;
  for ( const [faction, value] of Object.entries(grants.standingBonus ?? {}) ) standing[faction] = (standing[faction] ?? DEICIDE.standing.default) + value;
  for ( const [faction, value] of Object.entries(grants.standing ?? {}) ) standing[faction] = value;

  const system = {
    level: 1,
    xp: 0,
    attributes,
    growthTenths: attributeRecord(0),
    growthLog: [levelOneEntry(activeData)],
    promotionBonuses: [],
    rankBonuses: [],
    adaptations: [],
    people: inputs.people,
    peopleSubtype: inputs.peopleSubtype ?? "",
    background: inputs.background,
    talent: talentChoice,
    personalGrowth,
    classes,
    activeClass,
    loadout: {secondary: null, reaction: null, supports: [], stance: null},
    manaburn: flags.noManaburn ? null : (grants.manaburn ?? 0),
    saturation: tracksSaturation ? 0 : null,
    marks: 0,
    divineAttention: 0,
    static: 0,
    stolen: [],
    standingFaction: standing,
    dust: DEICIDE.economy.startingDust,
    storyGates: [...(grants.storyGates ?? [])]
  };
  return {system, errors};
}

export function issuedKit(classData) {
  const kit = classData?.kit ?? {};
  return {weapon: kit.weapon ?? null, offhand: kit.offhand ?? null, armor: kit.armor ?? null};
}
