const arenaOnly = note => ({dungeon: {requiresArena: true, note}});
const notInDungeon = note => ({dungeon: {available: false, note}});

export const classOverrides = {

  soldier: {kit: {weapon: "ironSword", offhand: "ironBuckler", armor: "ironMedium"}},
  scout: {kit: {weapon: "ironBow", offhand: "ironQuiver", armor: "ironLight"}},
  adept: {kit: {weapon: "ironTome", offhand: "ironFocus", armor: "ironLight"}},
  rogue: {kit: {weapon: "ironDagger", offhand: "ironBuckler", armor: "ironLight"}},
  cadet: {kit: {weapon: "ironLance", offhand: "ironBanner", armor: "ironMedium"}},
  acolyte: {kit: {weapon: "ironRelic", offhand: "ironFocus", armor: "ironLight"}},
  mariner: {kit: {weapon: "ironAxe", offhand: "ironBuckler", armor: "ironLight"}},
  rider: {kit: {weapon: "ironLance", offhand: "ironBuckler", armor: "ironMedium"}},
  alchemist: {
    kit: {weapon: "ironGauntlet", offhand: "ironSatchel", armor: "ironMedium"},
    storyGate: "alchemistCertification"
  },

  spellsword: {
    prerequisites: {any: [
      {all: [{prof: "sword", grade: "C"}, {prof: "reason", grade: "D"}]},
      {all: [{prof: "reason", grade: "C"}, {prof: "sword", grade: "D"}]}
    ]}
  },
  deadeye: {
    prerequisites: {any: [
      {all: [{prof: "bow", grade: "B"}, {prof: "gun", grade: "C"}]},
      {all: [{prof: "gun", grade: "B"}, {prof: "bow", grade: "C"}]}
    ]}
  },
  elementalist: {choices: ["weapon"]},
  captain: {choices: ["weapon"]},
  warlord: {choices: ["weapon"]},
  godslayer: {choices: ["weapon"]},

  hero: {
    layered: true, grantsCap: "SS", storyGate: "",
    prerequisites: {all: [{saturation: 50}]},
    growth: {}, hp: 0
  },
  diabolist: {
    storyGate: "diabolistRitual",
    prerequisites: {all: [{prof: "void", grade: "B"}, {marks: 3}, {story: "redWater"}]}
  },
  saint: {storyGate: "godSponsorship", prerequisites: null},
  godslayer: {
    storyGate: "divineRelic",
    prerequisites: {any: [{prof: "alchemy", grade: "B"}, {classRank: {id: "spellbreaker", rank: 7}}]}
  },
  philosopher: {
    storyGate: "bondedPhilosophersStone",
    prerequisites: {all: [{prof: "alchemy", grade: "A"}]}
  },

  stateAlchemist: {grantsFullTruth: true},

  greatKnight: {move: 5}
};

