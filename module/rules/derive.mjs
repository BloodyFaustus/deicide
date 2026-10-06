import {DEICIDE} from "../config.mjs";
import {evaluate} from "../core/expression.mjs";
import {Pipeline} from "../core/pipeline.mjs";
import {applicable, applyModifiers, applyStaged, fromSource, resolve} from "../core/modifiers.mjs";
import {gradeFor, gradeAtLeast} from "./grades.mjs";
import {accumulatedClassHp, classCaps, trainedAttributes, attributeRecord} from "./growth.mjs";
import {proficiencies as deriveProficiencies, meetsPrereq, tierGatesFor} from "./proficiency.mjs";

const ATTRS = DEICIDE.attributeIds;

export const CHANNEL_STAGES = ["innate", "origin", "gear", "final"];

function stepDefinitions(state) {
  const {source, lookup} = state;
  const out = state.derived;
  state.people = lookup("origin", source.people) ?? null;
  state.subtype = state.people?.subtypes?.[source.peopleSubtype] ?? null;
  state.background = lookup("origin", source.background) ?? null;
  state.talent = lookup("origin", source.talent?.id) ?? null;
  state.flags = {...(state.people?.flags ?? {}), ...(state.subtype?.flags ?? {}), ...(state.background?.flags ?? {})};
  out.flags = state.flags;
  out.missing = [];
  for ( const [kind, id, found] of [
    ["people", source.people, state.people], ["background", source.background, state.background],
    ["talent", source.talent?.id, state.talent]
  ] ) {
    if ( id && !found ) out.missing.push({type: "origin", kind, id});
  }
}

function stepClasses(state) {
  const {source, lookup} = state;
  const out = state.derived;
  state.classes = [];
  for ( const entry of source.classes ?? [] ) {
    const data = lookup("class", entry.id);
    if ( !data ) { out.missing.push({type: "class", id: entry.id}); continue; }
    state.classes.push({id: entry.id, rank: entry.rank ?? 1, cp: entry.cp ?? 0, choices: entry.choices ?? {}, data});
  }
  state.active = state.classes.find(entry => entry.id === source.activeClass) ?? state.classes[0] ?? null;
  const activeData = state.active?.data ?? null;
  out.activeClass = state.active?.id ?? null;
  out.classTypes = [...(activeData?.types ?? [])];
  out.capTier = activeData?.tier ?? 1;
  out.caps = activeData
    ? classCaps(activeData, {talent: state.talent, talentChoice: source.talent, people: state.people})
    : attributeRecord(DEICIDE.caps[1].F);
  out.classes = state.classes.map(({id, rank, cp, choices, data}) => ({id, rank, cp, choices, tier: data.tier}));
}

