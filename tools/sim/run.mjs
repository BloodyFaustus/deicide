import {mkdirSync, writeFileSync} from "node:fs";
import {dirname, join} from "node:path";
import {fileURLToPath} from "node:url";
import {DEICIDE} from "../../module/config.mjs";
import {runWar} from "./war-sim.mjs";
import {runDungeon} from "./dungeon-sim.mjs";
import {ashfordMill, drownedFoundry, mireDrakeAlone, wrathH3, juggernautH4, invasionH8} from "./scenarios.mjs";
import {rederive} from "./world.mjs";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "out");
const argv = process.argv.slice(2);
const seedsArg = argv.indexOf("--seeds");
const SEEDS = seedsArg >= 0 ? Number(argv[seedsArg + 1]) : 100;
const onlyArg = argv.indexOf("--only");
const ONLY = onlyArg >= 0 ? argv[onlyArg + 1].split(",").map(Number) : null;
const QUIET = argv.includes("--quiet");

function percentile(values, p) {
  if ( !values.length ) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.round((p / 100) * (sorted.length - 1))));
  return sorted[index];
}

function stats(values) {
  const list = values.filter(v => typeof v === "number" && Number.isFinite(v));
  if ( !list.length ) return {mean: 0, p10: 0, p90: 0, n: 0};
  const mean = list.reduce((a, b) => a + b, 0) / list.length;
  return {mean: Math.round(mean * 100) / 100, p10: percentile(list, 10), p90: percentile(list, 90), n: list.length};
}

const rate = (results, predicate) => Math.round((results.filter(predicate).length / Math.max(results.length, 1)) * 100);

function warRun(label, build, {seedBase = 1000} = {}) {
  const results = [];
  for ( let seed = 1; seed <= SEEDS; seed++ ) {
    const {scenario, units, hooks} = build({seedBase: seedBase + seed * 10});
    results.push(runWar({scenario, units, seed: seedBase + seed, hooks}));
  }
  const flat = key => results.flatMap(r => r[key]);
  const summary = {
    label, seeds: SEEDS,
    rounds: stats(results.map(r => r.rounds)),
    outcomes: {held: rate(results, r => r.outcome === "held"), victory: rate(results, r => r.outcome === "victory"), defeat: rate(results, r => r.outcome === "defeat")},
    decisionsPerPhase: stats(flat("decisionsPerPhase")),
    tilesPerDecision: stats(flat("tilesPerDecision")),
    cardsPerPhase: stats(flat("cardsPerPhase")),
    noRadiusPerRound: stats(flat("noRadiusPerRound")),
    strengthPerPcPerRound: Object.fromEntries(Object.keys(results[0].strengthByPc).map(name => [name, stats(results.map(r => r.strengthByPc[name] / Math.max(r.rounds, 1)))])),
    stoneLancePerCast: stats(flat("stoneLance")),
    stoneLanceCasts: stats(results.map(r => r.stoneLance.length)),
    downedRate: rate(results, r => r.downed > 0),
    downedPerBattle: stats(results.map(r => r.downed)),
    partyHpPercent: stats(results.map(r => r.partyHpPercent)),
    enemyStrengthLeft: stats(results.map(r => r.enemyStrengthLeft)),
    resupplyDust: 0,
    anomalies: results.reduce((s, r) => s + r.anomalies, 0),
    reactions: results.reduce((acc, r) => { for ( const [k, v] of Object.entries(r.reactions) ) acc[k] = (acc[k] ?? 0) + v; return acc; }, {})
  };
  return {summary, results};
}

function dungeonRun(label, build, {seedBase = 2000, surprise = "none"} = {}) {
  const results = [];
  for ( let seed = 1; seed <= SEEDS; seed++ ) {
    const {party, enemies} = build({seedBase: seedBase + seed * 10});
    results.push(runDungeon({party, enemies: enemies(), seed: seedBase + seed, surprise, policies: {matterSurface: "stone"}}));
  }
  return {summary: dungeonSummary(label, results), results};
}

