export default {
  shadowOffMap: {
    effects: [{kind: "flag", key: "deployFromAnyEdge", value: 2, target: "self"}],
    coverage: ["deploy from any map edge on round 2"]
  },
  shadowCloak: {
    coverage: ["untargetable at range 3\\+"]
  },
  shadowTerror: {
    command: {
      target: "enemyCompaniesWithin", radius: 1, anchor: "slainOfficer",
      effects: [{kind: "applyStatus", statusId: "routed", target: "companies"}]
    },
    coverage: ["enemy companies adjacent to a slain officer rout"]
  },
  shadowBlink: {
    reaction: {trigger: "targetedByAttack", window: {self: true}},
    effects: [{kind: "move", mode: "teleport", tiles: 3, target: "self"}, {kind: "cancel", what: "triggeringAction", when: {actionMelee: true}}]
  },
  shadowReaper: {
    effects: [{kind: "refundAction", condition: "onKillOfficer"}],
    coverage: ["killing an Officer refunds your action"]
  }
};
