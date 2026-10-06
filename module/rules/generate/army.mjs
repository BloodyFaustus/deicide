import {DEICIDE} from "../../config.mjs";
import {evaluate} from "../../core/expression.mjs";
import {hashString, pick, seededRng, weightedPick} from "../../core/random.mjs";
import {generateNpc} from "./npc.mjs";

const capitalize = text => text.charAt(0).toUpperCase() + text.slice(1);

export const OFFICER_LINES = [
  ["cadet", "captain", "warlord"],
  ["cadet", "battlemage", "magus"],
  ["cadet", "chaplain", "hierophant"],
  ["cadet", "captain", "spymaster"]
];

export const DEFAULT_DOCTRINE_MIX = {advance: 50, hold: 20, volley: 15, screen: 15};

export function companyCount(side, battleSize, tracks = {}) {
  const sizes = DEICIDE.generate.army.sizes;
  if ( battleSize in sizes ) return sizes[battleSize];
  const formula = side === "offweiss" ? DEICIDE.nationFormulas.offweissInvasionCompanies : DEICIDE.nationFormulas.companiesPerBattle;
  return Math.max(evaluate(formula, {soldiers: tracks.soldiers ?? 0, allies: tracks.allies ?? 0}), 1);
}

export function rollQuality(cap, rng) {
  const bell = DEICIDE.generate.army.qualityBell;
  const options = bell.map((weight, index) => [cap - (bell.length - 1 - index), weight]).filter(([quality]) => quality >= DEICIDE.company.quality.min);
  if ( !options.length ) return DEICIDE.company.quality.min;
  return Math.min(weightedPick(options, rng), DEICIDE.company.quality.max);
}

export function generateArmy(input, lookup) {
  const side = input.side === "lathander" ? "lathander" : "offweiss";
  const tracks = input.tracks ?? Object.fromEntries(Object.entries(DEICIDE.nationTracks).map(([id, track]) => [id, track[side]]));
  const seed = input.seed ?? 1;
  const rng = seededRng(typeof seed === "number" ? seed : hashString(String(seed)));
  const battleSize = ["skirmish", "battle", "invasion"].includes(input.battleSize) ? input.battleSize : "battle";
  const count = companyCount(side, battleSize, tracks);
  const qualityCap = evaluate(DEICIDE.nationFormulas.companyQualityCap, tracks);
  const mageCap = evaluate(DEICIDE.nationFormulas.battlemageQualityCap, tracks);
  const mix = DEICIDE.generate.army.mix[side];
  const doctrineMix = input.doctrineMix ?? DEFAULT_DOCTRINE_MIX;
  const army = DEICIDE.generate.army;

  const companies = [];
  for ( let i = 0; i < count; i++ ) {
    const type = weightedPick(mix, rng);
    let quality;
    if ( type === "legionary" ) quality = DEICIDE.companyTypes.legionary.quality;
    else if ( type === "battlemage" ) quality = rollQuality(Math.min(qualityCap, mageCap), rng);
    else quality = rollQuality(qualityCap, rng);
    const strength = input.chained ? army.chainedStrength[0] + Math.floor(rng() * (army.chainedStrength[1] - army.chainedStrength[0] + 1)) : DEICIDE.company.strength.max;
    const ranged = ["archer", "battlemage"].includes(type);
    const doctrine = ranged && (rng() < 0.7) ? "volley" : weightedPick(doctrineMix, rng);
    companies.push({id: `company${i + 1}`, name: `${capitalize(type)} ${i + 1}`, type, quality, strength, doctrine});
  }

  const reinforcementCount = Math.round(companies.length * army.reinforcementFraction);
  const reinforcements = [];
  if ( reinforcementCount > 0 ) {
    const late = companies.splice(companies.length - reinforcementCount, reinforcementCount);
    reinforcements.push({round: pick(army.reinforcementRounds, rng), edge: pick(army.edges, rng), companies: late});
  }

  const officers = [];
  const errors = [];
  const officerCount = Math.max(Math.floor(input.officers ?? 1), 0);
  for ( let i = 0; i < officerCount; i++ ) {
    const level = Math.max(1, (input.partyLevel ?? 1) + (i === 0 ? army.commanderLevelOffset : 0));
    const classLine = OFFICER_LINES[i % OFFICER_LINES.length];
    const result = generateNpc({
      level, classLine, people: input.people ?? "foreignHuman", profile: "enemy", faction: side, named: i === 0,
      seed: hashString(`${seed}:officer:${i}`), dials: input.dials, role: i === 0 ? "Commander of the army" : "Officer"
    }, lookup);
    errors.push(...result.errors);
    if ( result.actor ) officers.push({...result, commander: i === 0, classLine, level});
  }

  const grouped = groupCompanies(companies);
  const card = {
    map: {size: [24, 20], grid: "square", terrainRegions: [], fog: false},
    flags: {naval: false, arena: false},
    victory: {type: "rout", rounds: null, note: "Rout every enemy company."},
    defeat: "",
    deployment: {sheets: "N", swornSlots: "officers + 2", companySlots: "2 x soldiers"},
    enemy: {
      officers: officers.map(officer => ({classLine: officer.classLine, level: officer.level, profile: "enemy", name: officer.actor.name, activeClass: officer.actor.system.activeClass})),
      companies: grouped,
      reinforcements: reinforcements.map(entry => ({round: entry.round, edge: entry.edge, companies: groupCompanies(entry.companies)}))
    },
    intelligence: []
  };
  const name = input.name ?? `${capitalize(side)} ${battleSize}`;
  const text = `<p>Month ${input.warMonth ?? 1}. ${describeArmy(card, side)}</p>`;
  const scenario = {
    name, kind: "war", warMonth: input.warMonth ?? 1, difficulty: input.difficulty ?? "standard", card,
    payout: {tracks: {}, drops: [], dust: 0}, text
  };
  return {side, battleSize, qualityCap, companies, reinforcements, officers, card, scenario, errors, seed};
}

export function groupCompanies(companies) {
  const rows = [];
  for ( const company of companies ) {
    const row = rows.find(r => (r.type === company.type) && (r.quality === company.quality) && (r.strength === company.strength) && (r.doctrine === company.doctrine));
    if ( row ) row.count += 1;
    else rows.push({type: company.type, quality: company.quality, strength: company.strength, doctrine: company.doctrine, count: 1});
  }
  return rows;
}

export function describeArmy(card, side) {
  const parts = card.enemy.companies.map(row => `${row.count} ${row.type} ${row.count > 1 ? "companies" : "company"} at Quality ${row.quality}${row.strength < 100 ? ` and Strength ${row.strength}` : ""} on ${capitalize(row.doctrine)}`);
  const officers = card.enemy.officers.map(officer => `a level ${officer.level} ${capitalize(officer.activeClass ?? officer.classLine.at(-1))}${officer.name ? ` (${officer.name})` : ""}`);
  const late = card.enemy.reinforcements.map(entry => `${entry.companies.reduce((sum, row) => sum + row.count, 0)} arriving on round ${entry.round} from the ${entry.edge} edge`);
  return `Enemy (${capitalize(side)}): ${[...officers, ...parts].join(", ")}${late.length ? `, with ${late.join(" and ")}` : ""}.`;
}
