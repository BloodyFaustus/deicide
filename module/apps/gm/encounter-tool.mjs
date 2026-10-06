import {DEICIDE} from "../../config.mjs";
import {awardText, buildMonsters, createNpc, encounter, journal, partyContext, postLoot, storyActors} from "./generate.mjs";

const {HandlebarsApplicationMixin, ApplicationV2} = foundry.applications.api;

export class EncounterTool extends HandlebarsApplicationMixin(ApplicationV2) {

  static DEFAULT_OPTIONS = {
    id: "deicide-encounter-tool",
    classes: ["deicide", "gm-tool", "encounter-tool"],
    tag: "form",
    window: {title: "DEICIDE.Generate.EncounterTitle", icon: "fa-solid fa-skull", resizable: true},
    position: {width: 640, height: 720},
    form: {handler: EncounterTool.#onSubmit, submitOnChange: true, closeOnSubmit: false},
    actions: {
      award: EncounterTool.#onAward,
      buildMonsters: EncounterTool.#onBuildMonsters,
      buildBoss: EncounterTool.#onBuildBoss,
      buildOfficers: EncounterTool.#onBuildOfficers,
      journal: EncounterTool.#onJournal,
      postLoot: EncounterTool.#onPostLoot
    }
  };

  static PARTS = {
    body: {template: "systems/deicide/templates/apps/gm/encounter-tool.hbs", scrollable: [""]}
  };

  #input = null;

  static open(input = {}) {
    const app = new EncounterTool();
    app.#input = {...app.#defaults(), ...input};
    return app.render({force: true});
  }

  #defaults() {
    const context = partyContext();
    return {...context.dials, partyLevel: context.partyLevel, difficulty: "standard", kind: "dungeonFight", enemyTier: 1, lootKind: "standard", lootMode: "dungeon", officerWeapon: "", homunculusId: ""};
  }

  async _prepareContext() {
    this.#input ??= this.#defaults();
    const input = this.#input;
    const plan = encounter({N: input.N, S: input.S, L: input.L, partyLevel: input.partyLevel, difficulty: input.difficulty, kind: input.kind, enemyTier: input.enemyTier});
    const homunculi = game.deicide.catalog.all("monster", entry => (entry.system.tags ?? []).includes("homunculus")).map(entry => ({id: entry.identifier, name: entry.name}));
    return {
      input, plan, awards: awardText(plan),
      difficulties: Object.keys(DEICIDE.difficulty).map(id => ({id, label: game.i18n.localize(`DEICIDE.Generate.Difficulty.${id}`)})),
      kinds: ["dungeonFight", "boss", "warBattle"].map(id => ({id, label: game.i18n.localize(`DEICIDE.Generate.Kind.${id}`)})),
      lootKinds: ["standard", "boss", "officer", "homunculus"].map(id => ({id, label: game.i18n.localize(`DEICIDE.Generate.Encounter.${id}`)})),
      homunculi,
      deployed: this.#deployed().map(actor => actor.name).join(", "),
      nation: Boolean(game.deicide.nation.actor),
      isGM: game.user.isGM
    };
  }

  #deployed() {
    const combat = game.combat;
    if ( combat?.started ) {
      return combat.combatants.map(c => c.actor).filter(actor => actor?.type === "character");
    }
    const onScene = new Set((canvas.scene?.tokens ?? []).map(token => token.actor?.id).filter(Boolean));
    const candidates = [...storyActors(), ...game.actors.filter(actor => (actor.type === "character") && ["attached", "sworn", "bound"].includes(actor.system.recruit.status))];
    const present = candidates.filter(actor => onScene.has(actor.id));
    return present.length ? present : storyActors();
  }

  static async #onSubmit(event, form, formData) {
    const data = formData.object;
    this.#input = {
      ...this.#input,
      N: Number(data.N) || 1, S: Number(data.S) || 1, L: Number(data.L) || 20, partyLevel: Number(data.partyLevel) || 1,
      difficulty: data.difficulty, kind: data.kind, enemyTier: Number(data.enemyTier) || 1,
      lootKind: data.lootKind, lootMode: data.lootMode, officerWeapon: data.officerWeapon ?? "", homunculusId: data.homunculusId ?? ""
    };
    this.render();
  }

  #plan() {
    const i = this.#input;
    return encounter({N: i.N, S: i.S, L: i.L, partyLevel: i.partyLevel, difficulty: i.difficulty, kind: i.kind, enemyTier: i.enemyTier});
  }

  static async #onAward() {
    const actors = this.#deployed();
    if ( !actors.length ) { ui.notifications.warn(game.i18n.localize("DEICIDE.Generate.NoDeployed")); return; }
    const i = this.#input;
    await game.deicide.strategic.awardEncounter(actors, {kind: i.kind, enemyTier: i.enemyTier, difficulty: i.difficulty});
  }

  static async #onBuildMonsters() {
    const plan = this.#plan();
    const count = await foundry.applications.api.DialogV2.prompt({
      window: {title: game.i18n.localize("DEICIDE.Generate.BuildMonsters")},
      content: `<p>${game.i18n.format("DEICIDE.Generate.MonsterCountHint", {low: plan.count[0], high: plan.count[1]})}</p><input type="number" name="count" value="${plan.count[0]}" min="1" max="12" autofocus>`,
      ok: {label: game.i18n.localize("DEICIDE.Generate.Build"), callback: (event, button) => Number(button.form.elements.count.value)}
    });
    if ( !count ) return;
    const created = await buildMonsters(plan, {count});
    ui.notifications.info(game.i18n.format("DEICIDE.Generate.MonstersBuilt", {count: created.length}));
  }

  static async #onBuildBoss() {
    const created = await buildMonsters(this.#plan(), {boss: true});
    created[0]?.sheet.render({force: true});
  }

  static async #onBuildOfficers() {
    const plan = this.#plan();
    const classLine = await foundry.applications.api.DialogV2.prompt({
      window: {title: game.i18n.localize("DEICIDE.Generate.BuildOfficers")},
      content: `<p>${game.i18n.localize("DEICIDE.Generate.OfficerLineHint")}</p><input type="text" name="line" value="cadet, captain" autofocus>`,
      ok: {label: game.i18n.localize("DEICIDE.Generate.Build"), callback: (event, button) => button.form.elements.line.value}
    });
    if ( !classLine ) return;
    const actor = await createNpc({level: plan.enemyLevel, classLine: classLine.split(",").map(s => s.trim()).filter(Boolean), people: "foreignHuman", profile: "enemy", faction: "offweiss", seed: Math.floor(Math.random() * 100000), role: game.i18n.localize("DEICIDE.Generate.OfficerRole")});
    if ( actor ) actor.sheet.render({force: true});
  }

  static async #onJournal() {
    const text = await journal(this.#plan());
    ui.notifications.info(text);
  }

  static async #onPostLoot() {
    const i = this.#input;
    await postLoot({encounter: i.lootKind, mode: i.lootMode, partyLevel: i.partyLevel, officerWeapon: i.officerWeapon || undefined, homunculusId: i.homunculusId || undefined, seed: Math.floor(Math.random() * 100000)});
  }
}
