export default {
  heroAdaptation: {
    modifiers: [{key: "capGrade", op: "set", value: "SS"}],
    coverage: ["SS cap"]
  },
  heroHerosPresence: {
    command: {
      target: "companiesInRadius",
      effects: [{kind: "applyStatus", statusId: "steadfast", target: "companies", turns: "thisPhase"}]
    }
  },
  heroSaturatedStrike: {
    attack: {basis: "str", source: "weapon", defense: "def", might: 0, element: null},
    modifiers: [{key: "might", value: "floor(saturation / 10)", when: {actionId: "heroSaturatedStrike"}}],
    war: {range: null, area: {shape: "single", size: 1}, target: "enemy", movement: null, terrain: false},
    coverage: ["weapon attack \\+Saturation/10 Might"]
  },
  heroManaDrinker: {
    reaction: {trigger: "hitBySpell", window: {self: true}, when: {actionTag: "reason"}},
    effects: [{kind: "pool", key: "saturation", delta: 1, target: "self"}],
    coverage: ["gain 1 Saturation"]
  },
  heroWeaponOfWar: {
    modifiers: [{key: "damageMultiplier", op: "set", value: 1.5, when: {targetKind: "company"}}],
    coverage: ["all attacks vs companies x1\\.5"]
  }
};
