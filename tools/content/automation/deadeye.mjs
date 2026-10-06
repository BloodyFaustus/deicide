export default {
  deadeyeDeadCalm: {
    coverage: ["Move 0"]
  },
  deadeyeSuppressingFire: {
    command: {
      target: "companiesInRadius", companyTypes: ["archer"],
      effects: [{kind: "applyStatus", statusId: "ordered", target: "companies", turns: "thisPhase", modifiers: [{key: "targetMove", value: -2}]}]
    },
    coverage: ["archer companies in radius inflict Move minus 2"]
  },
  deadeyeOverwatch: {
    reaction: {trigger: "enemyEnteredRange", window: {tiles: 4, row: "any"}},
    effects: [{kind: "counter"}],
    coverage: ["enemy moves within range"]
  }
};
