export default {
  rangerHuntersMark: {
    coverage: ["Might \\+3 vs target 3 turns"]
  },
  rangerWoodcraft: {
    modifiers: [{key: "avoid", value: 10, when: {terrain: "forest"}}],
    coverage: ["forest Avoid \\+10 more"]
  },
  rangerBeastCall: {
    effects: [{kind: "summon", companyType: "animal", strength: 40, quality: 2, duration: "encounter"}]
  },
  rangerAmbush: {
    reaction: {trigger: "enemyEnteredRange", window: {tiles: 3, row: "any"}},
    effects: [{kind: "counter"}]
  },
  rangerTrailblazer: {
    effects: [{kind: "aura", radius: 99, target: "allies", modifiers: [{key: "move", value: 1}], when: {engine: "war"}}],
    coverage: ["party Move \\+1 in War"]
  }
};
