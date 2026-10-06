import {DEICIDE, SYSTEM_ID} from "../../config.mjs";
import {generateNpc} from "../../rules/generate/npc.mjs";
import {generateArmy} from "../../rules/generate/army.mjs";
import {generateLoot} from "../../rules/generate/loot.mjs";
import {benchmarkMonsters, planEncounter, sessionLine} from "../../rules/generate/encounter.mjs";
import {formatCp} from "../../rules/growth.mjs";
import {SCENES} from "../../content/scenes.mjs";

export function storyActors() {
  return game.actors.filter(actor => (actor.type === "character") && (actor.system.recruit.story || !actor.system.recruit.profile));
}

export function partyContext() {
  const pcs = storyActors();
  const partyLevel = Math.max(...pcs.map(actor => actor.system.level), 1);
  const partyTypes = pcs.flatMap(actor => actor.derived?.classTypes ?? []);
  const partyClasses = pcs.map(actor => actor.system.activeClass).filter(Boolean);
  const partyLines = pcs.map(actor => actor.system.equipment?.weapon?.line).filter(Boolean);
  const nation = game.deicide.nation;
  const weapons = nation.tracks?.weapons ?? 0;
  const royal = weapons >= DEICIDE.weaponsTrackUnlocks.royalShop;
  const shopTier = royal ? "royal" : (partyLevel >= 16 ? "silver" : (partyLevel >= 8 ? "steel" : "iron"));
  return {partyLevel, partyTypes, partyClasses, partyLines, shopTier, weaponsTrack: weapons, dials: nation.dials};
}

export function npc(input) {
  const context = partyContext();
  return generateNpc({partyTypes: context.partyTypes, weaponsTrack: context.weaponsTrack, dials: context.dials, ...input}, game.deicide.catalog.lookup());
}

export async function createNpc(input, {folder = null} = {}) {
  const result = npc(input);
  if ( !result.actor ) {
    ui.notifications.warn(result.errors.join(" "));
    return null;
  }
  const actor = await Actor.implementation.create({...result.actor, folder});
  if ( result.errors.length ) ui.notifications.warn(result.errors.join(" "));
  return actor;
}

export function army(input) {
  const nation = game.deicide.nation.actor;
  const side = input.side === "lathander" ? "lathander" : "offweiss";
  const tracks = input.tracks ?? (side === "lathander" ? nation?.system.tracks : nation?.system.offweissTracks) ?? undefined;
  const context = partyContext();
  return generateArmy({partyLevel: context.partyLevel, dials: context.dials, warMonth: nation?.system.warMonth ?? 1, ...input, tracks: tracks ? {...tracks} : undefined}, game.deicide.catalog.lookup());
}

export function loot(input) {
  const context = partyContext();
  return generateLoot({partyLevel: context.partyLevel, shopTier: context.shopTier, partyTypes: context.partyTypes, partyClasses: context.partyClasses, partyLines: context.partyLines, P: game.deicide.nation.P, ...input}, game.deicide.catalog.lookup());
}

export function encounter(input = {}) {
  const context = partyContext();
  return planEncounter({...context.dials, partyLevel: context.partyLevel, ...input});
}

export async function buildMonsters(plan, {boss = false, count = null, folder = null} = {}) {
  const sources = benchmarkMonsters(plan, {boss, count}).map(source => ({...source, folder}));
  return Actor.implementation.createDocuments(sources);
}

export async function journal(plan) {
  const nation = game.deicide.nation.actor;
  const text = sessionLine(plan);
  if ( !nation ) { ui.notifications.warn(game.i18n.localize("DEICIDE.Generate.NoNation")); return text; }
  const log = [...nation.system.log.map(entry => entry.toObject?.() ?? entry), {month: nation.system.warMonth, text, changes: {}}];
  await nation.update({"system.log": log});
  return text;
}

export async function postLoot(input) {
  const result = loot(input);
  if ( result.errors.length ) ui.notifications.warn(result.errors.join(" "));
  const items = result.items.map((item, index) => `<li class="loot-item" data-index="${index}"><img src="${item.img}" alt=""><span>${item.name}${item.system.quantity > 1 ? ` x${item.system.quantity}` : ""}</span><button type="button" data-action="claimLoot" data-index="${index}"><i class="fa-solid fa-hand"></i> ${game.i18n.localize("DEICIDE.Generate.Claim")}</button></li>`);
  const dustLine = result.dust
    ? `<p class="dust">${result.dustPerSheet ? game.i18n.format("DEICIDE.Generate.DustPerSheet", {dust: result.dust}) : game.i18n.format("DEICIDE.Generate.DustTotal", {dust: result.dust})} <button type="button" data-action="splitDust"><i class="fa-solid fa-coins"></i> ${game.i18n.localize("DEICIDE.Generate.SplitDust")}</button></p>`
    : "";
  const content = `<div class="deicide-card loot"><h3>${game.i18n.localize("DEICIDE.Generate.Loot")}: ${game.i18n.localize(`DEICIDE.Generate.Encounter.${result.encounter}`)}</h3>${result.notes.map(note => `<p class="note">${note}</p>`).join("")}${items.length ? `<ul class="plain">${items.join("")}</ul>` : ""}${dustLine}</div>`;
  return ChatMessage.implementation.create({
    content, speaker: {alias: "Deicide"},
    flags: {[SYSTEM_ID]: {loot: {items: result.items, dust: result.dust, dustPerSheet: result.dustPerSheet, claimed: [], split: false}}}
  });
}

