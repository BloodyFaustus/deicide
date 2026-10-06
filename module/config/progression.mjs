export const tierGrowthTenths = {1: 20, 2: 25, 3: 30, 4: 32};

export const peopleGrowthTenths = 6;

export const personalGrowthTenths = 6;
export const personalGrowthMaxPerStat = 3;

export const caps = {
  1: {S: 20, A: 19, B: 18, C: 17, D: 16, E: 15, F: 15},
  2: {S: 26, A: 25, B: 23, C: 21, D: 19, E: 17, F: 17},
  3: {S: 30, A: 29, B: 27, C: 25, D: 23, E: 21, F: 21},
  4: {S: 30, A: 30, B: 28, C: 26, D: 24, E: 22, F: 22}
};

export const accessoryCapOverflow = 2;

export const adaptationCap = 40;

export const promotionBonus = {2: 1, 3: 2};

export const promotionGrades = ["A", "S"];

export const rankCp = [0, 3, 7, 12, 18, 25, 33, 42, 52, 63];

export const maxRank = 10;

export const rankProficiency = {
  primary: {1: "E", 3: "D", 5: "C", 7: "B", 9: "A", 10: "S"},
  secondary: {2: "E", 4: "D", 6: "C", 8: "B", 10: "A"}
};

export const skillRanks = {
  standard: [1, 2, 4, 6, 8, 10],
  legend: [1, 2, 4, 6, 8]
};

export const rankAttributeBonusRanks = [3, 5, 7, 9];

export const secondaryActionMinRank = 3;

export const proficiencies = {
  sword: {label: "DEICIDE.Proficiency.sword", weapon: true},
  lance: {label: "DEICIDE.Proficiency.lance", weapon: true},
  axe: {label: "DEICIDE.Proficiency.axe", weapon: true},
  bow: {label: "DEICIDE.Proficiency.bow", weapon: true},
  gun: {label: "DEICIDE.Proficiency.gun", weapon: true},
  reason: {label: "DEICIDE.Proficiency.reason", school: true},
  faith: {label: "DEICIDE.Proficiency.faith", school: true},
  void: {label: "DEICIDE.Proficiency.void", school: true},
  alchemy: {label: "DEICIDE.Proficiency.alchemy", school: true},
  authority: {label: "DEICIDE.Proficiency.authority"},
  armor: {label: "DEICIDE.Proficiency.armor"},
  riding: {label: "DEICIDE.Proficiency.riding"},
  flying: {label: "DEICIDE.Proficiency.flying"},
  seamanship: {label: "DEICIDE.Proficiency.seamanship"}
};

export const proficiencyIds = Object.keys(proficiencies);

export const proficiencyGrades = ["F", "E", "D", "C", "B", "A", "S"];

export const weaponTierGates = {iron: "E", steel: "D", silver: "C", royal: "B", named: "A"};

export const xp = {
  warBattleBase: 60,
  warBattlePerEnemyTier: 10,
  dungeonFight: 30,
  boss: 150,
  milestone: 100,

  catchUp: [
    {levelsBelow: 5, multiplier: 3},
    {levelsBelow: 3, multiplier: 2}
  ],
  attachedMultiplier: 0.5
};

export const cp = {
  dungeonFight: 1,
  warBattle: 3,
  boss: 5,
  benchedSwornMultiplier: 0.5
};

export const commissions = {
  2: {id: "commission", dust: 20, legitimacy: 0},
  3: {id: "royalWarrant", dust: 60, legitimacy: 1},
  crownPatronMultiplier: 0.5,
  dustCollapseMinDustTrack: 3
};

export const tierGates = {
  30: [8, 16, 20],
  25: [7, 13, 17],
  20: [5, 11, 13]
};

export const loadout = {
  secondary: 1,
  reaction: 1,
  supports: [{level: 1, count: 2}, {level: 15, count: 3}, {level: 25, count: 4}],
  pin: 1,
  accessories: 2,
  belt: {slots: 4, stack: 3}
};

export const classTypes = {
  infantry: {label: "DEICIDE.ClassType.infantry", move: 5},
  armored: {label: "DEICIDE.ClassType.armored", move: 4, defense: {def: 2}},
  mounted: {
    label: "DEICIDE.ClassType.mounted", move: 7, canto: true, roadMove: 1, riverImpassable: true,
    dungeon: {delay: 10, canto: false}
  },
  flying: {
    label: "DEICIDE.ClassType.flying", move: 7, ignoresTerrainCost: true,
    dungeon: {delay: 15, flightSkills: false}
  },
  naval: {label: "DEICIDE.ClassType.naval", move: 5, navalOnly: true},
  caster: {label: "DEICIDE.ClassType.caster", move: 5, canRaiseWarded: true},
  officer: {label: "DEICIDE.ClassType.officer", move: null, commands: true},
  monster: {label: "DEICIDE.ClassType.monster", move: null}
};

export const defaultMove = 5;

export const recruitment = {
  statuses: [
    {id: "known", min: 0, max: 39, deployable: false},
    {id: "attached", min: 40, max: 59, deployable: true, xpMultiplier: 0.5},
    {id: "sworn", min: 60, max: 79, deployable: true, xpMultiplier: 1},
    {id: "bound", min: 80, max: 100, deployable: true, xpMultiplier: 1}
  ],
  standing: {battleTogether: 2, personalQuest: 15, mercerAttentionFear: -5},
  ownerTransferLead: 10,
  profiles: {
    veteran: {levelOffset: 6, talents: ["earlyPeak"]},
    standard: {levelOffset: 0, talents: ["steady"]},
    prodigy: {levelOffset: -5, talents: ["prodigy", "lateBloomer"]},
    specialist: {levelOffset: 0, talents: ["savant"]}
  }
};

export const deployment = {
  war: {swornBase: 2},
  dungeon: {swornSlots: 2, stageExtra: 2, stageMin: 6, stageMax: 8, rowCapacity: 4}
};

export const bonds = {
  ranks: [
    {id: "C", points: 3, hit: 5, avoid: 5, might: 0, def: 0, dualStrike: false},
    {id: "B", points: 8, hit: 10, avoid: 10, might: 1, def: 1, dualStrike: false},
    {id: "A", points: 15, hit: 10, avoid: 10, might: 1, def: 1, dualStrike: true}
  ],
  limits: {A: 1, B: 2, C: null},
  points: {battle: 1, battleMinRounds: 3, sharedQuest: 3},
  dualStrikeMight: -4,
  skills: ["shield", "follow", "avenge"],
  avengeCrit: 30,
  returnAfterBattles: 5
};

export const deathRules = {
  classic: {capture: true, overkill: true, overkillFraction: 0.5, routedReturnStrength: 30},
  casual: {capture: false, overkill: false, overkillFraction: null, routedReturnStrength: 50}
};

export const defaultDeathRule = "classic";
