export default {
  rogueLockpick: {
    effects: [{kind: "flag", key: "lockpick", value: true, target: "self"}],
    coverage: ["open any mundane lock"]
  },
  rogueSmoke: {
    effects: [{kind: "applyStatus", statusId: "smoke", target: "radius", turns: 2}],
    coverage: ["one row or radius 1 Avoid \\+15 for 2 turns"]
  },
  rogueEvade: {
    reaction: {trigger: "targetedByAttack", window: {self: true}, when: {attackerRange: {min: 2}}},
    modifiers: [{key: "avoid", value: 20}]
  }
};
