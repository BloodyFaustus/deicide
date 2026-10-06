export const company = {
  strength: {min: 0, max: 100},
  quality: {min: 1, max: 5},
  formulas: {
    def: "4 + 2 * quality",
    res: "2 + 2 * quality",
    atkVsCharacter: "4 * quality + floor(strength / 5)",
    atkVsCompany: "3 * quality + floor(strength / 10)",
    hit: "70 + 5 * quality - avoid - 2 * spd",
    morale: "40 + 10 * quality + inRadius * 5"
  },
  moraleBelow: 30,
  veterancy: {
    max: 5,
    promoteAt: 5,
    perBattle: 1,
    perBattleOwnerAdjacent: 2,
    minEndStrength: 50
  },
  upgradeCostPerQuality: 30,
  newCompanyCost: 50
};

export const companyTypes = {
  infantry: {label: "DEICIDE.CompanyType.infantry", move: 4, range: [1, 1]},
  pike: {label: "DEICIDE.CompanyType.pike", move: 4, range: [1, 2], multipliers: [{vs: "cavalry", value: 2}]},
  archer: {label: "DEICIDE.CompanyType.archer", move: 4, range: [2, 3], cannotShootAdjacent: true},
  cavalry: {
    label: "DEICIDE.CompanyType.cavalry", move: 7, range: [1, 1],
    multipliers: [{vs: "archer", value: 2, when: "charge"}, {vs: "battlemage", value: 2, when: "charge"}]
  },
  battlemage: {label: "DEICIDE.CompanyType.battlemage", move: 4, range: [1, 3], volleysAreCasts: true},
  siege: {label: "DEICIDE.CompanyType.siege", move: 2, range: [3, 6], cannotMoveAndFire: true},
  ship: {label: "DEICIDE.CompanyType.ship", move: null, range: null, naval: true},
  legionary: {label: "DEICIDE.CompanyType.legionary", move: 4, range: [1, 1], quality: 5},
  shade: {label: "DEICIDE.CompanyType.shade", move: 4, range: [1, 1], summoned: true},
  animal: {label: "DEICIDE.CompanyType.animal", move: 4, range: [1, 1], summoned: true},
  construct: {label: "DEICIDE.CompanyType.construct", move: 4, range: [1, 1], summoned: true}
};

export const doctrines = {
  hold: {label: "DEICIDE.Doctrine.hold"},
  advance: {label: "DEICIDE.Doctrine.advance"},
  volley: {label: "DEICIDE.Doctrine.volley", retreat: 1},
  screen: {label: "DEICIDE.Doctrine.screen"}
};

export const nationTracks = {
  soldiers: {label: "DEICIDE.Track.soldiers", lathander: 3, offweiss: 10},
  officers: {label: "DEICIDE.Track.officers", lathander: 2, offweiss: 8},
  fortifications: {label: "DEICIDE.Track.fortifications", lathander: 3, offweiss: 8},
  dust: {label: "DEICIDE.Track.dust", lathander: 2, offweiss: 8},
  allies: {label: "DEICIDE.Track.allies", lathander: 0, offweiss: 6},
  magical: {label: "DEICIDE.Track.magical", lathander: 3, offweiss: 7},
  intelligence: {label: "DEICIDE.Track.intelligence", lathander: 3, offweiss: 9},
  weapons: {label: "DEICIDE.Track.weapons", lathander: 2, offweiss: 7},
  legitimacy: {label: "DEICIDE.Track.legitimacy", lathander: 4, offweiss: 7},
  navy: {label: "DEICIDE.Track.navy", lathander: 3, offweiss: 2}
};

export const trackRange = {min: 0, max: 10};

export const nationFormulas = {
  companiesPerBattle: "2 * soldiers",
  npcAnchorsPerBattle: "floor(officers / 2)",
  swornSlotsWar: "officers + 2",
  fortAvoidBonus: "3 * fortifications",
  barrierEnginesPerBattle: "floor(fortifications / 3)",
  fortKitsPerBattle: "fortifications",
  foreignCompaniesPerBattle: "floor(allies / 2)",
  battlemageQualityCap: "1 + floor(magical / 3)",
  preBattleReveals: "floor(intelligence / 3)",
  companyQualityCap: "1 + floor(weapons / 3)",
  shipsPerNavalBattle: "navy",
  invasionCompanies: "2 * soldiers + floor(allies / 2)",
  offweissInvasionCompanies: "soldiers + 2"
};

