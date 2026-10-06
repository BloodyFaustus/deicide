export const benchmarks = [
  {level: 1, partyHp: 25, partyDef: 8, stdHp: 20, stdDef: 7, stdMight: 12, bossHp: 120, bossDef: 9, bossSingle: 22, bossArea: 16, companyQ: 1},
  {level: 5, partyHp: 40, partyDef: 11, stdHp: 35, stdDef: 9, stdMight: 16, bossHp: 200, bossDef: 12, bossSingle: 28, bossArea: 20, companyQ: 2},
  {level: 10, partyHp: 55, partyDef: 14, stdHp: 50, stdDef: 12, stdMight: 22, bossHp: 320, bossDef: 15, bossSingle: 34, bossArea: 26, companyQ: 3},
  {level: 15, partyHp: 75, partyDef: 18, stdHp: 70, stdDef: 15, stdMight: 28, bossHp: 420, bossDef: 19, bossSingle: 40, bossArea: 32, companyQ: 3},
  {level: 20, partyHp: 100, partyDef: 22, stdHp: 90, stdDef: 18, stdMight: 34, bossHp: 500, bossDef: 22, bossSingle: 46, bossArea: 38, companyQ: 4},
  {level: 25, partyHp: 130, partyDef: 26, stdHp: 105, stdDef: 21, stdMight: 40, bossHp: 600, bossDef: 26, bossSingle: 52, bossArea: 44, companyQ: 5},
  {level: 30, partyHp: 170, partyDef: 30, stdHp: 120, stdDef: 24, stdMight: 46, bossHp: 700, bossDef: 29, bossSingle: 58, bossArea: 50, companyQ: 5}
];

export const enemyFormulas = {
  standardDef: "round(6 + 0.6 * level)",
  bossDef: "round(8 + 0.7 * level)",
  res: "def - 2",
  monsterHit: "70 + 5 * floor(level / 3)",
  monsterAvoid: "2 * spd",
  bossHpScale: "N / 4"
};

export const difficulty = {
  easy: {levelOffset: -2, count: [0, 0], multiplier: 0.5},
  standard: {levelOffset: 0, count: [0, 2], multiplier: 1},
  hard: {levelOffset: 2, count: [2, 3], multiplier: 1.5, altCountMultiplier: 1.5},
  deadly: {levelOffset: 4, count: [3, 4], multiplier: 2, altCountMultiplier: 2}
};

export const bossDifficultyRows = {standard: 0, hard: 2, deadly: 4};

export const bossLevelGap = 5;

export const monsterTags = {
  beast: {label: "DEICIDE.MonsterTag.beast"},
  swarm: {label: "DEICIDE.MonsterTag.swarm", diesToBlast: true, immuneSingleTargetCrit: true},
  undead: {label: "DEICIDE.MonsterTag.undead", weakTo: ["divine"]},
  plant: {label: "DEICIDE.MonsterTag.plant"},
  construct: {label: "DEICIDE.MonsterTag.construct"},
  homunculus: {label: "DEICIDE.MonsterTag.homunculus", weakTo: ["divine"], fixedDelay: 30},
  divine: {label: "DEICIDE.MonsterTag.divine", divineBeing: true},
  boss: {label: "DEICIDE.MonsterTag.boss", noGuard: true}
};
