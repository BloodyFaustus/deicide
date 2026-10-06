import {DEICIDE, SYSTEM_ID} from "./config.mjs";
import {buildApi} from "./api.mjs";
import {buildCatalog, refreshActors, registerCatalogHooks, scanCompendiums, syncWorldLayer} from "./content/loader.mjs";
import {registerSceneModeHooks} from "./hooks/scene-mode.mjs";
import {DeicideActor} from "./documents/actor.mjs";
import {DeicideItem} from "./documents/item.mjs";
import {CharacterData} from "./data/actor-character.mjs";
import {CompanyData} from "./data/actor-company.mjs";
import {MonsterData} from "./data/actor-monster.mjs";
import {NationData} from "./data/actor-nation.mjs";
import {AbilityData} from "./data/item-ability.mjs";
import {ClassData} from "./data/item-class.mjs";
import {OriginData} from "./data/item-origin.mjs";
import {
  AccessoryData, ArmorData, ConsumableData, NamedData, OffhandData, PinData, WeaponData
} from "./data/item-equipment.mjs";
import {
  ActionMessageData, DungeonCombatData, ScenarioPageData, StatusEffectData, UnitCombatantData, WarCombatData
} from "./data/combat.mjs";
import {TerrainBehaviorData} from "./data/region-behavior-terrain.mjs";
import {DeicideActorSheetBase, DeicideItemSheetBase} from "./apps/base-sheets.mjs";
import {DeicideCombat, DeicideCombatant} from "./documents/combat.mjs";
import {DeicideCombatTracker} from "./apps/combat-tracker.mjs";
import {DungeonStage} from "./apps/dungeon-stage.mjs";
import {combatEngines} from "./combat/engines.mjs";
import {actions, registerCardHooks} from "./combat/action-flow.mjs";
import {statuses} from "./combat/statuses.mjs";
import {stances} from "./combat/stances.mjs";
import {field} from "./combat/field.mjs";
import {effectsApply} from "./combat/effects-apply.mjs";
import {registerReactionQueries, ReactionPrompt} from "./combat/reaction-prompt.mjs";
import {settleBonds, registerWarQueries} from "./combat/engines.mjs";
import {effectKinds} from "./rules/effects.mjs";
import {terrain} from "./hooks/terrain.mjs";
import {CharacterSheet} from "./apps/character-sheet.mjs";
import {CompanySheet, MonsterSheet, NationSheet} from "./apps/other-sheets.mjs";
import {DeicideItemSheet} from "./apps/item-sheet.mjs";
import {ClassTree} from "./apps/class-tree.mjs";
import {ScenarioPageSheet} from "./apps/scenario-page-sheet.mjs";
import {Deployment} from "./apps/deployment.mjs";
import {strategic} from "./strategic/strategic.mjs";
import {registerSceneConfigHooks, TerrainBrush} from "./hooks/scene-config.mjs";
import {generate, registerLootHooks} from "./apps/gm/generate.mjs";
import {NpcGenerator} from "./apps/gm/npc-generator.mjs";
import {EncounterTool} from "./apps/gm/encounter-tool.mjs";
import {ScenarioBuilder} from "./apps/gm/scenario-builder.mjs";
import {overlays, registerTokenOverlays, restoreSight} from "./hooks/token-overlays.mjs";

const ACTOR_MODELS = {character: CharacterData, company: CompanyData, monster: MonsterData, nation: NationData};
const ITEM_MODELS = {
  ability: AbilityData, class: ClassData, origin: OriginData, weapon: WeaponData, armor: ArmorData,
  offhand: OffhandData, accessory: AccessoryData, pin: PinData, consumable: ConsumableData, named: NamedData
};