export const weaponsTrackUnlocks = {forging: 4, gimmickPins: 5, royalShop: 6, namedForge: 8};

export const offweiss = {tracksPerMonth: 2, frigateFromMonth: 6};

export const payouts = {
  warDefeat: {soldiers: -1, legitimacy: -1},
  fundTrackCostPerValue: 100,
  fundableTracks: ["dust", "soldiers", "fortifications", "weapons"]
};

export const warClock = {
  months: 12,
  weeksPerMonth: 4,
  invasionWinsToHold: 3,
  dustCollapseMonths: [5, 6],
  stages: [
    {months: [1, 2], levels: [1, 5], id: "reorganization"},
    {months: [3, 4], levels: [6, 9], id: "sabotage"},
    {months: [5, 6], levels: [10, 13], id: "resourceCrisis"},
    {months: [7, 8], levels: [14, 17], id: "internalCrisis"},
    {months: [9, 10], levels: [18, 22], id: "imperialVanguard"},
    {months: [11, 12], levels: [23, 27], id: "invasion"}
  ]
};

export const ships = {
  sloop: {move: 7, broadsides: 1, mightPerQuality: 4, range: [2, 4], defBase: 4, cost: 150, navyTrack: 2},
  frigate: {move: 5, broadsides: 2, mightPerQuality: 5, range: [3, 6], defBase: 6, cost: 300, navyTrack: 4},
  shipOfTheLine: {move: 3, broadsides: 3, mightPerQuality: 6, range: [3, 8], defBase: 10, cost: 600, navyTrack: 7}
};

export const naval = {
  seaTileMeters: 50,
  shipDefPerQuality: 2,
  deckGrid: [6, 6],
  boardingCompanies: 2,
  hullDamagePerRoutedCompany: 10,
  mapSize: [15, 15],
  lathanderFleet: {sloop: 3, frigate: 1}
};

export const pacing = {
  formula: "25*L*(L-1) / (480*S)",
  defaults: {N: 4, S: 45, L: 30},
  ranges: {N: [4, 6], S: [20, 50], L: [20, 25, 30]}
};

export const economy = {
  startingDust: 15,
  startingBeltDust: 10,
  sellFraction: 0.5,
  income: {
    dungeonExpedition: "12 + 2 * level",
    warVictory: "6 + level",
    boss: "24 + 2 * level",
    officerDefeated: 6,
    officerWeaponDropChance: 50,
    noCombatSession: 5
  },
  shops: {
    village: {multiplier: 1},
    town: {multiplier: 1},
    city: {multiplier: 1},
    capital: {multiplier: 1, royalAtWeaponsTrack: 6},
    foreignCapital: {multiplier: 1.5, alliesTrack: 2},
    underworld: {multiplier: 2, standing: 40}
  },
  dustCollapse: {priceMultiplier: 1.5, resupplyMultiplier: 2},
  ventures: {
    cost: 50,
    months: 2,
    rollFormula: "roll + 5 * track",
    bands: [{max: 29, result: "lose"}, {max: 69, result: "low"}, {max: null, result: "high"}],
    types: {
      harborShares: {track: "allies", low: {dust: 60}, high: {dust: 120}, lose: {}},
      mineLease: {track: "dust", low: {dust: 70}, high: {dust: 150, tracks: {dust: 1}}, lose: {}},
      privateerLetter: {track: "navy", low: {dust: 80}, high: {dust: 160}, lose: {tracks: {legitimacy: -1}}},
      underworldLoan: {
        track: "intelligence", low: {dust: 75}, high: {dust: 140, namedRumor: true},
        lose: {standing: {underworld: -20}}
      }
    }
  },
  debt: {max: 200, perSession: 5, unpaidLegitimacy: -1},
  patronStanding: 60
};
