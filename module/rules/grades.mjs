import {DEICIDE} from "../config.mjs";

export function gradeFor(value) {
  for ( const grade of DEICIDE.gradeOrder ) {
    if ( value <= DEICIDE.grades[grade][1] ) return grade;
  }
  return DEICIDE.gradeOrder.at(-1);
}

export function tenthsFor(growthGrade) {
  const tenths = DEICIDE.growthTenths[growthGrade];
  if ( tenths === undefined ) throw new Error(`Unknown growth grade "${growthGrade}"`);
  return tenths;
}

export function gradeIndex(grade) {
  if ( (grade === null) || (grade === undefined) || (grade === "") ) return 0;
  const index = DEICIDE.gradeOrder.indexOf(grade);
  if ( index < 0 ) throw new Error(`Unknown grade "${grade}"`);
  return index;
}

export function gradeAtLeast(a, b) {
  return gradeIndex(a) >= gradeIndex(b);
}

export function maxGrade(a, b) {
  return gradeIndex(a) >= gradeIndex(b) ? (a ?? null) : (b ?? null);
}

export function stepGrade(grade, steps, ceiling = "S") {
  const index = Math.min(Math.max(gradeIndex(grade) + steps, 0), gradeIndex(ceiling));
  return DEICIDE.gradeOrder[index];
}

export function qualityGrade(quality) {
  const clamped = Math.min(Math.max(Math.round(quality), 1), 5);
  return DEICIDE.qualityGrades[clamped];
}

export function formatGraded(label, value) {
  return `${label} ${value} (${gradeFor(value)})`;
}

export function formatCapped(value, cap) {
  return `${value}/${cap} (${gradeFor(value)})`;
}
