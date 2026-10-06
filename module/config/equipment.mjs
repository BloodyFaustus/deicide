export const slots = {
  weapon: {count: 1},
  offhand: {count: 1},
  armor: {count: 1},
  accessory: {count: 2},
  pin: {count: 1},
  belt: {count: 4, stack: 3, engines: ["dungeon"]}
};

export const ppCosts = {
  might: 1,
  accuracyPer5: 1,
  critPer5: 1,
  range: 4,
  weightMinus: 2,
  effectiveX2: 6,
  elementTag: 2,
  brave: 10,
  defOrRes: 2,
  avoidPer5: 2,
  hpPer5: 2,
  channel: 1,
  matterCap: 1,
  attribute: 3,
  move: 5,
  statusImmunity: 4,
  skillRank1or2: 8,
  skillRank4or6: 14,
  mastery: 20
};

export const ppRefunds = {
  mightMinus: 1,
  weightPlus: 2,
  weightPlusMaxRefund: 4,
  burden1: 3,
  burden2: 6,
  mightZeroVsWarded: 4,
  dustPerUse: 4,
  burnPerUse2: 5,
  channelPerUse: 2,
  markOnFirstEquip: 10,
  standingMinus20: 6,
  divineAttentionEquipped: 12
};

export const tiers = {
  iron: {label: "DEICIDE.Tier.iron", budget: 10, gate: "E", shop: "village", accessoryBudget: 6, offhandPrice: 10},
  steel: {label: "DEICIDE.Tier.steel", budget: 15, gate: "D", shop: "town", accessoryBudget: 9, offhandPrice: 20},
  silver: {label: "DEICIDE.Tier.silver", budget: 20, gate: "C", shop: "city", accessoryBudget: 12, offhandPrice: 40},
  royal: {label: "DEICIDE.Tier.royal", budget: 29, gate: "B", shop: "capital", accessoryBudget: 14, offhandPrice: 80},
  named: {label: "DEICIDE.Tier.named", budget: [32, 45], gate: "A", shop: null}
};

export const tierOrder = ["iron", "steel", "silver", "royal", "named"];

export const minimumPrice = 10;

export const weaponGenerator = {
  lines: {
    sword: {prof: "sword", might: 6, acc: 10, crit: 5, range: [1, 1], weight: 6, pp: 9},
    lance: {prof: "lance", might: 8, acc: 5, crit: 0, range: [1, 1], weight: 8, pp: 9},
    axe: {prof: "axe", might: 10, acc: 0, crit: 0, range: [1, 1], weight: 10, pp: 10},
    bow: {prof: "bow", might: 7, acc: 5, crit: 5, range: [2, 3], weight: 8, pp: 9},
    gun: {prof: "gun", might: 9, acc: 15, crit: 10, range: [2, 2], weight: 10, pp: 10, drawback: "mightZeroVsWarded"},
    dagger: {prof: "sword", might: 4, acc: 15, crit: 15, range: [1, 1], weight: 4, pp: 10},
    tome: {prof: "reason", spellBonus: 2, channel: 1, acc: 10, pp: 9},
    relic: {prof: "faith", spellBonus: 2, healBonus: 2, channel: 1, acc: 10, pp: 9},
    gauntlet: {prof: "alchemy", alchemyBonus: 2, matter: 2, acc: 10, pp: 9}
  },
  tiers: {
    iron: {might: 0, acc: 0, crit: 0, weight: 0, pp: 0, gate: "E", casterBonus: 2, casterChannel: 1, casterMatter: 2},
    steel: {might: 3, acc: 5, crit: 5, weight: 0, pp: 5, gate: "D", casterBonus: 5, casterChannel: 2, casterMatter: 3},
    silver: {might: 6, acc: 10, crit: 10, weight: 0, pp: 10, gate: "C", casterBonus: 8, casterChannel: 3, casterMatter: 4},
    royal: {
      might: 10, acc: 15, crit: 10, weight: -2, pp: 19, gate: "B", casterBonus: 12, casterChannel: 4, casterMatter: 5,
      casterSpellWeight: -1
    }
  },
  prefixes: {
    killer: {crit: 25, might: -1, pp: 4, allowed: "any"},
    keen: {acc: 15, might: -1, pp: 2, allowed: "any"},
    reach: {rangeMax: 1, might: -2, pp: 2, allowed: ["sword", "lance", "axe", "dagger", "bow"]},
    warding: {res: 2, pp: 4, allowed: "any"},
    runed: {elementTag: "chosenNatural", channelPerAttack: 1, pp: 0, allowed: ["sword", "lance", "axe", "dagger", "bow", "gun"]},
    armorslayer: {effectiveVs: "armored", might: -1, pp: 5, allowed: "any"},
    horseslayer: {effectiveVs: "mounted", might: -1, pp: 5, allowed: "any"},
    wingclipper: {effectiveVs: "flying", might: -1, pp: 5, allowed: "any"},
    mageslayer: {effectiveVs: "caster", might: -1, pp: 5, allowed: "any"},
    siege: {range: [3, 6], might: -2, weight: 2, pp: 2, allowed: ["bow", "gun"]},
    brave: {attacksTwice: true, might: -4, weight: 4, pp: 2, allowed: "any", tiers: ["silver", "royal"]}
  },
  price: "floor(pp*pp/5)",
  forge: {maxLevel: 3, mightPerLevel: 1, accPerLevel: 5, cost: [20, 40, 80], requiresWeaponsTrack: 4}
};

