export default {
  hierophantMassWard: {
    effects: [{kind: "applyStatus", statusId: "warded", target: "alliesInRadius", turns: null}],
    war: {range: [0, 2], area: {shape: "blast", size: 2}, target: "ally", movement: null, terrain: false},
    coverage: ["Warded on every ally in radius 2"]
  },
  hierophantConsecrate: {
    command: {
      target: "companiesInRadius",
      effects: [{kind: "pool", key: "strength", delta: 10, target: "companies"}]
    }
  },
  hierophantAnathema: {
    modifiers: [{key: "might", value: 6, when: {actionTag: "faith", targetType: ["homunculus", "undead", "voidUser", "diabolist"]}}],
    coverage: ["Homunculi", "undead", "Void users", "and Diabolists take \\+6 from your Faith spells"]
  },
  hierophantDivineShield: {
    reaction: {trigger: "allyHit", window: {tiles: 3, row: "any"}},
    effects: [{kind: "absorb", amount: "mag", target: "ally"}]
  },
  hierophantEngineOfFaith: {
    effects: [{kind: "flag", key: "barriersPersist", value: true, target: "self"}],
    coverage: ["Barriers you raise persist until destroyed"]
  }
};
