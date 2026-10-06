import {DEICIDE} from "../config.mjs";
import {companyUpgradeCost, fundTrackCost} from "../rules/economy.mjs";
import {qualityCap, veterancyAfterBattle} from "../rules/company.mjs";
import {DeicideActorSheetBase} from "./base-sheets.mjs";

const {TextEditor} = foundry.applications.ux;

export class CompanySheet extends DeicideActorSheetBase {

  static DEFAULT_OPTIONS = {
    classes: ["deicide", "sheet", "actor", "company"],
    position: {width: 520, height: 560},
    actions: {
      veterancy: CompanySheet.#onVeterancy,
      upgrade: CompanySheet.#onUpgrade,
      reserve: CompanySheet.#onReserve
    }
  };

  static PARTS = {
    sheet: {template: "systems/deicide/templates/actor/company.hbs", scrollable: [""]}
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const system = this.document.system;
    const nation = game.deicide.nation;
    context.derived = system.derived;
    context.types = Object.entries(DEICIDE.companyTypes).map(([id, type]) => ({id, label: game.i18n.localize(type.label)}));
    context.ships = Object.keys(DEICIDE.ships);
    context.doctrines = Object.entries(DEICIDE.doctrines).map(([id, doctrine]) => ({id, label: game.i18n.localize(doctrine.label)}));
    context.sides = ["lathander", "enemy", "foreign"];
    context.owners = game.actors.filter(a => (a.type === "character") && a.derived?.isOfficer).map(a => ({id: a.id, name: a.name}));
    context.qualityCap = nation.tracks ? qualityCap(nation.tracks, system.type) : 5;
    context.upgradeCost = system.quality < 5 ? companyUpgradeCost(system.quality + 1) : null;
    context.pips = Array.from({length: DEICIDE.company.veterancy.max}, (_, i) => i < system.veterancy);
    context.notesHtml = await TextEditor.implementation.enrichHTML(system.notes, {relativeTo: this.document});
    context.isGM = game.user.isGM;
    return context;
  }

  static async #onVeterancy() {
    const actor = this.document;
    const ownerAdjacent = await foundry.applications.api.DialogV2.confirm({
      window: {title: "Veterancy"}, content: "<p>Did a Sworn owner end the battle adjacent to this company?</p>"
    });
    const nation = game.deicide.nation;
    const result = veterancyAfterBattle(actor.system, {ownerAdjacent, routed: actor.system.routed, qualityCap: nation.tracks ? qualityCap(nation.tracks, actor.system.type) : 5});
    await actor.update({"system.veterancy": result.veterancy, "system.quality": result.quality, "system.veterancyQuality": result.veterancyQuality, "system.named": actor.system.named || result.promoted, "system.routed": false});
    ui.notifications.info(`${actor.name}: veterancy ${result.veterancy}${result.promoted ? ", Quality rises to " + result.quality : ""}${result.demoted ? ", Quality falls to " + result.quality : ""}.`);
  }

  static async #onUpgrade() {
    const actor = this.document;
    const nation = game.deicide.nation.actor;
    const cost = companyUpgradeCost(actor.system.quality + 1);
    const cap = nation ? qualityCap(nation.system.tracks, actor.system.type) : 5;
    if ( actor.system.quality >= cap ) return ui.notifications.warn(`Quality is capped at ${cap} by the Weapons track.`);
    if ( nation && (nation.system.dust < cost) ) return ui.notifications.warn(`The Nation needs ${cost} Dust.`);
    if ( !(await foundry.applications.api.DialogV2.confirm({window: {title: "Upgrade"}, content: `<p>Raise Quality to ${actor.system.quality + 1} for ${cost} Nation Dust?</p>`})) ) return;
    if ( nation ) await nation.update({"system.dust": nation.system.dust - cost});
    await actor.update({"system.quality": actor.system.quality + 1});
  }

  static async #onReserve() {
    const actor = this.document;
    const rule = game.deicide.nation.actor?.system.deathRule ?? DEICIDE.defaultDeathRule;
    const strength = DEICIDE.deathRules[rule].routedReturnStrength;
    await actor.update({"system.routed": false, "system.strength": strength});
  }
}

export class MonsterSheet extends DeicideActorSheetBase {

  static DEFAULT_OPTIONS = {
    classes: ["deicide", "sheet", "actor", "monster"],
    position: {width: 600, height: 640},
    actions: {
      useMove: MonsterSheet.#onUseMove,
      editItem: MonsterSheet.#onEditItem,
      deleteItem: MonsterSheet.#onDeleteItem,
      addMove: MonsterSheet.#onAddMove
    }
  };

