import {DEICIDE} from "../config.mjs";
import {tenthsFor, gradeIndex} from "./grades.mjs";
import {d100} from "../core/random.mjs";

const ATTRS = DEICIDE.attributeIds;

export function attributeRecord(value = 0) {
  return Object.fromEntries(ATTRS.map(attr => [attr, value]));
}

export function sumRecords(...records) {
  const total = attributeRecord(0);
  for ( const record of records ) {
    if ( !record ) continue;
    for ( const attr of ATTRS ) total[attr] += record[attr] ?? 0;
  }
  return total;
}

export function scaleLine(tenths, total) {
  const raw = ATTRS.map(attr => Math.max(tenths[attr] ?? 0, 0));
  const sum = raw.reduce((a, b) => a + b, 0);
  const target = Math.max(total, 0);
  if ( (sum === 0) || (sum === target) ) return Object.fromEntries(ATTRS.map((attr, i) => [attr, raw[i]]));
  const exact = raw.map(value => value * target / sum);
  const scaled = exact.map(Math.floor);
  let remaining = target - scaled.reduce((a, b) => a + b, 0);
  const order = exact
    .map((value, index) => ({index, fraction: value - Math.floor(value)}))
    .sort((a, b) => (b.fraction - a.fraction) || (a.index - b.index));
  for ( const {index} of order ) {
    if ( remaining <= 0 ) break;
    if ( raw[index] === 0 ) continue;
    scaled[index] += 1;
    remaining -= 1;
  }
  return Object.fromEntries(ATTRS.map((attr, i) => [attr, scaled[i]]));
}

export function lineTenths(letters) {
  return Object.fromEntries(ATTRS.map(attr => [attr, letters?.[attr] ? tenthsFor(letters[attr]) : 0]));
}

export function classGrowthLine(classData, {talent, people} = {}) {
  const tierTotal = DEICIDE.tierGrowthTenths[classData.tier] ?? 0;
  const total = tierTotal + (talent?.growth?.totalMod ?? 0);
  const line = scaleLine(lineTenths(classData.growth), total);
  for ( const [attr, letter] of Object.entries(people?.classGrowthLocks ?? {}) ) {
    line[attr] = Math.min(line[attr], tenthsFor(letter));
  }
  return line;
}

export function peopleGrowthLine(people, subtype) {
  const letters = people?.subtypes?.[subtype]?.growth ?? people?.growth ?? {};
  return lineTenths(letters);
}

export function talentGrowthLine(talent, choice, level) {
  const line = attributeRecord(0);
  const growth = talent?.growth;
  if ( !growth ) return line;
  for ( const [attr, value] of Object.entries(growth.perStat ?? {}) ) line[attr] += value;
  for ( const [choiceKey, value] of Object.entries(growth.chosen ?? {}) ) {
    const attr = choice?.[choiceKey];
    if ( attr in line ) line[attr] += value;
  }
  for ( const band of growth.allStats ?? [] ) {
    if ( (band.minLevel !== undefined) && (level < band.minLevel) ) continue;
    if ( (band.maxLevel !== undefined) && (level > band.maxLevel) ) continue;
    for ( const attr of ATTRS ) line[attr] += band.value;
  }
  return line;
}

export function levelGrowth({classData, people, peopleSubtype, personalGrowth, talent, talentChoice, level}) {
  const total = sumRecords(
    classGrowthLine(classData, {talent, people}),
    peopleGrowthLine(people, peopleSubtype),
    personalGrowth,
    talentGrowthLine(talent, talentChoice, level)
  );
  for ( const attr of ATTRS ) total[attr] = Math.max(total[attr], 0);
  return total;
}

export function validatePersonalGrowth(personalGrowth) {
  const errors = [];
  let total = 0;
  for ( const attr of ATTRS ) {
    const value = personalGrowth?.[attr] ?? 0;
    if ( !Number.isInteger(value) || (value < 0) ) errors.push(`${attr}: must be a whole number of tenths, 0 or more`);
    if ( value > DEICIDE.personalGrowthMaxPerStat ) errors.push(`${attr}: at most ${DEICIDE.personalGrowthMaxPerStat} tenths`);
    total += value;
  }
  if ( total !== DEICIDE.personalGrowthTenths ) errors.push(`total must be ${DEICIDE.personalGrowthTenths} tenths, got ${total}`);
  return {valid: errors.length === 0, total, errors};
}

