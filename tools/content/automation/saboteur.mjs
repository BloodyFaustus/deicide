export default {
  saboteurDemolition: {
    effects: [{kind: "terrain", op: "remove", tileType: "wall"}, {kind: "cancel", what: "barrier"}],
    coverage: ["2 Mt or 1 Dust", "destroy a Wall tile or Barrier"]
  },
  saboteurMisdirect: {
    command: {
      target: "oneEnemyCompany", radius: 6, roll: {d100Under: "3 * skl - 2 * enemyOfficerCmd"},
      effects: [{kind: "applyStatus", statusId: "misdirected", target: "companies", turns: "thisPhase", params: {doctrine: "hold"}}]
    },
    coverage: ["one enemy company adopts Hold next phase"]
  },
  saboteurForgery: {
    modifiers: [{key: "standing.infiltration", value: 10}],
    coverage: ["Standing \\+10 in infiltration scenes"]
  },
  saboteurCutLines: {
    reaction: {trigger: "enemyCommand", window: {tiles: 6, row: "any"}, roll: {d100Under: "3 * skl"}},
    effects: [{kind: "cancel", what: "command"}]
  },
  saboteurSabotage: {
    effects: [{kind: "flag", key: "preBattle.enemyCompanyStrength", value: 70, target: "self"}],
    coverage: ["pre battle", "one enemy company starts at Strength 70"]
  }
};
