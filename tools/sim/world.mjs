import {readFileSync} from "node:fs";
import {join} from "node:path";
import {DEICIDE} from "../../module/config.mjs";
import {ROOT, loadCatalog, readSources} from "../lib/sources.mjs";
import {equipmentFromKit} from "../lib/equipment.mjs";
import {createCharacter} from "../../module/rules/creation.mjs";
import {applyLevel, applyPromotion, applyRankBonus, classCaps, cp100ForRank} from "../../module/rules/growth.mjs";
import {deriveCharacter} from "../../module/rules/derive.mjs";
import {companyStats} from "../../module/rules/company.mjs";
import {evaluate} from "../../module/core/expression.mjs";
import {seededRng, hashString} from "../../module/core/random.mjs";

export const catalog = loadCatalog();
export const lookup = catalog.lookup();

const monsterDocs = new Map(readSources("monsters").map(doc => [doc.system.identifier, doc]));
const fixtures = JSON.parse(readFileSync(join(ROOT, "fixtures", "pcs-level1.json"), "utf8"));

export function tierForLevel(level) {
  if ( level <= 7 ) return "iron";
  if ( level <= 15 ) return "steel";
  if ( level <= 23 ) return "silver";
  return "royal";
}

const capitalize = text => text.charAt(0).toUpperCase() + text.slice(1);

export function retier(id, tier) {
  if ( !id ) return id;
  for ( const known of Object.keys(DEICIDE.weaponGenerator.tiers) ) {
    if ( id.startsWith(known) ) return `${tier}${id.slice(known.length)}`;
  }
  return id;
}

let nextId = 1;
const simId = prefix => `${prefix}${nextId++}`;

