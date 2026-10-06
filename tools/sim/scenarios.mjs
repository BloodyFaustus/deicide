import {buildCharacter, buildMonster, buildCompany, tierForLevel} from "./world.mjs";

export const rankAt = level => Math.min(10, Math.max(1, Math.floor((level + 1) / 2)));

export function party(level, {mode = "war", seedBase = 100, siege = true} = {}) {
  const r = rankAt(level);
  const tier2 = level >= 8;
  const tier3 = level >= 16;
  const mercer = buildCharacter({
    fixture: "mercer", level, mode, seed: seedBase + 1, name: "Mercer",
    classes: [{id: "stateAlchemist", rank: Math.min(r, 10), from: 1}, ...(siege ? [{id: "siegeAlchemist", rank: Math.min(Math.max(2, r), 6), from: 1}] : [])],

    activeClass: (mode === "war") && siege && (level < 16) ? "siegeAlchemist" : "stateAlchemist",
    loadout: {secondary: "alchemist", reaction: "alchemistDeconstruct"}
  });
  const hyacinth = buildCharacter({
    fixture: "hyacinth", level, mode, seed: seedBase + 2, name: "Hyacinth",
    classes: [{id: "adept", rank: tier2 ? 6 : Math.max(3, r)}, ...(tier2 ? [{id: "battlemage", rank: tier3 ? 6 : r}] : []), ...(tier3 ? [{id: "magus", rank: r}] : [])],
    loadout: {reaction: tier3 ? "magusCounterspell" : (tier2 ? "battlemageManaShield" : "adeptManaSense")}
  });
  const rista = buildCharacter({
    fixture: "rista", level, mode, seed: seedBase + 3, name: "Rista",
    classes: [{id: "rogue", rank: tier2 ? 6 : Math.max(2, r)}, ...(tier2 ? [{id: "assassin", rank: tier3 ? 6 : r}] : []), ...(tier3 ? [{id: "shadow", rank: r}] : [])],
    loadout: {reaction: tier2 ? "assassinVanish" : "rogueEvade"}
  });
  const xidra = buildCharacter({
    fixture: "xidrathira", level, mode, seed: seedBase + 4, name: "Xidrathira",
    classes: [{id: "soldier", rank: tier2 ? 6 : Math.max(2, r)}, ...(tier2 ? [{id: "knight", rank: tier3 ? 6 : r}] : []), ...(tier3 ? [{id: "paladin", rank: r}] : [])],
    loadout: {reaction: tier2 ? "knightGuardian" : "soldierBrace", stance: tier2 ? "knightBulwark" : "soldierShieldWall"}
  });
  mercer.row = "front"; hyacinth.row = "back"; rista.row = "front"; xidra.row = "front";
  return [mercer, hyacinth, rista, xidra];
}

export function irena(level, {mode = "war", seed = 200} = {}) {
  const r = rankAt(level);
  const actor = buildCharacter({
    inputs: {people: "manaborne", background: "nobleCadet", baseClass: "cadet"}, level, mode, seed, name: "Irena Vos",
    classes: [{id: "cadet", rank: level >= 8 ? 6 : Math.max(2, r)}, ...(level >= 8 ? [{id: "captain", rank: r}] : [])],
    kit: {weapon: `${tierForLevel(level)}Lance`, offhand: `${tierForLevel(level)}Banner`, armor: `${tierForLevel(level)}Medium`},
    loadout: {reaction: "cadetCover"}
  });
  return actor;
}

export function chirurgeon(level, {mode = "dungeon", seed = 300} = {}) {
  const r = rankAt(level);
  const actor = buildCharacter({
    inputs: {people: "manaborne", background: "templeWard", baseClass: "acolyte"}, level, mode, seed, name: "Chirurgeon",
    classes: [{id: "acolyte", rank: level >= 8 ? 6 : Math.max(2, r)}, ...(level >= 8 ? [{id: "chirurgeon", rank: r}] : [])],
    kit: {weapon: `${tierForLevel(level)}Relic`, offhand: `${tierForLevel(level)}Focus`, armor: `${tierForLevel(level)}Light`},
    loadout: {reaction: level >= 8 ? "chirurgeonStabilize" : "acolyteSanctuary"}
  });
  actor.row = "back";
  return actor;
}

