export default {
  originOmen: {
    effects: [
      {kind: "reveal", what: "nextEnemyAction", target: "self"},
      {kind: "flag", key: "cannotBeAmbushed", value: true, target: "self"}
    ],
    usage: {limit: 1, per: "encounter"},
    coverage: ["learn the next enemy action", "Prevents the party being ambushed"]
  },
  originSpellthief: {
    reaction: {trigger: "enemyCast", window: {tiles: 3, row: "any"}, roll: {d100Under: "20 + 3 * skl - 2 * casterMag"}},
    effects: [{kind: "cancel", what: "triggeringAction"}, {kind: "pool", key: "stolen", delta: "+ability", target: "self"}],
    coverage: ["2 slots", "3 at level 15", "Release with the caster's Might and your SKL"]
  }
};