export function buildCharacter({fixture = null, inputs = null, level = 1, classes = null, activeClass = null, kit = null, loadout = {}, mode = "war", seed = 1, name = null, side = "party", pin = null}) {
  const fx = fixture ? fixtures[fixture] : null;
  const creation = inputs ?? {
    people: fx.people, peopleSubtype: fx.peopleSubtype, background: fx.background,
    baseClass: fx.classes.find(entry => lookup("class", entry.id)?.tier === 1)?.id ?? fx.classes[0].id,
    talent: fx.talent, personalGrowth: fx.personalGrowth, startSpread: fx.startSpread
  };
  const created = createCharacter(creation, lookup);
  if ( created.errors.length ) throw new Error(created.errors.join(" "));
  let source = created.system;
  const rng = seededRng(typeof seed === "number" ? seed : hashString(String(seed)));
  const people = lookup("origin", source.people);
  const talent = source.talent?.id ? lookup("origin", source.talent.id) : null;
  const plan = classes ?? [];
  const gates = DEICIDE.tierGates[30];
  const takeAt = entry => entry.from ?? (lookup("class", entry.id).tier <= 1 ? 1 : gates[lookup("class", entry.id).tier - 2]);

  const addClass = (id) => {
    if ( source.classes.some(c => c.id === id) ) return;
    const data = lookup("class", id);
    const caps = classCaps(data, {talent, talentChoice: source.talent, people});
    const promotionBonuses = applyPromotion(source, data, caps);
    source = {...source, classes: [...source.classes, {id, rank: 1, cp100: cp100ForRank(1), choices: {}}], promotionBonuses, activeClass: id};
  };
  for ( const entry of plan ) if ( takeAt(entry) <= 1 ) addClass(entry.id);
  for ( let next = 2; next <= level; next++ ) {
    for ( const entry of plan ) if ( takeAt(entry) === next ) addClass(entry.id);
    const data = lookup("class", source.activeClass);
    const result = applyLevel(source, data, people, source.personalGrowth, talent, {rng});
    source = {...source, level: result.level, growthTenths: result.growthTenths, growthLog: result.growthLog};
  }

  for ( const entry of plan ) {
    const data = lookup("class", entry.id);
    const owned = source.classes.find(c => c.id === entry.id);
    if ( !owned ) continue;
    const caps = classCaps(data, {talent, talentChoice: source.talent, people});
    let rankBonuses = source.rankBonuses;
    for ( let rank = owned.rank + 1; rank <= (entry.rank ?? 1); rank++ ) rankBonuses = applyRankBonus({...source, rankBonuses}, data, rank, caps, null);
    source = {...source, rankBonuses, classes: source.classes.map(c => c.id === entry.id ? {...c, rank: Math.max(c.rank, entry.rank ?? 1), cp100: cp100ForRank(entry.rank ?? 1)} : c)};
  }
  if ( activeClass ) source = {...source, activeClass};

  const previous = source.classes.filter(c => (c.id !== source.activeClass) && (c.rank >= DEICIDE.secondaryActionMinRank) && !lookup("class", c.id)?.layered).sort((a, b) => b.rank - a.rank)[0];
  source = {...source, loadout: {secondary: previous?.id ?? null, reaction: null, supports: [], stance: null, ...loadout}};

  const tier = tierForLevel(level);
  const baseKit = kit ?? {weapon: retier(fx?.equipment.weapon, tier), offhand: retier(fx?.equipment.offhand, tier), armor: retier(fx?.equipment.armor, tier), accessories: [], belt: fx?.equipment.belt ?? []};
  const equipment = equipmentFromKit(baseKit);
  if ( pin ) {
    const pinData = lookup("pin", pin);
    if ( pinData ) equipment.pin = {...pinData, identifier: pin, modifiers: pinData.modifiers ?? []};
  }
  const derived = deriveCharacter(source, {lookup, equipment, context: {mode, classCatalog: catalog.all("class")}});
  const actor = {
    id: simId("c"), name: name ?? (fx ? capitalize(fixture) : "NPC"), kind: "character", side, source, derived, equipment, mode,
    hp: derived.hp.max, hpMax: derived.hp.max,
    channel: derived.channel?.max ?? 0, channelMax: derived.channel?.max ?? 0,
    matter: derived.matter?.max ?? 0, matterMax: derived.matter?.max ?? 0,
    statuses: new Map(), x: 0, y: 0, row: "front", tilesMoved: 0, acted: false, reactionUsed: false, reactionsThisRound: {},
    firedThisEncounter: new Set(), burn: 0, overcastPoints: 0, soulPriceHp: 0, harvests: 0, downed: false, bonds: [],
    abilities: derived.skills.known.map(id => lookup("ability", id)).filter(Boolean),
    reactions: derived.skills.available.reactions.map(id => lookup("ability", id)).filter(Boolean),
    weapon: equipment.weapon, offhand: equipment.offhand
  };
  return actor;
}

export function rederive(actor, mode) {
  if ( actor.kind !== "character" ) return actor;
  actor.mode = mode;
  actor.derived = deriveCharacter(actor.source, {lookup, equipment: actor.equipment, context: {
    mode, classCatalog: [], statuses: Array.from(actor.statuses.keys()), attuned: actor.attuned ?? null,
    modifiers: Array.from(actor.statuses.values()).flatMap(s => s.modifiers ?? []),
    effectFlags: Object.assign({}, ...Array.from(actor.statuses.values()).map(s => s.flags ?? {}))
  }});
  actor.abilities = actor.derived.skills.known.map(id => lookup("ability", id)).filter(Boolean);
  actor.reactions = actor.derived.skills.available.reactions.map(id => lookup("ability", id)).filter(Boolean);
  return actor;
}

