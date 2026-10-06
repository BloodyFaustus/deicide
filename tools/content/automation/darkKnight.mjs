export default {
  darkKnightSouleater: {
    effects: [{kind: "heal", amount: "floor(damage / 4)", target: "self", chance: "onHit", trigger: "ownAttack", when: {actionId: "darkKnightDarkness"}}],
    coverage: ["Darkness heals a quarter of damage dealt"]
  },
  darkKnightGrimGuard: {
    reaction: {trigger: "allyHit", window: {adjacent: true}},
    effects: [{kind: "redirect", to: "self"}, {kind: "applyStatus", statusId: "voidEdge", target: "self", turns: 1}],
    coverage: ["Void Might \\+2 next turn"]
  },
  darkKnightLastBreath: {
    modifiers: [{key: "might", value: 6, when: {actionElement: "void", hpAtOrBelow: 0.25}}],
    coverage: ["at or below a quarter HP", "Void Might \\+6"]
  },
  darkKnightDreadMastery: {
    modifiers: [{key: "cost.hp", op: "mul", value: 0.5, when: {actionId: ["darkKnightDarkness", "darkKnightAbyssCleave"]}}],
    coverage: ["Darkness and Abyss Cleave cost half HP"]
  }
};
