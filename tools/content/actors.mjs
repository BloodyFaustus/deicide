const move = (name, might, area = "single", extra = {}) => ({name, might, area, ...extra});

export const monsters = [
  {
    id: "manaHound", name: "Mana Hound", level: 2, tags: ["beast"], hp: 24, def: 8, res: 6, spd: 10,
    weakness: "frost", resistance: "lightning", yield: {saturation: 1},
    moves: [move("Bite", 12), move("Howl", null, "self", {note: "The pack gains Hit +10 this fight."})]
  },
  {
    id: "plagueRatSwarm", name: "Plague Rat Swarm", level: 3, tags: ["swarm"], hp: 30, def: 5, res: 5, spd: 12,
    weakness: "fire", resistance: "stone", immunities: ["crit"], yield: {saturation: 0},
    moves: [move("Gnaw", 10, "row")],
    description: "Dies to any blast. Immune to single target Crit."
  },
  {
    id: "crystalStalker", name: "Crystal Stalker", level: 5, tags: ["beast"], hp: 36, def: 11, res: 9, spd: 14,
    weakness: "stone", resistance: "frost", yield: {saturation: 2},
    moves: [move("Shard Spit", 16, "single", {range: [2, 3]}), move("Refract", null, "self", {note: "Reason damage against it is halved."})]
  },
  {
    id: "burntWraith", name: "Burnt Wraith", level: 7, tags: ["undead"], classTypes: ["caster"], hp: 40, def: 6, res: 16, spd: 10, mag: 12,
    weakness: "divine", resistance: "fire", immunities: ["poison"], yield: {saturation: 2}, statuses: ["warded"],
    moves: [move("Manaburn Touch", 14, "single", {defense: "res", note: "The target gains 3 Manaburn."})],
    description: "Arrives Warded."
  },
  {
    id: "ironbackBoar", name: "Ironback Boar", level: 8, tags: ["beast"], classTypes: ["armored"], hp: 60, def: 18, res: 8, spd: 8,
    weakness: "lightning", resistance: "stone", yield: {saturation: 2},
    moves: [move("Gore", 22, "single", {perTile: {might: 4, per: 1}})]
  },
  {
    id: "mireDrake", name: "Mire Drake", level: 10, tags: ["boss", "beast"], boss: true, hp: 320, def: 15, res: 13, spd: 12,
    delay: {mode: "fixed", value: 30}, weakness: "lightning", resistance: "water", yield: {saturation: 5, drops: ["silverWeapon"]},
    phaseBreaks: [{percent: 50, note: "Bog Breath hits all enemies."}],
    moves: [
      move("Bog Breath", 26, "row", {statuses: [{id: "pinned", turns: 1}]}),
      move("Tail", 34),
      move("Submerge", null, "self", {note: "Untargetable until its next action, then Ambush: the next move auto hits."})
    ]
  },
  {
    id: "hollowKnight", name: "Hollow Knight", level: 12, tags: ["undead"], classTypes: ["armored"], hp: 70, def: 20, res: 10, spd: 9,
    weakness: "divine", resistance: "void", yield: {saturation: 3},
    moves: [move("Corrupted Cleave", 28, "row")],
    description: "Reforms once at 25 percent HP."
  },
  {
    id: "thornboundRevenant", name: "Thornbound Revenant", level: 14, tags: ["plant"], hp: 80, def: 14, res: 20, spd: 11,
    weakness: "fire", resistance: "water", yield: {saturation: 3},
    moves: [move("Lash", 30, "single", {statuses: [{id: "pinned", turns: 1}]}), move("Root", null, "self", {note: "Heals 10 per turn while in a plague zone."})]
  },
  {
    id: "dustGolem", name: "Dust Golem", level: 16, tags: ["construct"], hp: 110, def: 24, res: 18, spd: 6,
    weakness: "truth", resistance: "stone", immunities: ["poison", "burn"], yield: {saturation: 0, dust: 10},
    moves: [move("Slam", 34, "row", {statuses: [{id: "stagger", turns: 1}]})]
  },
  {
    id: "saturationBeast", name: "Saturation Beast", level: 18, tags: ["boss", "beast"], boss: true, hp: 500, def: 22, res: 20, spd: 15,
    delay: {mode: "fixed", value: 30}, weakness: "void", resistance: "lightning", yield: {saturation: 10, drops: ["redWater"]},
    phaseBreaks: [{percent: 50, note: "Delay 25. Gains Mana Drinker: each hit it takes from a Reason spell gives it 1 Saturation."}],
    moves: [move("Rend", 46), move("Pulse", 38, "all", {defense: "res"}), move("Drink", null, "all", {note: "Steals 2 Channel from each PC."})]
  },
  {
    id: "wyrmSpawn", name: "Wyrm Spawn", level: 22, tags: ["beast"], classTypes: ["flying"], hp: 120, def: 20, res: 22, spd: 18,
    weakness: "frost", resistance: "fire", yield: {saturation: 4},
    moves: [move("Dive", 40, "single", {ignoreAvoid: true}), move("Breath", 34, "line 3", {defense: "res", element: "fire"})]
  },
  {
    id: "corruptedWyrm", name: "Corrupted Wyrm", level: 26, tags: ["boss", "beast"], classTypes: ["flying"], boss: true, hp: 620, def: 26, res: 26, spd: 16,
    delay: {mode: "fixed", value: 28}, weakness: "void", resistance: "fire", yield: {saturation: 15, drops: ["redWater", "redWater", "actIINamed"]},
    phaseBreaks: [
      {percent: 50, note: "Lands. Loses Flying. DEF +6."},
      {percent: 25, note: "Inferno twice per action."}
    ],
    moves: [
      move("Inferno", 44, "all", {defense: "res", element: "fire"}),
      move("Crush", 52, "single", {statuses: [{id: "stagger", turns: 1}]}),
      move("Wingbeat", null, "row", {note: "Pushes the front row: forced row swap."})
    ]
  },

  {
    id: "lust", name: "Lust", level: 12, tags: ["homunculus", "boss"], boss: true, hp: 300, def: 12, res: 20, spd: 14, mag: 20,
    delay: {mode: "fixed", value: 30}, yield: {drops: ["redWater", "stoneFragment"]},
    phaseBreaks: [{percent: 50, note: "Thrall: a Downed PC fights for Lust until healed."}],
    moves: [
      move("Allure", null, "single", {note: "One PC attacks an ally on its next turn."}),
      move("Drain", 18, "single", {defense: "res", note: "Heals Lust for the damage dealt."}),
      move("Veil", null, "self", {note: "Avoid +20 until hit."}),
      move("Caress", 12, "single", {direct: true, statuses: [{id: "thrall", turns: null, onCrit: true}]})
    ]
  },
  {
    id: "greed", name: "Greed", level: 16, tags: ["homunculus", "boss"], boss: true, hp: 400, def: 18, res: 14, spd: 10, mag: 18,
    delay: {mode: "fixed", value: 30}, yield: {drops: ["redWater", "redWater", "stoneFragment"], dust: 50},
    phaseBreaks: [{percent: 50, note: "Avarice: steals a Stolen slot or 5 Matter per turn."}],
    moves: [
      move("Hoard", null, "single", {note: "Steals 10 Dust. DEF +2 per theft."}),
      move("Crush", 26, "row"),
      move("Collapse", 20, "all"),
      move("Devalue", 16, "single", {direct: true, note: "Destroys one equipped non Named item."})
    ]
  },
  {
    id: "envy", name: "Envy", level: 18, tags: ["homunculus", "boss"], boss: true, hp: 350, def: 14, res: 16, spd: 16, mag: 20,
    delay: {mode: "fixed", value: 30}, yield: {drops: ["redWater", "stoneFragment"]},
    phaseBreaks: [{percent: 50, note: "Usurp: copies a PC's Mastery."}],
    moves: [
      move("Mimic", null, "single", {note: "Copies the last PC action."}),
      move("Rend", 24),
      move("Spite", null, "single", {note: "6 Burn to the PC with the highest MAG."}),
      move("Erase", 14, "single", {direct: true, note: "The target loses one Support until a long rest."})
    ]
  },
  {
    id: "wrath", name: "Wrath", level: 20, tags: ["homunculus", "boss"], boss: true, hp: 450, def: 14, res: 12, spd: 15, mag: 16,
    delay: {mode: "fixed", value: 30}, yield: {drops: ["redWater", "redWater", "stoneFragment"]},
    phaseBreaks: [{percent: 50, note: "Frenzy: Delay 20. Cleave hits all enemies."}],
    moves: [
      move("Cleave", 26, "row"),
      move("Rend", 34),
      move("Howl", null, "all", {note: "Party Delay +15."}),
      move("Sunder Flesh", 20, "single", {direct: true})
    ]
  },
  {
    id: "pride", name: "Pride", level: 26, tags: ["homunculus", "boss"], boss: true, hp: 600, def: 20, res: 20, spd: 18, mag: 26,
    delay: {mode: "fixed", value: 30}, yield: {drops: ["redWater", "redWater", "redWater", "philosophersStone"]},
    phaseBreaks: [{percent: 50, note: "Ascension: SS stats, Delay 25, Decree twice per action."}],
    moves: [
      move("Decree", null, "single", {note: "Cancels one PC action."}),
      move("Smite", 30),
      move("Mantle", null, "self", {note: "Warded. Absorbs 60."}),
      move("Decree of Truth", 24, "row", {direct: true, note: "Cancels every Barrier touched."})
    ]
  },

  {
    id: "caldusRime", name: "Caldus Rime, Divine Agent", level: 30, tags: ["divine", "boss"], classTypes: ["officer", "caster"],
    boss: true, divineBeing: true,
    hp: 900, def: 30, res: 42, skl: 30, spd: 24, mag: 34, delay: {mode: "fixed", value: 25},
    weakness: "void", yield: {drops: ["caldussMantle"], divineAttention: 2},
    phaseBreaks: [
      {percent: 50, note: "Every company on any War map in the same session routs (narrative flag). Judgement twice per turn."},
      {percent: 25, note: "Delay 20. Erasure hits a row."}
    ],
    moves: [
      move("Judgement", 20, "all", {defense: "res", element: "divine"}),
      move("Erasure", null, "single", {note: "Against a mana hero: Saturation minus 10. Against Mercer: 20 Burn and Divine Attention +1. Against anyone else: Channel set to 0."}),
      move("Decree of Silence", null, "row", {statuses: [{id: "silenced", turns: 2}], note: "One row, Silenced 2 turns."}),
      move("Unmaking", null, "self", {note: "Reaction: direct alchemy targeting him fails on d100 over 50. The alchemist still pays the Soul Price."})
    ],
    description: "Divine Agent. Weakness Void (x1.5). Truth deals full damage. Every other tag x0.5 (divine being). Drops Caldus's Mantle (Named, Act III) and Divine Attention +2 for the party as a whole. Never fought in War Mode."
  }
];

