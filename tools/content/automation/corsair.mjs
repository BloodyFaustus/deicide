export default {
  corsairBroadside: {
    command: {
      target: "companiesInRadius", companyTypes: ["ship"],
      effects: [{kind: "applyStatus", statusId: "ordered", target: "companies", turns: "thisPhase", modifiers: [{key: "strikes", value: 1}]}]
    }
  },
  corsairGrapnel: {
    reaction: {trigger: "enemyMoved", window: {adjacent: true}},
    effects: [{kind: "move", mode: "pull", tiles: 1, target: "attacker"}]
  },
  corsairDreadCaptain: {
    effects: [{kind: "standing", faction: "underworld", delta: 20, scope: "character", once: true}],
    modifiers: [{key: "shipQuality", value: 1}],
    coverage: ["ships Quality \\+1"]
  }
};
