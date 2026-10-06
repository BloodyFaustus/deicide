export default {
  dustwrightRefine: {
    effects: [
      {kind: "pool", key: "matter", delta: -10, target: "self"},
      {kind: "pool", key: "dust", delta: 5, target: "self"}
    ],
    usage: {limit: 1, per: "session"},
    coverage: ["between sessions", "10 Mt to 5 Dust"]
  },
  dustwrightQuartermaster: {
    modifiers: [{key: "resupplyCost", op: "mul", value: 0.5}],
    effects: [{kind: "nationTrack", track: "dust", delta: 1, once: true}],
    coverage: ["Resupply costs half"]
  },
  dustwrightFleetOrdnance: {
    command: {
      target: "companiesInRadius", companyTypes: ["ship"],
      effects: [{kind: "applyStatus", statusId: "ordered", target: "companies", turns: "thisPhase", modifiers: [{key: "might", value: 4}]}]
    }
  },
  dustwrightFuse: {
    effects: [{kind: "terrain", op: "remove", delay: "roundEnd"}, {kind: "cancel", what: "barrier", delay: "roundEnd"}],
    coverage: ["a Wall tile or Barrier is destroyed at end of round"]
  },
  dustwrightDustLord: {
    modifiers: [{key: "refine.dust", op: "set", value: 10}],
    coverage: ["Refine yields 10 Dust"]
  }
};
