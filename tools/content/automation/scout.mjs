export default {
  scoutMarkTarget: {
    effects: [{kind: "applyStatus", statusId: "exposed", target: "target", turns: 1}]
  },
  scoutPathfinder: {
    modifiers: [
      {key: "terrainCost.forest", op: "set", value: 1},
      {key: "terrainCost.hill", op: "set", value: 1}
    ],
    coverage: ["forest and hill cost 1"]
  },
  scoutVolley: {
    command: {
      target: "companiesInRadius", companyTypes: ["archer"],
      effects: [{kind: "applyStatus", statusId: "ordered", target: "companies", turns: "thisPhase", modifiers: [{key: "hit", value: 10}]}]
    }
  },
  scoutSidestep: {
    reaction: {trigger: "missedByMelee", window: {self: true}},
    effects: [{kind: "move", mode: "teleport", tiles: 1, target: "self"}]
  }
};
