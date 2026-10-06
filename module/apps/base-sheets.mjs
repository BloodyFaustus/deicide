const {HandlebarsApplicationMixin} = foundry.applications.api;
const {ActorSheetV2, ItemSheetV2} = foundry.applications.sheets;

function pretty(value) {
  return JSON.stringify(value, (key, entry) => (entry instanceof Set) ? Array.from(entry) : entry, 2);
}

export class DeicideActorSheetBase extends HandlebarsApplicationMixin(ActorSheetV2) {

  static DEFAULT_OPTIONS = {
    classes: ["deicide", "sheet", "actor"],
    position: {width: 640, height: 700},
    window: {resizable: true},
    form: {submitOnChange: true},
    actions: {
      resetActor: DeicideActorSheetBase.#onReset
    }
  };

  static PARTS = {
    inspector: {template: "systems/deicide/templates/actor/inspector.hbs", scrollable: [""]}
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const system = this.document.system;
    context.actor = this.document;
    context.system = system;
    context.derived = system.derived ?? {};
    context.derivedJson = pretty(system.derived ?? {});
    context.sourceJson = pretty(system.toObject());
    context.items = this.document.items.map(item => ({id: item.id, name: item.name, type: item.type, equipped: item.system.equipped ?? null}));
    return context;
  }

  static async #onReset() {
    this.document.reset();
    this.render();
  }

  async _onDropItem(event, item) {
    const actor = this.document;
    if ( !actor.isOwner ) return false;
    if ( actor.type === "character" ) {
      if ( item.type === "class" ) {
        await actor.addClass(item.system.identifier, {activate: !actor.system.classes.length || event.altKey});
        return item;
      }
      if ( item.type === "origin" ) {
        const field = {people: "people", background: "background", talent: "talent.id"}[item.system.kind];
        if ( field ) await actor.update({[`system.${field}`]: item.system.identifier});
        return item;
      }
    }
    return super._onDropItem(event, item);
  }
}

export class DeicideItemSheetBase extends HandlebarsApplicationMixin(ItemSheetV2) {

  static DEFAULT_OPTIONS = {
    classes: ["deicide", "sheet", "item"],
    position: {width: 560, height: 600},
    window: {resizable: true},
    form: {submitOnChange: true}
  };

  static PARTS = {
    inspector: {template: "systems/deicide/templates/item/inspector.hbs", scrollable: [""]}
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const system = this.document.system;
    context.item = this.document;
    context.system = system;
    context.derivedJson = pretty(system.derived ?? {});
    context.sourceJson = pretty(system.toObject());
    context.descriptionHtml = await foundry.applications.ux.TextEditor.implementation.enrichHTML(system.description ?? "", {relativeTo: this.document});
    return context;
  }
}