Hooks.once("init", () => {
  console.log(`${SYSTEM_ID} | Initializing Deicide`);
  CONFIG.DEICIDE = DEICIDE;

  CONFIG.Actor.documentClass = DeicideActor;
  CONFIG.Actor.dataModels = ACTOR_MODELS;
  CONFIG.Item.documentClass = DeicideItem;
  CONFIG.Item.dataModels = ITEM_MODELS;
  CONFIG.Combat.documentClass = DeicideCombat;
  CONFIG.Combat.dataModels.war = WarCombatData;
  CONFIG.Combat.dataModels.dungeon = DungeonCombatData;
  CONFIG.Combatant.documentClass = DeicideCombatant;
  CONFIG.Combatant.dataModels.unit = UnitCombatantData;
  CONFIG.ui.combat = DeicideCombatTracker;
  CONFIG.ActiveEffect.dataModels.status = StatusEffectData;
  CONFIG.ChatMessage.dataModels.action = ActionMessageData;
  CONFIG.RegionBehavior.dataModels.terrain = TerrainBehaviorData;
  CONFIG.RegionBehavior.typeIcons.terrain = "fa-solid fa-mountain-sun";
  CONFIG.JournalEntryPage.dataModels.scenario = ScenarioPageData;

  CONFIG.Actor.trackableAttributes = {
    character: {bar: ["hp", "channel", "matter"], value: ["static", "manaburn", "saturation", "marks", "divineAttention", "dust"]},
    company: {bar: ["hp"], value: ["strength", "quality", "veterancy"]},
    monster: {bar: ["hp"], value: ["level", "def", "res", "spd"]},
    nation: {bar: [], value: ["dust", "warMonth"]}
  };

  CONFIG.statusEffects = Object.entries(DEICIDE.statuses).map(([id, status], index) => ({
    id, name: status.label, img: status.img, order: index + 1, type: "status",
    system: {statusId: id, changes: []}
  }));
  CONFIG.specialStatusEffects.DEFEATED = "downed";

  const {DocumentSheetConfig} = foundry.applications.apps;
  DocumentSheetConfig.registerSheet(foundry.documents.Actor, SYSTEM_ID, CharacterSheet, {types: ["character"], makeDefault: true, label: "DEICIDE.Sheet.Character"});
  DocumentSheetConfig.registerSheet(foundry.documents.Actor, SYSTEM_ID, CompanySheet, {types: ["company"], makeDefault: true, label: "DEICIDE.Sheet.Company"});
  DocumentSheetConfig.registerSheet(foundry.documents.Actor, SYSTEM_ID, MonsterSheet, {types: ["monster"], makeDefault: true, label: "DEICIDE.Sheet.Monster"});
  DocumentSheetConfig.registerSheet(foundry.documents.Actor, SYSTEM_ID, NationSheet, {types: ["nation"], makeDefault: true, label: "DEICIDE.Sheet.Nation"});
  DocumentSheetConfig.registerSheet(foundry.documents.Actor, SYSTEM_ID, DeicideActorSheetBase, {types: Object.keys(ACTOR_MODELS), makeDefault: false, label: "DEICIDE.Sheet.Inspector"});
  DocumentSheetConfig.registerSheet(foundry.documents.Item, SYSTEM_ID, DeicideItemSheet, {types: Object.keys(ITEM_MODELS), makeDefault: true, label: "DEICIDE.Sheet.Item"});
  DocumentSheetConfig.registerSheet(foundry.documents.Item, SYSTEM_ID, DeicideItemSheetBase, {types: Object.keys(ITEM_MODELS), makeDefault: false, label: "DEICIDE.Sheet.Inspector"});
  DocumentSheetConfig.registerSheet(foundry.documents.JournalEntryPage, SYSTEM_ID, ScenarioPageSheet, {types: ["scenario"], makeDefault: true, label: "DEICIDE.Sheet.Scenario"});

  game.settings.register(SYSTEM_ID, "worldSchemaVersion", {
    name: "World schema version", scope: "world", config: false, type: Number, default: 0
  });
  game.settings.register(SYSTEM_ID, "autoReactions", {
    name: "DEICIDE.Settings.AutoReactions", hint: "DEICIDE.Settings.AutoReactionsHint",
    scope: "world", config: true, type: Boolean, default: true
  });
  registerReactionQueries();
  registerWarQueries();

  const catalog = buildCatalog();
  game.deicide = buildApi({
    catalog,
    version: game.system.version,
    documents: {DeicideActor, DeicideItem, DeicideCombat, DeicideCombatant},
    apps: {CharacterSheet, CompanySheet, MonsterSheet, NationSheet, DeicideItemSheet, ScenarioPageSheet, ClassTree, Deployment, TerrainBrush, DeicideActorSheetBase, DeicideItemSheetBase, DeicideCombatTracker, DungeonStage, NpcGenerator, EncounterTool, ScenarioBuilder}
  });
  game.deicide.registries.combatEngines = combatEngines;
  game.deicide.registries.effectKinds = effectKinds;
  game.deicide.stances = stances;
  game.deicide.field = field;
  game.deicide.effects = effectsApply;
  game.deicide.apps.ReactionPrompt = ReactionPrompt;
  game.deicide.pipelines.action = actions.pipeline;
  game.deicide.actions = actions;
  game.deicide.statuses = statuses;
  game.deicide.terrain = terrain;
  game.deicide.strategic = strategic;
  game.deicide.generate = generate;
  game.deicide.overlays = overlays;
  registerLootHooks();
  registerTokenOverlays();
  registerCatalogHooks(catalog);
  registerSceneModeHooks();
  registerSceneConfigHooks();
  registerCardHooks();
  terrain.register();
  TerrainBrush.registerControls();

  Hooks.callAll("deicide.register", game.deicide);
});

