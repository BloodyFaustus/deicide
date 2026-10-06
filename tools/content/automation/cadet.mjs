export default {
  cadetAdvance: {
    command: {
      target: "oneCompany",
      effects: [{kind: "applyStatus", statusId: "ordered", target: "companies", turns: "thisPhase", modifiers: [{key: "move", value: 1}]}]
    }
  },
  cadetSteady: {
    effects: [{kind: "flag", key: "ignoreFirstMorale", value: true, target: "companiesInRadius"}],
    coverage: ["ignore first morale check"]
  },
  cadetFormUp: {
    command: {
      target: "companiesInRadius",
      effects: [{kind: "applyStatus", statusId: "ordered", target: "companies", turns: "thisPhase", modifiers: [{key: "defense.def", value: 2}, {key: "avoid", value: 5}]}]
    }
  },
  cadetCover: {
    reaction: {trigger: "allyTargeted", window: {adjacent: true}},
    effects: [{kind: "redirect", to: "self"}]
  }
};
