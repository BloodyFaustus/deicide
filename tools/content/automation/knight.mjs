export default {
  knightShieldBash: {
    attack: {basis: "str", source: "weapon", defense: "def", might: 6, element: null},
    effects: [{kind: "applyStatus", statusId: "rooted", target: "target", turns: 1, chance: "onHit"}],
    coverage: ["target loses next Canto or Swap"]
  },
  knightGuardian: {
    reaction: {trigger: "allyHit", window: {adjacent: true}},
    effects: [{kind: "redirect", to: "self"}],
    modifiers: [{key: "defense.def", value: 4}]
  },
  knightFortress: {
    modifiers: [{key: "terrainHeal.fort", op: "set", value: 20}],
    coverage: ["forts heal 20 percent"]
  },
  knightImmovable: {
    modifiers: [{key: "immune", value: "rowSwap"}, {key: "immune", value: "push"}, {key: "immune", value: "pull"}],
    effects: [{kind: "flag", key: "immovable", value: true, target: "self"}],
    coverage: ["pull", "swap", "immune to push"]
  }
};
