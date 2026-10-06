export default {
  godslayerDeicideArray: {
    modifiers: [{key: "damageMultiplier", op: "set", value: 2, when: {targetTag: "divine"}}],
    coverage: ["Divine Agents take x2 from you"]
  },
  godslayerUnmake: {
    effects: [{kind: "cancel", what: "barrier"}, {kind: "removeStatus", statusId: "warded", target: "target"}, {kind: "flag", key: "destroyRelic", value: true, target: "target"}],
    coverage: ["destroy a divine relic or ward"]
  },
  godslayerAnomaly: {
    reaction: {trigger: "targetedByAttack", window: {self: true}, roll: {d100Under: "3 * skl"}, when: {attackerTag: "divine"}},
    effects: [{kind: "redirect", to: "attacker"}],
    coverage: ["targeted by a god", "the attack resolves against the god"]
  },
  godslayerLawBreaker: {
    effects: [{kind: "flag", key: "capGradeEncounter", value: "SSS", target: "self", duration: "encounter"}],
    usage: {limit: 1, per: "session"},
    coverage: ["SSS cap for one encounter per session"]
  }
};