Hooks.on("renderActorDirectory", (app, html) => {
  if ( !game.user.isGM ) return;
  const header = html.querySelector(".directory-header .header-actions");
  if ( !header || header.querySelector(".deicide-gm-tools") ) return;
  const tools = [
    ["npc", "fa-user-plus", "DEICIDE.Generate.NpcTitle", () => NpcGenerator.open()],
    ["encounter", "fa-skull", "DEICIDE.Generate.EncounterTitle", () => EncounterTool.open()],
    ["scenario", "fa-map", "DEICIDE.Generate.ScenarioTitle", () => ScenarioBuilder.open()]
  ];
  const group = document.createElement("div");
  group.className = "deicide-gm-tools flexrow";
  for ( const [id, icon, label, open] of tools ) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "deicide-tool";
    button.dataset.tool = id;
    button.dataset.tooltip = game.i18n.localize(label);
    button.innerHTML = `<i class="fa-solid ${icon}"></i>`;
    button.addEventListener("click", open);
    group.append(button);
  }
  header.append(group);
});

Hooks.on("renderSceneDirectory", (app, html) => {
  if ( !game.user.isGM ) return;
  const header = html.querySelector(".directory-header .header-actions");
  if ( !header || header.querySelector(".deicide-import-scenes") ) return;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "deicide-import-scenes";
  button.dataset.tooltip = game.i18n.localize("DEICIDE.Generate.ImportScenesHint");
  button.innerHTML = `<i class="fa-solid fa-layer-group"></i> ${game.i18n.localize("DEICIDE.Generate.ImportScenes")}`;
  button.addEventListener("click", () => generate.importScenes());
  header.append(button);
});

Hooks.on("updateActor", async (actor, changes, options, userId) => {
  if ( (game.user.id !== userId) || (actor.type !== "monster") || !foundry.utils.hasProperty(changes, "system.hp.value") ) return;
  const percent = (actor.system.hp.value / Math.max(actor.system.hp.max, 1)) * 100;
  const breaks = actor.system.phaseBreaks.map((entry, index) => ({...entry, index})).filter(entry => !entry.triggered && (percent <= entry.percent));
  if ( !breaks.length ) return;
  const updated = actor.system.phaseBreaks.map(entry => ({...entry, triggered: entry.triggered || breaks.some(b => b.percent === entry.percent)}));
  await actor.update({"system.phaseBreaks": updated});
  for ( const entry of breaks ) {
    await ChatMessage.implementation.create({
      content: `<p class="deicide-phase boss"><strong>${actor.name}</strong> at ${entry.percent} percent: ${entry.note || "phase break"}</p>`,
      speaker: {alias: "Dungeon Mode"}
    });
    ui.notifications?.warn(`${actor.name}: phase ${entry.percent} percent. ${entry.note}`);
    Hooks.callAll("deicide.phaseBreak", actor, entry);
  }
});

Hooks.on("deleteCombat", async (combat, options, userId) => {
  if ( game.user.id !== userId ) return;
  await settleBonds(combat);
  await restoreSight(combat);
  for ( const combatant of combat.combatants ) {
    if ( combatant.actor ) await statuses.expire(combatant.actor, {kind: "battle"});
  }
});

Hooks.once("setup", () => {
  syncWorldLayer(game.deicide.catalog);

  for ( const actor of game.actors ) actor.reset();
});

Hooks.once("ready", async () => {
  const count = await scanCompendiums(game.deicide.catalog);
  if ( count ) refreshActors();
  console.log(`${SYSTEM_ID} | Ready. Catalog: ${JSON.stringify(game.deicide.catalog.counts())}`);
  Hooks.callAll("deicide.ready", game.deicide);
});
