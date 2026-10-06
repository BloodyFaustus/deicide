export default {
  paladinBastion: {
    command: {
      target: "companiesInRadius",
      effects: [{kind: "applyStatus", statusId: "ordered", target: "companies", turns: "thisPhase", modifiers: [{key: "defense.def", value: 4}], flags: {passMorale: true}}]
    }
  },
  paladinIntercede: {
    reaction: {trigger: "allyHit", window: {tiles: 2, row: "any"}},
    effects: [{kind: "redirect", to: "self"}, {kind: "heal", amount: "floor(mag / 2)", target: "ally"}],
    coverage: ["take it and heal them MAG/2"]
  }
};
