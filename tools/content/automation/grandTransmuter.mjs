export default {
  grandTransmuterCitadel: {
    effects: [{kind: "terrain", op: "fort3x3", tileType: "fort", size: 3, side: "ally", row: "front"}],
    coverage: ["raise a 3 by 3 Fort"]
  },
  grandTransmuterGolem: {
    effects: [{kind: "summon", companyType: "construct", strength: 60, quality: 3, duration: "battle"}],
    coverage: ["Construct company Strength 60 Quality 3"]
  },
  grandTransmuterStoneskin: {
    coverage: ["Move 3"]
  },
  grandTransmuterFortressDoctrine: {
    command: {
      target: "companiesInRadius",
      effects: [{kind: "applyStatus", statusId: "ordered", target: "companies", turns: "thisPhase", modifiers: [{key: "terrainHeal.fort", op: "set", value: 20}]}]
    },
    coverage: ["companies in radius inside Forts heal 20 percent"]
  },
  grandTransmuterWorldMason: {
    effects: [{kind: "flag", key: "freeTransmuteTerrainPerRound", value: 1, target: "self"}],
    coverage: ["Transmute Terrain is a free action once per round"]
  }
};
