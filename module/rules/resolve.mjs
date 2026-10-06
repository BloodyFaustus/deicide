import {DEICIDE} from "../config.mjs";
import {evaluate} from "../core/expression.mjs";
import {Pipeline} from "../core/pipeline.mjs";
import {test, contains} from "../core/predicate.mjs";
import {applicable, applyModifiers, resolve as resolveModifier} from "../core/modifiers.mjs";
import {d100, rollUnder} from "../core/random.mjs";

const clampPercent = value => Math.min(Math.max(Math.floor(value), 0), 100);

export const BASIC_ATTACK = Object.freeze({basis: "str", source: "weapon", defense: "def", might: 0});

export function describeAction(ability, weapon) {
  const attack = ability?.attack ?? (ability ? null : BASIC_ATTACK);
  const source = attack?.source ?? "none";
  const usesWeapon = (source === "weapon") && Boolean(weapon);
  const element = attack?.element ?? (usesWeapon ? weapon.element : null) ?? null;
  const direct = Boolean(ability?.direct) || (element === "truth");
  const tags = new Set(ability?.tags ?? []);
  if ( element ) {
    tags.add(element);
    const school = DEICIDE.elements[element]?.school;
    if ( school ) tags.add(school);
  }
  if ( (source === "spell") && weapon?.prof && DEICIDE.proficiencies[weapon.prof]?.school ) tags.add(weapon.prof);
  if ( source === "alchemy" ) tags.add("alchemy");
  if ( direct ) { tags.add("truth"); tags.add("alchemy"); }
  return {
    identifier: ability?.identifier ?? "attack",
    type: ability?.type ?? "action",
    source,
    weaponLine: usesWeapon ? weapon.line : null,
    weaponProf: usesWeapon ? weapon.prof : null,
    element: direct ? "truth" : element,
    school: element ? (DEICIDE.elements[element]?.school ?? null) : null,
    direct,
    tags
  };
}

function conditionContext({attacker, target, action, mode, context}) {
  const engine = DEICIDE.modes[mode]?.engine ?? mode;
  return {...context, subject: attacker, target, action, mode, engine};
}

export function triangleRelation(attackerProf, targetProf) {
  const beats = DEICIDE.triangle.beats;
  if ( !attackerProf || !targetProf ) return 0;
  if ( beats[attackerProf] === targetProf ) return 1;
  if ( beats[targetProf] === attackerProf ) return -1;
  return 0;
}

export function hitChance({attacker, target, weapon = null, ability = null, mode = "war", context = {}}) {
  const action = describeAction(ability, weapon);
  const attack = ability?.attack ?? BASIC_ATTACK;
  const conditions = conditionContext({attacker, target, action, mode, context});
  const parts = [];
  const add = (id, value) => { if ( value ) parts.push({id, value}); };

  const usesAccuracy = (action.source !== "none") && Boolean(weapon);
  const weaponAcc = usesAccuracy ? (weapon.acc ?? 0) : 0;
  const ignoreAvoid = Boolean(attack.ignoreAvoid);
  const ignoreTerrain = ignoreAvoid || Boolean(attack.ignoreTerrainAvoid)
    || (resolveModifier(0, attacker.modifiers, "ignoreTerrainAvoid", {context: conditions}).value > 0);
  const targetSpd = ignoreAvoid ? 0 : (target.attributes?.spd ?? 0);
  const terrainAvoid = ignoreTerrain ? 0 : (context.terrainAvoid ?? 0);

  let raw;
  if ( (attacker.hitBase ?? null) !== null ) {
    raw = attacker.hitBase - (2 * targetSpd + terrainAvoid);
    add("base", attacker.hitBase);
  }
  else {
    raw = evaluate(DEICIDE.formulas.hit, {skl: attacker.attributes.skl, weaponAcc, targetSpd, terrainAvoid});
    add("base", 75);
    add("skl", 2 * attacker.attributes.skl);
    add("weaponAcc", weaponAcc);
  }
  add("targetSpd", -2 * targetSpd);
  add("terrainAvoid", -terrainAvoid);

  const bump = (id, value) => { if ( value ) { raw += value; add(id, value); } };
  bump("ability", attack.hit ?? 0);
  bump("targetAvoid", ignoreAvoid ? 0 : -(target.defense?.avoid ?? 0));

  if ( action.weaponProf ) {
    bump("triangle", triangleRelation(action.weaponProf, context.targetWeaponProf) * DEICIDE.triangle.hit);
  }
  if ( (conditions.engine === "war") && context.flank ) bump("flank", DEICIDE.war.flankHit);
  if ( (conditions.engine === "war") && context.highGround ) bump("highGround", DEICIDE.war.highGroundHit);

  const modifiers = applyModifiers(0, applicable(attacker.modifiers, "hit", conditions), attacker.attributes);
  bump("modifiers", modifiers.value);
  bump("bonus", context.bonus ?? 0);

  return {chance: clampPercent(raw), raw, parts};
}

