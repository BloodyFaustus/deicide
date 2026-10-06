export const namedItems = [
  {
    id: "kalistosHand",
    name: "Kalisto's Hand",
    slot: "weapon",
    base: {line: "gauntlet", tier: "royal"},
    stats: {alchemyBonus: 14, matter: 6, acc: 25},
    modifiers: [
      {key: "matter.max", value: 6},
      {key: "harvest.yield", op: "max", value: 4},
      {key: "soulPrice", value: -2}
    ],
    drawback: {text: "Divine Attention +1 while equipped.", flags: {divineAttentionEquipped: 1}, refund: "divineAttentionEquipped"},
    pp: 42,
    hook: "Kalisto's tomb, month 5.",
    text: "Royal Gauntlet. Alchemy +14 total, Matter +6, Harvest 4, Soul Prices minus 2."
  },
  {
    id: "redBlade",
    name: "Red Blade",
    slot: "weapon",
    base: {line: "sword", tier: "royal"},
    stats: {might: 18, acc: 25, crit: 15, weight: 4, range: [1, 1]},
    modifiers: [],
    special: "Each hit on a Homunculus or mana beast yields 1 Saturation (mana hero) or 1 Matter (alchemist).",
    drawback: {text: "1 Mark on first equip (mana hero) or Divine Attention +1 (Mercer).", flags: {markOnFirstEquip: 1, divineAttentionOnEquip: 1}, refund: "markOnFirstEquip"},
    pp: 40,
    hook: "Homunculus harvest.",
    text: "Royal Sword, Might +2."
  },
  {
    id: "spellthiefsNeedle",
    name: "Spellthief's Needle",
    slot: "weapon",
    base: {line: "dagger", tier: "royal"},
    stats: {might: 14, acc: 30, crit: 25, weight: 2, range: [1, 1]},
    modifiers: [{key: "stolen.slots", value: 1}, {key: "stolen.might", value: 4}],
    drawback: {text: "2 Burn per release.", flags: {burnPerRelease: 2}, refund: "burnPerUse2"},
    pp: 38,
    hook: "Rista's lineage.",
    text: "Royal Dagger. Stolen slots +1. Stolen spells keep the caster's Might +4."
  },
  {
    id: "stormfang",
    name: "Stormfang",
    slot: "weapon",
    base: {line: "lance", tier: "royal"},
    stats: {might: 18, acc: 20, crit: 10, weight: 6, range: [1, 2], element: "lightning"},
    modifiers: [{key: "static.max", op: "max", value: 7}],
    drawback: {text: "Crown Standing minus 20 while equipped.", flags: {standingEquipped: {crown: -20}}, refund: "standingMinus20"},
    pp: 39,
    hook: "XidraThira's tribe.",
    text: "Royal Lance with the lightning tag, Reach, and a Static cap of 7."
  },
  {
    id: "ashenCirclet",
    name: "Ashen Circlet",
    slot: "accessory",
    base: null,
    stats: {},
    modifiers: [
      {key: "channel.max", value: 12},
      {key: "overcast.burnPerPoint", value: -1},
      {key: "attributes.mag", value: 2, accessory: true}
    ],
    drawback: {text: "Divine Attention +1 while equipped.", flags: {divineAttentionEquipped: 1}, refund: "divineAttentionEquipped"},
    pp: 33,
    hook: "Hyacinth's island ruins.",
    text: "Channel +12. Overcast Burn minus 1 per point (floor 1). MAG +2."
  },
  {
    id: "lathandersCrownSeal",
    name: "Lathander's Crown Seal",
    slot: "accessory",
    base: null,
    stats: {},
    modifiers: [{key: "commandRadius", value: 3}, {key: "company.quality", value: 1}],
    drawback: {text: "Legitimacy minus 1 if lost or the wearer defects.", flags: {}, refund: null},
    pp: 36,
    hook: "King Edric.",
    text: "Command radius +3. Companies in radius Quality +1."
  },
  {
    id: "breakwaterAegis",
    name: "Breakwater Aegis",
    slot: "offhand",
    base: {line: "towerShield", tier: "iron"},
    stats: {def: 8, avoid: -10, negateHitPerRound: 1},
    modifiers: [
      {key: "defense.def", value: 8}, {key: "avoid", value: -10}, {key: "move", value: -1},
      {key: "delay", value: 8, when: {engine: "dungeon"}}, {key: "avoid", value: -10, when: {engine: "war"}}
    ],
    drawback: {text: "Move minus 1. Burden 2.", flags: {burden: 2}, refund: "burden2"},
    pp: 32,
    hook: "Ilwen Ashcroft, the engineer restoring the Breakwater Forts. Selwyn Marr is an archivist, not a shield bearer.",
    text: "DEF +8. Negate one hit per round. Avoid minus 10."
  },
  {
    id: "harborChain",
    name: "Harbor Chain",
    slot: "weapon",
    base: {line: "axe", tier: "royal"},
    stats: {might: 20, acc: 15, crit: 10, weight: 8, range: [1, 1], effectiveVs: "mounted"},
    modifiers: [{key: "might", value: 4, when: {targetClassType: "naval"}}],
    drawback: {text: "1 Dust per battle.", flags: {dustPerBattle: 1}, refund: "dustPerUse"},
    pp: 38,
    hook: "Admiral Soren Kade.",
    text: "Royal Axe, Horseslayer, Might +4 vs Naval."
  },
  {
    id: "dustLedger",
    name: "Dust Ledger",
    slot: "accessory",
    base: null,
    stats: {},
    modifiers: [{key: "income.multiplier", op: "mul", value: 1.5}],
    special: "Brasswater Standing +20 while equipped.",
    drawback: {text: "Crown Standing minus 20 while equipped.", flags: {standingEquipped: {brasswater: 20, crown: -20}}, refund: "standingMinus20"},
    pp: 30,
    hook: "Mirella Dant.",
    text: "Personal Dust income +50 percent. Brasswater Standing +20."
  },
  {
    id: "theQuietPistol",
    name: "The Quiet Pistol",
    slot: "offhand",
    base: {line: "gun", tier: "royal"},
    stats: {might: 19, acc: 30, crit: 40, weight: 8, range: [2, 2], mightVsWarded: 6},
    modifiers: [],
    drawback: {text: "1 Dust per shot.", flags: {dustPerUse: 1}, refund: "dustPerUse"},
    pp: 40,
    hook: "Rook Maren.",
    text: "Royal Gun as a sidearm. Might 6 vs Warded. Crit +20."
  }
];
