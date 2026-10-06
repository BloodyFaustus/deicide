export default {
  wardenBarrier: {
    effects: [{kind: "terrain", op: "barrier", barrier: "3 * mag", side: "ally", row: "front"}],
    coverage: ["tile or row Barrier absorbs 3 x MAG"]
  },
  wardenShieldOfFaith: {
    reaction: {trigger: "allyHit", window: {tiles: 3, row: "any"}},
    effects: [{kind: "absorb", amount: "floor(mag / 2)", target: "ally"}]
  },
  wardenSanctifiedGround: {
    command: {
      target: "companiesInRadius",
      effects: [{kind: "applyStatus", statusId: "steadfast", target: "companies", turns: "thisPhase"}]
    }
  },
  wardenRepel: {
    effects: [{kind: "move", mode: "push", tiles: 1, target: "radius"}],
    coverage: ["push radius 1 one tile or force swap"]
  },
  wardenBarrierEngine: {
    coverage: ["Barrier absorbs 5 x MAG"]
  }
};