export function enemyCaptain(level, {seed = 400, name = "Enemy Captain"} = {}) {
  const r = rankAt(level);
  const actor = buildCharacter({
    inputs: {people: "foreignHuman", background: "conscript", baseClass: "cadet"}, level, mode: "war", seed, name, side: "enemy",
    classes: [{id: "cadet", rank: level >= 8 ? 6 : Math.max(2, r)}, ...(level >= 8 ? [{id: "captain", rank: r}] : [])],
    kit: {weapon: `${tierForLevel(level)}Lance`, offhand: `${tierForLevel(level)}Banner`, armor: `${tierForLevel(level)}Medium`}
  });
  actor.side = "enemy";
  return actor;
}

export function ashfordMap() {
  return {
    width: 24, height: 20, rounds: 10,
    terrainAt(x, y) {
      if ( x === 12 ) {
        if ( y === 10 ) return "plain";
        if ( y === 5 ) return "road";
        return "river";
      }
      if ( (x >= 4) && (x <= 6) && (y >= 8) && (y <= 11) ) return "hill";
      return "plain";
    }
  };
}

export function ashfordMill({level = 5, difficulty = "standard", seedBase = 100} = {}) {
  const map = ashfordMap();
  const hard = difficulty === "hard";
  const pcs = party(level, {mode: "war", seedBase});
  const positions = [[10, 9], [9, 10], [10, 11], [9, 9]];
  pcs.forEach((pc, i) => { pc.x = positions[i][0]; pc.y = positions[i][1]; });
  const captain = irena(level, {seed: seedBase + 5});
  captain.x = 10; captain.y = 10;
  const lathander = [
    buildCompany({type: "infantry", quality: 2, side: "party", doctrine: "advance", name: "Lathander Infantry 1", x: 11, y: 9}),
    buildCompany({type: "infantry", quality: 2, side: "party", doctrine: "advance", name: "Lathander Infantry 2", x: 11, y: 11})
  ];
  const officer = enemyCaptain(level + 1 + (hard ? 2 : 0), {seed: seedBase + 6});
  officer.x = 18; officer.y = 10;
  const infantryCount = 5 + (hard ? 2 : 0);
  const enemies = [];
  for ( let i = 0; i < infantryCount; i++ ) enemies.push(buildCompany({type: "infantry", quality: 2, side: "enemy", doctrine: "advance", name: `Meridian Infantry ${i + 1}`, x: 16 + (i % 3), y: 8 + Math.floor(i / 3) * 2}));
  enemies.push(buildCompany({type: "archer", quality: 2, side: "enemy", doctrine: "volley", name: "Meridian Archers 1", x: 20, y: 9}));
  enemies.push(buildCompany({type: "archer", quality: 2, side: "enemy", doctrine: "volley", name: "Meridian Archers 2", x: 20, y: 11}));
  const cavalry = buildCompany({type: "cavalry", quality: 3, side: "enemy", doctrine: "advance", name: "Meridian Cavalry", x: 23, y: 10});
  return {
    scenario: {map, rounds: map.rounds, terrainAt: map.terrainAt, reinforcements: [{round: 4, units: [cavalry]}]},
    units: [...pcs, captain, ...lathander, officer, ...enemies],
    hooks: {stoneLanceId: "siegeAlchemistStoneLance"}
  };
}

export function drownedFoundry({level = 10, seedBase = 100} = {}) {
  const pcs = party(level, {mode: "dungeon", seedBase});
  const healer = chirurgeon(level, {seed: seedBase + 7});
  const members = [...pcs, healer];
  return {
    party: members,
    floors: [
      {surface: "stone", shortRest: true, encounters: [
        {name: "entry hall", enemies: () => [buildMonster("manaHound"), buildMonster("manaHound"), buildMonster("manaHound")], surprise: "none"},
        {name: "flooded gallery", enemies: () => [buildMonster("manaHound"), buildMonster("manaHound"), buildMonster("manaHound")], surprise: "none"},
        {name: "overseer's office", enemies: () => [buildMonster("crystalStalker")], surprise: "party"}
      ]},
      {surface: "metal", shortRest: false, plagueRounds: 4, encounters: [
        {name: "forge floor", enemies: () => [buildMonster("burntWraith"), buildMonster("burntWraith")], surprise: "none", warded: true}
      ]},
      {surface: "stone", shortRest: false, encounters: [
        {name: "drowned arena", enemies: () => [buildMonster("mireDrake")], surprise: "none", boss: true}
      ]}
    ]
  };
}

