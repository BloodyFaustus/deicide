export default {
  spellbreakerNullEdge: {
    effects: [{kind: "removeStatus", statusId: "warded", target: "target", chance: "onHit", trigger: "ownAttack", when: {actionSource: "weapon"}}],
    coverage: ["weapon hits remove Warded"]
  },
  spellbreakerSeveringCut: {
    effects: [{kind: "pool", key: "channel", delta: "-floor(damage / 2)", target: "target", chance: "onHit"}],
    coverage: ["target loses Channel equal to damage/2"]
  },
  spellbreakerSpellEater: {
    reaction: {trigger: "enemyCast", window: {tiles: 3, row: "any"}, roll: {d100Under: "3 * skl"}},
    effects: [{kind: "cancel", what: "triggeringAction"}, {kind: "pool", key: "channel", delta: 2, target: "self"}]
  },
  spellbreakerSuppression: {
    command: {
      target: "companiesInRadius",
      effects: [{kind: "aura", radius: 3, target: "enemies", flags: {cannotRaiseWarded: true}}]
    },
    coverage: ["enemy casters within 3 of companies in radius cannot raise Warded"]
  },
  spellbreakerDispelField: {
    effects: [{kind: "removeStatus", statusId: "warded", target: "radius"}, {kind: "cancel", what: "barrier"}],
    war: {range: [0, 2], area: {shape: "blast", size: 2}, target: "enemy", movement: null, terrain: false}
  },
  spellbreakerMageBane: {
    modifiers: [{key: "damageTaken", op: "mul", value: 0.5, when: {actionTag: ["reason", "faith", "void"]}}],
    coverage: ["Reason", "Faith", "and Void damage against you halved"]
  }
};
