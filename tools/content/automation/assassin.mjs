export default {
  assassinShadowstep: {
    effects: [{kind: "move", mode: "teleport", tiles: 3, through: true, target: "self"}],
    coverage: ["move 3 ignoring enemies or free row swap"]
  },
  assassinPoisonEdge: {
    effects: [{kind: "applyStatus", statusId: "poison", target: "target", turns: 3, chance: "onHit", trigger: "ownAttack", when: {actionSource: "weapon"}}],
    coverage: ["hits inflict Poison"]
  },
  assassinVanish: {
    reaction: {trigger: "targetedByAttack", window: {self: true}},
    modifiers: [{key: "avoid", value: 30}],
    effects: [{kind: "applyStatus", statusId: "untargetable", target: "self", expires: "ownTurn"}]
  },
  assassinDeathMark: {
    modifiers: [{key: "crit", op: "set", value: 100, when: {targetUndamaged: true, firstThisEncounter: true}}],
    coverage: ["first hit per encounter on an undamaged target auto crits"]
  }
};
