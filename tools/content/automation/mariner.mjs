export default {
  marinerSeaLegs: {
    effects: [{kind: "flag", key: "seaLegs", value: true, target: "self"}],
    coverage: ["no penalty on decks or wet terrain"]
  },
  marinerRigging: {
    modifiers: [
      {key: "move", value: 1, when: {mode: "naval"}},
      {key: "terrainCost.wall", op: "set", value: 2}
    ],
    coverage: ["climb walls at cost 2"]
  },
  marinerGrapple: {
    effects: [{kind: "move", mode: "pull", tiles: 1, target: "target", chance: "onHit"}],
    attack: {basis: "str", source: "weapon", defense: "def", might: 0, element: null},
    coverage: ["pull 1 tile or force row swap"]
  },
  marinerBraceDeck: {
    reaction: {trigger: "targetedByAttack", window: {self: true}, when: {actionArea: "blast"}},
    modifiers: [{key: "damageTaken", op: "mul", value: 0.5}]
  },
  marinerOldSalt: {
    modifiers: [{key: "shipQuality", value: 1}],
    coverage: ["ships you crew Quality \\+1"]
  }
};
