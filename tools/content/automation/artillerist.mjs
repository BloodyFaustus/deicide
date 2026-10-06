export default {
  artilleristSpotter: {
    effects: [{kind: "flag", key: "lineOfSightFromCompanies", value: true, target: "self"}],
    coverage: ["companies in radius give you line of sight"]
  },
  artilleristSiegeLine: {
    command: {
      target: "companiesInRadius", companyTypes: ["siege"],
      effects: [{kind: "applyStatus", statusId: "ordered", target: "companies", turns: "thisPhase", modifiers: [{key: "strikes", value: 1}]}]
    }
  },
  artilleristBreachShot: {
    effects: [{kind: "terrain", op: "remove", tileType: "wall"}, {kind: "cancel", what: "barrier"}],
    coverage: ["destroy a Wall tile or Barrier"]
  },
  artilleristBrace: {
    reaction: {trigger: "targetedByAttack", window: {self: true}, when: {actionArea: "blast"}},
    modifiers: [{key: "damageTaken", op: "mul", value: 0.5}]
  },
  artilleristBombard: {
    modifiers: [{key: "range.max", value: 2, when: {actionId: "artilleristCannon"}}],
    coverage: ["Cannon range 3 to 10"]
  }
};
