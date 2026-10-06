export default {
  halberdierPikeWall: {
    command: {
      target: "companiesInRadius", companyTypes: ["pike"],
      effects: [{kind: "applyStatus", statusId: "ordered", target: "companies", turns: "thisPhase", modifiers: [{key: "companyMultiplier.mounted", op: "set", value: 2}]}]
    }
  },
  halberdierSetSpear: {
    reaction: {trigger: "mountedAttacker", window: {self: true}},
    effects: [{kind: "strikeFirst"}]
  },
  halberdierPhalanx: {
    effects: [{kind: "aura", radius: 1, target: "allies", modifiers: [{key: "defense.def", value: 2}]}],
    coverage: ["adjacent allies DEF \\+2"]
  }
};
