export default {
  wyvernLordAirSuperiority: {
    modifiers: [{key: "effectiveness.bowVsFlying", op: "set", value: 1.25}],
    coverage: ["bow x1\\.25 against you"]
  },
  wyvernLordDropFormation: {
    command: {
      target: "companiesInRadius", companyTypes: ["flying"],
      effects: [{kind: "move", mode: "carry", tiles: 6, target: "companies"}]
    },
    coverage: ["flying companies in radius deliver a company 6 tiles"]
  },
  wyvernLordStoop: {
    reaction: {trigger: "allyTargeted", window: {tiles: 4, row: "any"}},
    effects: [{kind: "counter"}],
    coverage: ["enemy within 4 attacks ally"]
  }
};