function stepSkills(state) {
  const {source, lookup, equipment, context} = state;
  const out = state.derived;
  const engine = context.engine;
  const known = new Map();
  const learn = (id, origin) => {
    if ( !id || known.has(id) ) return;
    const data = lookup("ability", id);
    if ( !data ) { out.missing.push({type: "ability", id}); return; }
    known.set(id, {id, data, ...origin});
  };

  for ( const entry of state.classes ) {
    for ( const skill of entry.data.skills ?? [] ) {
      if ( entry.rank >= skill.rank ) learn(skill.id, {from: "class", classId: entry.id, rank: skill.rank});
    }
  }
  const grants = state.background?.grants ?? {};
  for ( const id of grants.abilities ?? [] ) learn(id, {from: "origin"});
  for ( const id of state.people?.grants?.abilities ?? [] ) learn(id, {from: "origin"});
  for ( const ability of state.owned ?? [] ) {
    if ( ability?.identifier && !known.has(ability.identifier) ) {
      known.set(ability.identifier, {id: ability.identifier, data: ability, from: "owned"});
    }
  }

  const engines = [];
  for ( const id of [...(grants.engines ?? []), ...(state.people?.grants?.engines ?? [])] ) {
    const data = lookup("ability", id);
    if ( data ) engines.push({id, data, from: "engine"});
    else out.missing.push({type: "ability", id});
  }
  const extras = [];
  const pinAbility = equipment.pin?.ability ? lookup("ability", equipment.pin.ability) : null;
  if ( pinAbility ) extras.push({id: equipment.pin.ability, data: pinAbility, from: "pin"});
  for ( const accessory of equipment.accessories ?? [] ) {
    const data = accessory?.skill ? lookup("ability", accessory.skill) : null;
    if ( data ) extras.push({id: accessory.skill, data, from: "accessory"});
  }
  for ( const artId of equipment.weapon?.arts ?? [] ) {
    const data = lookup("ability", artId);
    if ( data ) extras.push({id: artId, data, from: "art"});
  }

  const ofType = (list, type) => list.filter(skill => skill.data.type === type);
  const all = Array.from(known.values());
  const activeId = state.active?.id ?? null;
  const fromActive = skill => (skill.from !== "class") || (skill.classId === activeId);

  const loadout = source.loadout ?? {};
  const level = source.level ?? 1;
  let supportSlots = DEICIDE.loadout.supports.reduce((count, band) => (level >= band.level) ? band.count : count, 0);
  const knownSupports = ofType(all, "support");
  const knownReactions = ofType(all, "reaction");
  let supports = (loadout.supports ?? []).filter(id => knownSupports.some(skill => skill.id === id));
  let reaction = knownReactions.some(skill => skill.id === loadout.reaction) ? loadout.reaction : null;
  const secondaryEntry = state.classes.find(entry => (entry.id === loadout.secondary) && (entry.id !== activeId)
    && (entry.rank >= DEICIDE.secondaryActionMinRank)) ?? null;

  state.skills = {known, engines, extras, all, supportSlotsBase: supportSlots};
  state.loadoutChoice = {supports, reaction, secondary: secondaryEntry?.id ?? null, stance: loadout.stance ?? null};
  state.ofType = ofType;
  state.fromActive = fromActive;
  state.knownSupports = knownSupports;
  state.knownReactions = knownReactions;

  out.skills = {known: all.map(skill => skill.id), engines: engines.map(skill => skill.id)};
  state.engine = engine;
}