export function profileOf(actor) {
  if ( actor.kind === "character" ) {
    const profile = actor.derived.profile;
    const statuses = Array.from(actor.statuses.keys());
    const extra = Array.from(actor.statuses.values()).flatMap(s => s.modifiers ?? []);
    return {...profile, name: actor.name, hp: {value: actor.hp, max: actor.hpMax}, statuses, modifiers: [...profile.modifiers, ...extra, ...(actor.extraModifiers ?? [])], attuned: actor.attuned ?? null};
  }
  if ( actor.kind === "monster" ) {
    return {
      kind: "monster", name: actor.name, level: actor.level,
      attributes: {str: 0, mag: actor.mag, skl: actor.skl ?? 0, spd: actor.spd, def: actor.def, res: actor.res, cmd: 0},
      defense: {def: actor.def, res: actor.res, avoid: 0}, hp: {value: actor.hp, max: actor.hpMax},
      classTypes: actor.classTypes ?? [], tags: actor.tags, statuses: Array.from(actor.statuses.keys()), affinities: [],
      weakness: actor.weakness, resistance: actor.resistance, weakTo: actor.weakTo ?? [], immunities: actor.immunities ?? [],
      divineBeing: Boolean(actor.divineBeing), modifiers: Array.from(actor.statuses.values()).flatMap(s => s.modifiers ?? []), hitBase: actor.hitBase
    };
  }
  const stats = companyStats({quality: actor.quality, strength: actor.strength, type: actor.type});
  return {
    kind: "company", name: actor.name, level: 0, attributes: {str: 0, mag: 0, skl: 0, spd: 0, def: stats.def, res: stats.res, cmd: 0},
    defense: {def: stats.def, res: stats.res, avoid: 0}, hp: {value: actor.strength, max: 100}, classTypes: [], tags: ["company", actor.type],
    statuses: Array.from(actor.statuses.keys()), affinities: [], immunities: [], modifiers: [], hitBase: 70 + 5 * actor.quality
  };
}

export function buildMonster(id, {level = null, hpScale = 1, side = "enemy"} = {}) {
  const entry = monsterDocs.get(id);
  if ( !entry ) throw new Error(`Unknown monster ${id}`);
  const data = entry.system;
  const sources = entry.items ?? [];
  const monsterLevel = level ?? data.level;
  const scaled = level && (level !== data.level);
  const hp = Math.round(data.hp.max * hpScale * (scaled ? (1 + 0.08 * (level - data.level)) : 1));
  const tags = Array.from(data.tags ?? []);
  const weakTo = tags.flatMap(tag => DEICIDE.monsterTags[tag]?.weakTo ?? []);
  const actor = {
    id: simId("m"), name: entry.name, kind: "monster", side, level: monsterLevel,
    hp, hpMax: hp, def: data.def + (scaled ? Math.round(0.6 * (level - data.level)) : 0), res: data.res + (scaled ? Math.round(0.6 * (level - data.level)) : 0),
    spd: data.spd, mag: data.mag ?? 0, skl: data.skl ?? 0,
    hitBase: data.hitBase ?? evaluate(DEICIDE.enemyFormulas.monsterHit, {level: monsterLevel}),
    delay: data.delay, fixedDelay: data.delay?.mode === "fixed" ? data.delay.value : (tags.some(t => DEICIDE.monsterTags[t]?.fixedDelay) ? 30 : null),
    tags, classTypes: tags.filter(t => t in DEICIDE.classTypes), weakness: data.weakness, resistance: data.resistance, weakTo,
    immunities: Array.from(data.immunities ?? []), divineBeing: Boolean(data.divineBeing) || tags.includes("divine"),
    boss: Boolean(data.boss) || tags.includes("boss"), phaseBreaks: (data.phaseBreaks ?? []).map(b => ({...b, triggered: false})),
    moves: sources.filter(item => item.type === "ability").map(item => ({...item.system, name: item.name})),
    statuses: new Map(), x: 0, y: 0, row: "front", tilesMoved: 0, reactionUsed: false, reactionsThisRound: {}, actions: 0, downed: false
  };
  return actor;
}

export function buildCompany({type = "infantry", quality = 1, strength = 100, doctrine = "advance", side = "enemy", name = null, x = 0, y = 0}) {
  const stats = companyStats({quality, strength, type});
  return {
    id: simId("k"), name: name ?? `${capitalize(type)} Q${quality}`, kind: "company", side, type, quality, strength, doctrine,
    move: stats.move, range: stats.range, x, y, acted: false, activations: 0, statuses: new Map(), routed: false, downed: false, moraleChecked: false
  };
}

export {fixtures};
