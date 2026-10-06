import {DEICIDE} from "../config.mjs";
import {evaluate} from "../core/expression.mjs";

export function collapseArea(area) {
  const shape = area?.shape ?? "single";
  const size = area?.size ?? 1;
  const map = DEICIDE.collapse.area;
  switch ( shape ) {
    case "self": return "self";
    case "line": return map.line;
    case "blast":
    case "radius":
      if ( size <= 0 ) return map.single;
      return size >= 2 ? map.blast2 : map.blast1;
    default: return map.single;
  }
}

export function collapseRange(range, weapon) {
  const effective = range ?? weapon?.range ?? [1, 1];
  const max = effective[1] ?? effective[0] ?? 1;
  if ( max <= 0 ) return "self";
  return max <= DEICIDE.collapse.meleeRangeMax ? "front" : "any";
}

export function dungeonProfile(ability, {weapon, mag} = {}) {
  const typeConfig = DEICIDE.skillTypes[ability.type] ?? DEICIDE.skillTypes.action;
  const war = ability.war ?? {};
  const reach = (war.area?.shape === "self") ? "self" : collapseRange(war.range ?? null, weapon);
  const side = war.target ?? "enemy";

  const profile = {
    available: typeConfig.engines.includes("dungeon"),
    reach,
    requiresFrontRow: reach === "front",
    target: collapseArea(war.area),
    side,
    rowSwap: Boolean(war.movement),
    barrier: war.terrain ? {formula: DEICIDE.collapse.terrainBarrierFormula, pool: null} : null,
    weight: ability.weight ?? DEICIDE.delay.defaultWeight,
    overridden: false,
    note: ""
  };

  if ( ability.dungeon ) {
    for ( const [key, value] of Object.entries(ability.dungeon) ) {
      if ( (value === null) || (value === undefined) ) continue;
      profile[key] = value;
    }
    profile.requiresFrontRow = ability.dungeon.requiresFrontRow ?? (profile.reach === "front");
    profile.overridden = true;
  }

  if ( profile.barrier && (typeof mag === "number") ) {
    profile.barrier = {...profile.barrier, pool: Math.floor(evaluate(profile.barrier.formula, {mag}))};
  }
  return profile;
}

export function reachableRows(profile, actorRow, {enemyFrontEmpty = false, ownFrontEmpty = false} = {}) {
  if ( profile.reach === "self" ) return [];
  if ( profile.reach === "any" ) return ["front", "back"];
  const actorIsFront = (actorRow === "front") || ownFrontEmpty;
  if ( !actorIsFront ) return [];
  return enemyFrontEmpty ? ["back"] : ["front"];
}