export const martialLines = ["sword", "lance", "axe", "bow", "gun", "dagger"];

export const casterLines = ["tome", "relic", "gauntlet"];

export const sidearmLines = ["dagger", "gun"];

export const slayerMultiplier = 2;

export const prefixShops = {
  keen: "town", warding: "town", runed: "town",
  killer: "city", armorslayer: "city", horseslayer: "city", wingclipper: "city", mageslayer: "city",
  reach: "city", siege: "city",
  brave: "capital"
};

export const burden = {
  0: {delay: 0, avoid: 0},
  1: {delay: 4, avoid: -5},
  2: {delay: 8, avoid: -10}
};

export const armor = {
  ironLight: {weight: "light", tier: "iron", def: 1, res: 1, burden: 0, pp: 4, price: 10},
  steelLight: {weight: "light", tier: "steel", def: 2, res: 2, burden: 0, pp: 8, price: 12},
  silverLight: {weight: "light", tier: "silver", def: 3, res: 3, burden: 0, pp: 12, price: 28},
  royalLight: {weight: "light", tier: "royal", def: 4, res: 4, avoid: 5, burden: 0, pp: 18, price: 64},
  ironMedium: {weight: "medium", tier: "iron", def: 3, res: 1, burden: 1, pp: 5, price: 10},
  steelMedium: {weight: "medium", tier: "steel", def: 4, res: 2, burden: 1, pp: 9, price: 16},
  silverMedium: {weight: "medium", tier: "silver", def: 5, res: 3, burden: 1, pp: 13, price: 33},
  royalMedium: {weight: "medium", tier: "royal", def: 6, res: 4, burden: 1, pp: 17, price: 57},
  ironHeavy: {weight: "heavy", tier: "iron", def: 5, res: 0, burden: 2, pp: 4, price: 10, requires: {armor: "D"}},
  steelHeavy: {weight: "heavy", tier: "steel", def: 7, res: 1, burden: 2, pp: 10, price: 20, requires: {armor: "D"}},
  silverHeavy: {weight: "heavy", tier: "silver", def: 9, res: 2, burden: 2, pp: 16, price: 51, requires: {armor: "C"}},
  royalHeavy: {weight: "heavy", tier: "royal", def: 11, res: 3, hp: 5, burden: 2, pp: 24, price: 115, requires: {armor: "B"}}
};

