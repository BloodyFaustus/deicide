import {DEICIDE} from "../config.mjs";
import {dungeonProfile} from "../rules/collapse.mjs";
import {DeicideItemSheetBase} from "./base-sheets.mjs";

const {TextEditor} = foundry.applications.ux;

export class DeicideItemSheet extends DeicideItemSheetBase {

  static DEFAULT_OPTIONS = {
    classes: ["deicide", "sheet", "item"],
    position: {width: 600, height: 640},
    actions: {
      toggleEquipped: DeicideItemSheet.#onToggleEquipped
    }
  };

  static PARTS = {
    header: {template: "systems/deicide/templates/item/header.hbs"},
    body: {template: "systems/deicide/templates/item/body.hbs", scrollable: [""]}
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const item = this.document;
    const system = item.system;
    const d = system.derived ?? {};
    context.type = item.type;
    context.typeLabel = game.i18n.localize(`TYPES.Item.${item.type}`);
    context.derived = d;
    context.isGM = game.user.isGM;
    context.automationLevels = ["full", "partial", "manual"];
    const options2 = (table, labels = true) => Object.entries(table).map(([id, entry]) => ({id, label: labels && entry?.label ? game.i18n.localize(entry.label) : id}));

    switch ( item.type ) {
      case "ability": {
        context.skillTypes = options2(DEICIDE.skillTypes);
        context.bases = options2(DEICIDE.attackBases);
        context.sources = options2(DEICIDE.mightSources);
        context.defenses = options2(DEICIDE.defenses);
        context.elements = options2(DEICIDE.elements);
        context.attackJson = JSON.stringify(system.attack, null, 2);
        context.warJson = JSON.stringify(system.war, null, 2);
        context.dungeonJson = JSON.stringify(system.dungeon, null, 2);
        context.modifiersJson = JSON.stringify(system.modifiers, null, 2);
        context.statusesJson = JSON.stringify(system.statuses, null, 2);
        context.collapse = dungeonProfile(system, {mag: 10});
        context.engineLabels = (d.engines ?? []).join(", ");
        break;
      }
      case "class": {
        context.growth = DEICIDE.attributeIds.map(attr => ({attr, abbr: DEICIDE.attributes[attr].abbr, letter: system.growth[attr], tenths: d.growthLine?.[attr] ?? 0, cap: d.caps?.[attr]}));
        context.types = options2(DEICIDE.classTypes).map(entry => ({...entry, active: system.types.includes(entry.id)}));
        context.skills = system.skills.map(skill => ({...skill, name: game.deicide.catalog.get("ability", skill.id)?.name ?? skill.id}));
        context.trainsPrimary = system.trains.primary.join(", ");
        context.trainsSecondary = system.trains.secondary.join(", ");
        context.prerequisitesJson = JSON.stringify(system.prerequisites, null, 2);
        break;
      }
      case "origin": {
        context.kinds = ["people", "background", "talent"];
        context.detailJson = JSON.stringify({growth: system.growth, subtypes: system.subtypes, classGrowthLocks: system.classGrowthLocks, proficiencies: system.proficiencies, flags: system.flags, modifiers: system.modifiers, points: system.points, grants: system.grants, start: system.start, caps: system.caps, hpPerLevel: system.hpPerLevel, flex: system.flex, proficiency: system.proficiency, wild: system.wild}, null, 2);
        context.originJson = Object.fromEntries(["modifiers", "flags", "grants", "points", "growth", "subtypes"].map(key => [key, JSON.stringify(system[key] ?? null, null, 2)]));
        break;
      }
      case "weapon": {
        const g = DEICIDE.weaponGenerator;
        context.lines = Object.keys(g.lines);
        context.tiers = Object.keys(g.tiers);
        context.prefixes = Object.keys(g.prefixes).filter(prefix => game.deicide.rules.economy.prefixAllowed(prefix, system.line, system.tier));
        context.elements = options2(DEICIDE.elements).filter(entry => DEICIDE.elements[entry.id].natural);
        context.ppBreakdown = [
          {label: `${system.line} base`, value: g.lines[system.line]?.pp ?? 0},
          {label: `${system.tier} tier`, value: g.tiers[system.tier]?.pp ?? 0},
          system.prefix ? {label: `${system.prefix} prefix`, value: g.prefixes[system.prefix]?.pp ?? 0} : null
        ].filter(Boolean);
        context.arts = (d.arts ?? []).map(id => game.deicide.catalog.get("ability", id)?.name ?? id);
        break;
      }
      case "offhand": {
        context.lines = Object.keys(DEICIDE.offhand);
        context.tiers = Object.keys(DEICIDE.offhand[system.line]?.tiers ?? {});
        break;
      }
      case "accessory": {
        context.keys = Object.keys(DEICIDE.accessories);
        context.attributes = DEICIDE.attributeIds.map(id => ({id, label: DEICIDE.attributes[id].abbr}));
        context.needsAttribute = Boolean(DEICIDE.accessories[system.key]?.attribute);
        context.needsSecond = Boolean(DEICIDE.accessories[system.key]?.secondAttribute);
        context.needsSkill = Boolean(DEICIDE.accessories[system.key]?.skillRanks);
        break;
      }
      case "named": {
        context.slots = ["weapon", "offhand", "armor", "accessory"];
        context.statsJson = JSON.stringify(system.stats, null, 2);
        context.modifiersJson = JSON.stringify(system.modifiers, null, 2);
        context.drawbackJson = JSON.stringify(system.drawback, null, 2);
        break;
      }
      case "consumable": {
        context.keys = Object.keys(system.kind === "supply" ? DEICIDE.supplies : DEICIDE.consumables);
        break;
      }
    }
    context.modifierList = (d.modifiers ?? system.modifiers ?? []).map(m => `${m.key} ${m.op === "mul" ? "x" : ""}${m.op === "set" ? "= " : ""}${m.value}${m.when ? ` (${JSON.stringify(m.when)})` : ""}`);
    context.descriptionHtml = await TextEditor.implementation.enrichHTML(system.description ?? "", {relativeTo: item});
    return context;
  }

  _onRender(context, options) {
    super._onRender(context, options);
    for ( const area of this.element.querySelectorAll("textarea[data-json]") ) {
      area.addEventListener("change", async event => {
        const field = event.currentTarget.dataset.json;
        let value;
        try { value = event.currentTarget.value.trim() ? JSON.parse(event.currentTarget.value) : null; }
        catch ( error ) { return ui.notifications.error(`${field}: ${error.message}`); }
        await this.document.update({[`system.${field}`]: value === null && !["attack", "heal", "war", "dungeon", "prerequisites", "base"].includes(field) ? [] : value});
      });
    }
    for ( const box of this.element.querySelectorAll("input[data-class-type]") ) {
      box.addEventListener("change", async event => {
        const types = new Set(this.document.system.types);
        if ( event.currentTarget.checked ) types.add(event.currentTarget.dataset.classType);
        else types.delete(event.currentTarget.dataset.classType);
        await this.document.update({"system.types": Array.from(types)});
      });
    }
    for ( const input of this.element.querySelectorAll("input[data-list]") ) {
      input.addEventListener("change", async event => {
        const values = event.currentTarget.value.split(",").map(v => v.trim()).filter(Boolean);
        await this.document.update({[`system.${event.currentTarget.dataset.list}`]: values});
      });
    }
  }

  static async #onToggleEquipped() {
    await this.document.toggleEquipped();
  }
}
