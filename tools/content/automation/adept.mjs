export default {
  adeptManaSense: {
    reaction: {trigger: "targetedByAttack", window: {self: true}, when: {actionSource: "spell"}},
    modifiers: [{key: "defense.res", value: 4}],
    coverage: ["enemy cast within 3"]
  }
};