export function mireDrakeAlone({level = 10, seedBase = 100} = {}) {
  return {party: party(level, {mode: "dungeon", seedBase}), enemies: () => [buildMonster("mireDrake")]};
}

export function wrathH3({seedBase = 100} = {}) {
  const assassin = buildCharacter({
    fixture: "rista", level: 20, mode: "dungeon", seed: seedBase + 3, name: "Vantage Assassin",
    classes: [{id: "rogue", rank: 10}, {id: "assassin", rank: 10}], activeClass: "assassin", pin: "vantagePin",
    loadout: {secondary: "rogue", reaction: "pinVantage", supports: ["assassinPoisonEdge", "rogueFlank", "assassinLethality"]}
  });
  assassin.row = "front";
  return {party: [assassin], enemies: () => [buildMonster("wrath")]};
}

export function juggernautH4({seedBase = 100} = {}) {
  const knight = () => {
    const actor = buildCharacter({
      fixture: "xidrathira", level: 30, seed: seedBase + 4, name: "Great Knight",
      classes: [{id: "soldier", rank: 6}, {id: "knight", rank: 10}, {id: "greatKnight", rank: 10}], activeClass: "greatKnight",
      kit: {weapon: "royalLance", offhand: "royalShield", armor: "royalHeavy"},
      loadout: {secondary: "knight", reaction: "greatKnightUnbreakable", stance: "greatKnightIronWall", supports: ["knightFortress", "halberdierPhalanx"]}
    });
    return actor;
  };
  const map = {width: 16, height: 8, rounds: 6, terrainAt: () => "plain"};
  const warUnits = () => {
    const k = knight(); k.x = 2; k.y = 4; k.side = "party";
    const line = [0, 1, 2].map(i => buildCompany({type: "infantry", quality: 5, side: "enemy", doctrine: "hold", name: `Legion Line ${i + 1}`, x: 8, y: 3 + i}));
    return [k, ...line];
  };
  const mercer = () => {
    const actor = party(30, {mode: "dungeon", seedBase: seedBase + 50, siege: false})[0];
    actor.row = "front";
    return actor;
  };
  return {knight, map, warUnits, mercer};
}

export function invasionH8({seedBase = 100, policy = "spender"} = {}) {
  const map = {width: 24, height: 20, rounds: 10, terrainAt: (x, y) => ((x >= 4) && (x <= 6) && (y >= 8) && (y <= 11)) ? "hill" : "plain"};
  const pcs = party(28, {mode: "war", seedBase});
  const positions = [[8, 9], [7, 10], [8, 11], [7, 9]];
  pcs.forEach((pc, i) => { pc.x = positions[i][0]; pc.y = positions[i][1]; });
  const captain = irena(28, {seed: seedBase + 5});
  captain.x = 8; captain.y = 10;
  const lathander = [0, 1, 2, 3].map(i => buildCompany({type: i < 3 ? "infantry" : "archer", quality: 4, side: "party", doctrine: i < 3 ? "advance" : "volley", name: `Lathander ${i + 1}`, x: 10, y: 7 + i * 2}));
  const marshal = enemyCaptain(32, {seed: seedBase + 8, name: "Marshal Krieg"});
  marshal.x = 19; marshal.y = 10;
  const enemies = [];
  for ( let i = 0; i < 5; i++ ) enemies.push(buildCompany({type: i < 2 ? "legionary" : "infantry", quality: 5, side: "enemy", doctrine: "advance", name: `Imperial ${i + 1}`, x: 17 + (i % 2), y: 7 + i}));
  enemies.push(buildCompany({type: "archer", quality: 4, side: "enemy", doctrine: "volley", name: "Imperial Archers", x: 21, y: 9}));
  enemies.push(buildCompany({type: "cavalry", quality: 4, side: "enemy", doctrine: "advance", name: "Imperial Cavalry", x: 21, y: 12}));
  enemies.push(buildCompany({type: "battlemage", quality: 3, side: "enemy", doctrine: "volley", name: "Imperial Battlemages", x: 21, y: 11}));
  if ( policy === "hoarder" ) {
    for ( const pc of pcs ) { pc.hoarder = true; }
  }
  return {scenario: {map, rounds: map.rounds, terrainAt: map.terrainAt, reinforcements: []}, units: [...pcs, captain, ...lathander, marshal, ...enemies], hooks: {}};
}
