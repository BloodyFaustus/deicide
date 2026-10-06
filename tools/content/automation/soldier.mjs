export default {
  soldierShieldWall: {
    stance: {
      modifiers: [{key: "defense.def", value: 4}],
      effects: [{kind: "flag", key: "cannotSwapRow", value: true}]
    }
  },
  soldierBash: {
    effects: [{kind: "move", mode: "push", tiles: 1, target: "target", chance: "onHit"}]
  },
  soldierHoldTheLine: {
    command: {
      target: "companiesInRadius",
      effects: [{kind: "applyStatus", statusId: "formed", target: "companies", turns: "thisPhase"}]
    }
  },
  soldierBrace: {
    reaction: {trigger: "hitByPhysical", window: {self: true}},
    modifiers: [{key: "damageTaken", op: "add", value: "-floor(def / 4)"}]
  }
};