export const abilityOverrides = {

  alchemistTransmuteStrike: {
    attack: {basis: "hybrid", source: "alchemy", defense: "def", might: 0, element: null},
    war: {range: [1, 1], area: {shape: "single", size: 1}, target: "enemy"}
  },
  alchemistWall: {war: {terrain: true, target: "tile"}, tags: ["alchemy", "terrain"]},
  alchemistDeconstruct: {trigger: "Targeted by a physical attack."},

  saboteurIncendiary: {attack: {basis: "skl", source: "none", defense: "res", might: 8, element: "fire"}},
  dustwrightPowderCharge: {attack: {basis: "mag", source: "alchemy", defense: "def", might: 10, element: "fire"}},
  dustwrightRefine: {dungeon: {available: false, note: "Between sessions only."}},

  transmuterTransmuteTerrain: {war: {terrain: true, target: "tile"}, tags: ["alchemy", "terrain"]},
  transmuterBridge: {...notInDungeon("No rivers in Dungeon Mode."), war: {terrain: true, target: "tile"}},
  grandTransmuterCitadel: {
    war: {terrain: true, target: "tile", area: {shape: "blast", size: 1}},
    dungeon: {target: "row", side: "ally", note: "A Barrier of 4 x MAG on each of your rows, once per battle."}
  },
  transmuterCollapse: {
    attack: {basis: "mag", source: "alchemy", defense: "def", might: 14},
    dungeon: {target: "row", note: "Needs a stone or metal surface. M14 physical to one enemy row."}
  },
  grandTransmuterQuake: {attack: {basis: "mag", source: "alchemy", defense: "def", might: 16}},
  grandTransmuterWorldMason: notInDungeon("Transmute Terrain has no free action in Dungeon Mode."),
  knightFortress: notInDungeon("No forts in Dungeon Mode."),

  riderTrample: notInDungeon("Companies do not appear in Dungeon Mode."),
  greatKnightTrampleLine: notInDungeon("Companies do not appear in Dungeon Mode."),
  assassinShadowstep: {
    war: {range: [0, 3], area: {shape: "self", size: 0}, target: "self", movement: "self"},
    dungeon: {reach: "self", target: "self", rowSwap: true, weight: 4, note: "Free row swap."}
  },
  wyvernRiderTalonGrip: arenaOnly("A flight skill. Carry one ally to the other row in an Arena."),
  chevalierDoubleCanto: arenaOnly("No Canto in Dungeon Mode unless the scene is an Arena."),
  outriderHarass: {dungeon: {note: "The attack only. No Canto outside an Arena."}},
  riderCharge: {attack: {perTile: {might: 2, per: 2}}, dungeon: {note: "No tiles to move. Charge Might is +0 outside an Arena."}},
  lancerLanceCharge: {attack: {perTile: {might: 1, per: 1, max: 6}}, dungeon: {note: "No tiles to move. +0 outside an Arena."}},
  greatKnightJuggernaut: {attack: {perTile: {might: 2, per: 1, max: 8}}, dungeon: {note: "No tiles to move. +0 outside an Arena."}},
  shadowOffMap: notInDungeon("No map edges in Dungeon Mode."),

  artilleristCannon: arenaOnly("A siege weapon. Arena only. One enemy row."),
  siegeAlchemistShell: arenaOnly("A siege transmutation. Arena only. One enemy row."),
  siegeAlchemistBreach: {dungeon: {reach: "any", target: "row", note: "Destroys one Barrier. M10 to the row it covered."}},
  artilleristBreachShot: {dungeon: {reach: "any", target: "row", note: "Destroys one Barrier. M10 to the row it covered."}},
  artilleristBombard: notInDungeon("Cannon range is a War Mode number."),
  siegeAlchemistSiegemaster: notInDungeon("Ranges are War Mode numbers."),

  rangerBeastCall: {dungeon: {target: "self", summon: true, note: "The company enters as one combatant: HP equal to Strength, DEF and RES from Quality, attacks as a company against characters. It takes a front row slot."}},
  grandTransmuterGolem: {dungeon: {target: "self", summon: true, note: "The Construct enters as one combatant: HP 60, DEF 10, RES 8, attacks as a company against characters. It takes a front row slot."}},
  diabolistSummonShade: {dungeon: {target: "self", summon: true, note: "The Shade enters as one combatant: HP 50, DEF 10, RES 8, attacks as a company against characters. It takes a front row slot."}},

  wardenBarrier: {war: {terrain: true, target: "tile"}, dungeon: {barrier: {formula: "3 * mag"}, target: "row", side: "ally"}},
  wardenBarrierEngine: {modifiers: [{key: "barrier.multiplier", op: "set", value: 5}]},
  plagueDoctorCulture: {war: {terrain: true, target: "tile"}, dungeon: {target: "row", barrier: null, note: "One enemy row takes 2 Burn per turn."}},
  rogueSmoke: {war: {area: {shape: "blast", size: 1}, target: "ally"}, dungeon: {target: "row", side: "ally"}},

  magusCounterspell: {roll: {formula: "10 + 3 * skl - 2 * casterMag"}},
  spellbreakerSpellEater: {roll: {formula: "3 * skl"}},
  voidcallerNullWard: {roll: {formula: "3 * skl"}},
  saboteurCutLines: {roll: {formula: "3 * skl"}},
  saboteurMisdirect: {roll: {formula: "3 * skl - 2 * enemyOfficerCmd"}},
  spymasterTurncoat: {roll: {formula: "3 * skl - 2 * enemyOfficerCmd"}},
  spymasterCounterintel: {roll: {formula: "3 * skl"}},
  warlordVeto: {roll: {formula: "3 * cmd"}},
  godslayerAnomaly: {roll: {formula: "3 * skl"}},

  adeptDeepChannel: {modifiers: [{key: "channel.max", value: "floor(mag / 4)"}]},
  magusOverflow: {modifiers: [{key: "channel.max", op: "mul", value: 1.5, stage: "final"}]},
  rogueOpportunist: {modifiers: [{key: "critMultiplier", op: "set", value: 2}]},
  assassinLethality: {modifiers: [{key: "critMultiplier", op: "set", value: 2, when: {targetClassType: "officer"}}]},
  scoutEagleEye: {modifiers: [{key: "range.max", value: 1, when: {actionWeaponLine: ["bow", "gun"]}}]},
  marksmanLongshot: {modifiers: [{key: "range.max", value: 1, when: {actionWeaponLine: "bow"}}]},
  halberdierReach: {modifiers: [{key: "range.max", value: 1, when: {actionWeaponLine: "lance"}}]},
  battlemageSiegeMind: {modifiers: [{key: "range.max", value: 1, when: {actionSource: "spell"}}]},
  deadeyeSnipersNest: {modifiers: [{key: "range.max", value: 2, when: {terrain: ["hill", "fort"]}}]},
  deadeyeTrueShot: {modifiers: [{key: "ignoreTerrainAvoid", value: 1}]},
  gunnerMarksmanship: {modifiers: [{key: "weaponMight.gunVsWarded", op: "set", value: 3}]},
  gunnerPowderBurn: {modifiers: [{key: "crit", value: 10, when: {actionWeaponLine: "gun"}}]},
  marksmanDeadshot: {modifiers: [{key: "crit", value: 15}]},
  rogueFlank: {modifiers: [{key: "might", value: 3, when: {flankOrBackRow: true}}]},
  riderHorseman: {modifiers: [{key: "proficiency.pace.riding", value: 1}]},
  corsairPistolHand: {modifiers: [{key: "proficiency.pace.gun", value: 1}]},
  soldierVeteran: {modifiers: [{key: "hp.perLevel", value: 2}]},
  marineLeatherneck: {modifiers: [{key: "hp.max", value: 15}]},
  cadetPresence: {modifiers: [{key: "commandRadius", value: 1}]},
  captainFieldMarshal: {modifiers: [{key: "commandRadius", value: 2}]},
  warlordGrandCommand: {modifiers: [{key: "commandRadius", value: 2}]},
  riderOutrun: {modifiers: [{key: "move", value: 1}]},
  outriderCourier: {modifiers: [{key: "move", value: 2}]},
  chevalierHorselord: {modifiers: [{key: "move", value: 2}]},
  wyvernRiderUpdraft: {modifiers: [{key: "move", value: 1}]},
  wyvernLordLordOfTheSky: {modifiers: [{key: "move", value: 3}]},
  adeptFocus: {modifiers: [{key: "channel.max", value: 3}]},
  battlemageCommission: {modifiers: [{key: "channel.max", value: 6}]},
  diabolistPact: {modifiers: [{key: "channel.max", value: 10}]},
  wardenBulwarkMind: {modifiers: [{key: "defense.res", value: 3}]},
  knightImmovable: {modifiers: [{key: "immune", value: "rowSwap"}]},
  spellswordTwinDiscipline: {modifiers: [{key: "attackBasis", basis: "twin", value: 0, when: {actionId: "spellswordSpellblade"}}]},
  spellswordSpellblade: {attack: {basis: "hybrid", source: "weapon", defense: "lower", might: 6}},
  spellbreakerSeveringCut: {attack: {basis: "hybrid", source: "weapon", defense: "lower", might: 9}},
  paladinHolyBlade: {attack: {basis: "hybrid", source: "weapon", defense: "lower", might: 10, element: "divine"}},
  godslayerTruthEdge: {attack: {basis: "hybrid", source: "weapon", defense: "lower", might: 14, ignoreDivineResistance: true}},
  paladinSanctity: {modifiers: [{key: "overcast.immune", value: 1}]},
  magusSaturatedVessel: {modifiers: [{key: "overcast.multiplier", op: "set", value: 0.5}]},
  darkMageNightVessel: {modifiers: [{key: "cost.channel", value: -1, when: {actionElement: "void"}}]},
  stateAlchemistEquivalentExchange: {modifiers: [{key: "soulPrice.multiplier", op: "set", value: 0.5}]},
  alchemistCircle: {modifiers: [{key: "matter.max", value: 4}]},
  alchemistHarvestEye: {modifiers: [{key: "harvest.yield", op: "max", value: 3}]},
  philosopherTheStone: {modifiers: [{key: "cost.matter", op: "set", value: 0}, {key: "soulPrice.multiplier", op: "set", value: 0}]},
  heroSaturatedStrike: {attack: {basis: "str", source: "weapon", defense: "def", might: 0}},

  soldierShieldWall: {modifiers: [{key: "defense.def", value: 4}, {key: "immune", value: "rowSwap"}]},
  knightBulwark: {modifiers: [{key: "defense.def", value: 6}, {key: "defense.res", value: 2}, {key: "delay", value: 10}]},
  paladinAegis: {modifiers: [{key: "defense.def", value: 4}, {key: "defense.res", value: 4}, {key: "delay", value: 10}]},
  dreadKnightPall: {modifiers: [{key: "defense.def", value: 6}, {key: "defense.res", value: 4}, {key: "delay", value: 10}]},
  greatKnightIronWall: {modifiers: [{key: "defense.def", value: 8}, {key: "move", op: "set", value: 3}]},
  grandTransmuterStoneskin: {modifiers: [{key: "defense.def", value: 8}, {key: "move", op: "set", value: 3}]},
  marineShieldDeck: {modifiers: [{key: "defense.def", value: 4}, {key: "move", op: "set", value: 0}]},
  marksmanAim: {modifiers: [{key: "hit", value: 15}, {key: "delay", value: 5}]},
  deadeyeDeadCalm: {modifiers: [{key: "hit", value: 20}, {key: "move", op: "set", value: 0}]},
  lancerLancerStance: {modifiers: [{key: "attributes.str", value: 3}, {key: "attributes.spd", value: -2}]},
  corsairSwashbuckle: {modifiers: [{key: "avoid", value: 10}, {key: "defense.def", value: -2}]},
  outriderSkirmish: {modifiers: [{key: "avoid", value: 10, when: {movedAtLeast: 1}}]},
  shadowCloak: {modifiers: [{key: "untargetableAtRange", op: "set", value: 3}]},
  gunnerReload: {modifiers: [{key: "might", value: 4, when: {actionWeaponLine: "gun"}}]},

  pinWrath: {modifiers: [{key: "crit", value: 30, when: {hpAtMost: 0.5}}]},
  pinBerserk: {modifiers: [
    {key: "attributes.str", value: 6}, {key: "might", value: 4}, {key: "delay", value: -10},
    {key: "damageTaken", op: "mul", value: 1.25}, {key: "immune", value: "guard"}
  ]},
  pinDoublecast: {usage: {limit: 1, per: "encounter"}},
  pinCounter: {attack: {basis: "str", source: "weapon", defense: "def", might: -2}},
  pinLancet: {attack: {basis: "str", source: "weapon", defense: "def", might: 0}, weight: 8},
  pinMiracle: {usage: {limit: 1, per: "encounter"}},
  pinGaleforce: {usage: {limit: 1, per: "round"}},
};

