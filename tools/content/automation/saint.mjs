export default {
  saintDivineFavor: {
    effects: [{kind: "flag", key: "divineAttentionAsChannel", value: 5, target: "self"}],
    coverage: ["Divine Attention spent as Channel", "1 for 5"]
  },
  saintMiracle: {
    reaction: {trigger: "allyDowned", window: {tiles: 99, row: "any"}},
    effects: [{kind: "revive", fraction: 1, target: "ally"}],
    usage: {limit: 1, per: "campaign"},
    coverage: ["they live at full HP"]
  },
  saintVoiceOfTheGod: {
    effects: [{kind: "aura", radius: 99, target: "companiesInRadius", modifiers: [{key: "quality", value: 2}]}],
    coverage: ["companies in radius Quality \\+2"]
  }
};
