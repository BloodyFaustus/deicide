export const overcast = {
  burnPerPoint: 2,
  floorPerPoint: 1
};

export const channel = {
  shortRestFraction: 0.5
};

export const matter = {
  harvestYield: 2,
  warTileYield: 2,
  dungeonSurfaces: ["stone", "metal"]
};

export const catalysts = {
  redWater: {prices: 1, scope: "use", might: 6},
  stoneFragment: {prices: 3, scope: "encounter", might: 10},
  philosophersStone: {prices: null, scope: "encounter", mightMultiplier: 2, matterCost: 0}
};

export const studentTruthMultiplier = 0.5;

export const saturation = {
  min: 0,
  max: 100,
  perAdaptation: 10,
  gains: {manaRichSession: 1, manaBeastKill: 3, redWater: 5, bondedRelic: 10},
  adaptation: {attribute: 2, hp: 5, marks: 1},
  markCivilianStanding: -5,
  heroClassAt: 50
};

export const divineAttention = {
  max: 10,
  templeStandingPerPoint: -5,

  acts: {
    certifyStudent: 2,
    studentTier2Alchemy: 1,
    studentStateAlchemist: 3,
    directAlchemyOnDivine: 1,
    witnessedByDivine: 1,
    transmuteLandmark: 1,
    usePhilosophersStone: 1,
    killHomunculusDirect: 1
  },
  thresholds: [
    {min: 1, id: "observed"},
    {min: 3, id: "agentsDispatched"},
    {min: 6, id: "caldusRime"},
    {min: 9, id: "godActs"},
    {min: 10, id: "truthWatching"}
  ]
};

export const staticCharge = {
  max: 5,
  gain: {warTiles: 2, dungeonActions: 1},
  spend: {mightPerPoint: 2, freeMoveCost: 3}
};

export const stolenSlots = {
  base: 2,
  upgrades: [{level: 15, slots: 3}],
  cancelFormula: "20 + 3 * skl - 2 * casterMag"
};

export const manaburn = {
  min: 0,
  max: 100,
  gains: {overcastFree: 10, overcastPer: 5, plagueRoundsFree: 3, redWater: 5, outbreak: 10},
  thresholds: [
    {min: 25, id: "scarring", civilianStanding: -5},
    {min: 50, id: "channelLoss", channel: -4},
    {min: 75, id: "burningCasts", burnPerCast: 2},
    {min: 100, id: "cannotCast", forcedBurnPerCast: 10}
  ],
  recovery: {cure: 10, longRest: 1, resistantLongRest: 2}
};

export const rest = {
  short: {
    hp: 0.25, channel: 0.5, matter: null, belt: false, clears: ["poison"], warClockWeeks: 0, perFloor: 1
  },
  long: {
    hp: 1, channel: 1, matter: 1, belt: true, clears: "all", keeps: ["crystalline"], warClockWeeks: 1,
    manaburn: -1
  },
  camp: {
    hp: 0.5, channel: 1, matter: 1, belt: false, clears: ["poison"], warClockWeeks: 1
  }
};

export const factions = {
  crown: {label: "DEICIDE.Faction.crown", lathander: true, track: "legitimacy"},
  army: {label: "DEICIDE.Faction.army", lathander: true, track: "soldiers"},
  civilians: {label: "DEICIDE.Faction.civilians", lathander: true},
  temple: {label: "DEICIDE.Faction.temple", lathander: true},
  mages: {label: "DEICIDE.Faction.mages", lathander: true, track: "magical"},
  brasswater: {label: "DEICIDE.Faction.brasswater", foreign: true},
  underworld: {label: "DEICIDE.Faction.underworld"},
  duneTribes: {label: "DEICIDE.Faction.duneTribes"},
  offweiss: {label: "DEICIDE.Faction.offweiss", foreign: true},
  council: {label: "DEICIDE.Faction.council"},
  gravetide: {label: "DEICIDE.Faction.gravetide", foreign: true},
  briarwall: {label: "DEICIDE.Faction.briarwall", foreign: true},
  valedorn: {label: "DEICIDE.Faction.valedorn", foreign: true},
  seastrand: {label: "DEICIDE.Faction.seastrand", foreign: true}
};

export const standing = {
  min: 0,
  max: 100,

  default: 40,
  bands: [
    {id: "hostile", min: 0, max: 19, shops: false, shopMultiplier: null, recruit: null},
    {id: "wary", min: 20, max: 39, shops: true, shopMultiplier: 1.25, recruit: null},
    {id: "neutral", min: 40, max: 59, shops: true, shopMultiplier: 1, recruit: "attached"},
    {id: "patron", min: 60, max: 79, shops: true, shopMultiplier: 1, recruit: "sworn", patron: true},
    {id: "allied", min: 80, max: 100, shops: true, shopMultiplier: 1, recruit: "sworn", patron: true, allied: true}
  ]
};