function stepModifiers(state) {
  const {source, equipment, context} = state;
  const out = state.derived;
  const pool = [];
  const push = (modifiers, id, label) => pool.push(...fromSource(modifiers, id, label));

  push(state.people?.modifiers, source.people, state.people?.name);
  push(state.subtype?.modifiers, `${source.people}.${source.peopleSubtype}`);
  push(state.background?.modifiers, source.background, state.background?.name);
  push(state.talent?.modifiers, source.talent?.id, state.talent?.name);
  if ( state.talent?.hpPerLevel ) {
    pool.push({key: "hp.perLevel", value: state.talent.hpPerLevel, source: source.talent.id});
  }
  for ( const type of out.classTypes ) {
    const benefit = DEICIDE.classTypes[type]?.defense;
    if ( benefit?.def ) pool.push({key: "defense.def", value: benefit.def, source: `classType.${type}`});
    if ( benefit?.res ) pool.push({key: "defense.res", value: benefit.res, source: `classType.${type}`});
    const dungeon = DEICIDE.classTypes[type]?.dungeon;
    if ( dungeon?.delay && !context.arena ) {
      pool.push({key: "delay", value: dungeon.delay, when: {engine: "dungeon"}, source: `classType.${type}`});
    }
  }
  for ( const slot of ["weapon", "offhand", "armor", "pin"] ) {
    const item = equipment[slot];
    if ( item ) push(item.modifiers, item.identifier ?? slot, item.name);
  }
  for ( const accessory of equipment.accessories ?? [] ) {
    if ( accessory ) push(accessory.modifiers, accessory.identifier ?? "accessory", accessory.name);
  }
  for ( const status of context.statuses ?? [] ) {
    push(DEICIDE.statuses[status]?.modifiers, `status.${status}`);
  }

  if ( (typeof source.manaburn === "number") && !state.flags.noManaburn && (state.flags.manaburnThresholds !== false) ) {
    for ( const threshold of DEICIDE.manaburn.thresholds ) {
      if ( (source.manaburn >= threshold.min) && threshold.channel ) {
        pool.push({key: "channel.max", value: threshold.channel, source: `manaburn.${threshold.id}`});
      }
    }
  }
  pool.push(...(context.modifiers ?? []));

  const passive = [];
  for ( const skill of state.ofType(state.skills.all, "mastery") ) passive.push(skill);
  for ( const skill of state.skills.engines ) passive.push(skill);
  for ( const skill of state.skills.extras ) {
    if ( DEICIDE.skillTypes[skill.data.type]?.passive ) passive.push(skill);
  }
  for ( const skill of passive ) push(skill.data.modifiers, skill.id, skill.data.name);

  const conditions = {engine: state.engine, mode: context.mode, subject: {classTypes: out.classTypes, statuses: context.statuses ?? []}};
  const slots = resolve(state.skills.supportSlotsBase, pool, "supports.slots", {context: conditions}).value;
  const choice = state.loadoutChoice;
  let supports = choice.supports.slice(0, slots);
  if ( !supports.length && (state.knownSupports.length <= slots) ) supports = state.knownSupports.map(skill => skill.id);
  let reaction = choice.reaction;
  if ( !reaction && (state.knownReactions.length === 1) ) reaction = state.knownReactions[0].id;

  const activeStances = state.ofType(state.skills.all, "stance").filter(state.fromActive);
  const stance = activeStances.some(skill => skill.id === choice.stance) ? choice.stance : null;

  for ( const id of supports ) {
    const skill = state.skills.known.get(id);
    passive.push(skill);
    push(skill.data.modifiers, skill.id, skill.data.name);
  }
  if ( stance && (state.engine === "dungeon") ) {
    const skill = state.skills.known.get(stance);
    passive.push(skill);
    push(skill.data.modifiers, skill.id, skill.data.name);
  }

  state.pool = pool;
  state.conditions = conditions;
  out.modifiers = pool;
  out.loadout = {supports, supportSlots: slots, reaction, secondary: choice.secondary, stance};
  out.skills.active = passive.map(skill => skill.id);

  const usable = type => DEICIDE.skillTypes[type].engines.includes(state.engine);
  const actions = state.ofType(state.skills.all, "action").filter(skill => state.fromActive(skill)
    || (skill.classId === choice.secondary));
  for ( const skill of state.skills.extras ) if ( skill.data.type === "action" ) actions.push(skill);
  const reactions = [];
  if ( reaction ) reactions.push(reaction);
  for ( const skill of [...state.skills.engines, ...state.skills.extras] ) {
    if ( skill.data.type === "reaction" ) reactions.push(skill.id);
  }
  out.skills.available = {
    actions: usable("action") ? actions.map(skill => skill.id) : [],
    reactions: usable("reaction") ? reactions : [],
    supports,
    commands: usable("command") ? state.ofType(state.skills.all, "command").filter(state.fromActive).map(skill => skill.id) : [],
    stances: usable("stance") ? activeStances.map(skill => skill.id) : [],
    masteries: state.ofType(state.skills.all, "mastery").map(skill => skill.id)
  };
}

function stepAttributes(state) {
  const {source} = state;
  const out = state.derived;
  const trained = trainedAttributes(source);
  const adaptation = attributeRecord(0);
  for ( const attr of source.adaptations ?? [] ) {
    if ( attr in adaptation ) adaptation[attr] += DEICIDE.saturation.adaptation.attribute;
  }
  const values = {};
  const detail = {};
  for ( const attr of ATTRS ) {
    const cap = out.caps[attr];
    const mods = applicable(state.pool, `attributes.${attr}`, state.conditions);
    const accessory = applyModifiers(0, mods.filter(modifier => modifier.accessory)).value;
    const other = mods.filter(modifier => !modifier.accessory);
    const natural = Math.min(trained[attr] + adaptation[attr], Math.max(trained[attr], DEICIDE.adaptationCap));
    const room = Math.max(cap + DEICIDE.accessoryCapOverflow - natural, 0);
    const accessoryApplied = Math.max(Math.min(accessory, room), Math.min(accessory, 0));
    const value = Math.max(applyModifiers(natural + accessoryApplied, other).value, 0);
    values[attr] = value;
    detail[attr] = {
      base: source.attributes?.[attr] ?? 0,
      trained: trained[attr],
      adaptation: natural - trained[attr],
      accessory: accessoryApplied,
      bonus: value - natural - accessoryApplied,
      value, cap,
      grade: gradeFor(value),
      atCap: trained[attr] >= cap
    };
  }
  state.values = values;
  out.attributes = detail;
  out.values = values;
  out.grades = Object.fromEntries(ATTRS.map(attr => [attr, detail[attr].grade]));
}

