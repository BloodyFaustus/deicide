import {DEICIDE} from "../../config.mjs";
import {evaluate} from "../../core/expression.mjs";
import {displayMultiplier, encounterAwards, enemyCount, pacingMultiplier} from "../pacing.mjs";

export function benchmarkRowIndex(level) {
  let index = 0;
  DEICIDE.benchmarks.forEach((row, i) => { if ( level >= row.level ) index = i; });
  return index;
}

export function planEncounter({N = DEICIDE.pacing.defaults.N, S = DEICIDE.pacing.defaults.S, L = DEICIDE.pacing.defaults.L, partyLevel = 1, difficulty = "standard", kind = "dungeonFight", enemyTier = 1} = {}) {
  const diff = DEICIDE.difficulty[difficulty] ?? DEICIDE.difficulty.standard;
  const dials = {S, L};
  const P = pacingMultiplier(dials);
  const enemyLevel = Math.max(1, Math.min(partyLevel + diff.levelOffset, 30));
  const count = enemyCount(N, difficulty);
  const altCount = diff.altCountMultiplier ? Math.ceil(N * diff.altCountMultiplier) : null;
  const standardRow = DEICIDE.benchmarks[benchmarkRowIndex(enemyLevel)];
  const partyRow = benchmarkRowIndex(partyLevel);
  const bossRow = DEICIDE.benchmarks[Math.min(partyRow + (DEICIDE.bossDifficultyRows[difficulty] ?? 0), DEICIDE.benchmarks.length - 1)];
  const bossScale = evaluate(DEICIDE.enemyFormulas.bossHpScale, {N});
  const standardDef = evaluate(DEICIDE.enemyFormulas.standardDef, {level: enemyLevel});
  const bossLevel = Math.max(bossRow.level, enemyLevel);
  const bossDef = evaluate(DEICIDE.enemyFormulas.bossDef, {level: bossLevel});
  const awards = encounterAwards({kind, level: partyLevel, enemyTier, difficulty, dials});
  return {
    N, S, L, P, displayP: displayMultiplier(dials), partyLevel, difficulty, kind, enemyTier,
    enemyLevel, count, altCount,
    standard: {
      row: standardRow.level, hp: standardRow.stdHp, def: standardDef, res: evaluate(DEICIDE.enemyFormulas.res, {def: standardDef}),
      might: standardRow.stdMight, hit: evaluate(DEICIDE.enemyFormulas.monsterHit, {level: enemyLevel})
    },
    boss: {
      row: bossRow.level, level: bossLevel, hp: Math.round(bossRow.bossHp * bossScale), hpBase: bossRow.bossHp, scale: bossScale,
      def: bossDef, res: evaluate(DEICIDE.enemyFormulas.res, {def: bossDef}),
      single: bossRow.bossSingle, area: bossRow.bossArea, hit: evaluate(DEICIDE.enemyFormulas.monsterHit, {level: bossLevel})
    },
    companyQ: standardRow.companyQ,
    awards
  };
}

export function benchmarkMonsters(plan, {boss = false, count = null} = {}) {
  const spdFor = level => evaluate(DEICIDE.generate.benchmarkMonster.spd, {level});
  const move = (id, name, might, area, note = "") => ({
    name, type: "ability", img: "icons/svg/sword.svg",
    system: {
      identifier: id, type: "action", source: {kind: "monster", id: "benchmark", rank: null}, description: `<p>M${might} ${area}.</p>`, summary: `M${might} ${area}`,
      tags: [], direct: false, trigger: "", usage: {limit: null, per: null, used: 0}, cost: {channel: 0, matter: 0, hp: 0, dust: 0, soulPrice: 0}, weight: null,
      attack: {basis: "flat", source: "none", defense: "def", might, element: null, hit: 0, crit: 0, weaponLines: [], strikes: 1, ignoreDef: 0, bonuses: [], ignoreAvoid: false, perTile: null},
      heal: null, war: {range: [1, 1], area: area === "row" ? {shape: "blast", size: 1} : {shape: "single", size: 1}, target: "enemy", movement: null, terrain: false},
      dungeon: {target: area, note}, statuses: [], modifiers: [], roll: null, art: null, effects: [], reaction: null, command: null, stance: null, coverage: [], automation: "full"
    }
  });
  const base = (name, level, hp, def, res, moves, extra = {}) => ({
    name, type: "monster", img: "icons/svg/skull.svg",
    system: {
      identifier: "", level, hp: {value: hp, max: hp}, def, res, spd: spdFor(level), mag: 0, skl: 0,
      delay: {mode: "spd", value: 30}, hitBase: null, tags: ["benchmark"], boss: false, divineBeing: false, weakness: null, resistance: null,
      immunities: [], phaseBreaks: [], yield: {saturation: 0, dust: 0, drops: [], divineAttention: 0}, row: "front", description: "<p>Benchmark monster from the Encounter tool.</p>", notes: "",
      ...extra
    },
    items: moves, effects: [],
    prototypeToken: {name, disposition: -1, actorLink: false, texture: {src: "icons/svg/skull.svg"}},
    flags: {deicide: {generated: {kind: "benchmark", plan: {partyLevel: plan.partyLevel, difficulty: plan.difficulty, N: plan.N}}}}
  });
  if ( boss ) {
    const b = plan.boss;
    return [base(`Benchmark Boss ${b.level}`, b.level, b.hp, b.def, b.res, [
      move("benchmarkSmite", "Smite", b.single, "single"),
      move("benchmarkWave", "Wave", b.area, "row")
    ], {boss: true, tags: ["benchmark", "boss"], delay: {mode: "fixed", value: 30}, phaseBreaks: [{percent: 50, note: "Phase break: the boss gains its listed move.", triggered: false}]})];
  }
  const s = plan.standard;
  const n = count ?? plan.count[0];
  const out = [];
  for ( let i = 0; i < n; i++ ) {
    out.push(base(`Benchmark Enemy ${plan.enemyLevel} (${i + 1})`, plan.enemyLevel, s.hp, s.def, s.res, [
      move("benchmarkStrike", "Strike", s.might, "single"),
      move("benchmarkSweep", "Sweep", Math.max(s.might - DEICIDE.generate.benchmarkMonster.sweepMightMinus, 1), "row")
    ]));
  }
  return out;
}

export function sessionLine(plan) {
  const a = plan.awards;
  return `${plan.kind} at level ${plan.partyLevel}, ${plan.difficulty}, N ${plan.N}, P ${plan.displayP.toFixed(2)}: enemies level ${plan.enemyLevel}, ${plan.count[0]} to ${plan.count[1]}${plan.altCount ? ` (or ${plan.altCount} at party level)` : ""}, boss HP ${plan.boss.hp}. Awards per sheet: ${a.xp} XP, ${a.cp} CP, ${a.dust} Dust.`;
}