function dungeonSummary(label, results) {
  const names = Object.keys(results[0].damageBy);
  const byName = key => Object.fromEntries(names.map(name => [name, stats(results.map(r => r[key][name] ?? 0))]));
  return {
    label, seeds: results.length,
    outcomes: {victory: rate(results, r => r.outcome === "victory"), defeat: rate(results, r => r.outcome === "defeat"), timeout: rate(results, r => r.outcome === "timeout")},
    rotations: stats(results.map(r => r.rotations)),
    bossActions: stats(results.map(r => r.bossActions)),
    ticks: stats(results.map(r => r.ticksElapsed)),
    damageBy: byName("damageBy"),
    overcast: byName("overcast"),
    burn: byName("burn"),
    harvests: byName("harvests"),
    soulPriceHp: byName("soulPriceHp"),
    partyHpPercent: stats(results.map(r => r.partyHpPercent)),
    downedPerFight: stats(results.map(r => r.downed)),
    reactions: results.reduce((acc, r) => { for ( const [k, v] of Object.entries(r.reactions) ) acc[k] = (acc[k] ?? 0) + v; return acc; }, {}),
    dualStrikes: results.reduce((s, r) => s + r.dualStrikes, 0),
    anomalies: results.reduce((s, r) => s + r.anomalies, 0)
  };
}

function foundryRun() {
  const bossResults = [];
  const crawl = [];
  for ( let seed = 1; seed <= SEEDS; seed++ ) {
    const {party, floors} = drownedFoundry({seedBase: 3000 + seed * 10});
    let fights = 0;
    let outcome = "cleared";
    let bossMetrics = null;
    for ( const floor of floors ) {
      for ( const encounter of floor.encounters ) {
        for ( const member of party ) { member.downed = member.hp <= 0; }
        const alive = party.filter(m => !m.downed);
        if ( !alive.length ) break;
        const enemies = encounter.enemies();
        if ( encounter.warded ) for ( const e of enemies ) e.statuses.set("warded", {statusId: "warded", duration: null, pool: null, absorbed: 0, modifiers: [], flags: {}, expires: null});
        const metrics = runDungeon({party: alive, enemies, seed: 3000 + seed * 100 + fights, surprise: encounter.surprise, policies: {matterSurface: floor.surface}});
        fights++;
        if ( encounter.boss ) bossMetrics = metrics;
        if ( metrics.outcome !== "victory" ) { outcome = `lost at ${encounter.name}`; break; }

        for ( const member of party ) { member.statuses.clear(); rederive(member, "dungeon"); }
      }
      if ( outcome !== "cleared" ) break;
      if ( floor.shortRest ) {
        for ( const member of party ) {
          if ( member.downed ) continue;
          member.hp = Math.min(member.hp + Math.floor(member.hpMax * DEICIDE.rest.short.hp), member.hpMax);
          member.channel = Math.min(member.channel + Math.floor(member.channelMax * DEICIDE.rest.short.channel), member.channelMax);
        }
      }
      if ( floor.plagueRounds ) {
        for ( const member of party ) {
          if ( member.downed || member.derived?.immunities?.includes("plagueBurn") ) continue;
          member.hp = Math.max(member.hp - floor.plagueRounds * DEICIDE.terrain.plague.burnPerRound, 1);
        }
      }
    }
    crawl.push({seed, outcome, fights});
    if ( bossMetrics ) bossResults.push(bossMetrics);
  }
  const summary = bossResults.length ? dungeonSummary("Run 3: Drowned Foundry, Mire Drake after floors 1 and 2 at level 10", bossResults) : {label: "Run 3", seeds: 0};
  summary.crawl = {cleared: rate(crawl, c => c.outcome === "cleared"), reachedBoss: Math.round(bossResults.length / SEEDS * 100), lostAt: crawl.filter(c => c.outcome !== "cleared").reduce((acc, c) => { acc[c.outcome] = (acc[c.outcome] ?? 0) + 1; return acc; }, {})};
  return {summary, results: bossResults};
}

function juggernautRun() {
  const volleys = [];
  const mercerActions = [];
  const knightWins = [];
  for ( let seed = 1; seed <= SEEDS; seed++ ) {
    const h4 = juggernautH4({seedBase: 6000 + seed * 10});

    const units = h4.warUnits();
    const knight = units[0];
    const hpBefore = knight.hp;
    const metrics = runWar({scenario: {map: h4.map, rounds: 3, terrainAt: h4.map.terrainAt, reinforcements: []}, units, seed: 6000 + seed});
    const taken = hpBefore - Math.max(knight.hp, 0);
    const volleyCount = 3 * 3;
    volleys.push(taken / volleyCount);
    void metrics;

    const duelKnight = h4.knight();
    duelKnight.row = "front";
    const mercer = h4.mercer();
    const duel = runDungeon({party: [mercer], enemies: [duelKnight], seed: 6500 + seed, policies: {matterSurface: "stone", keepHealerBack: false}});
    mercerActions.push(duel.partyActions.Mercer ?? 0);
    knightWins.push(duel.outcome === "defeat" ? 1 : 0);
  }
  return {summary: {
    label: "Run 6: Great Knight Juggernaut at 30 (H4)", seeds: SEEDS,
    damagePerVolleyToKnight: stats(volleys), mercerActionsToDownKnight: stats(mercerActions), knightBeatsMercerRate: Math.round(knightWins.reduce((a, b) => a + b, 0) / SEEDS * 100)
  }, results: volleys.map((v, i) => ({seed: i + 1, damagePerVolley: v, mercerActions: mercerActions[i]}))};
}

