export default {
  admiralFleetCommand: {
    modifiers: [{key: "commandRadius", op: "set", value: 99, when: {mode: "naval"}}],
    coverage: ["command radius covers all ships"]
  },
  admiralFullBroadside: {
    command: {
      target: "companiesInRadius", companyTypes: ["ship"],
      effects: [{kind: "applyStatus", statusId: "ordered", target: "companies", turns: "thisPhase", modifiers: [{key: "strikes", value: 1}]}]
    }
  },
  admiralBlockade: {
    effects: [{kind: "nationTrack", track: "navy", delta: 1, once: true}],
    coverage: ["Navy track \\+1 at campaign start"]
  },
  admiralWeatherEye: {
    reaction: {trigger: "enemyMoved", window: {tiles: 3, row: "any"}, when: {targetType: "ship"}},
    effects: [{kind: "counter"}],
    coverage: ["enemy ship moves within 3"]
  },
  admiralSeaKing: {
    effects: [{kind: "aura", radius: 99, target: "companiesInRadius", modifiers: [{key: "quality", value: 2}], when: {mode: "naval"}}],
    coverage: ["ships you command Quality \\+2"]
  }
};
