export default {
  marineShieldDeck: {
    coverage: ["Move 0"]
  },
  marineSeaArmor: {
    modifiers: [{key: "effectiveness.piercingVsArmored", op: "set", value: 1.5}],
    coverage: ["Armored x2 weaknesses become x1\\.5"]
  },
  marineHoldFast: {
    command: {
      target: "companiesInRadius", companyTypes: ["ship"],
      effects: [{kind: "applyStatus", statusId: "ordered", target: "companies", turns: "thisRound", flags: {immuneBoarding: true}}]
    }
  },
  marineSplashGuard: {
    reaction: {trigger: "targetedByAttack", window: {self: true}, when: {actionArea: "blast"}},
    modifiers: [{key: "damageTaken", op: "mul", value: 0.5}]
  }
};
