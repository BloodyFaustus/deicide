export default {
  battlemageMageLine: {
    command: {
      target: "companiesInRadius", companyTypes: ["battlemage"],
      effects: [{kind: "applyStatus", statusId: "ordered", target: "companies", turns: "thisPhase", modifiers: [{key: "quality", value: 2}]}]
    },
    coverage: ["this volley"]
  },
  battlemageManaShield: {
    reaction: {trigger: "hitByAttack", window: {self: true}, cost: {channel: 2}},
    modifiers: [{key: "damageTaken", op: "add", value: "-floor(mag / 2)"}],
    coverage: ["2 Ch reduces damage by MAG/2"]
  }
};
