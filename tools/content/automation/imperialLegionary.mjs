export default {
  imperialLegionaryShieldPush: {
    attack: {basis: "str", source: "weapon", defense: "def", might: 8, element: null},
    effects: [{kind: "move", mode: "push", tiles: 1, target: "target", chance: "onHit"}]
  },
  imperialLegionaryCohort: {
    command: {
      target: "companiesInRadius", companyTypes: ["legionary"],
      effects: [{kind: "applyStatus", statusId: "ordered", target: "companies", turns: "thisPhase", modifiers: [{key: "quality", value: 1}]}]
    }
  },
  imperialLegionaryDiscipline: {
    effects: [{kind: "aura", radius: 99, target: "companiesInRadius", flags: {passMorale: true}}],
    coverage: ["morale auto pass for companies in radius"]
  }
};
