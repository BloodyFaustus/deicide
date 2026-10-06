export const attributes = {
  str: {label: "DEICIDE.Attribute.str", abbr: "STR"},
  mag: {label: "DEICIDE.Attribute.mag", abbr: "MAG", noManaLabel: "DEICIDE.Attribute.alchemy", noManaAbbr: "ALC"},
  skl: {label: "DEICIDE.Attribute.skl", abbr: "SKL"},
  spd: {label: "DEICIDE.Attribute.spd", abbr: "SPD"},
  def: {label: "DEICIDE.Attribute.def", abbr: "DEF"},
  res: {label: "DEICIDE.Attribute.res", abbr: "RES"},
  cmd: {label: "DEICIDE.Attribute.cmd", abbr: "CMD"}
};

export const attributeIds = Object.keys(attributes);

export const attributeBase = 6;

export const attributeBands = {
  mortal: {min: 1, max: 30},
  hero: {min: 31, max: 40},
  divine: {min: 41, max: 50}
};

export const grades = {
  "F": [1, 4],
  "E": [5, 8],
  "D": [9, 12],
  "C": [13, 16],
  "B": [17, 20],
  "A": [21, 24],
  "S": [25, 28],
  "S+": [29, 30],
  "SS": [31, 40],
  "SSS": [41, 50]
};

export const gradeOrder = ["F", "E", "D", "C", "B", "A", "S", "S+", "SS", "SSS"];

export const growthTenths = {F: 0, E: 1, D: 2, C: 3, B: 5, A: 7, S: 9};

export const qualityGrades = {1: "D", 2: "C", 3: "B", 4: "A", 5: "S"};

export const formulas = {
  hp: "20 + 2 * level + classHp + bonus",
  channel: "4 + floor(mag / 2) + floor(res / 2)",
  commandRadius: "1 + floor(cmd / 5)",
  matterCap: "6 + floor(str / 4)",
  delay: "10 * weight - 2 * spd",
  hit: "75 + 2 * skl + weaponAcc - (2 * targetSpd + terrainAvoid)",
  crit: "floor(skl / 2) + weaponCrit",
  xpToNext: "50 * level",
  xpTotal: "25 * L * (L - 1)",
  pacing: "25 * L * (L - 1) / (480 * S)",
  price: "floor(pp * pp / 5)",
  flee: "50 + 2 * spd - 2 * fastestEnemySpd",
  terrainBarrier: "4 * mag",
  wardedBreak: "2 * mag"
};

export const damage = {
  minimum: 1,
  critMultiplier: 1.5
};