function claimant() {
  return canvas.tokens?.controlled[0]?.actor ?? game.user.character ?? null;
}

export function registerLootHooks() {
  Hooks.on("renderChatMessageHTML", (message, html) => {
    const loot = message.getFlag(SYSTEM_ID, "loot");
    if ( !loot ) return;
    for ( const button of html.querySelectorAll("[data-action='claimLoot']") ) {
      const index = Number(button.dataset.index);
      if ( loot.claimed.includes(index) ) { button.disabled = true; continue; }
      button.addEventListener("click", async () => {
        const actor = claimant();
        if ( !actor ) { ui.notifications.warn(game.i18n.localize("DEICIDE.Generate.NoClaimant")); return; }
        const item = loot.items[index];
        const {price, ...source} = item;
        await actor.createEmbeddedDocuments("Item", [source]);
        ui.notifications.info(game.i18n.format("DEICIDE.Generate.Claimed", {name: item.name, actor: actor.name}));
        if ( game.user.isGM ) await message.setFlag(SYSTEM_ID, "loot", {...loot, claimed: [...loot.claimed, index]});
        else await game.users.activeGM?.query("deicide.lootClaimed", {messageId: message.id, index}, {timeout: 10000}).catch(() => null);
      });
    }
    const split = html.querySelector("[data-action='splitDust']");
    if ( split ) {
      if ( !game.user.isGM ) split.remove();
      else if ( loot.split ) split.disabled = true;
      else split.addEventListener("click", async () => {
        const sheets = storyActors();
        const recruits = game.actors.filter(actor => (actor.type === "character") && ["attached", "sworn", "bound"].includes(actor.system.recruit.status));
        const all = [...sheets, ...recruits];
        if ( !all.length ) return;
        const each = loot.dustPerSheet ? loot.dust : Math.floor(loot.dust / all.length);
        for ( const actor of all ) await actor.update({"system.dust": actor.system.dust + each});
        await message.setFlag(SYSTEM_ID, "loot", {...loot, split: true});
        ui.notifications.info(game.i18n.format("DEICIDE.Generate.DustSplit", {dust: each, count: all.length}));
      });
    }
  });
  CONFIG.queries["deicide.lootClaimed"] = async ({messageId, index}) => {
    const message = game.messages.get(messageId);
    const loot = message?.getFlag(SYSTEM_ID, "loot");
    if ( !loot || loot.claimed.includes(index) ) return false;
    await message.setFlag(SYSTEM_ID, "loot", {...loot, claimed: [...loot.claimed, index]});
    return true;
  };
}

export async function publishScenario(scenario, {officers = []} = {}) {
  let folder = game.folders.find(f => (f.type === "JournalEntry") && (f.name === "Scenarios"));
  folder ??= await Folder.implementation.create({name: "Scenarios", type: "JournalEntry"});
  let actorFolder = null;
  if ( officers.length ) {
    actorFolder = game.folders.find(f => (f.type === "Actor") && (f.name === "Enemy officers"))
      ?? await Folder.implementation.create({name: "Enemy officers", type: "Actor"});
    await Actor.implementation.createDocuments(officers.map(officer => ({...officer.actor, folder: actorFolder.id})));
  }
  const entry = await JournalEntry.implementation.create({
    name: scenario.name, folder: folder.id,
    pages: [
      {
        name: game.i18n.localize(scenario.kind === "war" ? "DEICIDE.Generate.WarCard" : "DEICIDE.Generate.DungeonCard"), type: "scenario", title: {show: true, level: 1}, sort: 100000,
        system: {kind: scenario.kind, warMonth: scenario.warMonth, difficulty: scenario.difficulty, card: scenario.card, payout: {...scenario.payout, applied: false}, description: scenario.text}
      },
      {name: game.i18n.localize("DEICIDE.Generate.Briefing"), type: "text", title: {show: true, level: 1}, sort: 200000, text: {format: 1, content: scenario.text}}
    ]
  });
  entry.sheet.render({force: true});
  return entry;
}

export async function importScenes({replace = false} = {}) {
  const created = [];
  for ( const source of SCENES ) {
    const existing = game.scenes.find(scene => scene.name === source.name);
    if ( existing && !replace ) continue;
    if ( existing ) await existing.delete();
    created.push(await Scene.implementation.create(foundry.utils.deepClone(source)));
  }
  if ( created.length ) ui.notifications.info(game.i18n.format("DEICIDE.Generate.ScenesImported", {count: created.length}));
  else ui.notifications.info(game.i18n.localize("DEICIDE.Generate.ScenesPresent"));
  return created;
}

export function awardText(plan) {
  const a = plan.awards;
  return `${a.xp} XP, ${formatCp(a.cp100)} CP, ${a.dust} Dust`;
}

export const generate = {npc, createNpc, army, loot, postLoot, encounter, buildMonsters, journal, publishScenario, importScenes, partyContext, storyActors};
