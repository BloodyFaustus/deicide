import {DEICIDE} from "../config.mjs";

const {JournalEntryPageHandlebarsSheet} = foundry.applications.sheets.journal;

export class ScenarioPageSheet extends JournalEntryPageHandlebarsSheet {

  static DEFAULT_OPTIONS = {
    classes: ["deicide-scenario"],
    window: {icon: "fa-solid fa-map"},
    actions: {
      applyPayout: ScenarioPageSheet.#onApplyPayout,
      applyDefeat: ScenarioPageSheet.#onApplyDefeat
    }
  };

  static EDIT_PARTS = {
    header: super.EDIT_PARTS.header,
    content: {template: "systems/deicide/templates/journal/scenario-edit.hbs", classes: ["standard-form"]},
    footer: super.EDIT_PARTS.footer
  };

  static VIEW_PARTS = {
    content: {template: "systems/deicide/templates/journal/scenario-view.hbs", root: true}
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const system = this.page.system;
    context.system = system;
    context.isGM = game.user.isGM;
    context.kindLabel = system.kind === "war" ? "War scenario" : "Dungeon expedition";
    context.cardJson = JSON.stringify(system.card, null, 2);
    context.payoutTracks = Object.entries(system.payout.tracks ?? {}).map(([track, delta]) => ({label: game.i18n.localize(DEICIDE.nationTracks[track]?.label ?? track), delta}));
    context.tracksJson = JSON.stringify(system.payout.tracks ?? {});
    context.dropsText = (system.payout.drops ?? []).join(", ");
    context.difficulties = Object.keys(DEICIDE.difficulty);
    context.descriptionHtml = await foundry.applications.ux.TextEditor.implementation.enrichHTML(system.description ?? "", {relativeTo: this.page});
    return context;
  }

  _onRender(context, options) {
    super._onRender(context, options);
    const tracks = this.element.querySelector("textarea[name='payoutTracksJson']");
    tracks?.addEventListener("change", async event => {
      try { await this.page.update({"system.payout.tracks": JSON.parse(event.currentTarget.value || "{}")}); }
      catch ( error ) { ui.notifications.error(error.message); }
    });
    const card = this.element.querySelector("textarea[name='cardJson']");
    card?.addEventListener("change", async event => {
      try { await this.page.update({"system.card": JSON.parse(event.currentTarget.value || "{}")}); }
      catch ( error ) { ui.notifications.error(error.message); }
    });
    const drops = this.element.querySelector("input[name='dropsText']");
    drops?.addEventListener("change", async event => {
      await this.page.update({"system.payout.drops": event.currentTarget.value.split(",").map(v => v.trim()).filter(Boolean)});
    });
  }

  static async #onApplyPayout() {
    await game.deicide.strategic.applyScenarioPayout(this.page, {victory: true});
    this.render();
  }

  static async #onApplyDefeat() {
    await game.deicide.strategic.applyScenarioPayout(this.page, {victory: false});
    this.render();
  }
}