export function capFor(classTier, growthGrade, bonus = 0) {
  const row = DEICIDE.caps[classTier];
  if ( !row ) throw new Error(`No cap row for class tier ${classTier}`);
  const cap = row[growthGrade ?? "F"];
  if ( cap === undefined ) throw new Error(`No cap for growth grade "${growthGrade}"`);
  return cap + bonus;
}

export function talentCapBonuses(talent, choice) {
  const bonus = attributeRecord(0);
  for ( const [attr, value] of Object.entries(talent?.caps?.flat ?? {}) ) bonus[attr] += value;
  for ( const [choiceKey, value] of Object.entries(talent?.caps?.chosen ?? {}) ) {
    const attr = choice?.[choiceKey];
    if ( attr in bonus ) bonus[attr] += value;
  }
  return bonus;
}

export function classCaps(classData, {talent, talentChoice, people} = {}) {
  const bonus = talentCapBonuses(talent, talentChoice);
  const caps = {};
  for ( const attr of ATTRS ) {

    const grade = people?.classGrowthLocks?.[attr] || classData.growth?.[attr] || "F";
    caps[attr] = capFor(classData.tier, grade, bonus[attr]);
  }
  return caps;
}

export function trainedAttributes(actorData) {
  const total = sumRecords(actorData.attributes);
  for ( const entry of actorData.growthLog ?? [] ) {
    for ( const attr of ATTRS ) total[attr] += entry.gains?.[attr] ?? 0;
  }
  for ( const bonus of actorData.promotionBonuses ?? [] ) {
    for ( const attr of ATTRS ) total[attr] += bonus.stats?.[attr] ?? 0;
  }
  for ( const bonus of actorData.rankBonuses ?? [] ) {
    if ( bonus.stat in total ) total[bonus.stat] += bonus.value ?? 1;
  }
  return total;
}

export function accumulatedClassHp(actorData) {
  return (actorData.growthLog ?? []).reduce((sum, entry) => sum + (entry.hp ?? 0), 0);
}

export function levelOneEntry(classData) {
  return {level: 1, classId: classData.identifier, tier: classData.tier, tenths: {}, gains: {}, hp: classData.hp ?? 0};
}

export function grantsFlex(talent, level) {
  const every = talent?.flex?.every;
  return Boolean(every) && (level % every === 0);
}

export function applyLevel(actorData, classData, peopleData, personalGrowth, talent, {rng = Math.random, flex = null} = {}) {
  const level = (actorData.level ?? 1) + 1;
  const talentChoice = actorData.talent ?? null;
  const tenths = levelGrowth({
    classData, people: peopleData, peopleSubtype: actorData.peopleSubtype, personalGrowth, talent, talentChoice, level
  });
  const caps = classCaps(classData, {talent, talentChoice, people: peopleData});
  const current = trainedAttributes(actorData);
  const remainder = sumRecords(actorData.growthTenths);
  const gains = {};
  const lost = {};
  const entry = {level, classId: classData.identifier, tier: classData.tier, tenths, gains, hp: classData.hp ?? 0};

  if ( talent?.wild ) {

    entry.rolls = {};
    for ( const attr of ATTRS ) {
      const roll = d100(rng);
      entry.rolls[attr] = roll;
      const guaranteed = Math.floor(tenths[attr] / 10);
      const chance = (tenths[attr] % 10) * 10;
      const rolled = guaranteed + (roll <= chance ? 1 : 0);
      const room = Math.max(caps[attr] - current[attr], 0);
      const gain = Math.min(rolled, room);
      if ( gain > 0 ) gains[attr] = gain;
      if ( rolled > gain ) lost[attr] = (rolled - gain) * 10;
      current[attr] += gain;
    }
  }
  else {
    for ( const attr of ATTRS ) {
      if ( current[attr] >= caps[attr] ) {
        if ( tenths[attr] > 0 ) lost[attr] = tenths[attr];
        continue;
      }
      remainder[attr] += tenths[attr];
      while ( remainder[attr] >= 10 ) {
        if ( current[attr] >= caps[attr] ) {
          lost[attr] = (lost[attr] ?? 0) + remainder[attr];
          remainder[attr] = 0;
          break;
        }
        remainder[attr] -= 10;
        current[attr] += 1;
        gains[attr] = (gains[attr] ?? 0) + 1;
      }
    }
  }

  if ( grantsFlex(talent, level) ) {
    entry.flex = null;
    if ( flex && (flex in current) && (current[flex] < caps[flex]) ) {
      entry.flex = flex;
      gains[flex] = (gains[flex] ?? 0) + 1;
      current[flex] += 1;
    }
  }

  if ( Object.keys(lost).length ) entry.lost = lost;
  return {
    level,
    growthTenths: remainder,
    growthLog: [...(actorData.growthLog ?? []), entry],
    entry,
    current
  };
}

