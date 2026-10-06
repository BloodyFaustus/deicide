export default {
  marksmanPinningShot: {
    effects: [{kind: "applyStatus", statusId: "pinned", target: "target", turns: 1, chance: "onHit"}]
  },
  marksmanBarrage: {
    command: {
      target: "companiesInRadius", companyTypes: ["archer"],
      effects: [{kind: "applyStatus", statusId: "ordered", target: "companies", turns: "thisPhase", modifiers: [{key: "strikes", value: 1}]}]
    }
  },
  marksmanCounterShot: {
    reaction: {trigger: "targetedByAttack", window: {self: true}, when: {attackerRange: {min: 2}}},
    effects: [{kind: "counter"}]
  }
};
