const innate = value => ({key: "channel.max", value, stage: "innate"});

export const peoples = {
  manaborne: {
    name: "Manaborne Human",
    growth: {mag: "D", res: "D", skl: "E", cmd: "E"},
    rider: "None."
  },
  foreignHuman: {
    name: "Foreign Human",
    growth: {skl: "D", spd: "D", str: "E", mag: "E"},
    rider: "None."
  },
  summoned: {
    name: "Summoned",
    growth: {},
    flags: {saturation: true},
    rider: "Hero rules by background. Mana bearing Summoned use Saturation. Mercer does not."
  },
  highElf: {
    name: "High Elf",
    growth: {mag: "D", res: "D", spd: "E", skl: "E"},
    modifiers: [innate(2)],
    rider: "Channel +2."
  },
  commonElf: {
    name: "Common Elf",
    growth: {spd: "D", skl: "D", mag: "E", res: "E"},
    rider: "None."
  },
  halfElf: {
    name: "Half Elf",
    growth: {mag: "D", spd: "D", skl: "E", res: "E"},
    rider: "None."
  },
  dwarf: {
    name: "Dwarf",
    growth: {str: "D", def: "D", skl: "E", res: "E"},
    proficiencies: {armor: "D"},
    rider: "Armor proficiency starts D."
  },
  beastman: {
    name: "Beastman",
    growth: {spd: "D", str: "D", skl: "E", def: "E"},
    subtypes: {
      feline: {name: "Feline", startBonus: {spd: 2}},
      avian: {name: "Avian", growth: {skl: "D", str: "D", spd: "E", def: "E"}, proficiencies: {flying: "D"}}
    },
    rider: "Subtype swaps one D. Avian: Flying starts D, SPD D becomes SKL D. Feline: starting SPD +2."
  },
  vitrean: {
    name: "Vitrean",
    growth: {res: "D", mag: "D", def: "E", skl: "E"},
    modifiers: [innate(4)],
    flags: {crystallineAtBurn: 20},
    rider: "Channel +4. 20 Burn in one encounter causes Crystalline."
  },
  thornbound: {
    name: "Thornbound",
    growth: {def: "D", res: "D", str: "E", mag: "E"},
    flags: {immunities: ["plagueBurn"], manaburnLongRest: 2},
    rider: "Ignores plague zone Burn. Manaburn minus 2 per long rest."
  },
  tidekin: {
    name: "Tidekin",
    growth: {spd: "D", skl: "D", res: "E", cmd: "E"},
    proficiencies: {seamanship: "D"},
    rider: "Seamanship starts D."
  },
  emberkin: {
    name: "Emberkin",
    growth: {mag: "D", str: "D", spd: "E", def: "E"},
    flags: {overcastBurnPerPoint: 1},
    rider: "Overcast Burn 1 per point instead of 2. The floor of 1 still applies."
  },
  stoneblood: {
    name: "Stoneblood",
    growth: {str: "D", def: "D", skl: "E", cmd: "E"},
    classGrowthLocks: {mag: "F"},
    flags: {corruptionResDoubled: true},
    rider: "MAG growth F in every class. RES doubled against corruption effects."
  },
  sableborn: {
    name: "Sableborn",
    growth: {res: "D", skl: "D", spd: "E", mag: "E"},
    flags: {noExposureMarks: true, manaburnLongRest: 2},
    rider: "Cannot gain Marks from exposure. Manaburn minus 2 per long rest."
  },
  forged: {
    name: "Forged",
    growth: {def: "D", str: "D", res: "E", skl: "E"},
    flags: {noChannel: true, noManaburn: true, maintenanceDust: 1, maintenancePenalty: -2},
    rider: "No Channel. No Manaburn. 1 Dust per week maintenance or minus 2 all stats."
  },
  wyrmkin: {
    name: "Wyrmkin",
    growth: {mag: "D", str: "D", res: "E", def: "E"},
    modifiers: [innate(6)],
    proficiencies: {flying: "D"},
    rider: "Channel +6. Flying starts D."
  }
};

