export default {
  chaplainHymn: {
    command: {
      target: "companiesInRadius",
      effects: [{kind: "pool", key: "strength", delta: 5, target: "companies"}]
    }
  },
  chaplainSermon: {
    effects: [{kind: "standing", faction: "civilians", delta: 10, scope: "character", once: true}]
  },
  chaplainLastRites: {
    reaction: {trigger: "allyDowned", window: {tiles: 3, row: "any"}},
    effects: [{kind: "survive", hp: 1, target: "ally"}]
  },
  chaplainRallyCry: {
    command: {
      target: "companiesInRadius", radius: 99,
      effects: [{kind: "applyStatus", statusId: "ordered", target: "companies", turns: "thisPhase", flags: {ignoreRadius: true}}]
    }
  },
  chaplainMartyr: {
    modifiers: [{key: "healing", op: "mul", value: 1.5}],
    coverage: ["heals \\+50 percent"]
  }
};
