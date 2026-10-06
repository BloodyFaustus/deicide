import {DEICIDE} from "../config.mjs";
import {evaluate} from "../core/expression.mjs";

export function pacingMultiplier({S = DEICIDE.pacing.defaults.S, L = DEICIDE.pacing.defaults.L} = {}) {
  return evaluate(DEICIDE.pacing.formula, {S, L});
}

export function displayMultiplier(dials) {
  return Math.round(pacingMultiplier(dials) * 100) / 100;
}

export function award(base, multiplier) {
  return Math.round(base * multiplier);
}

export function xpToNext(level) {
  return evaluate(DEICIDE.formulas.xpToNext, {level});
}

export function xpTotal(level) {
  return evaluate(DEICIDE.formulas.xpTotal, {L: level});
}

export function levelForXp(totalXp, levelCap = DEICIDE.pacing.defaults.L) {
  let level = 1;
  while ( (level < levelCap) && (totalXp >= xpTotal(level + 1)) ) level++;
  return level;
}

export function catchUpMultiplier(recruitLevel, partyLevel) {
  if ( recruitLevel > partyLevel ) return 0;
  const below = partyLevel - recruitLevel;
  for ( const band of DEICIDE.xp.catchUp ) {
    if ( below >= band.levelsBelow ) return band.multiplier;
  }
  return 1;
}

export function warBattleXp(enemyTier) {
  return DEICIDE.xp.warBattleBase + DEICIDE.xp.warBattlePerEnemyTier * enemyTier;
}

export function encounterAwards({kind, level, enemyTier = 1, difficulty = "standard", dials} = {}) {
  const multiplier = pacingMultiplier(dials) * (DEICIDE.difficulty[difficulty]?.multiplier ?? 1);
  const income = DEICIDE.economy.income;
  const base = {
    dungeonFight: {xp: DEICIDE.xp.dungeonFight, cp: DEICIDE.cp.dungeonFight, dust: 0},
    warBattle: {xp: warBattleXp(enemyTier), cp: DEICIDE.cp.warBattle, dust: evaluate(income.warVictory, {level})},
    boss: {xp: DEICIDE.xp.boss, cp: DEICIDE.cp.boss, dust: evaluate(income.boss, {level})},
    milestone: {xp: DEICIDE.xp.milestone, cp: 0, dust: 0},
    dungeonExpedition: {xp: 0, cp: 0, dust: evaluate(income.dungeonExpedition, {level})}
  }[kind];
  if ( !base ) throw new Error(`Unknown encounter kind "${kind}"`);
  return {
    xp: award(base.xp, multiplier),
    cp: award(base.cp, multiplier),
    dust: award(base.dust, multiplier),
    multiplier
  };
}

export function enemyCount(N, difficulty = "standard") {
  const [low, high] = DEICIDE.difficulty[difficulty]?.count ?? [0, 0];
  return [N + low, N + high];
}

export function stageCapacity(N) {
  const {stageExtra, stageMin, stageMax} = DEICIDE.deployment.dungeon;
  return Math.min(Math.max(N + stageExtra, stageMin), stageMax);
}