export const offhand = {
  buckler: {
    tiers: {
      iron: {def: 1},
      steel: {def: 1, avoid: 5},
      silver: {def: 2, avoid: 5},
      royal: {def: 2, avoid: 10}
    }
  },
  shield: {
    requires: {armor: "D"},
    tiers: {
      iron: {def: 2, avoid: -5},
      steel: {def: 3, res: 1, avoid: -5},
      silver: {def: 4, res: 2, avoid: -5},
      royal: {def: 5, res: 3, negateHitPerEncounter: 1}
    }
  },
  towerShield: {
    requires: {armor: "C"},
    tiers: {
      iron: {def: 5, avoid: -15, move: -1, price: 20}
    }
  },
  focus: {
    requires: {classType: "caster"},
    tiers: {
      iron: {channel: 2},
      steel: {channel: 3},
      silver: {channel: 4},
      royal: {channel: 5, spellAcc: 5}
    }
  },
  satchel: {
    requires: {alchemy: "E"},
    tiers: {
      iron: {matter: 2},
      steel: {matter: 3},
      silver: {matter: 4},
      royal: {matter: 5, harvest: 1}
    }
  },
  quiver: {
    requires: {anyOf: [{bow: "E"}, {gun: "E"}]},
    tiers: {
      iron: {acc: 5},
      steel: {acc: 10},
      silver: {acc: 15},
      royal: {acc: 20}
    }
  },
  banner: {
    requires: {classType: "officer"},
    tiers: {
      iron: {companyHit: 5},
      steel: {companyMorale: 10},
      silver: {commandRadius: 1},
      royal: {commandRadius: 1, companyAvoid: 5}
    }
  }
};

export const accessories = {
  ironRing: {price: 10, shop: "village", choice: "attribute", attribute: 2, family: "ring"},
  steelRing: {price: 16, shop: "town", choice: "attribute", attribute: 3, family: "ring"},
  silverRing: {price: 28, shop: "city", choice: "attribute", attribute: 4, family: "ring"},
  royalRing: {price: 45, shop: "capital", choice: "attribute", attribute: 4, secondAttribute: 1, family: "ring"},
  speedCharm: {price: 10, shop: "village", avoid: 10, family: "speed"},
  windCharm: {price: 24, shop: "city", avoid: 15, move: 1, family: "speed"},
  vigorBand: {price: 10, shop: "village", hp: 10, family: "vigor"},
  heartBand: {price: 20, shop: "city", hp: 20, def: 1, family: "vigor"},
  channelBead: {price: 10, shop: "village", channel: 4, family: "bead"},
  deepBead: {price: 12, shop: "town", channel: 8, family: "bead"},
  manaBead: {price: 39, shop: "capital", channel: 10, overcastBurn: -1, family: "bead"},
  matterPouch: {price: 10, shop: "village", matter: 3, family: "pouch"},
  alchemistsPouch: {price: 16, shop: "town", matter: 6, harvest: 1, family: "pouch"},
  antidoteToken: {price: 10, shop: "village", immune: ["poison"], family: "token"},
  emberToken: {price: 10, shop: "town", immune: ["fire"], family: "token"},
  stormToken: {price: 10, shop: "town", immune: ["lightning"], family: "token"},
  frostToken: {price: 10, shop: "town", immune: ["frost"], family: "token"},
  stoneToken: {price: 10, shop: "town", immune: ["stone"], family: "token"},
  windToken: {price: 10, shop: "town", immune: ["wind"], family: "token"},
  waterToken: {price: 10, shop: "town", immune: ["water"], family: "token"},
  stillToken: {price: 10, shop: "town", immune: ["stagger"], family: "token"},
  wardensToken: {price: 10, shop: "town", immune: ["plagueBurn"], family: "token"},
  sureHand: {price: 10, shop: "village", acc: 10, family: "aim"},
  keenEye: {price: 10, shop: "town", crit: 10, acc: 5, family: "aim"},
  officersSeal: {price: 10, shop: "town", commandRadius: 1, requires: {classType: "officer"}, family: "seal"},
  marshalsSeal: {
    price: 33, shop: "capital", commandRadius: 2, companyMorale: 10, requires: {classType: "officer"}, family: "seal"
  },
  skillPin: {price: 12, shop: "city", choice: "skill", skillRanks: [1, 2], family: "pin"},
  masterPin: {price: 39, shop: "capital", choice: "skill", skillRanks: [4, 6], family: "pin"}
};

