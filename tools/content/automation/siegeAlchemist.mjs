export default {
  siegeAlchemistGunsmith: {
    effects: [
      {kind: "nationTrack", track: "weapons", delta: 1, once: true},
      {kind: "flag", key: "gunsOneTierEarly", value: true, target: "self"}
    ],
    coverage: ["Lathander guns available one shop tier early"]
  },
  siegeAlchemistOrdnanceDoctrine: {
    command: {
      target: "companiesInRadius", companyTypes: ["siege"],
      effects: [{kind: "applyStatus", statusId: "ordered", target: "companies", turns: "thisPhase", modifiers: [{key: "quality", value: 1}, {key: "strikes", value: 1}]}]
    }
  },
  siegeAlchemistBreach: {
    effects: [{kind: "terrain", op: "remove", tileType: "wall"}, {kind: "cancel", what: "barrier"}],
    coverage: ["destroy a Wall tile or Barrier"]
  },
  siegeAlchemistSiegemaster: {
    modifiers: [{key: "range.max", value: 2, when: {actionId: ["siegeAlchemistStoneLance", "siegeAlchemistShell"]}}],
    coverage: ["Stone Lance and Shell range \\+2"]
  }
};