export function critChance({attacker, target, weapon = null, ability = null, mode = "war", context = {}}) {
  const action = describeAction(ability, weapon);
  const attack = ability?.attack ?? BASIC_ATTACK;
  const conditions = conditionContext({attacker, target, action, mode, context});
  const parts = [];
  if ( attack.noCrit || contains(target?.immunities, "crit") ) return {chance: 0, raw: 0, parts};
  if ( (attacker.hitBase ?? null) !== null && !("skl" in (attacker.attributes ?? {})) ) return {chance: 0, raw: 0, parts};

  const usesWeapon = (action.source !== "none") && Boolean(weapon);
  const weaponCrit = usesWeapon ? (weapon.crit ?? 0) : 0;
  let raw = evaluate(DEICIDE.formulas.crit, {skl: attacker.attributes.skl ?? 0, weaponCrit});
  parts.push({id: "skl", value: Math.floor((attacker.attributes.skl ?? 0) / 2)});
  if ( weaponCrit ) parts.push({id: "weaponCrit", value: weaponCrit});
  const bump = (id, value) => { if ( value ) { raw += value; parts.push({id, value}); } };
  bump("ability", attack.crit ?? 0);
  bump("modifiers", applyModifiers(0, applicable(attacker.modifiers, "crit", conditions), attacker.attributes).value);
  bump("bonus", context.critBonus ?? 0);
  return {chance: clampPercent(raw), raw, parts};
}

export function critMultiplier({attacker, target, weapon = null, ability = null, mode = "war", context = {}}) {
  const action = describeAction(ability, weapon);
  const conditions = conditionContext({attacker, target, action, mode, context});
  const mods = applicable(attacker.modifiers, "critMultiplier", conditions);
  if ( !mods.length ) return DEICIDE.damage.critMultiplier;

  return Math.max(DEICIDE.damage.critMultiplier, ...mods.map(modifier => Number(modifier.value)));
}

function effectivenessRules(state) {
  const {attacker, target, action, conditions} = state;
  const matched = [];
  for ( const rule of DEICIDE.effectiveness ) {
    if ( !test(rule.attacker, {...conditions, subject: action}) ) continue;
    if ( !test(rule.target, {...conditions, subject: target}) ) continue;
    if ( !test(rule.when, {...conditions, subject: attacker}) ) continue;
    matched.push(rule);
  }
  return matched;
}

function stepSetup(state) {
  const {ability, weapon} = state;
  state.attack = ability?.attack ?? (ability ? null : BASIC_ATTACK);
  if ( !state.attack ) {
    state.total = 0;
    state.notes.push("noAttack");
    return false;
  }
  state.action = describeAction(ability, weapon);
  state.conditions = conditionContext(state);
  state.isTruth = state.action.direct;
  state.rules = state.isTruth ? [] : effectivenessRules(state);
}

