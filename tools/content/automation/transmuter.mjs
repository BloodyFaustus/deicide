export default {
  transmuterTransmuteTerrain: {
    effects: [{kind: "terrain", op: "set", side: "ally", row: "front"}],
    coverage: ["change one tile type or raise or remove a Wall", "Dungeon: row Barrier 4 x MAG"]
  },
  transmuterBridge: {
    effects: [{kind: "terrain", op: "set", tileType: "road", size: 4}],
    coverage: ["river line of 4 becomes Road for the battle"]
  },
  transmuterMason: {
    effects: [{kind: "nationTrack", track: "fortifications", delta: 1, once: true}],
    modifiers: [{key: "fortKitCost", op: "mul", value: 0.5}],
    coverage: ["Fort Kits cost half"]
  },
  transmuterEarthworks: {
    command: {
      target: "companiesInRadius",
      effects: [{kind: "applyStatus", statusId: "ordered", target: "companies", turns: "thisPhase", modifiers: [{key: "avoid", value: 20}]}]
    },
    coverage: ["companies in radius gain Fort Avoid this phase"]
  },
  transmuterCollapse: {
    effects: [{kind: "terrain", op: "remove"}],
    coverage: ["a Wall or Hill falls"]
  },
  transmuterArchitect: {
    modifiers: [{key: "cost.matter", op: "set", value: 1, when: {actionId: "transmuterTransmuteTerrain"}}]
  }
};
