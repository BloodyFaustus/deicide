import {evaluate} from "./expression.mjs";
import {test} from "./predicate.mjs";

export const MODIFIER_KEYS = [
  "attributes.str", "attributes.mag", "attributes.skl", "attributes.spd", "attributes.def", "attributes.res",
  "attributes.cmd",
  "hp.max", "hp.perLevel", "channel.max", "matter.max", "static.max", "stolen.slots",
  "move", "canto", "commandRadius",
  "defense.def", "defense.res", "avoid",
  "hit", "crit", "critMultiplier", "might", "spellMight", "healing", "range.max", "range.min",
  "delay", "weight",
  "harvest.yield", "overcast.burnPerPoint", "soulPrice", "cost.channel", "cost.matter", "cost.hp",
  "supports.slots", "damageTaken"
];

export function applicable(modifiers, key, context = {}) {
  const matches = [];
  for ( const modifier of modifiers ?? [] ) {
    if ( modifier.key !== key ) continue;
    if ( !test(modifier.when, context) ) continue;
    matches.push(modifier);
  }
  return matches;
}

export function valueOf(modifier, scope = {}) {
  return (typeof modifier.value === "string") ? evaluate(modifier.value, scope) : Number(modifier.value ?? 0);
}

export function applyModifiers(base, modifiers, scope = {}) {
  let value = base;
  const parts = [];
  const record = (modifier, op, amount) => parts.push({
    label: modifier.label ?? modifier.source ?? "", source: modifier.source ?? "", op, value: amount
  });
  const byOp = op => modifiers.filter(modifier => (modifier.op ?? "add") === op);

  for ( const modifier of byOp("add") ) {
    const amount = valueOf(modifier, scope);
    value += amount;
    record(modifier, "add", amount);
  }
  for ( const modifier of byOp("mul") ) {
    const amount = valueOf(modifier, scope);
    value = Math.floor(value * amount);
    record(modifier, "mul", amount);
  }
  for ( const modifier of byOp("max") ) {
    const amount = valueOf(modifier, scope);
    value = Math.max(value, amount);
    record(modifier, "max", amount);
  }
  for ( const modifier of byOp("min") ) {
    const amount = valueOf(modifier, scope);
    value = Math.min(value, amount);
    record(modifier, "min", amount);
  }
  const sets = byOp("set");
  if ( sets.length ) {
    let lowest = Infinity;
    for ( const modifier of sets ) {
      const amount = valueOf(modifier, scope);
      lowest = Math.min(lowest, amount);
      record(modifier, "set", amount);
    }
    value = lowest;
  }
  return {value, parts};
}

export function resolve(base, modifiers, key, {scope = {}, context = {}} = {}) {
  return applyModifiers(base, applicable(modifiers, key, context), scope);
}

export function applyStaged(base, modifiers, key, stages, {defaultStage, scope = {}, context = {}} = {}) {
  const pool = applicable(modifiers, key, context);
  const fallback = defaultStage ?? stages.at(-1);
  let value = base;
  const parts = [];
  const byStage = {};
  for ( const stage of stages ) {
    const inStage = pool.filter(modifier => (modifier.stage ?? fallback) === stage);
    const result = applyModifiers(value, inStage, scope);
    value = result.value;
    parts.push(...result.parts);
    byStage[stage] = value;
  }
  return {value, parts, byStage};
}

export function fromSource(modifiers, source, label) {
  return (modifiers ?? []).map(modifier => ({...modifier, source, label: modifier.label ?? label ?? source}));
}