function stepPower(state) {
  const {attacker, target, weapon, attack, action, conditions, context, parts} = state;
  const add = (id, value) => { if ( value ) parts.push({id, value}); };

  let basisId = attack.basis ?? "flat";
  const basisSwap = applicable(attacker.modifiers, "attackBasis", conditions).at(-1);
  if ( basisSwap?.basis ) basisId = basisSwap.basis;
  const basis = DEICIDE.attackBases[basisId];
  if ( !basis ) throw new Error(`Unknown attack basis "${basisId}"`);
  const stat = Math.floor(evaluate(basis.formula, attacker.attributes ?? {}));
  add(`basis.${basisId}`, stat);

  const field = DEICIDE.mightSources[action.source]?.field;
  let weaponMight = (field && weapon) ? (weapon[field] ?? 0) : 0;
  for ( const rule of state.rules ) {
    if ( rule.effect.weaponMight === undefined ) continue;

    const floor = resolveModifier(rule.effect.weaponMight, attacker.modifiers, `weaponMight.${rule.id}`, {context: conditions});
    weaponMight = Math.min(weaponMight, Math.max(floor.value, weapon?.mightVsWarded ?? 0));
    state.notes.push(rule.id);
  }
  add(`source.${action.source}`, weaponMight);
  state.weaponMight = weaponMight;

  const skillMight = attack.might ?? 0;
  add("skillMight", skillMight);

  let power = stat + weaponMight + skillMight;
  const bump = (id, value) => { if ( value ) { power += value; add(id, value); } };

  if ( attack.perTile ) {
    const per = attack.perTile.per ?? 1;
    const steps = Math.floor((context.tilesMoved ?? 0) / per);
    bump("charge", Math.min(steps * attack.perTile.might, attack.perTile.max ?? Infinity));
  }

  if ( !state.isTruth ) {
    if ( action.weaponProf ) {
      bump("triangle", triangleRelation(action.weaponProf, context.targetWeaponProf) * DEICIDE.triangle.might);
    }
    for ( const rule of state.rules ) {
      if ( rule.effect.might ) bump(`effect.${rule.id}`, rule.effect.might);
    }
  }

  for ( const bonus of attack.bonuses ?? [] ) {
    if ( test(bonus.when, conditions) ) bump("abilityBonus", bonus.might ?? 0);
  }

  if ( action.element && contains(attacker.statuses, "attuned") && (attacker.attuned === action.element) ) {
    bump("attuned", DEICIDE.statuses.attuned.elementMight);
  }
  if ( context.marked ) bump("marked", DEICIDE.statuses.marked.markerMight);
  if ( context.staticSpent ) bump("static", context.staticSpent * DEICIDE.staticCharge.spend.mightPerPoint);
  if ( context.overcastMight ) bump("overcast", context.overcastMight);
  const catalyst = context.catalyst ? DEICIDE.catalysts[context.catalyst] : null;
  if ( catalyst?.might && state.isTruth ) bump(`catalyst.${context.catalyst}`, catalyst.might);
  bump("bond", context.bondMight ?? 0);

  const sourceKey = (action.source === "spell") ? "spellMight" : null;
  const modifiers = applyModifiers(0, applicable(attacker.modifiers, "might", conditions), attacker.attributes);
  bump("modifiers", modifiers.value);
  if ( sourceKey ) {
    bump("spellModifiers", applyModifiers(0, applicable(attacker.modifiers, sourceKey, conditions), attacker.attributes).value);
  }
  bump("bonus", context.mightBonus ?? 0);

  if ( catalyst?.mightMultiplier && state.isTruth ) {
    const before = power;
    power = Math.floor(power * catalyst.mightMultiplier);
    add(`catalyst.${context.catalyst}`, power - before);
  }
  if ( state.isTruth && attacker.truthMultiplier && (attacker.truthMultiplier !== 1) ) {
    const before = power;
    power = Math.floor(power * attacker.truthMultiplier);
    add("student", power - before);
  }

  state.power = power;
  state.target = target;
}

function stepDefense(state) {
  const {target, attack, attacker, conditions} = state;
  let defenseId = state.isTruth ? "none" : (attack.defense ?? "def");
  if ( !(defenseId in DEICIDE.defenses) ) throw new Error(`Unknown defense "${defenseId}"`);
  const def = target.defense?.def ?? target.attributes?.def ?? 0;
  const res = target.defense?.res ?? target.attributes?.res ?? 0;
  let ignoreDef = attack.ignoreDef ?? 0;
  for ( const rule of state.rules ) ignoreDef += rule.effect.ignoreDef ?? 0;
  ignoreDef += applyModifiers(0, applicable(attacker.modifiers, "ignoreDef", conditions), attacker.attributes).value;

  let defense = 0;
  if ( defenseId === "def" ) defense = Math.max(def - ignoreDef, 0);
  else if ( defenseId === "res" ) defense = Math.max(res - (attack.ignoreRes ?? 0), 0);
  else if ( defenseId === "lower" ) {
    const reducedDef = Math.max(def - ignoreDef, 0);
    defense = Math.min(reducedDef, res);
    defenseId = (reducedDef <= res) ? "lower.def" : "lower.res";
  }
  state.defenseId = defenseId;
  state.defense = defense;
  state.damageType = DEICIDE.defenses[defenseId.split(".")[0]].damageType;
  state.base = state.power - defense;
}

