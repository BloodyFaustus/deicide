export default {
  captainOrders: {
    command: {
      target: "oneCompany",
      effects: [{kind: "grantAction", count: 1, scope: "oneCompany", target: "companies"}]
    }
  },
  captainCutDown: {
    attack: {basis: "str", source: "weapon", defense: "def", might: 0, element: null, bonuses: [{when: {targetKind: "company"}, might: 4}]},
    war: {range: null, area: {shape: "single", size: 1}, target: "enemy", movement: null, terrain: false}
  },
  captainLogistics: {
    modifiers: [{key: "companyStartStrength", value: 10}],
    coverage: ["companies you command start at Strength \\+10"]
  },
  captainFlankOrder: {
    command: {
      target: "companiesInRadius",
      effects: [{kind: "applyStatus", statusId: "ordered", target: "companies", turns: "thisPhase", modifiers: [{key: "move", value: 2}]}]
    }
  },
  captainShieldRing: {
    reaction: {trigger: "targetedByAttack", window: {self: true}},
    effects: [{kind: "redirect", to: "adjacentCompany"}]
  }
};
