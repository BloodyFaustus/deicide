export default {
  wyvernRiderTalonGrip: {
    effects: [{kind: "move", mode: "carry", tiles: 4, target: "ally"}],
    war: {range: [1, 1], area: {shape: "single", size: 1}, target: "ally", movement: "carry", terrain: false},
    coverage: ["carry adjacent ally 4 tiles"]
  },
  wyvernRiderAirScreen: {
    command: {
      target: "companiesInRadius", companyTypes: ["flying"],
      effects: [{kind: "applyStatus", statusId: "ordered", target: "companies", turns: "thisPhase", modifiers: [{key: "avoid", value: 10}]}]
    }
  },
  wyvernRiderEvasiveRoll: {
    reaction: {trigger: "targetedByAttack", window: {self: true}, when: {actionWeaponLine: "bow"}, usesPerRound: 1},
    modifiers: [{key: "avoid", value: 20}]
  },
  wyvernRiderSkyHunter: {
    modifiers: [{key: "effectiveness.bowVsFlying", op: "set", value: 1.5}],
    coverage: ["bow damage x1\\.5 instead of x2"]
  }
};