  static PARTS = {
    sheet: {template: "systems/deicide/templates/actor/monster.hbs", scrollable: [""]}
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const system = this.document.system;
    context.derived = system.derived;
    context.elements = Object.entries(DEICIDE.elements).map(([id, element]) => ({id, label: game.i18n.localize(element.label)}));
    context.tags = Object.entries(DEICIDE.monsterTags).map(([id, tag]) => ({id, label: game.i18n.localize(tag.label), active: system.tags.has(id)}));
    context.classTypeTags = ["armored", "flying", "mounted", "caster"].map(id => ({id, label: game.i18n.localize(DEICIDE.classTypes[id].label), active: system.tags.has(id)}));
    context.moves = this.document.items.filter(i => i.type === "ability").map(item => ({
      id: item.id, name: item.name, summary: item.system.summary, direct: item.system.direct,
      might: item.system.attack?.might ?? null, area: item.system.dungeon?.target ?? "single"
    }));
    context.hpPercent = Math.round(system.hp.value / Math.max(system.hp.max, 1) * 100);
    context.descriptionHtml = await TextEditor.implementation.enrichHTML(system.description, {relativeTo: this.document});
    context.isGM = game.user.isGM;
    return context;
  }

  _onRender(context, options) {
    super._onRender(context, options);
    for ( const box of this.element.querySelectorAll("input[data-tag]") ) {
      box.addEventListener("change", async event => {
        const tags = new Set(this.document.system.tags);
        if ( event.currentTarget.checked ) tags.add(event.currentTarget.dataset.tag);
        else tags.delete(event.currentTarget.dataset.tag);
        await this.document.update({"system.tags": Array.from(tags)});
      });
    }
  }

  static async #onUseMove(event, target) {
    const item = this.document.items.get(target.closest("[data-item-id]")?.dataset.itemId);
    if ( item ) await game.deicide.actions.useAbility(this.document, {abilityId: item.system.identifier});
  }

  static async #onEditItem(event, target) {
    this.document.items.get(target.closest("[data-item-id]")?.dataset.itemId)?.sheet.render({force: true});
  }

  static async #onDeleteItem(event, target) {
    await this.document.items.get(target.closest("[data-item-id]")?.dataset.itemId)?.delete();
  }

  static async #onAddMove() {
    const [item] = await this.document.createEmbeddedDocuments("Item", [{
      name: "New move", type: "ability",
      system: {type: "action", source: {kind: "monster", id: this.document.system.identifier || this.document.id, rank: null},
        attack: {basis: "flat", source: "none", defense: "def", might: 10, element: null, hit: 0, crit: 0, weaponLines: [], strikes: 1, ignoreDef: 0, bonuses: []},
        war: {range: [1, 1], area: {shape: "single", size: 1}, target: "enemy", movement: null, terrain: false}, automation: "partial"}
    }]);
    item?.sheet.render({force: true});
  }
}

export class NationSheet extends DeicideActorSheetBase {

  static DEFAULT_OPTIONS = {
    classes: ["deicide", "sheet", "actor", "nation"],
    position: {width: 760, height: 720},
    actions: {
      advanceWeek: NationSheet.#onAdvanceWeek,
      fundTrack: NationSheet.#onFundTrack,
      addVenture: NationSheet.#onAddVenture,
      resolveVentures: NationSheet.#onResolveVentures,
      addDebt: NationSheet.#onAddDebt,
      tickDebts: NationSheet.#onTickDebts,
      removeEntry: NationSheet.#onRemoveEntry
    }
  };

  static PARTS = {
    sheet: {template: "systems/deicide/templates/actor/nation.hbs", scrollable: [""]}
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const system = this.document.system;
    const d = system.derived;
    context.derived = d;
    context.tracks = Object.entries(DEICIDE.nationTracks).map(([id, track]) => ({
      id, label: game.i18n.localize(track.label), value: system.tracks[id], offweiss: system.offweissTracks[id],
      effect: game.i18n.localize(`DEICIDE.TrackEffect.${id}`), fundCost: system.tracks[id] < 10 ? fundTrackCost(system.tracks[id] + 1) : null,
      fundable: DEICIDE.payouts.fundableTracks.includes(id)
    }));
    context.values = Object.entries(d.values ?? {}).map(([key, value]) => ({key, value}));
    context.stage = d.stage ? game.i18n.localize(`DEICIDE.WarClockStage.${d.stage}`) : "";
    context.ventureTypes = Object.keys(DEICIDE.economy.ventures.types);
    context.ventures = system.ventures.map(v => ({...v, resolvesAt: v.startMonth + DEICIDE.economy.ventures.months, due: system.warMonth >= v.startMonth + DEICIDE.economy.ventures.months}));
    context.debts = system.debts.map(debt => ({...debt, debtor: debt.debtorId ? game.actors.get(debt.debtorId)?.name : ""}));
    context.levelCaps = DEICIDE.pacing.ranges.L;
    context.deathRules = Object.keys(DEICIDE.deathRules);
    context.log = [...system.log].reverse().slice(0, 30);
    context.notesHtml = await TextEditor.implementation.enrichHTML(system.notes, {relativeTo: this.document});
    context.isGM = game.user.isGM;
    return context;
  }

