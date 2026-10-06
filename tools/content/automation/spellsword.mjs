export default {
  spellswordSpellblade: {
    coverage: ["vs lower defense"]
  },
  spellswordWardEdge: {
    reaction: {trigger: "targetedByAttack", window: {self: true}, when: {actionSource: "spell"}},
    modifiers: [{key: "defense.res", value: 6}]
  },
  spellswordElementalEdge: {
    choices: ["element"],
    modifiers: [{key: "attackElement", value: "chosen", when: {actionId: "spellswordSpellblade"}}],
    coverage: ["Spellblade takes a chosen element tag"]
  },
  spellswordRiposte: {
    reaction: {trigger: "missedByMelee", window: {self: true}},
    effects: [{kind: "counter", abilityId: "spellswordSpellblade"}]
  },
  spellswordTwinDiscipline: {
    coverage: ["Spellblade uses STR \\+ MAG"]
  }
};