function stepMultipliers(state) {
  const {target, weapon, attack, action, conditions, multipliers} = state;
  const element = action.element;
  const config = DEICIDE.elementMultipliers;
  const push = (id, value) => { if ( value !== 1 ) multipliers.push({id, value}); };

  if ( element && contains(target.immunities, element) ) {
    state.immune = true;
    return;
  }

  if ( !state.isTruth ) {
    for ( const rule of state.rules ) {
      if ( !rule.effect.multiplier ) continue;

      const adjusted = resolveModifier(rule.effect.multiplier, target.modifiers, `effectiveness.${rule.id}`, {
        context: {...conditions, subject: target}
      });
      push(`effect.${rule.id}`, adjusted.value);
    }
    if ( (action.source === "weapon") && weapon?.effectiveVs && contains(target.classTypes, weapon.effectiveVs) ) {
      push(`slayer.${weapon.effectiveVs}`, DEICIDE.slayerMultiplier);
    }
    if ( attack.effectiveVs && contains(target.classTypes, attack.effectiveVs) ) {
      push(`art.${attack.effectiveVs}`, DEICIDE.slayerMultiplier);
    }
    if ( element ) {
      const opposed = (target.affinities ?? []).some(affinity => DEICIDE.elements[affinity]?.opposedBy.includes(element));
      if ( opposed ) push("opposed", config.opposed);
      if ( target.resistance === element ) push("resistance", config.resistance);
    }
    if ( target.divineBeing && !attack.ignoreDivineResistance && !config.divineBeing.except.includes(element) ) {
      push("divineBeing", config.divineBeing.multiplier);
    }
  }
  if ( element && ((target.weakness === element) || contains(target.weakTo, element)) ) push("weakness", config.weakness);
  if ( attack.multiplier ) push("ability", attack.multiplier);
  for ( const extra of state.context.multipliers ?? [] ) push(extra.id, extra.value);
}

function stepFinalize(state) {
  const {target, conditions} = state;
  if ( state.immune ) {
    state.total = 0;
    state.critTotal = 0;
    state.notes.push("immune");
    return;
  }
  const multiplier = state.multipliers.reduce((product, entry) => product * entry.value, 1);
  state.multiplier = multiplier;
  const minimum = DEICIDE.damage.minimum;
  let total = Math.max(Math.floor(state.base * multiplier), minimum);
  let critTotal = Math.max(Math.floor(total * state.critMultiplier), minimum);

  if ( !state.isTruth ) {
    const taken = applicable(target.modifiers, "damageTaken", {...conditions, subject: target});
    const guarded = contains(target.statuses, "guard");
    const adjust = value => {
      let result = value;
      if ( guarded ) result = Math.floor(result * DEICIDE.statuses.guard.damageMultiplier);
      result = applyModifiers(result, taken, target.attributes ?? {}).value;
      return Math.max(result, minimum);
    };
    total = adjust(total);
    critTotal = adjust(critTotal);
    if ( guarded ) state.notes.push("guard");
  }
  state.total = total;
  state.critTotal = critTotal;
}

export const damagePipeline = new Pipeline("damage", [
  ["setup", stepSetup],
  ["power", stepPower],
  ["defense", stepDefense],
  ["multipliers", stepMultipliers],
  ["finalize", stepFinalize]
]);

export function damage({attacker, target, ability = null, weapon = null, mode = "war", context = {}}) {
  const state = {
    attacker, target, ability, weapon, mode, context,
    parts: [], multipliers: [], notes: [], rules: [],
    power: 0, defense: 0, base: 0, multiplier: 1, total: 0, critTotal: 0,
    damageType: "physical", isTruth: false, immune: false,
    critMultiplier: critMultiplier({attacker, target, weapon, ability, mode, context})
  };
  damagePipeline.run(state);
  const element = state.action?.element ?? null;
  return {
    attack: state.power,
    defense: state.defense,
    base: state.base,
    multiplier: state.multiplier,
    total: state.total,
    critTotal: state.critTotal,
    critMultiplier: state.critMultiplier,
    type: state.isTruth ? "truth" : state.damageType,
    element,
    isTruth: state.isTruth,

    label: state.isTruth ? "truth" : (element ?? state.damageType),
    defenseId: state.defenseId ?? "none",
    weaponMight: state.weaponMight ?? 0,
    parts: state.parts,
    multipliers: state.multipliers,
    notes: state.notes
  };
}

export function attackPower({attacker, ability = null, weapon = null, mode = "war", context = {}}) {
  const blank = {kind: "character", attributes: {spd: 0, def: 0, res: 0}, defense: {def: 0, res: 0, avoid: 0}, classTypes: [], statuses: []};
  const result = damage({attacker, target: blank, ability, weapon, mode, context});
  return {attack: result.attack, type: result.type, element: result.element, label: result.label, parts: result.parts};
}

