import {readFileSync, readdirSync, existsSync} from "node:fs";
import {join} from "node:path";
import {pathToFileURL} from "node:url";
import {DEICIDE} from "../module/config.mjs";
import {ROOT, camelId, pascalId, stableId, writeSource} from "./lib/sources.mjs";
import {sections, tables, findSection} from "./lib/markdown.mjs";
import {gradeAutomation} from "./lib/automation.mjs";
import {peoples, backgrounds, talents, originAbilities} from "./content/origins.mjs";
import {classOverrides, abilityOverrides, enemyClasses} from "./content/overrides.mjs";

const automationData = {};
const automationDir = join(ROOT, "tools", "content", "automation");
if ( existsSync(automationDir) ) {
  for ( const file of readdirSync(automationDir).filter(name => name.endsWith(".mjs")).sort() ) {
    const module = await import(pathToFileURL(join(automationDir, file)).href);
    for ( const [id, data] of Object.entries(module.default ?? {}) ) {
      if ( automationData[id] ) console.warn(`Automation data for ${id} appears twice (${file})`);
      automationData[id] = data;
    }
  }
}
export const automationIds = new Set(Object.keys(automationData));

const force = process.argv.includes("--force");
const ATTRS = DEICIDE.attributeIds;
const ICONS = {
  class: "icons/svg/book.svg",
  action: "icons/svg/sword.svg",
  reaction: "icons/svg/shield.svg",
  support: "icons/svg/upgrade.svg",
  command: "icons/svg/sound.svg",
  stance: "icons/svg/statue.svg",
  mastery: "icons/svg/aura.svg",
  people: "icons/svg/mystery-man.svg",
  background: "icons/svg/village.svg",
  talent: "icons/svg/light.svg",
  pin: "icons/svg/item-bag.svg"
};

const report = {classes: 0, abilities: 0, origins: 0, pins: 0, written: 0, skipped: 0, scaled: [], automation: {full: 0, partial: 0, manual: 0}};

const titleCaseToId = text => camelId(text);

function deepMerge(target, source) {
  for ( const [key, value] of Object.entries(source ?? {}) ) {
    if ( value && (typeof value === "object") && !Array.isArray(value) && target[key] && (typeof target[key] === "object") && !Array.isArray(target[key]) ) {
      deepMerge(target[key], value);
    }
    else target[key] = value;
  }
  return target;
}

function document(type, identifier, name, system, img) {
  return {
    _id: stableId(type, identifier),
    name,
    type,
    img,
    system: {...system, identifier},
    effects: [],
    folder: null,
    sort: 0,
    ownership: {default: 0},
    flags: {}
  };
}

function write(folder, doc) {
  if ( writeSource(folder, doc, {force}) ) report.written++;
  else report.skipped++;
}

const PROF_WORDS = Object.fromEntries(Object.keys(DEICIDE.proficiencies).map(id => [id, id]));

function parseTrains(text) {
  const [primary = "", secondary = ""] = text.split("/");
  const read = part => part.split(",").map(word => word.replace(/\(.*?\)/g, "").trim().toLowerCase()).filter(Boolean)
    .map(word => (word === "chosen weapon") ? "chosenWeapon" : (PROF_WORDS[word] ?? null))
    .filter(Boolean);
  return {primary: read(primary), secondary: read(secondary)};
}

function parseGrowth(text) {
  const letters = text.trim().split(/\s+/);
  if ( letters.length !== ATTRS.length ) return {};
  return Object.fromEntries(ATTRS.map((attr, index) => [attr, letters[index]]));
}

function parseSpread(text) {
  const spread = {};
  for ( const match of text.matchAll(/\b(STR|MAG|SKL|SPD|DEF|RES|CMD) (\d+)/g) ) spread[match[1].toLowerCase()] = Number(match[2]);
  return spread;
}