export const enemyClasses = [
  {
    id: "imperialLegionary",
    name: "Imperial Legionary",
    tier: 2,
    types: ["armored", "infantry"],
    growth: {str: "A", mag: "F", skl: "B", spd: "D", def: "S", res: "C", cmd: "C"},
    hp: 4,
    trains: {primary: ["lance", "armor"], secondary: ["authority", "sword"]},
    description: "Lance S, DEF S, companies count Quality 5. Growth STR A, MAG F, SKL B, SPD D, DEF S, RES C, CMD C.",
    cells: [
      "Testudo [Stance]: DEF +8",
      "Shield Push [Action]: M8 W8, push 1 tile or force row swap",
      "Cohort [Command]: legionary companies in radius Quality +1",
      "Discipline [Reaction]: morale auto pass for companies in radius"
    ]
  },
  {
    id: "inquisitor",
    name: "Inquisitor",
    tier: 3,
    types: ["infantry", "caster"],
    growth: {str: "B", mag: "B", skl: "A", spd: "C", def: "C", res: "A", cmd: "C"},
    hp: 3,
    trains: {primary: ["sword", "faith"], secondary: ["reason", "void"]},
    description: "Spellbreaker Rank 1 to 6 plus Faith. Hunts Void users first. Growth STR B, MAG B, SKL A, SPD C, DEF C, RES A, CMD C.",
    borrows: [
      {rank: 1, id: "spellbreakerNullEdge"}, {rank: 2, id: "spellbreakerSeveringCut"},
      {rank: 4, id: "spellbreakerSpellEater"}, {rank: 6, id: "spellbreakerSuppression"}
    ],
    cells: [
      "Writ of Silence [Action]: W8, target Silenced 2 turns, 3 Ch",
      "Hunt the Mage [Support]: Might +6 vs Caster"
    ]
  }
];