export function canDouble({attacker, target, weapon = null, mode = "war"}) {
  const engine = DEICIDE.modes[mode]?.engine ?? mode;
  if ( engine !== "war" ) return false;
  if ( (weapon?.weight ?? 0) > DEICIDE.war.doubling.maxWeight ) return false;
  return ((attacker.attributes?.spd ?? 0) - (target.attributes?.spd ?? 0)) >= DEICIDE.war.doubling.spdGap;
}

export function strikeCount({attacker, target, weapon = null, ability = null, mode = "war"}) {
  const action = describeAction(ability, weapon);
  let strikes = ability?.attack?.strikes ?? 1;
  if ( action.source !== "weapon" ) return strikes;
  if ( weapon?.attacksTwice ) strikes *= 2;
  if ( !ability && canDouble({attacker, target, weapon, mode}) ) strikes *= 2;
  return strikes;
}

export function resolveAttack(params, rng = Math.random) {
  const hit = hitChance(params);
  const crit = critChance(params);
  const result = damage(params);
  const autoHit = Boolean(params.ability?.attack?.autoHit) || Boolean(params.context?.autoHit);
  const autoCrit = Boolean(params.context?.autoCrit);
  const strikes = [];
  let total = 0;
  const count = strikeCount(params);
  for ( let i = 0; i < count; i++ ) {
    const hitRoll = autoHit ? null : d100(rng);
    const didHit = autoHit || rollUnder(hitRoll, hit.chance);
    let critRoll = null;
    let didCrit = false;
    if ( didHit ) {
      if ( autoCrit ) didCrit = true;
      else if ( crit.chance > 0 ) {
        critRoll = d100(rng);
        didCrit = rollUnder(critRoll, crit.chance);
      }
    }
    const dealt = didHit ? (didCrit ? result.critTotal : result.total) : 0;
    total += dealt;
    strikes.push({hitRoll, hit: didHit, critRoll, crit: didCrit, damage: dealt});
  }
  return {hit, crit, damage: result, strikes, total};
}

export function absorb(amount, pool = 0) {
  const absorbed = Math.min(Math.max(pool, 0), amount);
  const remaining = Math.max(pool, 0) - absorbed;
  return {toHp: amount - absorbed, absorbed, pool: remaining, broken: (pool > 0) && (remaining === 0)};
}

export function wardedProgress({taken, damage: amount, mag}) {
  const threshold = evaluate(DEICIDE.statuses.warded.breakFormula, {mag});
  const total = taken + amount;
  return {taken: total, threshold, broken: total >= threshold};
}

export function payChannel({cost, channel, burnPerPoint = DEICIDE.overcast.burnPerPoint, reduction = 0, multiplier = 1, immune = false}) {
  const paid = Math.min(cost, Math.max(channel, 0));
  const overcast = cost - paid;
  let burn = 0;
  if ( (overcast > 0) && !immune ) {
    const perPoint = Math.max(Math.floor((burnPerPoint - reduction) * multiplier), DEICIDE.overcast.floorPerPoint);
    burn = overcast * perPoint;
  }
  return {paid, overcast, burn, channel: channel - paid};
}

export function soulPrice({price, payer, catalyst = null, reduction = 0, multiplier = 1}) {
  const adjusted = Math.max(Math.floor((price - reduction) * multiplier), 0);
  if ( catalyst && DEICIDE.catalysts[catalyst] ) return {hp: 0, channel: 0, catalyst, price: adjusted};
  return {hp: payer === "hp" ? adjusted : 0, channel: payer === "channel" ? adjusted : 0, catalyst: null, price: adjusted};
}

export function healAmount({formula, healer, weapon = null, context = {}}) {
  const parts = [];
  let total = Math.floor(evaluate(formula, healer.attributes ?? {}));
  parts.push({id: "formula", value: total});
  if ( weapon?.healBonus ) { total += weapon.healBonus; parts.push({id: "source.heal", value: weapon.healBonus}); }
  const mods = applyModifiers(total, applicable(healer.modifiers, "healing", {...context, subject: healer}), healer.attributes ?? {});
  if ( mods.value !== total ) parts.push({id: "modifiers", value: mods.value - total});
  return {total: Math.max(mods.value, 0), parts};
}

export function fleeChance({spd, fastestEnemySpd, boss = false}) {
  if ( boss ) return 0;
  return clampPercent(evaluate(DEICIDE.formulas.flee, {spd, fastestEnemySpd}));
}

export function opposedChance(formula, scope) {
  return clampPercent(evaluate(formula, scope));
}
