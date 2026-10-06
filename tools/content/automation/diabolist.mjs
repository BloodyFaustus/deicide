export default {
  diabolistRedDraught: {
    effects: [
      {kind: "pool", key: "redWater", delta: -1, target: "self"},
      {kind: "applyStatus", statusId: "empowered", target: "self", turns: 3},
      {kind: "pool", key: "marks", delta: 1, target: "self"}
    ],
    war: {range: [0, 0], area: {shape: "self", size: 0}, target: "self", movement: null, terrain: false},
    coverage: ["1 Red Water", "\\+4 all stats 3 turns", "1 Mark", "Void"]
  },
  diabolistSummonShade: {
    effects: [
      {kind: "summon", companyType: "shade", strength: 50, quality: 3, duration: "battle"},
      {kind: "pool", key: "marks", delta: 1, target: "self"}
    ],
    coverage: ["Void company Strength 50 Quality 3", "1 Mark"]
  },
  diabolistPact: {
    effects: [{kind: "pool", key: "divineAttention", delta: 1, target: "self", once: true}],
    coverage: ["Divine Attention \\+1"]
  },
  diabolistBloodPrice: {
    reaction: {trigger: "allyDowned", window: {tiles: 2, row: "any"}},
    effects: [{kind: "pool", key: "channel", delta: "+allyChannel", target: "self"}],
    coverage: ["you gain their Channel"]
  },
  diabolistApotheosis: {
    effects: [
      {kind: "flag", key: "apotheosisStat", value: "chosen", target: "self", duration: "encounter"},
      {kind: "pool", key: "marks", delta: 3, target: "self"}
    ],
    usage: {limit: 1, per: "encounter"},
    coverage: ["one SSS stat for one encounter", "3 Marks"]
  }
};