function parsePrerequisites(text) {
  const clean = text.replace(/\(.*?\)/g, "").trim();
  if ( !clean ) return null;
  const leaf = part => {
    const match = /^(any weapon|[A-Za-z]+) ([EDCBAS])$/.exec(part.trim());
    if ( !match ) return null;
    const word = match[1].toLowerCase();
    const prof = (word === "any weapon") ? "anyWeapon" : PROF_WORDS[word];
    return prof ? {prof, grade: match[2]} : null;
  };
  const all = [];
  for ( const part of clean.split(",") ) {
    const options = part.split(/\bor\b/).map(leaf);
    if ( options.some(option => !option) ) return {unparsed: clean};
    all.push(options.length === 1 ? options[0] : {any: options});
  }
  return {all};
}

function classDocument(row, tier, kind) {
  const name = row.Class;
  const identifier = titleCaseToId(name);
  const trainsText = row.Trains ?? "";
  const trains = parseTrains(trainsText);
  const prerequisites = (tier === 1) ? null : parsePrerequisites(row.Requires ?? "");
  const growth = parseGrowth(row.Growth ?? "");
  const system = {
    tier,
    types: (row.Type ?? "").split(",").map(word => word.trim().toLowerCase()).filter(word => word in DEICIDE.classTypes),
    growth,
    hp: Number(row.HP) || 0,
    trains,
    trainsText,
    startSpread: tier === 1 ? parseSpread(row["Start spread"] ?? "") : {},
    prerequisites: prerequisites?.unparsed ? null : prerequisites,
    prerequisiteText: row.Requires ?? row.Gate ?? "",
    storyGate: (tier === 4) ? "storyGate" : "",
    skills: [],
    move: null,
    affinities: [],
    enemyOnly: kind === "enemy",
    layered: false,
    grantsFullTruth: false,
    choices: trains.primary.includes("chosenWeapon") || trains.secondary.includes("chosenWeapon") ? ["weapon"] : [],
    kit: {},
    description: ""
  };
  if ( prerequisites?.unparsed && !classOverrides[identifier]?.prerequisites ) {
    console.warn(`Prerequisite text not parsed for ${name}: "${prerequisites.unparsed}"`);
  }
  const total = ATTRS.reduce((sum, attr) => sum + (DEICIDE.growthTenths[growth[attr]] ?? 0), 0);
  const tierTotal = DEICIDE.tierGrowthTenths[tier];
  if ( Object.keys(growth).length && (total !== tierTotal) ) report.scaled.push({id: identifier, printed: total, tierTotal});
  deepMerge(system, classOverrides[identifier] ?? {});
  return document("class", identifier, name, system, ICONS.class);
}