function verdicts(runs) {
  const lines = [];
  const check = (ok, text, fix) => lines.push({ok, text, fix});
  const r1 = runs[1]?.summary;
  if ( r1 ) {
    check(r1.decisionsPerPhase.mean < 12, `Run 1 enemy phase decisions mean ${r1.decisionsPerPhase.mean} (band under 12)`, "Fewer enemy companies on the card, or Screen doctrine groups.");
    check(r1.cardsPerPhase.mean < 40, `Run 1 cards per phase mean ${r1.cardsPerPhase.mean} (band under 40)`, "Resolve company volleys as one card per company.");
    check(r1.stoneLancePerCast.mean >= 30, `Run 1 Stone Lance Strength per cast mean ${r1.stoneLancePerCast.mean} (band 30 or more, ${r1.stoneLanceCasts.mean} casts per battle)`, "Raise siegeAlchemistStoneLance Might (config: docs/03 M8) or the alchemy versus company multiplier.");
    check(r1.downedRate >= 20, `Run 1 seeds with a PC Downed ${r1.downedRate} percent (band 20 or more)`, "Raise the enemy officer's level or Might (scenario: level 6 Captain).");
  }
  const r3 = runs[3]?.summary;
  if ( r3?.rotations ) {
    check((r3.rotations.p10 >= 6) && (r3.rotations.p90 <= 8), `Run 3 boss rotations p10 ${r3.rotations.p10}, p90 ${r3.rotations.p90} (band 6 to 8 in the middle 80 percent)`, "Mire Drake HP 320 (docs/07) up or down by 40 per rotation outside the band.");
    check((r3.partyHpPercent.mean >= 50) && (r3.partyHpPercent.mean <= 70), `Run 3 party HP at the end mean ${r3.partyHpPercent.mean} percent (band 50 to 70)`, "Mire Drake Tail M34 and Bog Breath M26 (docs/07).");
  }
  const r5 = runs[5]?.summary;
  if ( r5 ) check((r5.outcomes.victory >= 40) && (r5.outcomes.victory <= 60), `Run 5 Assassin win rate ${r5.outcomes.victory} percent (band 40 to 60)`, "Wrath HP 450 or Rend M34 (docs/03), or the Vantage trigger threshold.");
  const r6 = runs[6]?.summary;
  if ( r6 ) {
    check(Math.abs(r6.damagePerVolleyToKnight.mean - 1) <= 1, `Run 6 damage per Quality 5 volley to the Great Knight mean ${r6.damagePerVolleyToKnight.mean} (expected about 1)`, "Company atkVsCharacter formula (config/strategic) or Royal Heavy DEF.");
    check(Math.abs(r6.mercerActionsToDownKnight.mean - 4) <= 1.5, `Run 6 Mercer actions to down the knight mean ${r6.mercerActionsToDownKnight.mean} (expected about 4)`, "Deconstruction M14 or the Truth student multiplier.");
  }
  const r7 = runs[7]?.summary;
  const r71 = runs[71]?.summary;
  if ( r7 && r71 ) {
    check(true, `Run 7 spender party: ${r7.outcomes.victory} percent victory, enemy Strength left ${r7.enemyStrengthLeft.mean}, party HP ${r7.partyHpPercent.mean} percent. Hoarder party: ${r71.outcomes.victory} percent victory, enemy Strength left ${r71.enemyStrengthLeft.mean}, party HP ${r71.partyHpPercent.mean} percent (reported, no band)`, "");
  }
  const r2 = runs[2]?.summary;
  if ( r2 ) check(true, `Run 2 Hard: ${r2.outcomes.victory} percent victory, ${r2.outcomes.held} percent held, ${r2.outcomes.defeat} percent defeat, PC Downed in ${r2.downedRate} percent of seeds (reported, no band)`, "");
  for ( const [key, level] of [[4, 8], [41, 10], [42, 12]] ) {
    const r4 = runs[key]?.summary;
    if ( r4 ) check(true, `Run 4 Mire Drake alone at level ${level}: ${r4.outcomes.victory} percent victory, rotations ${r4.rotations.mean}, party HP ${r4.partyHpPercent.mean} percent (reported, no band)`, "");
  }
  const anomalies = Object.values(runs).reduce((s, r) => s + (r.summary.anomalies ?? 0), 0);
  check(anomalies === 0, `Tick queue anomalies across every run: ${anomalies} (must be 0)`, "rules/delay.mjs ordering.");
  return lines;
}

