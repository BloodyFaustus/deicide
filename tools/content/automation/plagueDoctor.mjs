export default {
  plagueDoctorDiagnose: {
    effects: [{kind: "reveal", what: "hpChannelSaturation", target: "target"}],
    coverage: ["see HP", "Channel", "Saturation of any target"]
  },
  plagueDoctorPurge: {
    effects: [{kind: "removeStatus", statusId: "all", target: "ally"}, {kind: "heal", amount: 20, target: "ally"}],
    war: {target: "ally"},
    coverage: ["remove all statuses and 20 Burn"]
  },
  plagueDoctorInoculate: {
    effects: [{kind: "applyStatus", statusId: "inoculated", target: "ally", expires: "session"}],
    war: {target: "ally"},
    coverage: ["ally immune to plague and Manaburn 1 session"]
  },
  plagueDoctorQuarantine: {
    command: {
      target: "companiesInRadius",
      effects: [{kind: "applyStatus", statusId: "ordered", target: "companies", expires: "battle", flags: {immunePlague: true}}]
    },
    coverage: ["companies in radius immune to plague zone this battle"]
  },
  plagueDoctorCulture: {
    effects: [{kind: "terrain", op: "set", tileType: "plague"}],
    coverage: ["2 Burn per turn"]
  },
  plagueDoctorCure: {
    effects: [{kind: "pool", key: "manaburn", delta: -10, target: "ally"}],
    war: {range: [1, 1], area: {shape: "single", size: 1}, target: "ally", movement: null, terrain: false},
    coverage: ["remove 10 Manaburn permanently"]
  }
};