export const companies = [
  ...["infantry", "pike", "archer", "cavalry", "battlemage", "siege", "legionary", "shade", "animal", "construct"].map(type => ({
    id: `${type}Company`, name: `${type.charAt(0).toUpperCase()}${type.slice(1)} Company`, type,
    quality: type === "legionary" ? 5 : 1, strength: 100
  })),
  {id: "sloop", name: "Sloop", type: "ship", shipClass: "sloop", quality: 1, strength: 100},
  {id: "frigate", name: "Frigate", type: "ship", shipClass: "frigate", quality: 2, strength: 100},
  {id: "shipOfTheLine", name: "Ship of the Line", type: "ship", shipClass: "shipOfTheLine", quality: 3, strength: 100}
];

export const scenarios = [
  {
    id: "fordAtAshfordMill",
    name: "Ford at Ashford Mill",
    kind: "war",
    warMonth: 3,
    difficulty: "standard",
    card: {
      map: {size: [24, 20], grid: "square", terrainRegions: ["river with a ford and a bridge", "Hill on the Lathander side"], fog: false},
      flags: {naval: false, arena: false},
      victory: {type: "survive", rounds: 10, note: "Hold the ford and the bridge for 10 rounds."},
      defeat: "Meridian saboteurs reach the mill. Dust track minus 1.",
      deployment: {sheets: "N", swornSlots: "officers + 2", companySlots: "2 x soldiers"},
      enemy: {
        officers: [{classLine: ["cadet", "captain"], level: 6, profile: "standard"}],
        companies: [
          {type: "infantry", quality: 2, strength: 100, doctrine: "advance", count: 5},
          {type: "archer", quality: 2, strength: 100, doctrine: "volley", count: 2}
        ],
        reinforcements: [{round: 4, edge: "east", companies: [{type: "cavalry", quality: 3, strength: 100, doctrine: "advance"}]}]
      },
      intelligence: []
    },
    payout: {tracks: {fortifications: 1, soldiers: 1}, drops: [], dust: 0},
    text: "<p>Month 3. A 24 by 20 map with a river crossed by a ford and a bridge, and a Hill on the Lathander side. Hold the ford and the bridge for 10 rounds.</p><p>Enemy: a level 6 Captain, 5 infantry companies at Quality 2 on Advance, 2 archer companies at Quality 2 on Volley, and 1 cavalry company at Quality 3 arriving on round 4 from the east edge.</p><p>Payout: Fortifications +1, Soldiers +1. Defeat: Meridian saboteurs reach the mill, Dust minus 1.</p>"
  },
  {
    id: "theDrownedFoundry",
    name: "The Drowned Foundry",
    kind: "dungeon",
    warMonth: 5,
    difficulty: "standard",
    card: {
      region: "Saltmarch wetlands",
      floors: [
        {rooms: ["entry hall", "flooded gallery", "overseer's office"], shortRest: true, matterSurfaces: "stone"},
        {rooms: ["forge floor", "locked vault", "plague corridor"], shortRest: false, matterSurfaces: "metal"},
        {rooms: ["drowned arena"], shortRest: false, matterSurfaces: "stone"}
      ],
      encounters: [
        {room: "entry hall", enemies: ["manaHound", "manaHound", "manaHound"], surprise: "none", arena: false, difficulty: "standard"},
        {room: "flooded gallery", enemies: ["manaHound", "manaHound", "manaHound"], surprise: "none", arena: false, difficulty: "standard"},
        {room: "overseer's office", enemies: ["crystalStalker"], surprise: "party", arena: false, difficulty: "standard"},
        {room: "forge floor", enemies: ["burntWraith", "burntWraith"], surprise: "none", arena: false, difficulty: "standard"}
      ],
      boss: {id: "mireDrake", room: "drowned arena", phaseBreaks: [50]},
      hazards: {plagueZones: [{room: "plague corridor", rounds: 4}], manaburnExposure: true, traps: []},
      vault: {room: "locked vault", loot: ["steelGauntlet"]},
      deployment: {sheets: "N", swornSlots: 2}
    },
    payout: {tracks: {weapons: 2, magical: 1}, drops: ["redWater"], dust: 60},
    text: "<p>Month 5. Floor 1 (stone): two Mana Hound packs of 3, one Crystal Stalker, a short rest. Floor 2 (metal): a Burnt Wraith pair (Warded), a locked vault with a Steel Gauntlet, a plague corridor of 4 rounds. Floor 3 (stone): the Mire Drake in an Arena.</p><p>Payout: Weapons +2, Magical +1, 1 Red Water, 60 Dust.</p>"
  }
];