const fmt = s => (s && typeof s === "object" && "mean" in s) ? `${s.mean} (p10 ${s.p10}, p90 ${s.p90})` : (s && typeof s === "object") ? JSON.stringify(s) : String(s);

function reportMarkdown(runs, lines) {
  const out = [`# Simulation report (${new Date().toISOString().slice(0, 10)}, ${SEEDS} seeds per run)`, "", "The simulation reports. ISSUES proposes. V decides. Numbers are mean (10th percentile, 90th percentile).", ""];
  out.push("## Bands", "", "| Verdict | Check | If out of band |", "|---|---|---|");
  for ( const line of lines ) out.push(`| ${line.ok ? "in band" : "OUT OF BAND"} | ${line.text} | ${line.ok ? "" : line.fix} |`);
  out.push("");
  for ( const [n, run] of Object.entries(runs) ) {
    const s = run.summary;
    out.push(`## ${s.label}`, "");
    out.push("| Metric | Value |", "|---|---|");
    for ( const [key, value] of Object.entries(s) ) {
      if ( ["label", "seeds"].includes(key) ) continue;
      if ( value && typeof value === "object" && !("mean" in value) ) {
        for ( const [k2, v2] of Object.entries(value) ) out.push(`| ${key}.${k2} | ${fmt(v2)} |`);
      }
      else out.push(`| ${key} | ${fmt(value)} |`);
    }
    out.push("");
    void n;
  }
  return out.join("\n");
}

const runs = {};
const want = n => !ONLY || ONLY.includes(n);
const time = (label, fn) => { const t0 = Date.now(); const result = fn(); if ( !QUIET ) console.log(`${label}: ${Math.round((Date.now() - t0) / 1000)}s`); return result; };

if ( want(1) ) runs[1] = time("run 1", () => warRun("Run 1: Ford at Ashford Mill at party level 5, Irena Sworn", () => ashfordMill({level: 5})));
if ( want(2) ) runs[2] = time("run 2", () => warRun("Run 2: Ford at Ashford Mill, Hard", () => ashfordMill({level: 5, difficulty: "hard"}), {seedBase: 1500}));
if ( want(3) ) runs[3] = time("run 3", foundryRun);
if ( want(4) ) {
  for ( const [index, level] of [[4, 8], [41, 10], [42, 12]] ) {
    runs[index] = time(`run 4 level ${level}`, () => dungeonRun(`Run 4: Mire Drake alone at party level ${level} (${level === 8 ? "Deadly" : level === 10 ? "Standard" : "Easy"})`, ({seedBase}) => mireDrakeAlone({level, seedBase}), {seedBase: 4000 + level * 100}));
  }
}
if ( want(5) ) runs[5] = time("run 5", () => dungeonRun("Run 5: Wrath at 20 against the Vantage Assassin (H3)", ({seedBase}) => wrathH3({seedBase}), {seedBase: 5000}));
if ( want(6) ) runs[6] = time("run 6", juggernautRun);
if ( want(7) ) {
  runs[7] = time("run 7 spender", () => warRun("Run 7: invasion battle at 28, spender party (H8)", ({seedBase}) => invasionH8({seedBase, policy: "spender"}), {seedBase: 7000}));
  runs[71] = time("run 7 hoarder", () => warRun("Run 7: invasion battle at 28, hoarder party (H8)", ({seedBase}) => invasionH8({seedBase, policy: "hoarder"}), {seedBase: 7500}));
}

mkdirSync(OUT, {recursive: true});
for ( const [n, run] of Object.entries(runs) ) writeFileSync(join(OUT, `run-${n}.json`), JSON.stringify(run, null, 1), "utf8");
const lines = verdicts(runs);
const markdown = reportMarkdown(runs, lines);
writeFileSync(join(OUT, "REPORT.md"), `${markdown}\n`, "utf8");
if ( !QUIET ) {
  for ( const line of lines ) console.log(`${line.ok ? "ok " : "OUT"} ${line.text}`);
  console.log(`Report: ${join(OUT, "REPORT.md")}`);
}
