export default {
  outriderHarass: {
    effects: [{kind: "move", mode: "canto", target: "self"}],
    coverage: ["then Canto full Move"]
  },
  outriderScoutAhead: {
    effects: [{kind: "reveal", what: "fog", radius: 6, target: "self"}]
  },
  outriderSweepFlank: {
    command: {
      target: "companiesInRadius", companyTypes: ["cavalry"],
      effects: [{kind: "applyStatus", statusId: "ordered", target: "companies", turns: "thisPhase", modifiers: [{key: "hit", value: 10, when: {flank: true}}]}]
    }
  },
  outriderHitAndRun: {
    reaction: {trigger: "targetedByAttack", window: {self: true}, when: {attackerRange: {max: 1}}},
    effects: [{kind: "move", mode: "retreat", tiles: 2, target: "self"}, {kind: "cancel", what: "triggeringAction", when: {actionMelee: true}}]
  }
};
