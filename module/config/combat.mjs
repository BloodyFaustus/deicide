export const modes = {
  war: {label: "DEICIDE.Mode.war", engine: "war", grid: true},
  dungeon: {label: "DEICIDE.Mode.dungeon", engine: "dungeon", grid: false},
  arena: {label: "DEICIDE.Mode.arena", engine: "dungeon", grid: false, liftsDismount: true},
  naval: {label: "DEICIDE.Mode.naval", engine: "war", grid: true, naval: true}
};

export const skillTypes = {
  action: {label: "DEICIDE.SkillType.action", engines: ["war", "dungeon"], slot: "action"},
  reaction: {label: "DEICIDE.SkillType.reaction", engines: ["war", "dungeon"], slot: "reaction"},
  support: {label: "DEICIDE.SkillType.support", engines: ["war", "dungeon"], slot: "support", passive: true},
  command: {label: "DEICIDE.SkillType.command", engines: ["war"], slot: "command"},
  stance: {label: "DEICIDE.SkillType.stance", engines: ["dungeon"], slot: "stance", passive: true},
  mastery: {label: "DEICIDE.SkillType.mastery", engines: ["war", "dungeon"], slot: "mastery", passive: true}
};

export const elements = {
  fire: {label: "DEICIDE.Element.fire", school: "reason", natural: true, opposedBy: ["frost", "water"]},
  lightning: {label: "DEICIDE.Element.lightning", school: "reason", natural: true, opposedBy: ["stone"]},
  frost: {label: "DEICIDE.Element.frost", school: "reason", natural: true, opposedBy: ["fire"]},
  stone: {label: "DEICIDE.Element.stone", school: "reason", natural: true, opposedBy: ["wind"]},
  wind: {label: "DEICIDE.Element.wind", school: "reason", natural: true, opposedBy: ["stone"]},
  water: {label: "DEICIDE.Element.water", school: "reason", natural: true, opposedBy: ["lightning"]},
  divine: {label: "DEICIDE.Element.divine", school: "faith", natural: false, opposedBy: ["void"]},
  void: {label: "DEICIDE.Element.void", school: "void", natural: false, opposedBy: ["divine"]},
  truth: {label: "DEICIDE.Element.truth", school: "alchemy", natural: false, opposedBy: []}
};

export const attackBases = {
  str: {label: "DEICIDE.AttackBasis.str", formula: "str"},
  mag: {label: "DEICIDE.AttackBasis.mag", formula: "mag"},
  hybrid: {label: "DEICIDE.AttackBasis.hybrid", formula: "str + floor(mag / 2)"},
  twin: {label: "DEICIDE.AttackBasis.twin", formula: "str + mag"},
  flat: {label: "DEICIDE.AttackBasis.flat", formula: "0"}
};

export const mightSources = {
  weapon: {label: "DEICIDE.MightSource.weapon", field: "might"},
  spell: {label: "DEICIDE.MightSource.spell", field: "spellBonus"},
  alchemy: {label: "DEICIDE.MightSource.alchemy", field: "alchemyBonus"},
  heal: {label: "DEICIDE.MightSource.heal", field: "healBonus"},
  none: {label: "DEICIDE.MightSource.none", field: null}
};

export const defenses = {
  def: {label: "DEICIDE.Defense.def", damageType: "physical"},
  res: {label: "DEICIDE.Defense.res", damageType: "magical"},
  lower: {label: "DEICIDE.Defense.lower", damageType: "hybrid"},
  none: {label: "DEICIDE.Defense.none", damageType: "truth"}
};

export const elementMultipliers = {
  opposed: 1.5,
  weakness: 1.5,
  resistance: 0.5,

  divineBeing: {multiplier: 0.5, except: ["void", "truth"]}
};

export const triangle = {
  beats: {sword: "axe", axe: "lance", lance: "sword"},
  hit: 10,
  might: 2
};

export const effectiveness = [
  {id: "bowVsFlying", attacker: {weaponLine: "bow"}, target: {classType: "flying"}, effect: {multiplier: 2}},
  {id: "gunVsUnwarded", attacker: {weaponLine: "gun"}, target: {notStatus: "warded"}, effect: {might: 6}},
  {id: "gunVsWarded", attacker: {weaponLine: "gun"}, target: {status: "warded"}, effect: {weaponMight: 0}},
  {id: "reasonVsArmored", attacker: {tag: "reason"}, target: {classType: "armored"}, effect: {ignoreDef: 4}},
  {
    id: "piercingVsArmored", attacker: {anyTag: ["alchemy", "manaPiercing"]}, target: {classType: "armored"},
    effect: {multiplier: 2}
  },
  {id: "alchemyVsWarded", attacker: {tag: "alchemy"}, target: {status: "warded"}, effect: {ignoreWarded: true}},
  {
    id: "officerHunter", attacker: {tag: "officer"}, target: {classType: "officer"}, when: {flankOrBackRow: true},
    effect: {might: 6}
  }
];

