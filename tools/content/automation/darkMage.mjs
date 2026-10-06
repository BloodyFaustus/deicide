export default {
  darkMageSiphon: {
    effects: [{kind: "heal", amount: "floor(damage / 2)", target: "self", chance: "onHit"}],
    coverage: ["heals you half damage"]
  },
  darkMageShadeStep: {
    modifiers: [
      {key: "avoid", value: 10, when: {terrain: "forest"}},
      {key: "avoid", value: 10, when: {night: true}}
    ],
    coverage: ["Avoid \\+10 in Forest and at night"]
  },
  darkMageHollow: {
    reaction: {trigger: "hitByDivine", window: {self: true}},
    modifiers: [{key: "defense.res", value: 8}]
  },
  darkMageNightVessel: {
    coverage: ["Void spells cost 1 less Channel"]
  }
};
