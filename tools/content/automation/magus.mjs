export default {
  magusCounterspell: {
    reaction: {trigger: "enemyCast", window: {tiles: 3, row: "any"}, roll: {d100Under: "10 + 3 * skl - 2 * casterMag"}, cost: {channel: 4}},
    effects: [{kind: "cancel", what: "triggeringAction"}]
  },
  magusFieldOfRuin: {
    command: {
      target: "companiesInRadius", companyTypes: ["battlemage"],
      effects: [{kind: "applyStatus", statusId: "ordered", target: "companies", turns: "thisPhase", modifiers: [{key: "quality", value: 3}]}]
    },
    coverage: ["this volley"]
  },
  magusSaturatedVessel: {
    coverage: ["Overcast Burn halved \\(floor 1\\)"]
  }
};