export const war = {
  tileMeters: 10,
  doubling: {spdGap: 5, maxWeight: 10},
  flankHit: 10,
  highGroundHit: 10,
  waitAvoid: 5,
  harvest: {tiles: 1, matter: 2},
  frontTiles: 3,
  forestSightTiles: 2,
  sightBlockElevation: 2,
  fogRevealTiles: 6,
  phases: ["lathander", "enemy"]
};

export const terrain = {
  plain: {label: "DEICIDE.Terrain.plain", avoid: 0, cost: 1, matter: false},
  road: {label: "DEICIDE.Terrain.road", avoid: 0, cost: 1, matter: false, mountedRoadMove: 1},
  forest: {label: "DEICIDE.Terrain.forest", avoid: 20, cost: 2, matter: false, flyingIgnoresCost: true, blocksSightBeyond: 2},
  hill: {label: "DEICIDE.Terrain.hill", avoid: 10, cost: 2, matter: true, rangedRange: 1, highGround: true},
  rock: {label: "DEICIDE.Terrain.rock", avoid: 15, cost: 2, matter: true},
  fort: {label: "DEICIDE.Terrain.fort", avoid: 20, cost: 1, matter: true, healPercent: 10, highGround: true},
  wall: {label: "DEICIDE.Terrain.wall", avoid: 0, cost: null, matter: true, blocksSight: true},
  river: {label: "DEICIDE.Terrain.river", avoid: 0, cost: 3, matter: false, mountedImpassable: true},
  plague: {label: "DEICIDE.Terrain.plague", avoid: 0, cost: 1, matter: false, burnPerRound: 2}
};

export const dungeon = {
  rows: ["front", "back"],
  rowCapacity: 4,
  surpriseTick: 20,
  reinforcementTick: 20,
  bossPhaseBreaks: [75, 50, 25],
  bossMightOverPartyDef: 10
};

export const delay = {
  min: 20,
  absoluteMin: 5,
  defaultWeight: 8,
  weights: {light: 6, standard: 8, heavy: 12},
  guardDivisor: 2,
  staggerPenalty: 10
};

export const dungeonActions = {
  attack: {weight: null},
  ability: {weight: null},
  item: {weight: 6},
  guard: {weight: 6},
  swapRow: {weight: 4},
  harvest: {weight: 8, matter: 2},
  stance: {weight: 4},
  flee: {weight: 8, row: "back"}
};

export const warActions = ["attack", "ability", "command", "rally", "harvest", "wait"];

export const collapse = {
  meleeRangeMax: 1,
  area: {
    single: "single",
    line: "column",
    blast1: "row",
    blast2: "all"
  },
  movement: "rowSwap",
  terrainBarrierFormula: "4 * mag"
};