export const accessoryNames = {
  alchemistsPouch: "Alchemist's Pouch",
  wardensToken: "Warden's Token",
  emberToken: "Ember Token",
  officersSeal: "Officer's Seal",
  marshalsSeal: "Marshal's Seal"
};

export const consumables = {
  salve: {price: 2, shop: "village", effect: {heal: 15}},
  tonic: {price: 5, shop: "town", effect: {heal: 30}},
  elixir: {price: 15, shop: "city", effect: {heal: 60, removeStatuses: 1}},
  dustDraught: {price: 6, shop: "town", effect: {channel: 4, burn: 2}},
  refinedDraught: {price: 14, shop: "city", effect: {channel: 8, burn: 2}},
  antidote: {price: 2, shop: "village", effect: {removeStatus: ["poison"], removeBurnTicks: true}},
  smokeVial: {price: 4, shop: "town", effect: {row: "own", avoid: 15, turns: 2}},
  flashVial: {price: 4, shop: "town", effect: {row: "enemy", acc: -15, turns: 2}},
  fireVial: {price: 6, shop: "town", effect: {attack: {might: 10, element: "fire", area: "row", basis: "flat", hitStat: "skl"}}},
  manaCrystal: {price: 5, shop: "town", effect: {matter: 4}, requires: {alchemy: "E"}},
  wardScroll: {price: 8, shop: "city", effect: {applyStatus: "warded", target: "ally"}},
  rallyHorn: {price: 10, shop: "town", effect: {companiesPassMorale: true}, engines: ["war"]},
  phoenixAsh: {price: 40, shop: "capital", effect: {revivePercent: 25}, carryLimit: 1},
  redWater: {
    price: null, shop: null, catalyst: "redWater",
    effect: {manaHero: {saturation: 5, marks: 1}, other: {burn: 10, manaburn: 5}}
  },
  stoneFragment: {price: null, shop: null, catalyst: "stoneFragment"},
  philosophersStone: {price: null, shop: null, catalyst: "philosophersStone"}
};

export const consumableNames = {
  philosophersStone: "Philosopher's Stone"
};

export const supplies = {
  resupply: {price: 5, effect: {companyStrength: 10}},
  cannonShell: {price: 2, effect: {ammo: "cannon"}},
  incendiary: {price: 1, effect: {ammo: "incendiary"}},
  fortKit: {price: 20, effect: {terrain: {from: "plain", to: "fort"}}, perBattle: "fortifications"},
  barrierEngine: {price: 30, effect: {barrier: 60}, perBattle: "fortifications / 3"},
  remount: {price: 15, effect: {remount: true}, perDungeon: 1}
};

export const arts = {
  sunder: {lines: ["sword", "axe"], minTier: "silver", hp: 5, might: 6, ignoreDef: 5},
  grounder: {lines: ["sword", "lance"], minTier: "steel", hp: 4, might: 4, effectiveVs: "flying"},
  knightkneeler: {lines: ["lance", "axe"], minTier: "steel", hp: 4, might: 4, effectiveVs: "mounted"},
  shatter: {lines: ["axe"], minTier: "silver", hp: 6, might: 8, targetDef: -3, turns: 2},
  curvedShot: {lines: ["bow"], minTier: "iron", hp: 3, rangeMax: 1, acc: 20},
  deadeyeShot: {lines: ["bow", "gun"], minTier: "royal", hp: 8, rangeMax: 2, crit: 20, weight: 12},
  pointBlank: {lines: ["gun"], minTier: "steel", hp: 4, range: [1, 1], might: 6, ignoreWarded: true},
  ruin: {lines: ["tome"], minTier: "silver", hp: 6, spellMight: 6, channelCost: 0},
  mercy: {lines: ["relic"], minTier: "iron", hp: 4, rowHealFraction: 0.5},
  reconstitute: {lines: ["gauntlet"], minTier: "steel", hp: 5, nextMatterCost: 0}
};

export const artDefaultWeight = 8;

export const named = {
  benefitBudget: [32, 45],
  royalBudget: 29,
  forge: {weaponsTrack: 8, dust: 200, budget: 32}
};
