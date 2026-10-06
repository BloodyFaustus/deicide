export default {
  greatKnightIronWall: {
    coverage: ["Move 3"]
  },
  greatKnightTrampleLine: {
    effects: [
      {kind: "move", mode: "through", tiles: 3, target: "self"},
      {kind: "damage", amount: 8, tag: "strength", target: "target", ignoresDefense: true}
    ],
    coverage: ["8 Strength each"]
  },
  greatKnightArmoredWedge: {
    command: {
      target: "companiesInRadius", companyTypes: ["cavalry", "legionary"],
      effects: [{kind: "applyStatus", statusId: "ordered", target: "companies", turns: "thisPhase", modifiers: [{key: "chargeMultiplier", op: "set", value: 2}]}]
    },
    coverage: ["armored and mounted companies in radius x2 on charge"]
  },
  greatKnightUnbreakable: {
    reaction: {trigger: "hitByAttack", window: {self: true}, when: {damageAtLeast: 20}},
    modifiers: [{key: "damageTaken", op: "add", value: "-floor(def / 2)"}],
    coverage: ["reduce by DEF/2"]
  },
  greatKnightSiegeBreaker: {
    effects: [{kind: "flag", key: "ignoresWallOnCharge", value: true, target: "self"}],
    coverage: ["ignores Wall and Barrier on charge"]
  }
};