export const statuses = {
  poison: {
    label: "DEICIDE.Status.poison", img: "icons/svg/poison.svg", duration: {turns: 3},
    tick: {burn: 3, at: "turnStart"}, removedBy: ["antidote", "purge", "vigil"]
  },
  stagger: {
    label: "DEICIDE.Status.stagger", img: "icons/svg/daze.svg", duration: {turns: 1},
    modifiers: [
      {key: "delay", value: 10, when: {engine: "dungeon"}},
      {key: "move", value: -2, when: {engine: "war"}},
      {key: "canto", op: "set", value: 0, when: {engine: "war"}}
    ]
  },
  pinned: {
    label: "DEICIDE.Status.pinned", img: "icons/svg/net.svg", duration: {turns: 1},
    modifiers: [{key: "move", op: "set", value: 0}]
  },
  warded: {
    label: "DEICIDE.Status.warded", img: "icons/svg/mage-shield.svg", duration: {until: "broken"},
    breakFormula: "2 * mag", raiseCost: {channel: 2}
  },
  barrier: {
    label: "DEICIDE.Status.barrier", img: "icons/svg/shield.svg", duration: {until: "emptyOrEncounterEnd"}, pool: true
  },
  guard: {
    label: "DEICIDE.Status.guard", img: "icons/svg/combat.svg", duration: {until: "nextTurn"},
    damageMultiplier: 0.5, nextDelayDivisor: 2
  },
  attuned: {
    label: "DEICIDE.Status.attuned", img: "icons/svg/lightning.svg", duration: {until: "stanceChange"},
    elementMight: 2
  },
  marked: {
    label: "DEICIDE.Status.marked", img: "icons/svg/target.svg", duration: {turns: 3}, markerMight: 3
  },
  silenced: {
    label: "DEICIDE.Status.silenced", img: "icons/svg/silenced.svg", duration: {turns: 2},
    blocksSchools: ["reason", "faith", "void"]
  },
  cloaked: {
    label: "DEICIDE.Status.cloaked", img: "icons/svg/invisible.svg", duration: {until: "attack"},
    untargetableAtRange: 3
  },
  crystalline: {
    label: "DEICIDE.Status.crystalline", img: "icons/svg/frozen.svg", duration: {until: "treated"},
    modifiers: [{key: "attributes.spd", value: -4}]
  },
  thrall: {
    label: "DEICIDE.Status.thrall", img: "icons/svg/terror.svg", duration: {until: "healedAboveZero"},
    statMultiplier: 0.5
  },
  downed: {
    label: "DEICIDE.Status.downed", img: "icons/svg/skull.svg", duration: {until: "healed"}, defeated: true
  },
  routed: {
    label: "DEICIDE.Status.routed", img: "icons/svg/falling.svg", duration: {until: "nextBattle"}, defeated: true
  },

  formed: {
    label: "DEICIDE.Status.formed", img: "icons/svg/tower.svg", duration: {until: "phaseEnd"},
    modifiers: [{key: "defense.def", value: 2}], company: true
  },
  stance: {
    label: "DEICIDE.Status.stance", img: "icons/svg/statue.svg", duration: {until: "stanceChange"}, stance: true
  },
  untargetable: {
    label: "DEICIDE.Status.untargetable", img: "icons/svg/invisible.svg", duration: {until: "ownTurn"},
    flags: {untargetable: true}
  },
  braced: {
    label: "DEICIDE.Status.braced", img: "icons/svg/shield.svg", duration: {turns: 1}
  },
  empowered: {
    label: "DEICIDE.Status.empowered", img: "icons/svg/upgrade.svg", duration: {turns: 3},
    modifiers: [{key: "attributes.str", value: 4}, {key: "attributes.mag", value: 4}, {key: "attributes.skl", value: 4}, {key: "attributes.spd", value: 4}, {key: "attributes.def", value: 4}, {key: "attributes.res", value: 4}, {key: "attributes.cmd", value: 4}]
  },
  inoculated: {
    label: "DEICIDE.Status.inoculated", img: "icons/svg/regen.svg", duration: {until: "session"},
    flags: {immunePlague: true, immuneManaburn: true}
  },
  burning: {
    label: "DEICIDE.Status.burning", img: "icons/svg/fire.svg", duration: {turns: 3},
    tick: {burn: 2, at: "turnStart"}
  },
  exposed: {
    label: "DEICIDE.Status.exposed", img: "icons/svg/eye.svg", duration: {turns: 1},
    modifiers: [{key: "avoid", value: -10}]
  },
  smoke: {
    label: "DEICIDE.Status.smoke", img: "icons/svg/clouds.svg", duration: {turns: 2},
    modifiers: [{key: "avoid", value: 15}]
  },
  ordered: {
    label: "DEICIDE.Status.ordered", img: "icons/svg/sound.svg", duration: {until: "phaseEnd"}, company: true
  },
  steadfast: {
    label: "DEICIDE.Status.steadfast", img: "icons/svg/holy-shield.svg", duration: {until: "roundEnd"}, company: true,
    flags: {passMorale: true}
  },
  rooted: {
    label: "DEICIDE.Status.rooted", img: "icons/svg/anchor.svg", duration: {turns: 1},
    flags: {cannotSwapRow: true, cannotCanto: true}, modifiers: [{key: "canto", op: "set", value: 0}]
  },
  voidEdge: {
    label: "DEICIDE.Status.voidEdge", img: "icons/svg/blood.svg", duration: {turns: 1},
    modifiers: [{key: "might", value: 2, when: {actionElement: "void"}}]
  },
  misdirected: {
    label: "DEICIDE.Status.misdirected", img: "icons/svg/direction.svg", duration: {until: "phaseEnd"}, company: true,
    flags: {doctrine: "hold"}
  }
};

export const reactions = {perInterval: 1, promptTimeoutMs: 20000, defaultResponse: "skip"};
