export default {
  dreadKnightPall: {
    stance: {
      modifiers: [{key: "defense.def", value: 6}, {key: "defense.res", value: 4}, {key: "delay", value: 10}],
      effects: [{kind: "aura", radius: 1, target: "allies", modifiers: [{key: "damageTaken", op: "mul", value: 0.75, when: {actionElement: "divine"}}]}]
    },
    coverage: ["adjacent allies take x0\\.75 from Divine"]
  },
  dreadKnightHarvestSoul: {
    effects: [{kind: "heal", amount: 15, target: "self", trigger: "onKillCharacter"}],
    coverage: ["killing a character restores 15 HP"]
  },
  dreadKnightBlackBanner: {
    command: {
      target: "companiesInRadius",
      effects: [{kind: "applyStatus", statusId: "ordered", target: "companies", turns: "thisPhase", modifiers: [{key: "quality", value: 1, when: {targetTag: "divine"}}]}]
    },
    coverage: ["companies in radius Quality \\+1 against Divine users"]
  },
  dreadKnightUndying: {
    reaction: {trigger: "lethalHit", window: {self: true}},
    effects: [{kind: "survive", hp: 1, target: "self"}, {kind: "flag", key: "undyingDebt", value: 20, target: "self", duration: "longRest"}],
    usage: {limit: 1, per: "encounter"},
    coverage: ["costs 20 HP at next long rest"]
  },
  dreadKnightLordOfThePall: {
    modifiers: [{key: "cost.hp", op: "set", value: 0, when: {actionElement: "void", hpAbove: 0.5}}],
    coverage: ["Void arts cost no HP while above half HP"]
  }
};
