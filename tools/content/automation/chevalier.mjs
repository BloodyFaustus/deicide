export default {
  chevalierDoubleCanto: {
    effects: [{kind: "flag", key: "doubleCanto", value: true, target: "self"}],
    coverage: ["Canto before and after acting"]
  },
  chevalierOutflank: {
    command: {
      target: "companiesInRadius", companyTypes: ["cavalry"],
      effects: [{kind: "applyStatus", statusId: "ordered", target: "companies", turns: "thisPhase", modifiers: [{key: "hit", value: 15, when: {flank: true}}, {key: "crit", value: 10, when: {flank: true}}]}]
    }
  },
  chevalierPursuit: {
    attack: {basis: "str", source: "weapon", defense: "def", might: 0, element: null, multiplierVs: {targetStatus: "routed", value: 2}},
    war: {range: null, area: {shape: "single", size: 1}, target: "enemy", movement: null, terrain: false},
    coverage: ["attack a routing company for x2 Strength loss"]
  },
  chevalierEvasion: {
    reaction: {trigger: "targetedByAttack", window: {self: true}, when: {selfMoved: {min: 5}}},
    modifiers: [{key: "avoid", value: 25}]
  },
  chevalierHorselord: {
    modifiers: [{key: "move", value: 2}, {key: "terrainCost.river", op: "set", value: 3}],
    effects: [{kind: "flag", key: "riverPassable", value: true, target: "self"}],
    coverage: ["river passable"]
  }
};
