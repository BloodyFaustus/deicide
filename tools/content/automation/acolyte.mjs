export default {
  acolyteLitany: {
    command: {
      target: "companiesInRadius",
      effects: [{kind: "applyStatus", statusId: "steadfast", target: "companies", turns: "thisRound"}]
    }
  },
  acolyteSanctuary: {
    reaction: {trigger: "allyHit", window: {adjacent: true}},
    effects: [{kind: "heal", amount: "floor(mag / 2)", target: "ally"}]
  },
  acolyteVigil: {
    modifiers: [{key: "healing.cleanse", value: 1}],
    coverage: ["heals also remove one status"]
  }
};
