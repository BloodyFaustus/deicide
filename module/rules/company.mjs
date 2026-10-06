import {DEICIDE} from "../config.mjs";
import {evaluate} from "../core/expression.mjs";
import {d100, rollUnder} from "../core/random.mjs";

const clampQuality = quality => Math.min(Math.max(quality, DEICIDE.company.quality.min), DEICIDE.company.quality.max);

export function companyStats({quality, strength, type = "infantry", shipClass = null}) {
  const formulas = DEICIDE.company.formulas;
  const scope = {quality: clampQuality(quality), strength: Math.max(strength, 0)};
  const typeData = DEICIDE.companyTypes[type] ?? DEICIDE.companyTypes.infantry;
  const ship = shipClass ? DEICIDE.ships[shipClass] : null;
  const stats = {
    def: evaluate(formulas.def, scope),
    res: evaluate(formulas.res, scope),
    atkVsCharacter: evaluate(formulas.atkVsCharacter, scope),
    atkVsCompany: evaluate(formulas.atkVsCompany, scope),
    move: typeData.move,
    range: typeData.range,
    routed: strength <= 0,
    wavering: (strength > 0) && (strength < DEICIDE.company.moraleBelow)
  };
  if ( ship ) {
    stats.def = ship.defBase + DEICIDE.naval.shipDefPerQuality * scope.quality;
    stats.move = ship.move;
    stats.range = ship.range;
    stats.broadsides = ship.broadsides;
    stats.broadsideMight = ship.mightPerQuality * scope.quality;
  }
  return stats;
}

export function companyHit({quality, targetSpd = 0, targetAvoid = 0, bonus = 0}) {
  const chance = evaluate(DEICIDE.company.formulas.hit, {quality: clampQuality(quality), avoid: targetAvoid, spd: targetSpd});
  return Math.min(Math.max(chance + bonus, 0), 100);
}

export function companyMultiplier(attackerType, targetType, {charge = false} = {}) {
  let multiplier = 1;
  for ( const rule of DEICIDE.companyTypes[attackerType]?.multipliers ?? [] ) {
    if ( rule.vs !== targetType ) continue;
    if ( (rule.when === "charge") && !charge ) continue;
    multiplier *= rule.value;
  }
  return multiplier;
}

export function companyDamage({attacker, target, targetKind, charge = false, magical = false, mightBonus = 0, multiplier = 1}) {
  const stats = companyStats(attacker);
  const useRes = magical || (attacker.type === "battlemage");
  let attack;
  let defense;
  let typeMultiplier = 1;
  if ( targetKind === "company" ) {
    const targetStats = companyStats(target);
    attack = stats.atkVsCompany;
    defense = useRes ? targetStats.res : targetStats.def;
    typeMultiplier = companyMultiplier(attacker.type, target.type, {charge});
  }
  else {
    attack = stats.atkVsCharacter;
    defense = useRes ? (target.defense?.res ?? 0) : (target.defense?.def ?? 0);
  }
  attack += mightBonus;
  const total = Math.max(Math.floor((attack - defense) * typeMultiplier * multiplier), DEICIDE.damage.minimum);
  return {attack, defense, multiplier: typeMultiplier * multiplier, total};
}

export function needsMorale(strength) {
  return (strength > 0) && (strength < DEICIDE.company.moraleBelow);
}

export function moraleThreshold({quality, inRadius = false, bonus = 0}) {
  return evaluate(DEICIDE.company.formulas.morale, {quality: clampQuality(quality), inRadius: inRadius ? 1 : 0}) + bonus;
}

export function rollMorale(params, rng = Math.random) {
  const threshold = moraleThreshold(params);
  const roll = d100(rng);
  return {roll, threshold, passed: rollUnder(roll, threshold)};
}

export function qualityCap(tracks, type = "infantry") {
  const formula = (type === "battlemage")
    ? DEICIDE.nationFormulas.battlemageQualityCap
    : DEICIDE.nationFormulas.companyQualityCap;
  return Math.min(evaluate(formula, tracks), DEICIDE.company.quality.max);
}

export function veterancyAfterBattle(company, {ownerAdjacent = false, routed = false, qualityCap: cap = 5} = {}) {
  const rules = DEICIDE.company.veterancy;
  let veterancy = company.veterancy ?? 0;
  let quality = company.quality;
  let veterancyQuality = company.veterancyQuality ?? 0;
  let promoted = false;
  let demoted = false;

  if ( routed || (company.strength <= 0) ) {
    veterancy = 0;
    if ( veterancyQuality > 0 ) {
      veterancyQuality -= 1;
      quality = Math.max(quality - 1, DEICIDE.company.quality.min);
      demoted = true;
    }
    return {veterancy, quality, veterancyQuality, promoted, demoted};
  }

  if ( company.strength > rules.minEndStrength ) {
    veterancy += ownerAdjacent ? rules.perBattleOwnerAdjacent : rules.perBattle;
  }
  if ( veterancy >= rules.promoteAt ) {
    veterancy = 0;
    if ( quality < Math.min(cap, DEICIDE.company.quality.max) ) {
      quality += 1;
      veterancyQuality += 1;
      promoted = true;
    }
  }
  return {veterancy, quality, veterancyQuality, promoted, demoted};
}

export function routedReturnStrength(deathRule = DEICIDE.defaultDeathRule) {
  return DEICIDE.deathRules[deathRule]?.routedReturnStrength ?? DEICIDE.deathRules.classic.routedReturnStrength;
}

export function nationValues(tracks) {
  return Object.fromEntries(
    Object.entries(DEICIDE.nationFormulas).map(([key, formula]) => [key, evaluate(formula, tracks)])
  );
}
