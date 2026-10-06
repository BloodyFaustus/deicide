export default {
  lancerShock: {
    effects: [{kind: "applyStatus", statusId: "stagger", target: "target", turns: 1, chance: "onHit", trigger: "ownAttack", when: {actionId: "lancerLanceCharge"}}],
    coverage: ["charge hits inflict Stagger"]
  },
  lancerWedge: {
    command: {
      target: "companiesInRadius", companyTypes: ["cavalry"],
      effects: [{kind: "applyStatus", statusId: "ordered", target: "companies", turns: "thisPhase", modifiers: [{key: "companyMultiplier.infantry", op: "set", value: 2, when: {charge: true}}]}]
    }
  },
  lancerHoldReins: {
    reaction: {trigger: "targetedByAttack", window: {self: true}, when: {selfMoved: {min: 1}}},
    modifiers: [{key: "defense.def", value: 4}]
  },
  lancerLanceOfTheCrown: {
    modifiers: [{key: "crit", value: 20, when: {actionId: "lancerLanceCharge"}}],
    coverage: ["charge crit \\+20"]
  }
};
