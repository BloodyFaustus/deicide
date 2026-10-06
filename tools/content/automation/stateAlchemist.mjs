export default {
  stateAlchemistDeconstruction: {
    effects: [{kind: "flag", key: "companyQualityMinus1", value: true, target: "target", chance: "onHit", when: {targetType: "company"}}],
    coverage: ["single", "Against a company", "Quality minus 1 permanently"]
  },
  stateAlchemistLessonOfEquivalence: {
    effects: [
      {kind: "flag", key: "certifyStudent", value: true, target: "self"},
      {kind: "pool", key: "divineAttention", delta: 2, target: "self"}
    ],
    coverage: ["between sessions", "certify one character into Alchemist"]
  },
  stateAlchemistArray: {
    modifiers: [{key: "cost.matter", op: "set", value: 0, when: {firstThisEncounter: true, actionSource: "alchemy"}}],
    coverage: ["first transmutation each encounter costs 0 Mt"]
  },
  stateAlchemistDoctrineOfRuin: {
    command: {
      target: "companiesInRadius",
      effects: [{kind: "applyStatus", statusId: "ordered", target: "companies", turns: "thisPhase", flags: {ignoreFortAvoid: true}}]
    },
    coverage: ["companies in radius ignore enemy Fort Avoid this phase"]
  },
  stateAlchemistUnmake: {
    effects: [{kind: "cancel", what: "barrier"}, {kind: "removeStatus", statusId: "warded", target: "target"}, {kind: "flag", key: "destroyRelic", value: true, target: "target"}],
    coverage: ["destroys one Barrier", "ward", "or relic"]
  },
  stateAlchemistEquivalentExchange: {
    coverage: ["Soul Prices halved"]
  }
};
