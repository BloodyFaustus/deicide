export default {
  riderTrample: {
    effects: [
      {kind: "move", mode: "through", tiles: 1, target: "self"},
      {kind: "damage", amount: 5, tag: "strength", target: "target", ignoresDefense: true}
    ],
    coverage: ["5 Strength damage"]
  },
  riderWheel: {
    command: {
      target: "companiesInRadius", companyTypes: ["cavalry"],
      effects: [{kind: "applyStatus", statusId: "ordered", target: "companies", turns: "thisPhase", modifiers: [{key: "move", value: 2}]}]
    }
  },
  riderReinIn: {
    reaction: {trigger: "targetedByAttack", window: {self: true}, when: {selfMoved: {min: 1}}},
    modifiers: [{key: "avoid", value: 15}]
  }
};
