export default {
  voidcallerDevour: {
    effects: [{kind: "heal", amount: "floor(damage / 2)", target: "self", chance: "onHit"}],
    coverage: ["heals you half"]
  },
  voidcallerUnlight: {
    modifiers: [{key: "ignoreDivineResistance", value: 1, when: {actionElement: "void"}}],
    coverage: ["your Void spells ignore Divine resistance entirely"]
  },
  voidcallerNullWard: {
    reaction: {trigger: "enemyCast", window: {tiles: 3, row: "any"}, roll: {d100Under: "3 * skl"}, cost: {channel: 4}, when: {actionTag: "faith"}},
    effects: [{kind: "cancel", what: "triggeringAction"}],
    coverage: ["enemy casts Faith within 3"]
  },
  voidcallerEclipse: {
    command: {
      target: "companiesInRadius",
      effects: [{kind: "applyStatus", statusId: "ordered", target: "companies", turns: "thisPhase", flags: {immuneDivine: true}}]
    },
    coverage: ["companies in radius immune to Divine effects this phase"]
  },
  voidcallerVoidborn: {
    modifiers: [{key: "opposedMultiplier", op: "set", value: 1, when: {actionElement: "divine"}}],
    coverage: ["Divine deals x1\\.0 to you instead of x1\\.5"]
  }
};
