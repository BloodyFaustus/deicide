export default {
  spymasterNetwork: {
    effects: [{kind: "nationTrack", track: "intelligence", delta: 1, once: true}],
    coverage: ["Intelligence track \\+1 at campaign start"]
  },
  spymasterReveal: {
    effects: [{kind: "reveal", what: "doctrineAndStrength", target: "target"}],
    war: {range: [1, 99], area: {shape: "single", size: 1}, target: "enemy", movement: null, terrain: false}
  },
  spymasterTurncoat: {
    command: {
      target: "oneEnemyCompany", radius: 99, roll: {d100Under: "3 * skl - 2 * enemyOfficerCmd"}, when: {targetHpBelow: 0.4},
      effects: [{kind: "flag", key: "turncoat", value: true, target: "companies"}]
    },
    coverage: ["one enemy company under Strength 40 joins you"]
  },
  spymasterPlantAgent: {
    effects: [{kind: "flag", key: "preBattle.enemyOfficerHpPercent", value: -20, target: "self"}],
    coverage: ["pre battle", "one enemy officer starts at HP minus 20 percent"]
  },
  spymasterCounterintel: {
    reaction: {trigger: "enemyCommand", window: {tiles: 99, row: "any"}, roll: {d100Under: "3 * skl"}, when: {actionTag: "intel"}},
    effects: [{kind: "cancel", what: "command"}],
    coverage: ["enemy reveals or sabotages"]
  },
  spymasterShadowCabinet: {
    modifiers: [{key: "preBattleSabotage", op: "set", value: 2}],
    coverage: ["two pre battle sabotage effects instead of one"]
  }
};
