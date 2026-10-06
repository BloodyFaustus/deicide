import {DEICIDE} from "../config.mjs";
import {sceneMode} from "../hooks/scene-mode.mjs";

const {HandlebarsApplicationMixin, ApplicationV2} = foundry.applications.api;

export class Deployment extends HandlebarsApplicationMixin(ApplicationV2) {

  static DEFAULT_OPTIONS = {
    id: "deicide-deployment",
    classes: ["deicide", "deployment"],
    window: {title: "Deployment", icon: "fa-solid fa-flag", resizable: true},
    position: {width: 720, height: 600},
    actions: {
      toggle: Deployment.#onToggle,
      placeAll: Deployment.#onPlaceAll
    }
  };

  static PARTS = {
    body: {template: "systems/deicide/templates/apps/deployment.hbs", scrollable: [""]}
  };

  #selected = new Set();

  async _prepareContext(options) {
    const mode = sceneMode();
    const engine = DEICIDE.modes[mode]?.engine ?? "war";
    const characters = game.actors.filter(a => a.type === "character");
    const story = characters.filter(a => a.system.recruit.story || !a.system.recruit.profile);
    const recruits = characters.filter(a => a.system.recruit.profile && !a.system.recruit.story);
    const companies = game.actors.filter(a => (a.type === "company") && (a.system.side === "lathander"));
    const row = actor => ({
      id: actor.id, name: actor.name, img: actor.img, level: actor.system.level ?? null,
      status: actor.system.recruit?.status ?? "", selected: this.#selected.has(actor.id),
      detail: actor.type === "company" ? `Q${actor.system.quality} S${actor.system.strength}${actor.system.routed ? `, ${game.i18n.localize("DEICIDE.Company.Routed")}` : ""}` : game.i18n.format("DEICIDE.Deployment.Detail", {level: actor.system.level, className: actor.derived?.activeClass ?? ""})
    });
    const counts = {
      sheets: story.filter(a => this.#selected.has(a.id)).length,
      sworn: recruits.filter(a => this.#selected.has(a.id)).length,
      companies: companies.filter(a => this.#selected.has(a.id)).length
    };
    const check = game.deicide.strategic.checkDeployment({...counts, mode});
    return {
      mode, engine, modeLabel: game.i18n.localize(DEICIDE.modes[mode]?.label ?? mode),
      story: story.map(row), recruits: recruits.map(row), companies: engine === "war" ? companies.map(row) : [],
      counts, limits: check.limits, warnings: check.warnings, ok: check.ok, isGM: game.user.isGM
    };
  }

  static async #onToggle(event, target) {
    const id = target.closest("[data-actor-id]")?.dataset.actorId;
    if ( !id ) return;
    if ( this.#selected.has(id) ) this.#selected.delete(id);
    else this.#selected.add(id);
    this.render();
  }

  static async #onPlaceAll() {
    if ( !canvas.scene || !game.user.isGM ) return;
    const size = canvas.grid.size;
    const data = [];
    let index = 0;
    for ( const id of this.#selected ) {
      const actor = game.actors.get(id);
      if ( !actor ) continue;
      const token = await actor.getTokenDocument({x: size, y: size * (1 + index++)});
      data.push(token.toObject());
    }
    if ( data.length ) await canvas.scene.createEmbeddedDocuments("Token", data);
    ui.notifications.info(`${data.length} tokens placed.`);
  }
}
