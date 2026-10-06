export default {
  alchemistTransmuteStrike: {
    coverage: ["STR \\+ MAG/2 physical", "0 Mt"]
  },
  alchemistWall: {
    effects: [{kind: "terrain", op: "wall", side: "ally", row: "front"}]
  },
  alchemistDeconstruct: {
    reaction: {trigger: "targetedByAttack", window: {self: true}, when: {actionPhysical: true}, cost: {matter: 1}},
    modifiers: [{key: "defense.def", value: 5}],
    coverage: ["1 Mt for DEF \\+5"]
  }
};