function stepProficiencies(state) {
  const {source} = state;
  const out = state.derived;
  const starting = [state.people?.proficiencies, state.subtype?.proficiencies, state.background?.grants?.proficiencies];
  const steps = {};
  const talentProficiency = state.talent?.proficiency;
  if ( talentProficiency && source.talent?.proficiency ) {
    starting.push({[source.talent.proficiency]: talentProficiency.startGrade});
    steps[source.talent.proficiency] = talentProficiency.steps ?? 0;
  }
  const pace = {};
  for ( const modifier of state.pool ) {
    if ( modifier.key?.startsWith("proficiency.pace.") ) pace[modifier.key.slice("proficiency.pace.".length)] = "primary";
  }
  out.proficiencies = deriveProficiencies(state.classes, {starting, pace, steps});
  out.isAlchemist = gradeAtLeast(out.proficiencies.alchemy, "E");
}

function stepResources(state) {
  const {source, context} = state;
  const out = state.derived;
  const pool = state.pool;
  const scope = {...state.values, level: source.level ?? 1};
  const opts = {scope, context: state.conditions};
  const level = source.level ?? 1;

  const adaptations = (source.adaptations ?? []).length;
  const perLevel = resolve(0, pool, "hp.perLevel", opts).value;
  const hpBase = evaluate(DEICIDE.formulas.hp, {level, classHp: accumulatedClassHp(source), bonus: 0});
  const hpFlat = resolve(0, pool, "hp.max", opts);
  out.hp = {
    max: hpBase + perLevel * level + adaptations * DEICIDE.saturation.adaptation.hp + hpFlat.value,
    parts: [
      {id: "formula", value: hpBase},
      {id: "perLevel", value: perLevel * level},
      {id: "adaptations", value: adaptations * DEICIDE.saturation.adaptation.hp},
      ...hpFlat.parts
    ].filter(part => part.value)
  };

  out.noChannel = Boolean(state.flags.noChannel);
  if ( out.noChannel ) out.channel = null;
  else {
    const formula = evaluate(DEICIDE.formulas.channel, scope);
    const staged = applyStaged(formula, pool, "channel.max", CHANNEL_STAGES, {defaultStage: "gear", ...opts});
    out.channel = {formula, innate: staged.byStage.origin, max: Math.max(staged.value, 0), parts: staged.parts};
  }

  if ( out.isAlchemist ) {
    const formula = evaluate(DEICIDE.formulas.matterCap, scope);
    const mods = resolve(formula, pool, "matter.max", opts);
    out.matter = {formula, max: Math.max(mods.value, 0), parts: mods.parts};
  }
  else out.matter = null;

  const activeData = state.active?.data;
  let move = activeData?.move ?? null;
  if ( move === null ) {
    const moves = out.classTypes.map(type => DEICIDE.classTypes[type]?.move).filter(value => typeof value === "number");
    move = moves.length ? Math.min(...moves) : DEICIDE.defaultMove;
  }
  out.move = Math.max(resolve(move, pool, "move", opts).value, 0);
  out.canto = out.classTypes.some(type => DEICIDE.classTypes[type]?.canto)
    && (resolve(1, pool, "canto", opts).value > 0) && (state.engine === "war");

  out.commandRadius = Math.max(resolve(evaluate(DEICIDE.formulas.commandRadius, scope), pool, "commandRadius", opts).value, 0);
  out.isOfficer = out.classTypes.includes("officer");

  const grants = state.background?.grants ?? {};
  out.static = grants.staticCharge
    ? {max: resolve(DEICIDE.staticCharge.max, pool, "static.max", opts).value}
    : null;
  if ( grants.stolenSlots ) {
    let slots = DEICIDE.stolenSlots.base;
    for ( const upgrade of DEICIDE.stolenSlots.upgrades ) if ( level >= upgrade.level ) slots = upgrade.slots;
    out.stolen = {slots: resolve(slots, pool, "stolen.slots", opts).value};
  }
  else out.stolen = null;

  out.tracksManaburn = !state.flags.noManaburn;
  out.tracksSaturation = Boolean(state.flags.saturation) && !state.flags.noSaturation;
  out.soulPricePayer = state.flags.noSoul ? "hp" : "channel";
  out.harvestYield = resolve(DEICIDE.matter.harvestYield, pool, "harvest.yield", opts).value;
  out.overcastBurnPerPoint = Math.max(
    resolve(state.flags.overcastBurnPerPoint ?? DEICIDE.overcast.burnPerPoint, pool, "overcast.burnPerPoint", opts).value,
    DEICIDE.overcast.floorPerPoint
  );
  out.delayPenalty = resolve(0, pool, "delay", opts).value;
}

