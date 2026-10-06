export const npcBudget = {
  bands: [{maxLevel: 7, dust: 60}, {maxLevel: 15, dust: 150}, {maxLevel: 23, dust: 350}, {maxLevel: 30, dust: 600}],
  multipliers: {veteran: 1.5, named: 1.5, enemy: 0.6, standard: 1, prodigy: 1, specialist: 1}
};

export const npcProfiles = {
  veteran: {talent: "earlyPeak", levelOffset: 6},
  standard: {talent: "steady", levelOffset: 0},
  prodigy: {talent: "prodigy", levelOffset: -5},
  specialist: {talent: "savant", levelOffset: 0},
  enemy: {talent: "steady", levelOffset: 0}
};

export const npcCp = {perLevel: 6, split: [0.7, 0.3, 0]};

export const npcEquipment = {
  armored: {weapon: {sword: 40, lance: 40, axe: 20}, armor: {heavy: 70, medium: 30}, offhand: {shield: 70, buckler: 20, sidearm: 10}, accessory: {vigor: 50, ring: 30, token: 20}},
  infantryMelee: {weapon: {sword: 50, axe: 30, lance: 20}, armor: {medium: 60, light: 40}, offhand: {buckler: 50, sidearm: 30, none: 20}, accessory: {ring: 40, speed: 30, token: 30}},
  infantryRanged: {weapon: {bow: 60, gun: 40}, armor: {light: 70, medium: 30}, offhand: {quiver: 70, sidearm: 30}, accessory: {aim: 70, ring: 30}},
  casterReason: {weapon: {tome: 100}, armor: {light: 90, medium: 10}, offhand: {focus: 80, sidearm: 20}, accessory: {bead: 50, ring: 30, token: 20}},
  casterFaith: {weapon: {relic: 100}, armor: {light: 70, medium: 30}, offhand: {focus: 70, shield: 30}, accessory: {bead: 50, ring: 50}},
  casterVoid: {weapon: {tome: 100}, armor: {light: 90, medium: 10}, offhand: {focus: 100}, accessory: {bead: 60, ring: 40}},
  casterAlchemy: {weapon: {gauntlet: 100}, armor: {medium: 70, light: 30}, offhand: {satchel: 100}, accessory: {pouch: 70, ring: 30}},
  officer: {weapon: null, armor: null, offhand: {banner: 60, other: 40}, accessory: {seal: 60, ring: 40}},
  mounted: {weapon: {lance: 60, sword: 30, bow: 10}, armor: {medium: 70, light: 30}, offhand: {buckler: 60, none: 40}, accessory: {speed: 50, ring: 50}},
  flying: {weapon: {axe: 60, lance: 40}, armor: {medium: 60, light: 40}, offhand: {buckler: 50, none: 50}, accessory: {speed: 60, ring: 40}},
  naval: {weapon: {axe: 50, sword: 30, gun: 20}, armor: {medium: 50, light: 50}, offhand: {buckler: 40, sidearm: 40, none: 20}, accessory: {ring: 50, token: 50}}
};

export const npcPrefixWeights = {keen: 30, warding: 20, killer: 20, slayer: 20, reach: 10};

export const slayerFor = {armored: "armorslayer", mounted: "horseslayer", flying: "wingclipper", caster: "mageslayer"};

export const army = {
  sizes: {skirmish: 4, battle: 8},
  invasion: {offweiss: "soldiers + 2", lathander: "2 * soldiers"},
  mix: {
    offweiss: {infantry: 40, legionary: 20, archer: 15, cavalry: 15, battlemage: 10},
    lathander: {infantry: 45, pike: 15, archer: 20, cavalry: 15, battlemage: 5}
  },

  qualityBell: [1, 2, 3],
  chainedStrength: [70, 90],
  reinforcementFraction: 0.2,
  reinforcementRounds: [3, 4],
  edges: ["north", "east", "south", "west"],
  commanderLevelOffset: 2
};

export const loot = {
  bossTierAbove: 1,
  prefixWeights: {default: {keen: 30, warding: 25, killer: 20, reach: 15, slayer: 10}, rogueHeavy: {killer: 40, keen: 25, warding: 15, reach: 10, slayer: 10}},
  officerWeaponChance: 50,
  officerDust: 6
};

export const benchmarkMonster = {spd: "8 + floor(level / 2)", sweepMightMinus: 6};

export const traits = [
  "keeps a ledger of every favor owed", "sleeps in armor", "quotes the Council charter from memory", "never sits with a back to a door",
  "collects the buttons of defeated officers", "prays before every ford", "has a price and says so", "writes letters home that never get sent",
  "counts the dead twice", "drinks only water in the field", "knows every smuggler's dock by name", "laughs at the wrong moments",
  "carries a stone from a burned village", "cannot abide a dull blade", "remembers every face and no names", "fears the sea",
  "feeds stray dogs before the company", "hums marching songs under fire", "lost a hand to a Homunculus and says it was a bear", "reads the Registry's rolls for pleasure",
  "trusts alchemy and nothing else", "has buried three commanders", "bets on every morale check", "mends the company banner personally",
  "speaks to horses more than to people", "keeps a tally of Dust spent on Resupply", "walked out of a plague zone and never explained how", "owes Nessa Pike money",
  "sharpens other people's weapons without asking", "has seen Caldus Rime once and will not say where"
];

export const names = {
  lathander: {
    first: ["Aldric", "Brenna", "Cael", "Dorna", "Edwin", "Fenna", "Garret", "Hesper", "Ivo", "Joss", "Kessa", "Lorne", "Maren", "Nils", "Orla", "Pell", "Rina", "Sorrel", "Tamsin", "Wren"],
    family: ["Ashcroft", "Barrow", "Coldwell", "Dunmore", "Fenwick", "Greaves", "Hollis", "Kade", "Larkin", "Marr", "Nettle", "Oakes", "Pike", "Quill", "Rowe", "Saltmarch", "Thorne", "Vane", "Whitlock", "Yarrow"]
  },
  offweiss: {
    first: ["Anselm", "Berta", "Conrad", "Dietlind", "Emil", "Frieda", "Gerhart", "Hilde", "Ignatz", "Jutta", "Klaus", "Liesl", "Manfred", "Nora", "Otto", "Petra", "Reinhold", "Sigrun", "Ulrich", "Wilhelmina"],
    family: ["Krieg", "Krauss", "Sigrun", "Adler", "Brandt", "Eisen", "Falk", "Gross", "Hauser", "Kessler", "Lang", "Metz", "Nagel", "Rademacher", "Stahl", "Thiel", "Vogel", "Weiss", "Ziegler", "Steiner"]
  }
};
