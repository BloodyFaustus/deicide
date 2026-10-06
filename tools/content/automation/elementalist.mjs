export default {
  elementalistAttune: {
    choices: ["element"],
    stance: {
      modifiers: [{key: "might", value: 2, when: {actionElement: "attuned"}}],
      effects: [{kind: "applyStatus", statusId: "attuned", target: "self"}],
      onExit: [{kind: "removeStatus", statusId: "attuned", target: "self"}]
    },
    coverage: ["choose a natural element", "Might \\+2 with it"]
  },
  elementalistLightningStrike: {
    coverage: ["element follows Attune"]
  },
  elementalistConduit: {
    modifiers: [
      {key: "might", value: "floor(mag / 4)", when: {actionSource: "weapon"}},
      {key: "attackElement", value: "attuned", when: {actionSource: "weapon"}}
    ],
    coverage: ["weapon attacks take your element and add MAG/4"]
  },
  elementalistDischarge: {
    reaction: {trigger: "hitByAttack", window: {self: true}, when: {attackerRange: {max: 1}}},
    effects: [{kind: "damage", amount: "floor(mag / 2)", tag: "attunedElement", target: "attacker"}]
  },
  elementalistElementalBody: {
    modifiers: [{key: "immune", value: "attunedElement"}],
    coverage: ["immune to your element"]
  }
};