export function assignFlex(actorData, level, attr, caps) {
  const log = actorData.growthLog ?? [];
  const index = log.findIndex(entry => (entry.level === level) && ("flex" in entry) && (entry.flex === null));
  if ( index < 0 ) return null;
  const current = trainedAttributes(actorData);
  if ( !(attr in current) || (current[attr] >= caps[attr]) ) return null;
  const entry = {...log[index], flex: attr, gains: {...log[index].gains}};
  entry.gains[attr] = (entry.gains[attr] ?? 0) + 1;
  return log.toSpliced(index, 1, entry);
}

export function promotionBonusFor(classData) {
  const amount = DEICIDE.promotionBonus[classData.tier] ?? 0;
  const stats = {};
  if ( !amount ) return stats;
  for ( const attr of ATTRS ) {
    if ( DEICIDE.promotionGrades.includes(classData.growth?.[attr]) ) stats[attr] = amount;
  }
  return stats;
}

export function applyPromotion(actorData, classData, caps) {
  const existing = actorData.promotionBonuses ?? [];
  if ( existing.some(bonus => bonus.tier === classData.tier) ) return existing;
  const wanted = promotionBonusFor(classData);
  if ( !Object.keys(wanted).length ) return existing;
  const current = trainedAttributes(actorData);
  const stats = {};
  for ( const [attr, amount] of Object.entries(wanted) ) {
    const granted = Math.min(amount, Math.max(caps[attr] - current[attr], 0));
    if ( granted > 0 ) stats[attr] = granted;
  }
  return [...existing, {tier: classData.tier, classId: classData.identifier, stats}];
}

export function highestGrowthStats(classData) {
  let best = -1;
  let stats = [];
  for ( const attr of ATTRS ) {
    const index = gradeIndex(classData.growth?.[attr] ?? "F");
    if ( index > best ) { best = index; stats = [attr]; }
    else if ( index === best ) stats.push(attr);
  }
  return best > 0 ? stats : [];
}

export function applyRankBonus(actorData, classData, rank, caps, stat) {
  const existing = actorData.rankBonuses ?? [];
  if ( !DEICIDE.rankAttributeBonusRanks.includes(rank) ) return existing;
  if ( existing.some(bonus => (bonus.classId === classData.identifier) && (bonus.rank === rank)) ) return existing;
  const candidates = highestGrowthStats(classData);
  const chosen = candidates.includes(stat) ? stat : candidates[0];
  if ( !chosen ) return existing;
  const current = trainedAttributes(actorData);
  if ( current[chosen] >= caps[chosen] ) return existing;
  return [...existing, {classId: classData.identifier, rank, stat: chosen, value: 1}];
}

export function rankForCp(cp) {
  let rank = 1;
  for ( let i = 0; i < DEICIDE.rankCp.length; i++ ) {
    if ( cp >= DEICIDE.rankCp[i] ) rank = i + 1;
  }
  return rank;
}

export function cpForRank(rank) {
  return DEICIDE.rankCp[Math.min(Math.max(rank, 1), DEICIDE.maxRank) - 1];
}