function stepDefense(state) {
  const {equipment} = state;
  const out = state.derived;
  const opts = {scope: state.values, context: state.conditions};
  out.defense = {
    def: Math.max(resolve(state.values.def, state.pool, "defense.def", opts).value, 0),
    res: Math.max(resolve(state.values.res, state.pool, "defense.res", opts).value, 0),
    avoid: resolve(0, state.pool, "avoid", opts).value
  };
  const immunities = new Set(state.flags.immunities ?? []);
  for ( const accessory of equipment.accessories ?? [] ) for ( const id of accessory?.immune ?? [] ) immunities.add(id);
  for ( const modifier of state.pool ) {
    if ( modifier.key === "immune" ) immunities.add(modifier.value);
  }
  out.immunities = Array.from(immunities);
}

function stepClassAccess(state) {
  const {source, context} = state;
  const out = state.derived;
  const tierGates = context.tierGates ?? tierGatesFor(context.levelCap ?? DEICIDE.pacing.defaults.L);
  const gateContext = {
    storyGates: source.storyGates ?? [], saturation: source.saturation ?? 0, marks: source.marks ?? 0
  };
  const owned = new Set(state.classes.map(entry => entry.id));
  out.availableClasses = [];
  for ( const entry of context.classCatalog ?? [] ) {
    const data = entry.system ?? entry;
    if ( data.enemyOnly ) continue;
    const result = meetsPrereq(data, out.proficiencies, source.level ?? 1, tierGates, gateContext);
    out.availableClasses.push({
      id: data.identifier, tier: data.tier, owned: owned.has(data.identifier),
      ok: result.ok, levelOk: result.levelOk, levelGate: result.levelGate, missing: result.missing
    });
  }
}

function stepProfile(state) {
  const {source, context} = state;
  const out = state.derived;
  const activeData = state.active?.data;
  const affinities = new Set(activeData?.affinities ?? []);
  for ( const prof of activeData?.trains?.primary ?? [] ) {
    if ( prof === "faith" ) affinities.add("divine");
    if ( prof === "void" ) affinities.add("void");
  }
  if ( context.attuned ) affinities.add(context.attuned);
  const hasStateRank = state.classes.some(entry => entry.data.grantsFullTruth);
  out.profile = {
    kind: "character",
    name: context.name ?? "",
    level: source.level ?? 1,
    attributes: state.values,
    defense: out.defense,
    hp: {value: source.hp?.value ?? out.hp.max, max: out.hp.max},
    classTypes: out.classTypes,
    tags: [...(state.flags.tags ?? [])],
    statuses: context.statuses ?? [],
    affinities: Array.from(affinities),
    attuned: context.attuned ?? null,
    immunities: out.immunities,
    divineBeing: false,
    modifiers: state.pool,
    truthMultiplier: (state.flags.noSoul || hasStateRank) ? 1 : DEICIDE.studentTruthMultiplier
  };
}

export const characterPipeline = new Pipeline("deriveCharacter", [
  ["definitions", stepDefinitions],
  ["classes", stepClasses],
  ["skills", stepSkills],
  ["modifiers", stepModifiers],
  ["attributes", stepAttributes],
  ["proficiencies", stepProficiencies],
  ["resources", stepResources],
  ["defense", stepDefense],
  ["classAccess", stepClassAccess],
  ["profile", stepProfile]
]);

export function deriveCharacter(source, {lookup, equipment = {}, owned = [], context = {}} = {}) {
  if ( typeof lookup !== "function" ) throw new TypeError("deriveCharacter needs a catalog lookup function");
  const mode = context.mode ?? "war";
  const state = {
    source, lookup, owned,
    equipment: {weapon: null, offhand: null, armor: null, accessories: [], pin: null, ...equipment},
    context: {...context, mode, engine: DEICIDE.modes[mode]?.engine ?? "war"},
    derived: {mode}
  };
  characterPipeline.run(state);
  return state.derived;
}
