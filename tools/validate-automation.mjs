import {readSources} from "./lib/sources.mjs";
import {gradeAutomation} from "./lib/automation.mjs";

export const MANUAL_LIMIT = 40;

export function validateAutomation() {
  const classes = new Map(readSources("classes").map(doc => [doc.system.identifier, doc.system]));
  const abilities = readSources("abilities").map(doc => {
    const system = doc.system;
    const source = system.source ?? {};
    const classData = source.kind === "class" ? classes.get(source.id) : null;
    const tier = classData?.tier ?? (source.kind === "pin" ? "pin" : source.kind === "origin" ? "origin" : source.kind === "art" ? "art" : "other");
    const grade = gradeAutomation(system);
    return {id: system.identifier, name: doc.name, type: system.type, tier, stored: system.automation, ...grade, enemyOnly: Boolean(classData?.enemyOnly)};
  });
  const byTier = {};
  for ( const ability of abilities ) {
    const bucket = byTier[ability.tier] ??= {full: 0, partial: 0, manual: 0, total: 0};
    bucket[ability.automation]++;
    bucket.total++;
  }
  const manual = abilities.filter(ability => ability.automation === "manual");
  const mismatched = abilities.filter(ability => ability.stored !== ability.automation);
  const tierFailures = manual.filter(ability => [1, 2].includes(ability.tier) && !ability.enemyOnly);
  return {abilities, byTier, manual, mismatched, tierFailures};
}

const argv = process.argv.slice(2);
const tierArg = argv.indexOf("--tier");
const listTier = tierArg >= 0 ? argv[tierArg + 1] : null;
const report = validateAutomation();

console.log("Automation by tier (full / partial / manual of total)");
for ( const [tier, bucket] of Object.entries(report.byTier).sort() ) {
  console.log(`  tier ${tier}: ${bucket.full} / ${bucket.partial} / ${bucket.manual} of ${bucket.total}`);
}
const totals = report.abilities.reduce((sum, a) => { sum[a.automation]++; return sum; }, {full: 0, partial: 0, manual: 0});
console.log(`  all: ${totals.full} full, ${totals.partial} partial, ${totals.manual} manual of ${report.abilities.length}`);

const show = list => {
  for ( const ability of list ) {
    console.log(`  [${ability.automation}] ${ability.id} (${ability.type}, tier ${ability.tier}): ${ability.uncovered.map(c => `"${c}"`).join(", ") || "all clauses covered"}`);
  }
};
if ( listTier ) show(report.abilities.filter(a => String(a.tier) === String(listTier) && a.automation !== "full"));
if ( argv.includes("--list") ) show(report.manual);
if ( argv.includes("--all") ) show(report.abilities.filter(a => a.automation !== "full"));

let failed = false;
if ( report.mismatched.length ) {
  failed = true;
  console.log(`${report.mismatched.length} stored grade(s) differ from the recomputed grade. Run npm run import:docs -- --force.`);
  for ( const ability of report.mismatched.slice(0, 10) ) console.log(`  ${ability.id}: stored ${ability.stored}, computed ${ability.automation}`);
}
if ( report.tierFailures.length ) {
  failed = true;
  console.log(`${report.tierFailures.length} Tier 1 or Tier 2 abilities are manual:`);
  show(report.tierFailures);
}
if ( totals.manual >= MANUAL_LIMIT ) {
  failed = true;
  console.log(`${totals.manual} manual abilities overall, the limit is under ${MANUAL_LIMIT}.`);
}
if ( process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/").split("/").pop()) ) {
  process.exit(failed ? 1 : 0);
}
