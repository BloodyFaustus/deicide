import {DEICIDE} from "../config.mjs";
import {Registry} from "../core/registry.mjs";
import {gradeAtLeast, gradeIndex, maxGrade, stepGrade} from "./grades.mjs";

export const CHOSEN_WEAPON = "chosenWeapon";

export const ANY_WEAPON = "anyWeapon";

export function weaponProficiencies() {
  return DEICIDE.proficiencyIds.filter(id => DEICIDE.proficiencies[id].weapon);
}

export function gradeForRank(rank, pace) {
  const table = DEICIDE.rankProficiency[pace];
  let grade = null;
  for ( const [threshold, value] of Object.entries(table) ) {
    if ( rank >= Number(threshold) ) grade = maxGrade(grade, value);
  }
  return grade;
}

export function resolveTraining(entry, choices) {
  if ( entry === CHOSEN_WEAPON ) return choices?.weapon ?? null;
  return entry;
}

export function proficiencies(classes, {starting = [], pace = {}, steps = {}} = {}) {
  const grades = Object.fromEntries(DEICIDE.proficiencyIds.map(id => [id, null]));
  const raise = (id, grade) => {
    if ( (id in grades) && grade ) grades[id] = maxGrade(grades[id], grade);
  };

  for ( const {data, rank, choices} of classes ?? [] ) {
    if ( !data || !(rank >= 1) ) continue;
    for ( const entry of data.trains?.primary ?? [] ) {
      raise(resolveTraining(entry, choices), gradeForRank(rank, "primary"));
    }
    for ( const entry of data.trains?.secondary ?? [] ) {
      const id = resolveTraining(entry, choices);
      raise(id, gradeForRank(rank, pace[id] === "primary" ? "primary" : "secondary"));
    }
  }

  for ( const [id, count] of Object.entries(steps) ) {
    if ( grades[id] ) grades[id] = stepGrade(grades[id], count, "S");
  }
  for ( const record of starting ) {
    for ( const [id, grade] of Object.entries(record ?? {}) ) raise(id, grade);
  }
  return grades;
}

export const prerequisiteKinds = new Registry("prerequisiteKinds");

prerequisiteKinds.registerAll({
  prof: (leaf, context) => {
    if ( leaf.prof === ANY_WEAPON ) {
      return weaponProficiencies().some(id => gradeAtLeast(context.proficiencies?.[id], leaf.grade));
    }
    return gradeAtLeast(context.proficiencies?.[leaf.prof], leaf.grade);
  },
  story: (leaf, context) => (context.storyGates ?? []).includes(leaf.story),
  saturation: (leaf, context) => (context.saturation ?? 0) >= leaf.saturation,
  marks: (leaf, context) => (context.marks ?? 0) >= leaf.marks,
  level: (leaf, context) => (context.level ?? 1) >= leaf.level
});

function describeLeaf(leaf) {
  if ( "prof" in leaf ) return {kind: "prof", prof: leaf.prof, grade: leaf.grade};
  const kind = Object.keys(leaf).find(key => prerequisiteKinds.has(key)) ?? "unknown";
  return {kind, value: leaf[kind]};
}

export function evaluatePrerequisite(node, context) {
  if ( !node || (Object.keys(node).length === 0) ) return {ok: true, missing: []};
  if ( Array.isArray(node.all) ) {
    const results = node.all.map(child => evaluatePrerequisite(child, context));
    return {ok: results.every(result => result.ok), missing: results.flatMap(result => result.missing)};
  }
  if ( Array.isArray(node.any) ) {
    const results = node.any.map(child => evaluatePrerequisite(child, context));
    if ( results.some(result => result.ok) ) return {ok: true, missing: []};
    const closest = results.reduce((best, result) => (result.missing.length < best.missing.length) ? result : best);
    return {ok: false, missing: closest.missing};
  }
  const kind = Object.keys(node).find(key => prerequisiteKinds.has(key));
  const ok = kind ? Boolean(prerequisiteKinds.get(kind)(node, context)) : false;
  return {ok, missing: ok ? [] : [describeLeaf(node)]};
}

export function tierGatesFor(levelCap) {
  const caps = Object.keys(DEICIDE.tierGates).map(Number).sort((a, b) => a - b);
  let chosen = caps[0];
  for ( const cap of caps ) {
    if ( cap <= levelCap ) chosen = cap;
  }
  return DEICIDE.tierGates[chosen];
}

export function levelGateFor(tier, tierGates) {
  if ( tier <= 1 ) return 1;
  return tierGates[tier - 2] ?? Infinity;
}

export function meetsPrereq(classData, profs, level, tierGates, context = {}) {
  const levelGate = levelGateFor(classData.tier, tierGates);
  const levelOk = level >= levelGate;
  const full = {...context, proficiencies: profs, level};
  const result = evaluatePrerequisite(classData.prerequisites, full);
  const storyOk = !classData.storyGate || (context.storyGates ?? []).includes(classData.storyGate);
  const missing = [...result.missing];
  if ( !levelOk ) missing.push({kind: "level", value: levelGate});
  if ( !storyOk ) missing.push({kind: "story", value: classData.storyGate});
  return {
    ok: levelOk && storyOk && result.ok,
    levelOk, storyOk, prerequisitesOk: result.ok, levelGate, missing
  };
}

export function meetsWeaponGate(proficiency, tier, profs) {
  const gate = DEICIDE.weaponTierGates[tier];
  if ( !gate ) return true;
  return gradeAtLeast(profs?.[proficiency], gate);
}

export function meetsRequirement(requires, context) {
  if ( !requires ) return true;
  if ( Array.isArray(requires.anyOf) ) return requires.anyOf.some(option => meetsRequirement(option, context));
  for ( const [key, value] of Object.entries(requires) ) {
    if ( key === "classType" ) {
      if ( !(context.classTypes ?? []).includes(value) ) return false;
    }
    else if ( key in DEICIDE.proficiencies ) {
      if ( !gradeAtLeast(context.proficiencies?.[key], value) ) return false;
    }
    else return false;
  }
  return true;
}

export function sortByGrade(profs) {
  return Object.entries(profs).sort((a, b) => gradeIndex(b[1]) - gradeIndex(a[1])).map(([id]) => id);
}
