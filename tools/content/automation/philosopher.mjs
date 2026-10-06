export default {
  philosopherTransmuteSoul: {
    coverage: ["single", "0 Mt", "SP 0 while the Stone is bonded"]
  },
  philosopherTheStone: {
    effects: [{kind: "pool", key: "divineAttention", delta: 1, target: "self", per: "session"}],
    coverage: ["Matter costs 0", "Soul Prices 0", "Divine Attention \\+1 per session"]
  },
  philosopherGreatWork: {
    command: {
      target: "companiesInRadius",
      effects: [{kind: "applyStatus", statusId: "ordered", target: "companies", turns: "thisPhase", flags: {immuneDivine: true}}]
    },
    coverage: ["companies in radius immune to Divine effects"]
  },
  philosopherReconstitute: {
    reaction: {trigger: "allyDowned", window: {tiles: 3, row: "any"}},
    effects: [{kind: "revive", fraction: 0.5, target: "ally"}, {kind: "pool", key: "divineAttention", delta: 1, target: "self"}],
    usage: {limit: 1, per: "session"},
    coverage: ["they live at half HP", "Divine Attention \\+1"]
  },
  philosopherTruth: {
    effects: [{kind: "pool", key: "divineAttention", delta: 3, target: "self"}],
    coverage: ["SP 0", "Divine Attention \\+3"]
  }
};