export const backgrounds = {
  summonedHero: {
    name: "Summoned Hero",
    points: {mag: 2, cmd: 2},
    flags: {
      noChannel: true, noManaburn: true, noSoul: true, noSaturation: true,
      divineAttentionByActs: true, alchemyLabel: true, gmRun: true, cannotBeSworn: true
    },
    grants: {
      classes: [{id: "alchemist", rank: 10}, {id: "stateAlchemist", rank: 1}],
      activeClass: "stateAlchemist",
      standing: {crown: 50, army: 40, civilians: 30, temple: 20},
      storyGates: ["alchemistCertification"]
    },
    story: true,
    text: "No Channel, no Manaburn, Soul Price in HP, Divine Attention by acts, arrives with Alchemist 10 and State Alchemist 1."
  },
  manaburnSurvivor: {
    name: "Manaburn Survivor",
    points: {mag: 4},
    modifiers: [{key: "channel.max", op: "mul", value: 0.5, stage: "origin"}],
    flags: {manaburnThresholds: false, overcastMight: 1},
    grants: {classes: [{id: "adept", rank: 3}], manaburn: 60},
    story: true,
    text: "Channel halved. Overcast: +1 Might per point as well as 2 Burn. Manaburn starts 60. Adept Rank 3 (military asset)."
  },
  spellthiefBloodline: {
    name: "Spellthief Bloodline",
    points: {skl: 2, spd: 2},
    grants: {classes: [{id: "rogue", rank: 2}], engines: ["originSpellthief"], stolenSlots: true},
    story: true,
    text: "Spellthief reaction, 2 Stolen slots (3 at level 15). Rogue Rank 2."
  },
  duneHunter: {
    name: "Dune Hunter",
    points: {str: 2, spd: 2},
    grants: {
      classes: [{id: "soldier", rank: 2}], abilities: ["originLightningStrike"], engines: ["originOmen"],
      staticCharge: true
    },
    story: true,
    text: "Static (max 5), Omen, Lightning Strike origin Action. Soldier Rank 2."
  },
  failedHero: {
    name: "Failed Hero",
    points: {mag: 2, res: 2},
    modifiers: [innate(4)],
    flags: {saturationRate: 0.5},
    grants: {},
    story: true,
    text: "Saturation at half gain, Channel +4, Hero class at Saturation 50."
  },
  conscript: {
    name: "Conscript",
    points: {def: 2, cmd: 2},
    grants: {classes: [{id: "soldier", rank: 2}]},
    text: "Soldier Rank 2."
  },
  guildThief: {
    name: "Guild Thief",
    points: {skl: 2, spd: 2},
    grants: {classes: [{id: "rogue", rank: 2}]},
    text: "Rogue Rank 2."
  },
  templeWard: {
    name: "Temple Ward",
    points: {res: 2, mag: 2},
    grants: {classes: [{id: "acolyte", rank: 2}]},
    text: "Acolyte Rank 2."
  },
  nobleCadet: {
    name: "Noble Cadet",
    points: {cmd: 2, skl: 2},
    grants: {classes: [{id: "cadet", rank: 2}], standingBonus: {crown: 20}},
    text: "Cadet Rank 2, Crown Standing +20."
  },
  harborHand: {
    name: "Harbor Hand",
    points: {str: 2, spd: 2},
    grants: {classes: [{id: "mariner", rank: 2}]},
    text: "Mariner Rank 2."
  },
  hedgeMage: {
    name: "Hedge Mage",
    points: {mag: 2, res: 2},
    grants: {classes: [{id: "adept", rank: 2}], proficiencies: {void: "E"}, standingBonus: {civilians: -10}},
    text: "Adept Rank 2, Void E, Civilians Standing minus 10."
  }
};

export const talents = {
  prodigy: {
    name: "Prodigy",
    choices: ["stat", "penaltyStat"],
    growth: {chosen: {stat: 3, penaltyStat: -2}},
    caps: {chosen: {stat: 2}},
    text: "That stat growth +0.3 and cap +2. One other stat growth minus 0.2."
  },
  lateBloomer: {
    name: "Late Bloomer",
    growth: {allStats: [{maxLevel: 14, value: -1}, {minLevel: 15, value: 2}]},
    text: "All growth minus 0.1 per stat through level 14, plus 0.2 per stat from 15."
  },
  earlyPeak: {
    name: "Early Peak",
    start: {points: 8, maxPerStat: 4},
    growth: {totalMod: -3},
    text: "Starting attributes +8 (max 4 in one). All growth minus 0.3 total."
  },
  steady: {
    name: "Steady",
    flex: {every: 3},
    text: "+1 flex point every 3 levels."
  },
  savant: {
    name: "Savant",
    choices: ["proficiency"],
    proficiency: {startGrade: "D", steps: 1},
    growth: {totalMod: -2},
    text: "One proficiency starts D and trains one step faster. Growth total minus 0.2."
  },
  hardy: {
    name: "Hardy",
    hpPerLevel: 1,
    caps: {flat: {def: 1, res: 1}},
    growth: {perStat: {str: -1, mag: -1}},
    text: "HP growth +1 per level, DEF and RES cap +1. STR and MAG growth minus 0.1."
  },
  wild: {
    name: "Wild",
    wild: true,
    text: "Growth rolled: each level, each stat, d100 under growth tenths x 10 gives +1. Seven d100 per level on one chat card."
  }
};

export const originAbilities = [
  {
    id: "originLightningStrike",
    cell: "Lightning Strike [Action]: MAG M7 lightning, line 2, 2 Ch",
    source: {kind: "origin", id: "duneHunter"}
  },
  {
    id: "originOmen",
    cell: "Omen [Support]: once per encounter, learn the next enemy action. Prevents the party being ambushed",
    source: {kind: "origin", id: "duneHunter"},
    system: {
      dungeon: {note: "Learn the next enemy action. The party cannot be ambushed."},
      automation: "manual"
    }
  },
  {
    id: "originSpellthief",
    cell: "Spellthief [Reaction]: enemy cast within 3 tiles (War) or any row (Dungeon), d100 under 20 + 3 x SKL minus 2 x caster MAG cancels and stores it. 2 slots, 3 at level 15. Release with the caster's Might and your SKL",
    source: {kind: "origin", id: "spellthiefBloodline"},
    system: {
      roll: {formula: "20 + 3 * skl - 2 * casterMag"},
      dungeon: {reach: "any", note: "Triggers on an enemy cast from any row."},
      automation: "manual"
    }
  }
];
