export default {
  gunnerShot: {
    coverage: ["\\+6 vs unwarded"]
  },
  gunnerFlinch: {
    reaction: {trigger: "hitByAttack", window: {self: true}, when: {attackerRange: {max: 1}}},
    effects: [{kind: "counter"}, {kind: "move", mode: "swapRow", target: "self"}]
  },
  gunnerMarksmanship: {
    coverage: ["gun Might 3 vs Warded instead of 0"]
  }
};
