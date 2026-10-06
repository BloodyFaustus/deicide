import {DEICIDE} from "../config.mjs";
import {CHOSEN_WEAPON} from "../rules/proficiency.mjs";

const {HandlebarsApplicationMixin, ApplicationV2} = foundry.applications.api;

export class ClassTree extends HandlebarsApplicationMixin(ApplicationV2) {

  static DEFAULT_OPTIONS = {
    id: "deicide-class-tree-{id}",
    classes: ["deicide", "class-tree"],
    window: {title: "Class tree", icon: "fa-solid fa-sitemap", resizable: true},
    position: {width: 960, height: 640},
    actions: {
      addClass: ClassTree.#onAddClass,
      openClass: ClassTree.#onOpenClass
    }
  };

  static PARTS = {
    tree: {template: "systems/deicide/templates/apps/class-tree.hbs", scrollable: [".tiers"]}
  };

  constructor(options = {}) {
    super(options);
    this.actor = options.actor ?? null;
  }

  get title() {
    return this.actor ? `Class tree: ${this.actor.name}` : "Class tree";
  }

  async _prepareContext(options) {
    const actor = this.actor;
    const lookup = actor?.lookup ?? game.deicide.catalog.lookup();
    const derived = actor?.derived ?? {};
    const access = new Map((derived.availableClasses ?? []).map(entry => [entry.id, entry]));
    const profs = derived.proficiencies ?? {};
    const tiers = [1, 2, 3, 4].map(tier => ({tier, gate: tier === 1 ? 1 : (game.deicide.nation.tierGates[tier - 2] ?? "story"), classes: []}));
    for ( const entry of game.deicide.catalog.all("class", e => !e.system.enemyOnly) ) {
      const data = entry.system;
      const state = access.get(data.identifier);
      const trains = list => list.map(id => id === CHOSEN_WEAPON ? "chosen weapon" : game.i18n.localize(DEICIDE.proficiencies[id]?.label ?? id)).join(", ");
      tiers[data.tier - 1]?.classes.push({
        id: data.identifier, name: entry.name, types: data.types.map(type => game.i18n.localize(DEICIDE.classTypes[type]?.label ?? type)).join(", "),
        growth: DEICIDE.attributeIds.map(attr => `${DEICIDE.attributes[attr].abbr} ${data.growth?.[attr] || "F"}`).join(" "),
        trains: `${trains(data.trains.primary)} / ${trains(data.trains.secondary)}`,
        prerequisiteText: data.prerequisiteText,
        owned: Boolean(state?.owned), ok: Boolean(state?.ok), levelOk: state?.levelOk ?? true,
        missing: (state?.missing ?? []).map(leaf => leaf.kind === "prof"
          ? `${game.i18n.localize(DEICIDE.proficiencies[leaf.prof]?.label ?? leaf.prof)} ${leaf.grade} (have ${profs[leaf.prof] ?? "none"})`
          : leaf.kind === "level" ? `level ${leaf.value}` : `${leaf.kind}${leaf.value ? ` ${leaf.value}` : ""}`).join(", "),
        active: data.identifier === actor?.system.activeClass
      });
    }
    for ( const tier of tiers ) tier.classes.sort((a, b) => (Number(b.owned) - Number(a.owned)) || (Number(b.ok) - Number(a.ok)) || a.name.localeCompare(b.name));
    return {actor, tiers, proficiencies: DEICIDE.proficiencyIds.map(id => ({label: game.i18n.localize(DEICIDE.proficiencies[id].label), grade: profs[id] ?? "none"}))};
  }

  static async #onAddClass(event, target) {
    if ( !this.actor ) return;
    await this.actor.addClass(target.dataset.classId, {activate: event.altKey});
    this.render();
  }

  static async #onOpenClass(event, target) {
    const entry = game.deicide.catalog.get("class", target.dataset.classId);
    const doc = entry?.uuid ? await fromUuid(entry.uuid) : null;
    doc?.sheet.render({force: true});
  }
}
