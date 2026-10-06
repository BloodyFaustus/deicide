export default {
  chirurgeonFieldDressing: {
    usage: {limit: 1, per: "targetPerEncounter"},
    coverage: ["no Channel", "once per target per encounter"]
  },
  chirurgeonAntidote: {
    effects: [
      {kind: "removeStatus", statusId: "poison", target: "ally"},
      {kind: "removeStatus", statusId: "burning", target: "ally"}
    ],
    war: {target: "ally"},
    coverage: ["remove Poison and Burn ticks"]
  },
  chirurgeonTriage: {
    modifiers: [{key: "healing", op: "mul", value: 1.5, when: {targetHpBelow: 0.3}}],
    coverage: ["heals on allies under 30 percent \\+50 percent"]
  },
  chirurgeonPlagueKit: {
    effects: [{kind: "applyStatus", statusId: "inoculated", target: "ally", turns: 3}],
    war: {target: "ally"},
    coverage: ["ally immune to plague zone 3 rounds"]
  },
  chirurgeonStabilize: {
    reaction: {trigger: "allyDowned", window: {adjacent: true}},
    effects: [{kind: "heal", amount: "skl", target: "ally"}]
  },
  chirurgeonSurgeon: {
    effects: [{kind: "revive", fraction: 0.25, target: "ally"}],
    usage: {limit: 1, per: "dungeon"},
    coverage: ["revive a Downed ally at 25 percent"]
  }
};
