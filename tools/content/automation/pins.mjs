export default {
  pinVantage: {
    reaction: {trigger: "targetedByAttack", window: {self: true}, when: {hpAtOrBelow: 0.5}},
    effects: [{kind: "strikeFirst"}],
    coverage: ["When attacked at or below half HP"]
  },
  pinWrath: {
    coverage: ["At or below half HP", "crit \\+30"]
  },
  pinGaleforce: {
    effects: [{kind: "refundAction", condition: "onKillCharacter|onRoutCompany", usesPerRound: 1}],
    coverage: ["Killing a character or routing a company refunds your Action"]
  },
  pinDrain: {
    effects: [{kind: "heal", amount: "floor(damage / 2)", target: "self", chance: "onHit", trigger: "ownAttack", when: {actionTag: "reason"}}],
    coverage: ["Reason spells heal you for half the damage dealt"]
  },
  pinBerserk: {
    stance: {
      modifiers: [
        {key: "attributes.str", value: 6}, {key: "might", value: 4}, {key: "delay", value: -10},
        {key: "damageTaken", op: "mul", value: 1.25}
      ],
      effects: [{kind: "flag", key: "cannotGuard", value: true, target: "self"}]
    },
    coverage: ["take \\+25 percent damage"]
  },
  pinDualWield: {
    effects: [{kind: "extraStrike", source: "sidearm", might: -3, trigger: "ownAttack", when: {actionSource: "weapon"}}],
    coverage: ["Sidearm attacks with every weapon attack at Might minus 3"]
  },
  pinDoublecast: {
    effects: [{kind: "flag", key: "doublecast", value: true, target: "self"}],
    weight: 12,
    coverage: ["cast two spells as one Action at full cost", "Weight 12"]
  },
  pinCounter: {
    reaction: {trigger: "hitByAttack", window: {self: true}, when: {attackerRange: {max: 1}}},
    effects: [{kind: "counter", might: -2}],
    coverage: ["attack back at Might minus 2"]
  },
  pinLancet: {
    effects: [{kind: "pool", key: "channel", delta: "floor(damage / 4)", target: "self", chance: "onHit"}],
    coverage: ["Weapon hit restores Channel equal to damage/4"]
  },
  pinMiracle: {
    reaction: {trigger: "lethalHit", window: {self: true}},
    effects: [{kind: "survive", hp: 1, target: "self"}],
    coverage: ["survive a lethal hit at 1 HP"]
  }
};
