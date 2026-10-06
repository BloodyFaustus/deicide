export default {
  warlordDoubleTime: {
    command: {
      target: "companiesInRadius",
      effects: [{kind: "grantAction", count: 1, scope: "companiesInRadius", target: "companies"}]
    }
  },
  warlordWarCry: {
    effects: [{kind: "flag", key: "forceMoraleCheck", value: true, target: "enemies"}],
    war: {range: [0, 3], area: {shape: "blast", size: 3}, target: "enemy", movement: null, terrain: false},
    coverage: ["enemy companies within 3 morale check"]
  },
  warlordReserve: {
    command: {
      target: "oneCompany", radius: 99, includeRouted: true,
      effects: [{kind: "removeStatus", statusId: "routed", target: "companies"}, {kind: "pool", key: "strength", delta: 30, target: "companies", op: "set"}]
    },
    coverage: ["one routed company returns at Strength 30"]
  },
  warlordVeto: {
    reaction: {trigger: "enemyCommand", window: {tiles: 99, row: "any"}, roll: {d100Under: "3 * cmd"}},
    effects: [{kind: "cancel", what: "command"}]
  },
  warlordLegendOfTheField: {
    effects: [{kind: "aura", radius: 99, target: "companiesInRadius", modifiers: [{key: "quality", value: 1}]}],
    coverage: ["companies in radius Quality \\+1"]
  }
};
