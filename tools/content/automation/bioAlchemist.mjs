export default {
  bioAlchemistAlchemicalMedicine: {
    war: {range: [1, 2], target: "ally"}
  },
  bioAlchemistMendFlesh: {
    effects: [
      {kind: "removeStatus", statusId: "poison", target: "ally"},
      {kind: "removeStatus", statusId: "crystalline", target: "ally"},
      {kind: "pool", key: "manaburn", delta: -10, target: "ally"}
    ],
    war: {target: "ally"},
    coverage: ["remove Poison", "Crystalline", "or 10 Manaburn"]
  },
  bioAlchemistAnatomist: {
    effects: [{kind: "reveal", what: "hpAndStatuses", target: "target"}]
  },
  bioAlchemistRend: {
    coverage: ["single"]
  },
  bioAlchemistGraft: {
    reaction: {trigger: "allyDowned", window: {adjacent: true}, cost: {matter: 3}},
    effects: [{kind: "heal", amount: "mag", target: "ally"}]
  },
  bioAlchemistPhysician: {
    modifiers: [{key: "heal.rowFull", value: 1, when: {actionId: "bioAlchemistAlchemicalMedicine"}}],
    coverage: ["Alchemical Medicine becomes a row heal at full value"]
  }
};