  static async #onAdvanceWeek() {
    const actor = this.document;
    let week = actor.system.warWeek + 1;
    let month = actor.system.warMonth;
    if ( week > DEICIDE.warClock.weeksPerMonth ) { week = 1; month = Math.min(month + 1, DEICIDE.warClock.months); }
    const update = {"system.warWeek": week, "system.warMonth": month};
    if ( month !== actor.system.warMonth ) {
      const log = [...actor.system.log.map(entry => entry.toObject?.() ?? entry), {month, text: `Month ${month} begins.`, changes: {}}];

      log.push({month, text: "Offweiss: raise two tracks by 1 (GM choice).", changes: {}});
      if ( month >= DEICIDE.offweiss.frigateFromMonth ) log.push({month, text: "Offweiss gains 1 frigate.", changes: {}});
      update["system.log"] = log;
    }
    await actor.update(update);
    if ( month !== actor.system.warMonth ) await game.deicide.strategic?.resolveVentures?.(actor);
  }

  static async #onFundTrack(event, target) {
    const actor = this.document;
    const id = target.dataset.track;
    const next = actor.system.tracks[id] + 1;
    if ( next > DEICIDE.trackRange.max ) return;
    const cost = fundTrackCost(next);
    const payer = await foundry.applications.api.DialogV2.prompt({
      window: {title: `Fund ${id}`},
      content: `<p>Raise ${id} to ${next} for ${cost} personal Dust.</p><select name="actor">${game.actors.filter(a => a.type === "character").map(a => `<option value="${a.id}">${a.name} (${a.system.dust} Dust)</option>`).join("")}</select>`,
      ok: {label: "Pay", callback: (event, button) => game.actors.get(button.form.elements.actor.value)}
    });
    if ( !payer ) return;
    if ( payer.system.dust < cost ) return ui.notifications.warn(`${payer.name} needs ${cost} Dust.`);
    await payer.update({"system.dust": payer.system.dust - cost});
    await actor.update({[`system.tracks.${id}`]: next, "system.log": [...actor.system.log.map(e => e.toObject?.() ?? e), {month: actor.system.warMonth, text: `${payer.name} funds ${id} to ${next} for ${cost} Dust.`, changes: {[id]: 1}}]});
  }

  static async #onAddVenture() {
    const actor = this.document;
    const type = await foundry.applications.api.DialogV2.prompt({
      window: {title: "New venture"},
      content: `<p>${DEICIDE.economy.ventures.cost} Dust. Resolves after ${DEICIDE.economy.ventures.months} months.</p><select name="type">${Object.keys(DEICIDE.economy.ventures.types).map(t => `<option value="${t}">${t}</option>`).join("")}</select>`,
      ok: {label: "Invest", callback: (event, button) => button.form.elements.type.value}
    });
    if ( !type ) return;
    if ( actor.system.dust < DEICIDE.economy.ventures.cost ) return ui.notifications.warn("Not enough Nation Dust.");
    await actor.update({
      "system.dust": actor.system.dust - DEICIDE.economy.ventures.cost,
      "system.ventures": [...actor.system.ventures.map(v => v.toObject?.() ?? v), {id: foundry.utils.randomID(), type, startMonth: actor.system.warMonth, resolved: false, result: ""}]
    });
  }

  static async #onResolveVentures() {
    await game.deicide.strategic?.resolveVentures?.(this.document, {force: true});
  }

  static async #onAddDebt() {
    const actor = this.document;
    const amount = await foundry.applications.api.DialogV2.prompt({
      window: {title: "New debt to the Crown"},
      content: `<p>Up to ${DEICIDE.economy.debt.max} Dust. ${DEICIDE.economy.debt.perSession} Dust per session.</p><input type="number" name="amount" value="50" min="1" max="${DEICIDE.economy.debt.max}"><select name="actor">${game.actors.filter(a => a.type === "character").map(a => `<option value="${a.id}">${a.name}</option>`).join("")}</select>`,
      ok: {label: "Borrow", callback: (event, button) => ({amount: Number(button.form.elements.amount.value), actorId: button.form.elements.actor.value})}
    });
    if ( !amount ) return;
    const debtor = game.actors.get(amount.actorId);
    if ( debtor ) await debtor.update({"system.dust": debtor.system.dust + amount.amount, "system.debt": debtor.system.debt + amount.amount});
    await actor.update({"system.debts": [...actor.system.debts.map(d => d.toObject?.() ?? d), {id: foundry.utils.randomID(), creditor: "crown", amount: amount.amount, debtorId: amount.actorId}]});
  }

  static async #onTickDebts() {
    await game.deicide.strategic?.tickDebts?.(this.document);
  }

  static async #onRemoveEntry(event, target) {
    const {list, id} = target.dataset;
    const entries = this.document.system[list].filter(entry => entry.id !== id).map(entry => entry.toObject?.() ?? entry);
    await this.document.update({[`system.${list}`]: entries});
  }
}
