import {Registry} from "./registry.mjs";

export const conditions = new Registry("conditions", {
  validate: (id, fn) => {
    if ( typeof fn !== "function" ) throw new TypeError(`Condition "${id}" must be a function`);
    return fn;
  }
});

const asArray = value => Array.isArray(value) ? value : [value];

export function contains(collection, value) {
  if ( !collection ) return false;
  if ( collection instanceof Set ) return collection.has(value);
  if ( Array.isArray(collection) ) return collection.includes(value);
  if ( typeof collection === "object" ) return Boolean(collection[value]);
  return collection === value;
}

export function test(condition, context = {}) {
  if ( !condition ) return true;
  for ( const [key, expected] of Object.entries(condition) ) {
    const tester = conditions.get(key);

    if ( !tester || !tester(expected, context) ) return false;
  }
  return true;
}

conditions.registerAll({
  all: (list, context) => list.every(condition => test(condition, context)),
  any: (list, context) => list.some(condition => test(condition, context)),
  not: (condition, context) => !test(condition, context),

  engine: (expected, context) => asArray(expected).includes(context.engine),
  mode: (expected, context) => asArray(expected).includes(context.mode),
  flank: (expected, context) => Boolean(context.flank) === Boolean(expected),
  backRow: (expected, context) => Boolean(context.backRow) === Boolean(expected),
  flankOrBackRow: (expected, context) => Boolean(context.flank || context.backRow) === Boolean(expected),
  highGround: (expected, context) => Boolean(context.highGround) === Boolean(expected),
  terrain: (expected, context) => asArray(expected).includes(context.terrain),
  movedAtLeast: (expected, context) => (context.tilesMoved ?? 0) >= expected,
  rangeAtLeast: (expected, context) => (context.distance ?? 0) >= expected,
  rangeAtMost: (expected, context) => (context.distance ?? 0) <= expected,

  status: (expected, context) => asArray(expected).every(id => contains(context.subject?.statuses, id)),
  notStatus: (expected, context) => asArray(expected).every(id => !contains(context.subject?.statuses, id)),
  classType: (expected, context) => asArray(expected).some(id => contains(context.subject?.classTypes, id)),
  notClassType: (expected, context) => asArray(expected).every(id => !contains(context.subject?.classTypes, id)),
  weaponLine: (expected, context) => asArray(expected).includes(context.subject?.weaponLine),
  tag: (expected, context) => asArray(expected).every(id => contains(context.subject?.tags, id)),
  anyTag: (expected, context) => asArray(expected).some(id => contains(context.subject?.tags, id)),
  element: (expected, context) => asArray(expected).includes(context.subject?.element),
  school: (expected, context) => asArray(expected).includes(context.subject?.school),
  kind: (expected, context) => asArray(expected).includes(context.subject?.kind),
  hpAtMost: (fraction, context) => {
    const hp = context.subject?.hp;
    return Boolean(hp) && (hp.value <= hp.max * fraction);
  },
  hpAbove: (fraction, context) => {
    const hp = context.subject?.hp;
    return Boolean(hp) && (hp.value > hp.max * fraction);
  },

  targetClassType: (expected, context) => asArray(expected).some(id => contains(context.target?.classTypes, id)),
  targetStatus: (expected, context) => asArray(expected).every(id => contains(context.target?.statuses, id)),
  targetKind: (expected, context) => asArray(expected).includes(context.target?.kind),
  targetTag: (expected, context) => asArray(expected).some(id => contains(context.target?.tags, id)),

  actionTag: (expected, context) => asArray(expected).some(id => contains(context.action?.tags, id)),
  actionElement: (expected, context) => asArray(expected).includes(context.action?.element),
  actionWeaponLine: (expected, context) => asArray(expected).includes(context.action?.weaponLine),
  actionSource: (expected, context) => asArray(expected).includes(context.action?.source),
  actionId: (expected, context) => asArray(expected).includes(context.action?.identifier)
});
