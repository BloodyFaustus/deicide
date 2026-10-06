import {DEICIDE} from "../../config.mjs";
import {npc, createNpc, partyContext} from "./generate.mjs";

const {HandlebarsApplicationMixin, ApplicationV2} = foundry.applications.api;

export class NpcGenerator extends HandlebarsApplicationMixin(ApplicationV2) {

  static DEFAULT_OPTIONS = {
    id: "deicide-npc-generator",
    classes: ["deicide", "gm-tool", "npc-generator"],
    tag: "form",
    window: {title: "DEICIDE.Generate.NpcTitle", icon: "fa-solid fa-user-plus", resizable: true},
    position: {width: 760, height: 680},
    form: {handler: NpcGenerator.#onSubmit, submitOnChange: true, closeOnSubmit: false},
    actions: {
      generate: NpcGenerator.#onGenerate,
      create: NpcGenerator.#onCreate,
      reroll: NpcGenerator.#onReroll
    }
  };

  static PARTS = {
    body: {template: "systems/deicide/templates/apps/gm/npc-generator.hbs", scrollable: [".preview"]}
  };

  #input = null;

  #result = null;

  static open(input = {}) {
    const app = new NpcGenerator();
    app.#input = {...app.#defaults(), ...input};
    return app.render({force: true});
  }

  #defaults() {
    const context = partyContext();
    return {
      name: "", level: context.partyLevel, base: "soldier", tier2: "", tier3: "", people: "manaborne", subtype: "", profile: "standard",
      talent: "", faction: "lathander", budgetDust: "", seed: Math.floor(Math.random() * 100000), personalSkill: "", named: false, namedItems: "", role: ""
    };
  }

  async _prepareContext() {
    this.#input ??= this.#defaults();
    const input = this.#input;
    const catalog = game.deicide.catalog;
    const classes = catalog.all("class").map(entry => ({id: entry.identifier, name: entry.name, tier: entry.system.tier, enemyOnly: entry.system.enemyOnly, layered: entry.system.layered}))
      .filter(entry => !entry.layered).sort((a, b) => a.name.localeCompare(b.name));
    const origins = catalog.all("origin").map(entry => ({id: entry.identifier, name: entry.name, kind: entry.system.kind, subtypes: Object.keys(entry.system.subtypes ?? {})}));
    const peoples = origins.filter(entry => entry.kind === "people").sort((a, b) => a.name.localeCompare(b.name));
    const talents = origins.filter(entry => entry.kind === "talent").sort((a, b) => a.name.localeCompare(b.name));
    const people = peoples.find(entry => entry.id === input.people);
    const pool = [...Object.values(DEICIDE.personalSkills.named), ...(DEICIDE.personalSkills.pools[input.base] ?? [])].map(entry => ({id: entry.id, name: entry.name, summary: entry.summary}));
    const result = this.#result;
    return {
      input,
      classes: {tier1: classes.filter(c => c.tier === 1), tier2: classes.filter(c => c.tier === 2), tier3: classes.filter(c => c.tier === 3)},
      peoples, subtypes: people?.subtypes ?? [], talents,
      profiles: Object.keys(DEICIDE.generate.npcProfiles).map(id => ({id, label: game.i18n.localize(`DEICIDE.Generate.Profile.${id}`)})),
      factions: Object.keys(DEICIDE.generate.names).map(id => ({id, label: game.i18n.localize(`DEICIDE.Generate.Side.${id}`)})),
      pool,
      result: result ? {
        summary: result.summary, errors: result.errors, ok: Boolean(result.actor),
        detail: result.detail, ranks: Object.entries(result.detail.ranks ?? {}).map(([id, r]) => `${id} ${r.rank}`).join(", "),
        attributes: DEICIDE.attributeIds.map(id => ({abbr: DEICIDE.attributes[id].abbr, value: result.detail.attributes?.[id] ?? 0})),
        items: (result.actor?.items ?? []).map(item => item.name)
      } : null,
      isGM: game.user.isGM
    };
  }

  #read(formData) {
    const data = formData.object;
    return {
      ...this.#input,
      name: data.name ?? "", level: Number(data.level) || 1, base: data.base, tier2: data.tier2 ?? "", tier3: data.tier3 ?? "",
      people: data.people, subtype: data.subtype ?? "", profile: data.profile, talent: data.talent ?? "", faction: data.faction,
      budgetDust: data.budgetDust ?? "", seed: data.seed ?? "", personalSkill: data.personalSkill ?? "", named: Boolean(data.named),
      namedItems: data.namedItems ?? "", role: data.role ?? ""
    };
  }

  #generatorInput() {
    const input = this.#input;
    const seedText = String(input.seed ?? "").trim();
    return {
      name: input.name || undefined, level: input.level, classLine: [input.base, input.tier2, input.tier3].filter(Boolean),
      people: input.people, subtype: input.subtype || undefined, profile: input.profile, talent: input.talent || undefined,
      faction: input.faction, budgetDust: input.budgetDust === "" ? undefined : Number(input.budgetDust),
      seed: /^\d+$/.test(seedText) ? Number(seedText) : (seedText || 1), personalSkill: input.personalSkill || undefined,
      named: input.named, namedItems: input.namedItems.split(",").map(s => s.trim()).filter(Boolean), role: input.role || undefined
    };
  }

  static async #onSubmit(event, form, formData) {
    this.#input = this.#read(formData);
    this.render();
  }

  static async #onGenerate() {
    this.#result = npc(this.#generatorInput());
    this.render();
  }

  static async #onReroll() {
    this.#input.seed = Math.floor(Math.random() * 100000);
    this.#result = npc(this.#generatorInput());
    this.render();
  }

  static async #onCreate() {
    const actor = await createNpc(this.#generatorInput());
    if ( actor ) actor.sheet.render({force: true});
  }
}