const CELL = /^([^[:]+?)\s*(?:\[(Action|Reaction|Support|Command|Stance)\])?\s*(DIRECT)?\s*:\s*(.*)$/s;
const LINES = DEICIDE.martialLines;
const ELEMENT_IDS = Object.keys(DEICIDE.elements);
const CLASS_TYPE_WORDS = {
  armored: "armored", mounted: "mounted", flying: "flying", caster: "caster", casters: "caster", officer: "officer",
  infantry: "infantry", naval: "naval", monster: "monster"
};

function splitCell(cell) {
  const match = CELL.exec(cell.trim());
  if ( !match ) return null;
  return {name: match[1].trim(), type: match[2] ? match[2].toLowerCase() : null, direct: Boolean(match[3]), text: match[4].trim()};
}

const clauses = text => text.split(/,\s*|\.\s+/).map(clause => clause.trim().replace(/\.$/, "")).filter(Boolean);

const MODIFIER_PATTERNS = [
  [/^(DEF|RES) \+(\d+)$/i, m => [{key: `defense.${m[1].toLowerCase()}`, value: +m[2]}]],
  [/^(DEF|RES) minus (\d+)$/i, m => [{key: `defense.${m[1].toLowerCase()}`, value: -m[2]}]],
  [/^(STR|MAG|SKL|SPD|CMD) \+(\d+)$/i, m => [{key: `attributes.${m[1].toLowerCase()}`, value: +m[2]}]],
  [/^(STR|MAG|SKL|SPD|CMD) minus (\d+)$/i, m => [{key: `attributes.${m[1].toLowerCase()}`, value: -m[2]}]],
  [/^Delay \+(\d+)$/i, m => [{key: "delay", value: +m[1]}]],
  [/^Delay minus (\d+)$/i, m => [{key: "delay", value: -m[1]}]],
  [/^Move \+(\d+)$/i, m => [{key: "move", value: +m[1]}]],
  [/^Move \+(\d+) in War$/i, m => [{key: "move", value: +m[1], when: {engine: "war"}}]],
  [/^Move (\d+)$/i, m => [{key: "move", op: "set", value: +m[1]}]],
  [/^Hit \+(\d+)$/i, m => [{key: "hit", value: +m[1]}]],
  [/^Avoid \+(\d+)$/i, m => [{key: "avoid", value: +m[1]}]],
  [/^crit \+(\d+)$/i, m => [{key: "crit", value: +m[1]}]],
  [/^Channel \+(\d+)$/i, m => [{key: "channel.max", value: +m[1]}]],
  [/^Channel \+MAG\/(\d+)$/i, m => [{key: "channel.max", value: `floor(mag / ${m[1]})`}]],
  [/^Channel x(\d+(?:\.\d+)?)$/i, m => [{key: "channel.max", op: "mul", value: +m[1], stage: "final"}]],
  [/^command radius \+(\d+)$/i, m => [{key: "commandRadius", value: +m[1]}]],
  [/^HP \+(\d+)$/i, m => [{key: "hp.max", value: +m[1]}]],
  [/^HP \+(\d+) per level$/i, m => [{key: "hp.perLevel", value: +m[1]}]],
  [/^Matter capacity \+(\d+)$/i, m => [{key: "matter.max", value: +m[1]}]],
  [/^Might \+(\d+)$/i, m => [{key: "might", value: +m[1]}]],
  [/^Harvest yields (\d+)$/i, m => [{key: "harvest.yield", op: "max", value: +m[1]}]],
  [/^crit multiplier (\d+(?:\.\d+)?)$/i, m => [{key: "critMultiplier", op: "set", value: +m[1]}]],
  [/^(\w+) secondary trains at primary pace$/i, m => PROF_WORDS[m[1].toLowerCase()] ? [{key: `proficiency.pace.${m[1].toLowerCase()}`, value: 1}] : null],
  [/^(bow|gun) crit \+(\d+)$/i, m => [{key: "crit", value: +m[2], when: {actionWeaponLine: m[1]}}]],
  [/^Soul Prices halved$/i, () => [{key: "soulPrice.multiplier", op: "set", value: 0.5}]],
  [/^retroactive$/i, () => []],
  [/^once per (encounter|battle|round|session|campaign|dungeon)$/i, () => []]
];

function parsePassive(text) {
  const modifiers = [];
  let matched = 0;
  let total = 0;
  for ( const clause of clauses(text) ) {
    total++;
    let hit = false;
    for ( const [pattern, build] of MODIFIER_PATTERNS ) {
      const match = pattern.exec(clause);
      if ( !match ) continue;
      const result = build(match);
      if ( result === null ) continue;
      modifiers.push(...result);
      hit = true;
      break;
    }
    if ( hit ) matched++;
  }
  const automation = !total ? "manual" : (matched === total) ? "full" : matched ? "partial" : "manual";
  return {modifiers, automation};
}

function parseUsage(text) {
  const match = /once per (encounter|battle|round|session|campaign|dungeon)/i.exec(text);
  return match ? {limit: 1, per: match[1].toLowerCase()} : {limit: null, per: null};
}

function parseCosts(text, type) {
  const cost = {channel: 0, matter: 0, hp: 0, dust: 0, soulPrice: 0};
  let match;
  if ( (match = /(\d+) Ch\b/.exec(text)) ) cost.channel = +match[1];
  if ( (match = /(\d+) Mt\b(?! to)/.exec(text)) ) cost.matter = +match[1];
  if ( (match = /\bSP (\d+)/.exec(text)) ) cost.soulPrice = +match[1];
  if ( (match = /costs? (\d+) HP/.exec(text)) ) cost.hp = +match[1];
  if ( (type === "action") && (match = /(?:^|, )(\d+) Dust\b/.exec(text)) && !/steals|to \d+ Dust|yields/.test(text) ) cost.dust = +match[1];
  return cost;
}

function schoolFor(classData) {
  for ( const prof of [...(classData.trains?.primary ?? []), ...(classData.trains?.secondary ?? [])] ) {
    if ( ["reason", "faith", "void"].includes(prof) ) return prof;
  }
  return "reason";
}

function parseAttack(text, {direct, classData, cost}) {
  const parts = clauses(text);
  const index = parts.findIndex(clause => /\bM(\d+)\b/.test(clause));
  if ( index < 0 ) return null;
  const clause = parts[index];
  const lower = clause.toLowerCase();
  const might = Number(/\bM(\d+)\b/.exec(clause)[1]);
  const weaponLines = LINES.filter(line => new RegExp(`\\b${line}\\b`).test(lower));
  const element = ELEMENT_IDS.find(id => new RegExp(`\\b${id}\\b`).test(lower)) ?? null;
  const attack = {basis: "str", source: "weapon", defense: "def", might, element: null, hit: 0, crit: 0,
    weaponLines, strikes: 1, ignoreDef: 0, bonuses: []};

  if ( direct || (element === "truth") ) Object.assign(attack, {basis: "mag", source: "alchemy", defense: "none", element: "truth"});
  else if ( /\bhybrid\b/.test(lower) ) Object.assign(attack, {basis: "hybrid", source: "weapon", defense: "lower", element});
  else if ( /\bship\b/.test(lower) ) Object.assign(attack, {basis: "flat", source: "none", defense: "def"});
  else if ( /\bmag\b/.test(lower) || (!weaponLines.length && !/\bstr\b/.test(lower) && (element || cost.channel) && !cost.matter) ) {
    const alchemy = /physical/.test(lower) || cost.matter > 0;
    Object.assign(attack, {basis: "mag", source: alchemy ? "alchemy" : "spell", defense: alchemy ? "def" : "res", element});
    if ( alchemy && element && (DEICIDE.elements[element]?.natural) ) attack.defense = "res";
  }
  else if ( cost.matter > 0 && /physical/.test(lower) ) Object.assign(attack, {basis: "mag", source: "alchemy", defense: "def", element});
  else attack.element = element;

  let match;
  if ( (match = /crit \+(\d+)/.exec(text)) ) attack.crit = +match[1];
  if ( (match = /ignores (\d+) DEF/.exec(text)) ) attack.ignoreDef = +match[1];
  if ( /\btwice\b/.test(lower) ) attack.strikes = 2;
  if ( /ignores Avoid/.test(text) ) attack.ignoreAvoid = true;
  if ( /ignores terrain/.test(text) ) attack.ignoreTerrainAvoid = true;
  if ( /auto crit from flank/.test(text) ) attack.autoCritWhen = {flank: true};
  for ( const bonus of text.matchAll(/\+(\d+)(?: Might)? vs ([A-Za-z ]+?)(?:,|$|\.)/g) ) {
    const words = bonus[2].toLowerCase().split(/ and | or /).map(word => word.trim());
    if ( words.includes("companies") ) attack.bonuses.push({when: {targetKind: "company"}, might: +bonus[1]});
    else if ( words.includes("summoned") ) attack.bonuses.push({when: {targetTag: "summoned"}, might: +bonus[1]});
    else if ( words.includes("naval") ) attack.bonuses.push({when: {targetClassType: "naval"}, might: +bonus[1]});
    else {
      const types = words.map(word => CLASS_TYPE_WORDS[word]).filter(Boolean);
      if ( types.length ) attack.bonuses.push({when: {targetClassType: types}, might: +bonus[1]});
    }
  }
  if ( (match = /Officer tag \+(\d+)/.exec(text)) ) {
    attack.bonuses.push({when: {targetClassType: "officer", flankOrBackRow: true}, might: +match[1] - 6});
  }
  for ( const mult of text.matchAll(/x2 vs ([A-Za-z]+)/g) ) {
    const type = CLASS_TYPE_WORDS[mult[1].toLowerCase()];
    if ( type ) attack.effectiveVs = type;
    else if ( mult[1].toLowerCase() === "summoned" ) attack.multiplierVs = {targetTag: "summoned", value: 2};
  }
  return attack;
}

function parseHeal(text) {
  let match;
  if ( (match = /heal (\d+) x (MAG|SKL)\/(\d+)/i.exec(text)) ) return {formula: `${match[1]} * floor(${match[2].toLowerCase()} / ${match[3]})`};
  if ( (match = /heal (\d+) x (MAG|SKL)/i.exec(text)) ) return {formula: `${match[1]} * ${match[2].toLowerCase()}`};
  if ( (match = /heal (MAG|SKL)\/(\d+)/i.exec(text)) ) return {formula: `floor(${match[1].toLowerCase()} / ${match[2]})`};
  if ( (match = /heal (MAG|SKL)\b/i.exec(text)) ) return {formula: match[1].toLowerCase()};
  if ( (match = /heal (\d+)\b/i.exec(text)) ) return {formula: match[1]};
  return null;
}

function parseStatuses(text) {
  const statuses = [];
  let match;
  if ( /\bPinned\b/.test(text) ) statuses.push({id: "pinned", turns: 1, target: "target", onCrit: false});
  if ( /\bStagger\b/.test(text) ) statuses.push({id: "stagger", turns: 1, target: "target", onCrit: false});
  if ( /inflict Poison|\bPoison on\b/.test(text) ) statuses.push({id: "poison", turns: 3, target: "target", onCrit: false});
  if ( (match = /Silenced (\d+) turns?( on crit)?/.exec(text)) ) statuses.push({id: "silenced", turns: +match[1], target: "target", onCrit: Boolean(match[2])});
  if ( /raise Warded|Ward Self/.test(text) ) statuses.push({id: "warded", turns: null, target: "self", onCrit: false});
  else if ( /Warded on/.test(text) ) statuses.push({id: "warded", turns: null, target: "ally", onCrit: false});
  if ( /\bMarked\b|Might \+3 vs target 3 turns/.test(text) ) statuses.push({id: "marked", turns: 3, target: "target", onCrit: false});
  return statuses;
}

function parseWar(text, {attack, heal, type}) {
  const war = {range: null, area: {shape: "single", size: 1}, target: "enemy", movement: null, terrain: false};
  let match;
  if ( (match = /range (\d+)(?: to (\d+))?/.exec(text)) ) war.range = [+match[1], match[2] ? +match[2] : +match[1]];
  if ( (match = /line (\d+)/.exec(text)) ) war.area = {shape: "line", size: +match[1]};
  else if ( (match = /blast (\d+)/.exec(text)) ) war.area = {shape: "blast", size: +match[1]};
  else if ( (match = /radius (\d+)/.exec(text)) ) war.area = {shape: "blast", size: +match[1]};
  else if ( /\ball enemies\b|\ball\b(?! but)/.test(text) && attack ) war.area = {shape: "blast", size: 2};
  if ( /\bpush\b/.test(text) ) war.movement = "push";
  else if ( /\bpull\b/.test(text) ) war.movement = "pull";
  else if ( /force row swap|reposition/.test(text) ) war.movement = "reposition";
  if ( /raise a Wall|Wall tile|plague zone tile|tile or row Barrier|Barrier on a row|raise a \d+ by \d+ Fort|becomes Road|change one tile/.test(text) ) war.terrain = true;
  if ( heal || /\bally\b|\ballies\b/.test(text) ) war.target = "ally";
  if ( /Ward Self|yourself|\byou\b.*\bgain\b/.test(text) && !attack ) war.target = "self";
  if ( war.terrain ) war.target = "tile";
  if ( !attack && !heal && !/\btarget\b|\benemy\b|\benemies\b/.test(text) && (war.target === "enemy") ) war.target = "self";
  if ( !war.range ) {
    if ( attack?.source === "spell" ) war.range = [1, 2];
    else if ( attack && (attack.source !== "weapon") ) war.range = [1, 1];
    else if ( heal ) war.range = [1, 1];
    else if ( !attack ) war.range = [0, 0];
  }
  if ( type === "command" ) war.target = "company";
  return war;
}

function abilityDocument({id, name, type, direct, text, source, classData, extra}) {
  const cost = parseCosts(text, type);
  const passive = DEICIDE.skillTypes[type]?.passive;
  const parsed = passive ? parsePassive(text) : {modifiers: [], automation: null};
  const attack = (type === "action") || (type === "reaction") ? parseAttack(text, {direct, classData, cost}) : null;
  const heal = (type === "action") || (type === "reaction") ? parseHeal(text) : null;
  const weightMatch = /\bW(\d+)\b/.exec(text);
  const tags = [];
  if ( attack?.source === "spell" ) tags.push(attack.element ? DEICIDE.elements[attack.element].school : schoolFor(classData));
  if ( attack?.source === "alchemy" ) tags.push("alchemy");
  if ( attack?.element ) tags.push(attack.element);
  if ( /Officer tag/.test(text) ) tags.push("officer");
  if ( /Mana Piercing/.test(text) ) tags.push("manaPiercing");
  if ( classData?.types?.includes("flying") && /\b(Dive|fly|flight|air|sky)\b/i.test(`${name} ${text}`) ) tags.push("flight");

  const system = {
    type,
    source,
    description: `<p>${text.charAt(0).toUpperCase()}${text.slice(1).replace(/\s+$/, "")}${/[.!?]$/.test(text) ? "" : "."}</p>`,
    summary: text,
    tags: Array.from(new Set(tags)),
    direct: Boolean(direct || attack?.element === "truth"),
    trigger: type === "reaction" ? text : "",
    usage: parseUsage(text),
    cost,
    weight: weightMatch ? Number(weightMatch[1]) : null,
    attack,
    heal,
    war: passive || (type === "command") ? null : parseWar(text, {attack, heal, type}),
    dungeon: null,
    statuses: (type === "action") || (type === "reaction") ? parseStatuses(text) : [],
    modifiers: parsed.modifiers,
    roll: null,
    effects: [],
    reaction: null,
    command: null,
    stance: null,
    coverage: [],
    automation: "manual"
  };
  deepMerge(system, extra ?? {});
  deepMerge(system, abilityOverrides[id] ?? {});
  deepMerge(system, automationData[id] ?? {});
  normalizeAutomation(system, type);
  if ( system.attack && !system.attack.bonuses ) system.attack.bonuses = [];
  system.automation = gradeAutomation(system).automation;
  report.automation[system.automation] = (report.automation[system.automation] ?? 0) + 1;
  return document("ability", id, name, system, ICONS[type] ?? ICONS.action);
}

function normalizeAutomation(system, type) {
  if ( type === "stance" ) {
    system.stance ??= {};
    system.stance.modifiers = system.stance.modifiers?.length ? system.stance.modifiers : (system.modifiers ?? []);
    system.stance.effects = system.stance.effects ?? [];
    system.modifiers = system.stance.modifiers;
  }
  if ( type === "reaction" ) {
    if ( system.reaction && system.roll?.formula && !system.reaction.roll ) system.reaction.roll = {d100Under: system.roll.formula};
    if ( system.reaction?.roll?.d100Under && !system.roll ) system.roll = {formula: system.reaction.roll.d100Under};
  }
  if ( (type === "command") && system.command ) system.command.target ??= "companiesInRadius";
}

function run() {
  const docs = readFileSync(join(ROOT, "docs", "03-classes.md"), "utf8");
  const all = sections(docs);
  const classes = new Map();

  const tierSections = [
    ["Tier 1", 1, "player"], ["Tier 2", 2, "player"], ["Tier 3", 3, "player"], ["Tier 4", 4, "player"]
  ];
  let cursor = 0;
  for ( const [prefix, tier, kind] of tierSections ) {
    const found = findSection(all, prefix, cursor);
    if ( !found ) throw new Error(`Section ${prefix} not found`);
    cursor = found.index + 1;
    const [table] = tables(found.section.lines);
    for ( const row of table.rows ) {
      const record = Object.fromEntries(table.headers.map((header, i) => [header, row[i] ?? ""]));
      const doc = classDocument(record, tier, kind);
      classes.set(doc.system.identifier, doc);
    }
  }

  const ladderStart = findSection(all, "Skill ladders").index;
  cursor = ladderStart + 1;
  const abilities = [];
  for ( const [prefix, tier] of tierSections ) {
    const found = findSection(all, prefix, cursor);
    if ( !found ) throw new Error(`Ladder section ${prefix} not found`);
    cursor = found.index + 1;
    const [table] = tables(found.section.lines);
    const ranks = table.headers.slice(1).map(header => Number(/R(\d+)/.exec(header)?.[1]));
    for ( const row of table.rows ) {
      const classId = titleCaseToId(row[0]);
      const classDoc = classes.get(classId);
      if ( !classDoc ) throw new Error(`Ladder for unknown class ${row[0]}`);
      row.slice(1).forEach((cell, index) => {
        const rank = ranks[index];
        const split = splitCell(cell);
        if ( !split ) throw new Error(`Unreadable cell for ${row[0]} R${rank}: ${cell}`);
        const isMasteryColumn = /Mastery/.test(table.headers[index + 1]);
        const type = split.type ?? (isMasteryColumn ? "mastery" : "support");
        const id = `${classId}${pascalId(split.name)}`;
        abilities.push(abilityDocument({
          id, name: split.name, type, direct: split.direct, text: split.text,
          source: {kind: "class", id: classId, rank}, classData: classDoc.system
        }));
        classDoc.system.skills.push({rank, id, mastery: isMasteryColumn});
      });
      classDoc.system.ladder = tier === 4 ? "legend" : "standard";
    }
  }

  for ( const enemy of enemyClasses ) {
    const system = {
      tier: enemy.tier, types: enemy.types, growth: enemy.growth, hp: enemy.hp, trains: enemy.trains,
      trainsText: "", startSpread: {}, prerequisites: null, prerequisiteText: "", storyGate: "", skills: [],
      move: null, affinities: [], enemyOnly: true, layered: false, grantsFullTruth: false, choices: [], kit: {},
      description: `<p>${enemy.description}</p>`, ladder: "standard"
    };
    for ( const borrow of enemy.borrows ?? [] ) system.skills.push({rank: borrow.rank, id: borrow.id, mastery: false});
    const ranks = [1, 2, 4, 6, 8, 10].filter(rank => !system.skills.some(skill => skill.rank === rank));
    enemy.cells.forEach((cell, index) => {
      const split = splitCell(cell);
      const id = `${enemy.id}${pascalId(split.name)}`;
      const rank = ranks[index] ?? 10;
      abilities.push(abilityDocument({
        id, name: split.name, type: split.type ?? "support", direct: split.direct, text: split.text,
        source: {kind: "class", id: enemy.id, rank}, classData: system
      }));
      system.skills.push({rank, id, mastery: false});
    });
    system.skills.sort((a, b) => a.rank - b.rank);
    classes.set(enemy.id, document("class", enemy.id, enemy.name, system, ICONS.class));
  }

  const pinSection = findSection(all, "Gimmick pins");
  const [pinTable] = tables(pinSection.section.lines);
  const pins = [];
  for ( const row of pinTable.rows ) {
    const [name, type, effect, dust] = row;
    const abilityId = `pin${pascalId(name)}`;
    abilities.push(abilityDocument({
      id: abilityId, name, type: type.toLowerCase(), direct: false, text: effect,
      source: {kind: "pin", id: `${camelId(name)}Pin`, rank: null}, classData: null
    }));
    pins.push(document("pin", `${camelId(name)}Pin`, `${name} Pin`, {
      ability: abilityId, price: Number(dust), description: `<p>${effect}.</p>`, equipped: false
    }, ICONS.pin));
  }

  for ( const origin of originAbilities ) {
    const split = splitCell(origin.cell);
    abilities.push(abilityDocument({
      id: origin.id, name: split.name, type: split.type ?? "support", direct: split.direct, text: split.text,
      source: origin.source, classData: null, extra: origin.system
    }));
  }

  for ( const [artId, art] of Object.entries(DEICIDE.arts) ) {
    const id = `art${pascalId(artId)}`;
    const name = artId.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, c => c.toUpperCase());
    const parts = [];
    if ( art.might ) parts.push(`Might +${art.might}`);
    if ( art.spellMight ) parts.push(`Spell Might +${art.spellMight}`);
    if ( art.ignoreDef ) parts.push(`ignores ${art.ignoreDef} DEF`);
    if ( art.effectiveVs ) parts.push(`x2 vs ${art.effectiveVs}`);
    if ( art.targetDef ) parts.push(`target DEF ${art.targetDef} for ${art.turns} turns`);
    if ( art.rangeMax ) parts.push(`Range +${art.rangeMax}`);
    if ( art.range ) parts.push(`Range ${art.range[0]}`);
    if ( art.acc ) parts.push(`Accuracy +${art.acc}`);
    if ( art.crit ) parts.push(`crit +${art.crit}`);
    if ( art.ignoreWarded ) parts.push("ignores Warded on an adjacent target");
    if ( art.channelCost === 0 ) parts.push("0 Channel");
    if ( art.rowHealFraction ) parts.push("heal becomes a row heal at half value");
    if ( art.nextMatterCost === 0 ) parts.push("next transmutation costs 0 Matter");
    const lines = art.lines.join(", ");
    const text = `${parts.join(", ")}. ${lines} at ${art.minTier} or better. Costs ${art.hp} HP. Weight ${art.weight ?? DEICIDE.artDefaultWeight}.`;
    const caster = art.lines.every(line => DEICIDE.casterLines.includes(line));
    const system = {
      type: "action", source: {kind: "art", id: artId, rank: null},
      description: `<p>${text}</p>`, summary: text, tags: ["art"], direct: false, trigger: "",
      usage: {limit: null, per: null},
      cost: {channel: art.channelCost ?? 0, matter: 0, hp: art.hp, dust: 0, soulPrice: 0},
      weight: art.weight ?? DEICIDE.artDefaultWeight,
      attack: caster ? null : {
        basis: "str", source: "weapon", defense: "def", might: art.might ?? 0, element: null, hit: art.acc ?? 0,
        crit: art.crit ?? 0, weaponLines: art.lines, strikes: 1, ignoreDef: art.ignoreDef ?? 0, bonuses: [],
        effectiveVs: art.effectiveVs ?? null, rangeMax: art.rangeMax ?? 0, range: art.range ?? null,
        ignoreWarded: Boolean(art.ignoreWarded)
      },
      heal: null,
      war: {range: art.range ?? null, area: {shape: "single", size: 1}, target: "enemy", movement: null, terrain: false},
      dungeon: null, statuses: [], modifiers: [], roll: null, effects: [], reaction: null, command: null, stance: null,
      coverage: [art.rowHealFraction ? "heal becomes a row heal" : null, art.ignoreWarded ? "ignores Warded on an adjacent target" : null].filter(Boolean),
      art: {lines: art.lines, minTier: art.minTier, spellMight: art.spellMight ?? 0, rowHealFraction: art.rowHealFraction ?? 0, nextMatterCost: art.nextMatterCost ?? null, targetDef: art.targetDef ?? 0, turns: art.turns ?? 0},
      automation: "manual"
    };
    system.automation = gradeAutomation(system).automation;
    abilities.push(document("ability", id, name, system, ICONS.action));
  }

  const origins = [];
  const originDoc = (kind, id, data) => {
    const {name, text, rider, ...rest} = data;
    const system = {kind, description: `<p>${rider ?? text ?? ""}</p>`, ...rest};
    return document("origin", id, name, system, ICONS[kind]);
  };
  for ( const [id, data] of Object.entries(peoples) ) origins.push(originDoc("people", id, data));
  for ( const [id, data] of Object.entries(backgrounds) ) origins.push(originDoc("background", id, data));
  for ( const [id, data] of Object.entries(talents) ) origins.push(originDoc("talent", id, data));

  for ( const doc of classes.values() ) { write("classes", doc); report.classes++; }
  for ( const doc of abilities ) { write("abilities", doc); report.abilities++; }
  for ( const doc of pins ) { write("accessories", doc); report.pins++; }
  for ( const doc of origins ) { write("origins", doc); report.origins++; }

  console.log(`Classes ${report.classes}, abilities ${report.abilities}, pins ${report.pins}, origins ${report.origins}`);
  console.log(`Written ${report.written}, kept ${report.skipped}${force ? "" : " (use --force to overwrite)"}`);
  console.log(`Automation: full ${report.automation.full}, partial ${report.automation.partial}, manual ${report.automation.manual}`);
  console.log(`Class growth lines scaled to tier totals: ${report.scaled.length}`);
  for ( const entry of report.scaled ) console.log(`  ${entry.id}: printed ${entry.printed / 10} to ${entry.tierTotal / 10}`);
}

run();
