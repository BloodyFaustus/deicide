import {DEICIDE} from "../config.mjs";
import {formatGraded, gradeFor} from "../rules/grades.mjs";
import {xpToNext} from "../rules/pacing.mjs";
import {cp100ForRank, formatCp, levelOneEntry, validatePersonalGrowth} from "../rules/growth.mjs";
import {promotionCost} from "../rules/economy.mjs";
import {dungeonProfile} from "../rules/collapse.mjs";
import {describeEffects} from "../rules/effects.mjs";
import {createCharacter, validateTalentPlacement} from "../rules/creation.mjs";
import {sceneMode} from "../hooks/scene-mode.mjs";
import {DeicideActorSheetBase} from "./base-sheets.mjs";
import {ClassTree} from "./class-tree.mjs";

const {TextEditor} = foundry.applications.ux;

export class CharacterSheet extends DeicideActorSheetBase {

  static DEFAULT_OPTIONS = {
    classes: ["deicide", "sheet", "actor", "character"],
    position: {width: 820, height: 760},
    window: {resizable: true, controls: [{icon: "fa-solid fa-sitemap", label: "Class tree", action: "classTree"}]},
    actions: {
      useAbility: CharacterSheet.#onUseAbility,
      basicAttack: CharacterSheet.#onBasicAttack,
      toggleEquipped: CharacterSheet.#onToggleEquipped,
      toggleBelt: CharacterSheet.#onToggleBelt,
      deleteItem: CharacterSheet.#onDeleteItem,
      editItem: CharacterSheet.#onEditItem,
      openEntry: CharacterSheet.#onOpenEntry,
      levelUp: CharacterSheet.#onLevelUp,
      awardXp: CharacterSheet.#onAwardXp,
      awardCp: CharacterSheet.#onAwardCp,
      addClass: CharacterSheet.#onAddClass,
      activateClass: CharacterSheet.#onActivateClass,
      commission: CharacterSheet.#onCommission,
      setLoadout: CharacterSheet.#onSetLoadout,
      toggleSupport: CharacterSheet.#onToggleSupport,
      setStance: CharacterSheet.#onSetStance,
      changePool: CharacterSheet.#onChangePool,
      classTree: CharacterSheet.#onClassTree,
      creation: CharacterSheet.#onCreation,
      logDivine: CharacterSheet.#onLogDivine,
      placeFlex: CharacterSheet.#onPlaceFlex,
      addBond: CharacterSheet.#onAddBond,
      removeBond: CharacterSheet.#onRemoveBond,
      addStanding: CharacterSheet.#onAddStanding,
      toggleCollapse: CharacterSheet.#onToggleCollapse,
      harvest: CharacterSheet.#onHarvest,
      rest: CharacterSheet.#onRest
    }
  };

  static PARTS = {
    header: {template: "systems/deicide/templates/actor/character/header.hbs"},
    tabs: {template: "templates/generic/tab-navigation.hbs"},
    overview: {template: "systems/deicide/templates/actor/character/overview.hbs", scrollable: [""]},
    classes: {template: "systems/deicide/templates/actor/character/classes.hbs", scrollable: [""]},
    abilities: {template: "systems/deicide/templates/actor/character/abilities.hbs", scrollable: [""]},
    equipment: {template: "systems/deicide/templates/actor/character/equipment.hbs", scrollable: [""]},
    standing: {template: "systems/deicide/templates/actor/character/standing.hbs", scrollable: [""]},
    notes: {template: "systems/deicide/templates/actor/character/notes.hbs", scrollable: [""]}
  };

  static TABS = {
    primary: {
      tabs: [
        {id: "overview", icon: "fa-solid fa-user"},
        {id: "classes", icon: "fa-solid fa-graduation-cap"},
        {id: "abilities", icon: "fa-solid fa-bolt"},
        {id: "equipment", icon: "fa-solid fa-shield-halved"},
        {id: "standing", icon: "fa-solid fa-handshake"},
        {id: "notes", icon: "fa-solid fa-book"}
      ],
      initial: "overview",
      labelPrefix: "DEICIDE.Sheet.Tab"
    }
  };

  #collapsePreview = false;

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const actor = this.document;
    const system = actor.system;
    const derived = system.derived ?? {};
    const lookup = actor.lookup;
    const mode = sceneMode();
    const engine = DEICIDE.modes[mode]?.engine ?? "war";

    context.mode = mode;
    context.engine = engine;
    context.modeLabel = game.i18n.localize(DEICIDE.modes[mode]?.label ?? mode);
    context.derived = derived;
    context.flags = derived.flags ?? {};
    context.magLabel = derived.flags?.alchemyLabel ? "ALC" : "MAG";
    context.isGM = game.user.isGM;
    context.collapsePreview = this.#collapsePreview;

    const origin = kind => {
      const id = kind === "talent" ? system.talent.id : system[kind];
      const data = id ? lookup("origin", id) : null;
      return {id, name: data?.name ?? id ?? "", data};
    };
    context.origin = {people: origin("people"), background: origin("background"), talent: origin("talent")};
    context.subtypeName = context.origin.people.data?.subtypes?.[system.peopleSubtype]?.name ?? system.peopleSubtype;
    context.talentChoices = this.#talentChoiceText(context.origin.talent.data, system.talent);

    context.attributes = DEICIDE.attributeIds.map(id => {
      const detail = derived.attributes?.[id] ?? {value: 0, cap: 0, grade: "F", trained: 0};
      const abbr = (id === "mag" && derived.flags?.alchemyLabel) ? "ALC" : DEICIDE.attributes[id].abbr;
      return {
        id, abbr, label: game.i18n.localize(id === "mag" && derived.flags?.alchemyLabel ? DEICIDE.attributes.mag.noManaLabel : DEICIDE.attributes[id].label),
        ...detail, display: `${detail.value}/${detail.cap} (${detail.grade})`, graded: formatGraded(abbr, detail.value),
        overCap: detail.trained > detail.cap
      };
    });

    context.pools = {
      hp: {value: system.hp.value, max: system.hp.max},
      channel: derived.noChannel ? null : {value: system.channel.value, max: system.channel.max, innate: derived.channel?.innate, formula: derived.channel?.formula},
      matter: derived.matter ? {value: system.matter.value, max: system.matter.max} : null,
      static: derived.static ? {value: system.static, max: derived.static.max} : null,
      stolen: derived.stolen ? {slots: derived.stolen.slots, stored: system.stolen} : null
    };
    context.tracks = {
      manaburn: derived.tracksManaburn ? system.manaburn : null,
      saturation: derived.tracksSaturation ? system.saturation : null,
      divineAttention: derived.flags?.divineAttentionByActs || derived.tracksSaturation ? system.divineAttention : null,
      marks: system.marks,
      xpNext: xpToNext(system.level),
      levelCap: game.deicide.nation.levelCap
    };
    context.defense = derived.defense ?? {def: 0, res: 0, avoid: 0};
    context.soulPricePool = game.i18n.localize(derived.soulPricePayer === "hp" ? "DEICIDE.Common.HP" : "DEICIDE.Common.Channel");
    context.divineLog = [...(system.divineAttentionLog ?? [])].reverse().slice(0, 20);
    context.proficiencies = DEICIDE.proficiencyIds.map(id => ({
      id, label: game.i18n.localize(DEICIDE.proficiencies[id].label), grade: derived.proficiencies?.[id] ?? null
    }));
    context.classTypes = (derived.classTypes ?? []).map(type => game.i18n.localize(DEICIDE.classTypes[type]?.label ?? type));
    context.pendingFlex = (system.growthLog ?? []).filter(entry => ("flex" in entry) && (entry.flex === null)).map(entry => entry.level);

    context.classes = (derived.classes ?? []).map(entry => {
      const data = lookup("class", entry.id);
      const next = entry.rank < DEICIDE.maxRank ? cp100ForRank(entry.rank + 1) : null;
      const floor = cp100ForRank(entry.rank);
      return {
        ...entry, name: data?.name ?? entry.id, active: entry.id === system.activeClass,
        cp: formatCp(entry.cp100), nextCp: next === null ? null : formatCp(next),
        progress: next ? Math.min(100, Math.round((entry.cp100 - floor) / (next - floor) * 100)) : 100,
        skills: (data?.skills ?? []).map(skill => ({...skill, name: lookup("ability", skill.id)?.name ?? skill.id, known: entry.rank >= skill.rank}))
      };
    });
    const tierGates = game.deicide.nation.tierGates;
    context.availableClasses = (derived.availableClasses ?? [])
      .filter(entry => !entry.owned)
      .map(entry => {
        const data = lookup("class", entry.id);
        return {
          ...entry, name: data?.name ?? entry.id, cost: promotionCost(entry.tier),
          missingText: entry.missing.map(leaf => leaf.kind === "prof" ? `${game.i18n.localize(DEICIDE.proficiencies[leaf.prof]?.label ?? leaf.prof)} ${leaf.grade}` : leaf.kind === "level" ? `level ${leaf.value}` : `${leaf.kind} ${leaf.value ?? ""}`).join(", ")
        };
      })
      .sort((a, b) => (a.tier - b.tier) || Number(b.ok) - Number(a.ok) || a.name.localeCompare(b.name));
    context.tierGates = tierGates;

    const known = derived.skills?.known ?? [];
    const available = derived.skills?.available ?? {};
    const activeSet = new Set(derived.skills?.active ?? []);
    const loadout = derived.loadout ?? {};
    const groups = {};
    const describe = id => {
      const data = lookup("ability", id);
      if ( !data ) return null;
      const profile = engine === "dungeon" ? dungeonProfile(data, {weapon: system.equipment?.weapon, mag: derived.values?.mag}) : null;
      const previewProfile = this.#collapsePreview && (engine !== "dungeon") ? dungeonProfile(data, {weapon: system.equipment?.weapon, mag: derived.values?.mag}) : null;
      const type = data.type;
      const usable = DEICIDE.skillTypes[type]?.engines.includes(engine) && (profile ? profile.available !== false : true);
      return {
        id, name: data.name, type, typeLabel: game.i18n.localize(DEICIDE.skillTypes[type]?.label ?? type),
        summary: data.summary, automation: data.automation, usable,
        isAction: type === "action", isReaction: type === "reaction", isSupport: type === "support", isStance: type === "stance",
        isCommand: type === "command", isMastery: type === "mastery",
        active: activeSet.has(id), slotted: loadout.supports?.includes(id), isReactionSlot: loadout.reaction === id, isStanceActive: loadout.stance === id,
        breakdown: abilityBreakdown(data),
        cost: Object.entries(data.cost ?? {}).filter(([, v]) => v).map(([k, v]) => `${v} ${k === "soulPrice" ? "SP" : k}`).join(", "),
        weight: data.weight, war: data.war, dungeon: profile ?? previewProfile, source: data.source,
        inAvailable: Object.values(available).some(list => list.includes(id)) || type === "mastery"
      };
    };
    for ( const id of known ) {
      const entry = describe(id);
      if ( !entry ) continue;
      (groups[entry.type] ??= []).push(entry);
    }
    context.abilityGroups = Object.keys(DEICIDE.skillTypes).filter(type => groups[type]?.length).map(type => ({
      type, label: game.i18n.localize(DEICIDE.skillTypes[type].label), hidden: !DEICIDE.skillTypes[type].engines.includes(engine),
      entries: groups[type]
    }));
    context.engines = (derived.skills?.engines ?? []).map(describe).filter(Boolean);
    context.loadout = {
      ...loadout,
      secondaryOptions: context.classes.filter(entry => !entry.active && (entry.rank >= DEICIDE.secondaryActionMinRank)),
      reactionOptions: (groups.reaction ?? []),
      stanceOptions: (groups.stance ?? []).filter(entry => !entry.source || entry.source.id === system.activeClass)
    };
    context.weaponArts = (system.equipment?.weapon?.arts ?? []).map(describe).filter(Boolean);

    const items = actor.items.contents.sort((a, b) => a.name.localeCompare(b.name));
    const slotOf = item => item.system.slot ?? (item.type === "consumable" ? "belt" : null);
    context.equipment = {
      slots: ["weapon", "offhand", "armor", "accessory", "pin"].map(slot => ({
        slot, label: game.i18n.localize(`DEICIDE.Slot.${slot}`),
        items: items.filter(item => (slotOf(item) === slot) && item.system.equipped).map(item => this.#itemRow(item)),
        count: DEICIDE.slots[slot]?.count ?? 1
      })),
      inventory: items.filter(item => ["weapon", "armor", "offhand", "accessory", "pin", "named"].includes(item.type)).map(item => this.#itemRow(item)),
      belt: items.filter(item => (item.type === "consumable") && (item.system.kind === "belt")).map(item => this.#itemRow(item)),
      supplies: items.filter(item => (item.type === "consumable") && (item.system.kind === "supply")).map(item => this.#itemRow(item)),
      other: items.filter(item => ["class", "origin", "ability"].includes(item.type)).map(item => this.#itemRow(item)),
      beltSlots: DEICIDE.slots.belt.count
    };
    context.dust = system.dust;

    context.standing = Object.entries(DEICIDE.factions).map(([id, faction]) => ({
      id, label: game.i18n.localize(faction.label), value: system.standingFaction[id] ?? null,
      band: this.#band(system.standingFaction[id])
    }));
    context.extraStanding = Object.entries(system.standingFaction).filter(([id]) => !(id in DEICIDE.factions)).map(([id, value]) => ({id, label: id, value, band: this.#band(value)}));
    context.personalStanding = Object.entries(system.standingPersonal).map(([id, value]) => ({id, name: game.actors.get(id)?.name ?? id, value}));
    context.bonds = system.bonds.map(bond => {
      const rank = [...DEICIDE.bonds.ranks].reverse().find(entry => bond.points >= entry.points);
      return {...bond, name: game.actors.get(bond.actorId)?.name ?? bond.actorId, rank: rank?.id ?? "none"};
    });
    context.recruit = system.recruit;
    context.profiles = Object.keys(DEICIDE.recruitment.profiles);
    context.bondSkills = DEICIDE.bonds.skills;

    context.notesHtml = await TextEditor.implementation.enrichHTML(system.notes, {relativeTo: actor});
    return context;
  }

  async _preparePartContext(partId, context, options) {
    context = await super._preparePartContext(partId, context, options);
    if ( context.tabs?.[partId] ) context.tab = context.tabs[partId];
    return context;
  }

  #itemRow(item) {
    const profile = item.system.profile ?? {};
    return {
      id: item.id, name: item.name, img: item.img, type: item.type, typeLabel: game.i18n.localize(`TYPES.Item.${item.type}`),
      equipped: Boolean(item.system.equipped), onBelt: Boolean(item.system.onBelt), quantity: item.system.quantity ?? null,
      slot: item.system.slot ?? null,
      summary: this.#profileSummary(item, profile),
      pp: profile.pp ?? null, price: profile.price ?? null, named: Boolean(profile.named), invalid: profile.invalid ?? null
    };
  }

  #profileSummary(item, profile) {
    switch ( item.type ) {
      case "weapon":
      case "named":
        if ( profile.caster ) return `Bonus +${profile.spellBonus || profile.alchemyBonus || 0}${profile.channel ? `, Channel +${profile.channel}` : ""}${profile.matter ? `, Matter +${profile.matter}` : ""}, Acc +${profile.acc}`;
        if ( typeof profile.might === "number" ) return `Might ${profile.might}, Acc +${profile.acc}, Crit ${profile.crit}${profile.range ? `, Range ${profile.range[0]}${profile.range[1] !== profile.range[0] ? ` to ${profile.range[1]}` : ""}` : ""}${profile.weight !== null && profile.weight !== undefined ? `, Weight ${profile.weight}` : ""}`;
        return item.system.special || "";
      case "armor": return `DEF +${profile.def ?? 0}, RES +${profile.res ?? 0}, Burden ${profile.burden ?? 0}`;
      default: return (profile.modifiers ?? []).map(m => `${m.key} ${m.op === "mul" ? "x" : (m.value > 0 ? "+" : "")}${m.value}`).join(", ");
    }
  }

  #band(value) {
    if ( (value === null) || (value === undefined) ) return "";
    return DEICIDE.standing.bands.find(band => (value >= band.min) && (value <= band.max))?.id ?? "";
  }

  #talentChoiceText(talent, choice) {
    if ( !talent ) return "";
    const parts = [];
    if ( choice.stat ) parts.push(`${DEICIDE.attributes[choice.stat]?.abbr ?? choice.stat}`);
    if ( choice.penaltyStat ) parts.push(`minus ${DEICIDE.attributes[choice.penaltyStat]?.abbr ?? choice.penaltyStat}`);
    if ( choice.proficiency ) parts.push(game.i18n.localize(DEICIDE.proficiencies[choice.proficiency]?.label ?? choice.proficiency));
    return parts.join(", ");
  }

  _onRender(context, options) {
    super._onRender(context, options);
    for ( const select of this.element.querySelectorAll("select[data-loadout]") ) {
      select.addEventListener("change", event => CharacterSheet.#onSetLoadout.call(this, event, event.currentTarget));
    }
    for ( const input of this.element.querySelectorAll("input[data-standing]") ) {
      input.addEventListener("change", async event => {
        const id = event.currentTarget.dataset.standing;
        const value = Number(event.currentTarget.value);
        await this.document.update({[`system.standingFaction.${id}`]: Math.min(Math.max(value, 0), 100)});
      });
    }
  }

  static async #onUseAbility(event, target) {
    await game.deicide.actions.useAbility(this.document, {abilityId: target.dataset.abilityId, options: {flank: event.altKey}});
  }

  static async #onBasicAttack(event) {
    await game.deicide.actions.useAbility(this.document, {abilityId: null, options: {flank: event.altKey}});
  }

  static async #onToggleEquipped(event, target) {
    const item = this.document.items.get(target.closest("[data-item-id]")?.dataset.itemId);
    if ( item ) await item.toggleEquipped();
  }

  static async #onToggleBelt(event, target) {
    const item = this.document.items.get(target.closest("[data-item-id]")?.dataset.itemId);
    if ( !item ) return;
    const onBelt = this.document.items.filter(i => (i.type === "consumable") && i.system.onBelt && (i.id !== item.id)).length;
    if ( !item.system.onBelt && (onBelt >= DEICIDE.slots.belt.count) ) return ui.notifications.warn(`The Belt holds ${DEICIDE.slots.belt.count}.`);
    await item.update({"system.onBelt": !item.system.onBelt});
  }

  static async #onDeleteItem(event, target) {
    const item = this.document.items.get(target.closest("[data-item-id]")?.dataset.itemId);
    if ( item && await foundry.applications.api.DialogV2.confirm({window: {title: "Delete item"}, content: `<p>Delete ${item.name}?</p>`}) ) await item.delete();
  }

  static async #onEditItem(event, target) {
    const item = this.document.items.get(target.closest("[data-item-id]")?.dataset.itemId);
    item?.sheet.render({force: true});
  }

  static async #onOpenEntry(event, target) {
    const {type, identifier} = target.dataset;
    const entry = game.deicide.catalog.get(type, identifier);
    const uuid = entry?.uuid;
    if ( !uuid ) return ui.notifications.info("No document for this entry. It lives in the builtin catalog only.");
    const doc = await fromUuid(uuid);
    doc?.sheet.render({force: true});
  }

  static async #onLevelUp() {
    const actor = this.document;
    const talent = actor.system.talent.id ? actor.lookup("origin", actor.system.talent.id) : null;
    let flex = null;
    if ( talent?.flex?.every && ((actor.system.level + 1) % talent.flex.every === 0) ) {
      flex = await foundry.applications.api.DialogV2.prompt({
        window: {title: "Steady: flex point"},
        content: `<p>Level ${actor.system.level + 1} grants a flex point. Place it:</p><select name="attr">${DEICIDE.attributeIds.map(id => `<option value="${id}">${DEICIDE.attributes[id].abbr}</option>`).join("")}</select>`,
        ok: {label: "Place", callback: (event, button) => button.form.elements.attr.value}
      });
    }
    const entry = await actor.levelUp({flex});
    const gains = Object.entries(entry.gains ?? {}).map(([attr, value]) => `${DEICIDE.attributes[attr].abbr} +${value}`).join(", ") || "no whole points yet";
    const lost = Object.entries(entry.lost ?? {}).map(([attr, value]) => `${DEICIDE.attributes[attr].abbr} ${value / 10} lost at cap`).join(", ");
    await ChatMessage.implementation.create({
      speaker: ChatMessage.implementation.getSpeaker({actor}),
      content: `<div class="deicide-card level"><h3>${actor.name} reaches level ${entry.level}</h3><p>${gains}.${lost ? ` ${lost}.` : ""} HP growth +${entry.hp}.</p>${entry.rolls ? `<p>Wild: ${Object.entries(entry.rolls).map(([a, r]) => `${DEICIDE.attributes[a].abbr} d100 ${r}`).join(", ")}</p>` : ""}</div>`
    });
  }

  static async #onAwardXp() {
    const amount = await foundry.applications.api.DialogV2.prompt({
      window: {title: "Award XP"}, content: `<input type="number" name="xp" value="${DEICIDE.xp.dungeonFight}" min="0" autofocus>`,
      ok: {label: "Award", callback: (event, button) => Number(button.form.elements.xp.value)}
    });
    if ( amount > 0 ) {
      const gained = await this.document.awardXp(amount);
      ui.notifications.info(`${this.document.name}: ${amount} XP${gained ? `, ${gained} level${gained > 1 ? "s" : ""} gained` : ""}.`);
    }
  }

  static async #onAwardCp() {
    const amount = await foundry.applications.api.DialogV2.prompt({
      window: {title: "Award CP"}, content: `<input type="number" name="cp" value="${DEICIDE.cp.dungeonFight}" min="0" step="0.01" autofocus>`,
      ok: {label: "Award", callback: (event, button) => Math.round(Number(button.form.elements.cp.value) * 100)}
    });
    if ( amount > 0 ) {
      const result = await this.document.awardCp(amount);
      if ( result.ranksGained ) ui.notifications.info(`${this.document.name} reaches Rank ${result.rank}.`);
    }
  }

  static async #onAddClass(event, target) {
    await this.document.addClass(target.dataset.classId, {activate: event.altKey});
  }

  static async #onActivateClass(event, target) {
    await this.document.update({"system.activeClass": target.dataset.classId});
  }

  static async #onCommission(event, target) {
    const actor = this.document;
    const classId = target.dataset.classId;
    const data = actor.lookup("class", classId);
    if ( !data ) return;
    const nation = game.deicide.nation.actor;
    const crownPatron = (actor.system.standingFaction.crown ?? 0) >= DEICIDE.economy.patronStanding;
    const cost = promotionCost(data.tier, {crownPatron});
    if ( nation?.system.derived?.dustCollapse ) return ui.notifications.warn("Commissions and Warrants are unavailable during the Dust collapse until the Dust track reaches 3.");
    if ( cost && (actor.system.dust < cost.dust) ) return ui.notifications.warn(`${actor.name} needs ${cost.dust} Dust.`);
    if ( cost?.legitimacy && nation && (nation.system.tracks.legitimacy < cost.legitimacy) ) return ui.notifications.warn("The Crown lacks the Legitimacy for a Warrant.");
    const ok = await foundry.applications.api.DialogV2.confirm({
      window: {title: data.tier === 3 ? "Royal Warrant" : "Commission"},
      content: `<p>Enter ${data.name} for ${cost?.dust ?? 0} Dust${cost?.legitimacy ? ` and ${cost.legitimacy} Legitimacy` : ""}?</p>`
    });
    if ( !ok ) return;
    await actor.update({"system.dust": actor.system.dust - (cost?.dust ?? 0)});
    if ( cost?.legitimacy && nation ) await nation.update({"system.tracks.legitimacy": nation.system.tracks.legitimacy - cost.legitimacy});
    await actor.addClass(classId, {activate: true});
  }

  static async #onSetLoadout(event, target) {
    const key = target.dataset.loadout;
    const value = target.value || null;
    await this.document.update({[`system.loadout.${key}`]: value});
  }

  static async #onToggleSupport(event, target) {
    const id = target.dataset.abilityId;
    const supports = [...this.document.system.loadout.supports];
    const index = supports.indexOf(id);
    if ( index >= 0 ) supports.splice(index, 1);
    else {
      const slots = this.document.derived.loadout?.supportSlots ?? 2;
      if ( supports.length >= slots ) return ui.notifications.warn(`${slots} Support slots.`);
      supports.push(id);
    }
    await this.document.update({"system.loadout.supports": supports});
  }

  static async #onSetStance(event, target) {
    const id = target.dataset.abilityId;
    await game.deicide.stances.toggle(this.document, id);
  }

  static async #onChangePool(event, target) {
    await this.document.changePool(target.dataset.pool, Number(target.dataset.delta));
  }

  static #onClassTree() {
    new ClassTree({actor: this.document}).render({force: true});
  }

  static async #onPlaceFlex(event, target) {
    const level = Number(target.dataset.level);
    const attr = await foundry.applications.api.DialogV2.prompt({
      window: {title: `Flex point from level ${level}`},
      content: `<select name="attr">${DEICIDE.attributeIds.map(id => `<option value="${id}">${DEICIDE.attributes[id].abbr}</option>`).join("")}</select>`,
      ok: {label: "Place", callback: (event, button) => button.form.elements.attr.value}
    });
    if ( attr && !(await this.document.placeFlex(level, attr)) ) ui.notifications.warn("That attribute is at its cap.");
  }

  static async #onAddBond() {
    const others = game.actors.filter(a => (a.type === "character") && (a.id !== this.document.id));
    const actorId = await foundry.applications.api.DialogV2.prompt({
      window: {title: "New Bond"},
      content: `<select name="actor">${others.map(a => `<option value="${a.id}">${a.name}</option>`).join("")}</select>`,
      ok: {label: "Bond", callback: (event, button) => button.form.elements.actor.value}
    });
    if ( !actorId ) return;
    const bonds = [...this.document.system.bonds.map(b => b.toObject?.() ?? b), {actorId, points: 0, skill: "", broken: false}];
    await this.document.update({"system.bonds": bonds});
  }

  static async #onRemoveBond(event, target) {
    const bonds = this.document.system.bonds.filter(b => b.actorId !== target.dataset.actorId).map(b => b.toObject?.() ?? b);
    await this.document.update({"system.bonds": bonds});
  }

  static async #onAddStanding() {
    const id = await foundry.applications.api.DialogV2.prompt({
      window: {title: "Track a faction"},
      content: `<input type="text" name="id" placeholder="factionId" autofocus>`,
      ok: {label: "Add", callback: (event, button) => button.form.elements.id.value.trim()}
    });
    if ( id ) await this.document.update({[`system.standingFaction.${id}`]: DEICIDE.standing.default ?? 40});
  }

  static #onToggleCollapse() {
    this.#collapsePreview = !this.#collapsePreview;
    this.render();
  }

  static async #onHarvest() {
    await game.deicide.terrain.harvest(this.document);
  }

  static async #onRest() {
    const kind = await foundry.applications.api.DialogV2.wait({
      window: {title: `${this.document.name} rests`},
      content: "<p>Short: +25 percent HP, half Channel, Poison cleared. Long: everything, +1 week. Camp: +50 percent HP, full Channel and Matter, +1 week.</p>",
      buttons: [
        {action: "short", label: "Short"}, {action: "long", label: "Long", default: true}, {action: "camp", label: "Camp"}
      ],
      rejectClose: false
    });
    if ( kind ) await game.deicide.strategic.rest([this.document], kind);
  }

  static async #onCreation() {
    const actor = this.document;
    const catalog = game.deicide.catalog;
    const peoples = catalog.all("origin", e => e.system.kind === "people");
    const backgrounds = catalog.all("origin", e => e.system.kind === "background");
    const talents = catalog.all("origin", e => e.system.kind === "talent");
    const classes = catalog.all("class", e => (e.system.tier === 1) && !e.system.enemyOnly);
    const options = list => list.map(e => `<option value="${e.identifier}">${e.name}</option>`).join("");
    const attrInputs = (name, initial) => DEICIDE.attributeIds.map(id => `<label>${DEICIDE.attributes[id].abbr}<input type="number" name="${name}.${id}" value="${initial[id] ?? 0}" min="0" max="4"></label>`).join("");
    const L = key => game.i18n.localize(`DEICIDE.Character.Creation.${key}`);
    const attrOptions = DEICIDE.attributeIds.map(id => `<option value="${id}">${DEICIDE.attributes[id].abbr}</option>`).join("");
    const subtypes = peoples.flatMap(e => Object.keys(e.system.subtypes ?? {}));
    const partners = game.actors.filter(a => (a.type === "character") && (a.id !== actor.id));
    const beltDust = DEICIDE.economy.startingBeltDust;
    const content = `
      <div class="deicide-creation">
        <p>${L("Intro")}</p>
        <label>${L("Name")} <input type="text" name="name" value="${actor.name}"></label>
        <label>${L("People")} <select name="people">${options(peoples)}</select></label>
        <label>${L("Subtype")} <input type="text" name="peopleSubtype" list="deicide-subtypes" placeholder="${L("SubtypeHint")}"><datalist id="deicide-subtypes">${subtypes.map(s => `<option value="${s}">`).join("")}</datalist></label>
        <label>${L("Background")} <select name="background">${options(backgrounds)}</select></label>
        <label>${L("BaseClass")} <select name="baseClass">${options(classes)}</select></label>
        <label>${L("Talent")} <select name="talent">${options(talents)}</select></label>
        <label>${L("TalentStat")} <select name="talentStat"><option value="">${L("NoBond")}</option>${attrOptions}</select></label>
        <label>${L("PenaltyStat")} <select name="talentPenalty"><option value="">${L("NoBond")}</option>${attrOptions}</select></label>
        <label>${L("Proficiency")} <select name="talentProficiency"><option value="">${L("NoBond")}</option>${DEICIDE.proficiencyIds.map(id => `<option value="${id}">${game.i18n.localize(DEICIDE.proficiencies[id].label)}</option>`).join("")}</select></label>
        <fieldset><legend>${L("Growth")}</legend>${attrInputs("growth", {})}</fieldset>
        <fieldset><legend>${L("Placement")}</legend>${attrInputs("placement", {})}</fieldset>
        <label><input type="checkbox" name="kit" checked> ${L("Kit")}</label>
        <label>${game.i18n.format("DEICIDE.Character.Creation.Belt", {dust: beltDust})} <input type="text" name="belt" value="${L("BeltHint")}"></label>
        <label>${L("Bond")} <select name="bond"><option value="">${L("NoBond")}</option>${partners.map(a => `<option value="${a.id}">${a.name}</option>`).join("")}</select></label>
        <p class="hint">${L("Hint")}</p>
      </div>`;
    const result = await foundry.applications.api.DialogV2.prompt({
      window: {title: game.i18n.format("DEICIDE.Character.Creation.Title", {name: actor.name})}, position: {width: 560}, content,
      ok: {label: L("Build"), callback: (event, button) => {
        const form = new FormData(button.form);
        const read = prefix => Object.fromEntries(DEICIDE.attributeIds.map(id => [id, Number(form.get(`${prefix}.${id}`)) || 0]));
        return {
          name: String(form.get("name") ?? "").trim(),
          people: form.get("people"), peopleSubtype: form.get("peopleSubtype"), background: form.get("background"), baseClass: form.get("baseClass"),
          talent: {id: form.get("talent"), stat: form.get("talentStat") || null, penaltyStat: form.get("talentPenalty") || null, proficiency: form.get("talentProficiency") || null, placement: read("placement")},
          personalGrowth: read("growth"), kit: form.get("kit") === "on",
          belt: String(form.get("belt") ?? "").split(",").map(s => s.trim()).filter(Boolean), bond: form.get("bond") || null
        };
      }}
    });
    if ( !result ) return;
    const lookup = catalog.lookup();
    const talent = lookup("origin", result.talent.id);
    const growthCheck = validatePersonalGrowth(result.personalGrowth);
    const placementCheck = validateTalentPlacement(talent, result.talent.placement);
    const errors = [...growthCheck.errors, ...placementCheck.errors];
    const built = createCharacter(result, lookup);
    errors.push(...built.errors);

    let beltCost = 0;
    for ( const id of result.belt ) {
      const row = DEICIDE.consumables[id];
      if ( !row ) errors.push(game.i18n.format("DEICIDE.Character.Creation.UnknownBelt", {id}));
      else beltCost += row.price ?? 0;
    }
    if ( beltCost > beltDust ) errors.push(game.i18n.format("DEICIDE.Character.Creation.BeltTooDear", {cost: beltCost, max: beltDust}));
    if ( errors.length ) return ui.notifications.error(errors.join(" "));
    const bonds = result.bond ? [{actorId: result.bond, points: DEICIDE.bonds.ranks[0].points, skill: "", broken: false}] : [];
    await actor.update({name: result.name || actor.name, system: _replace({...built.system, bonds})});
    if ( result.kit ) {
      const baseClass = lookup("class", result.baseClass);
      await actor.grantKit({...(baseClass.kit ?? {}), belt: result.belt});
    }
    if ( result.bond ) {

      const partner = game.actors.get(result.bond);
      if ( partner && !partner.system.bonds.some(b => b.actorId === actor.id) ) {
        await partner.update({"system.bonds": [...partner.system.bonds.map(b => b.toObject?.() ?? b), {actorId: actor.id, points: DEICIDE.bonds.ranks[0].points, skill: "", broken: false}]});
      }
    }
    await actor.update({"system.hp.value": actor.system.hp.max, "system.channel.value": actor.system.channel.max, "system.matter.value": actor.system.matter.max});
    ui.notifications.info(game.i18n.format("DEICIDE.Character.Creation.Done", {name: actor.name}));
  }

  static async #onLogDivine() {
    const actor = this.document;
    const month = game.deicide.nation.actor?.system.warMonth ?? 1;
    const entry = await foundry.applications.api.DialogV2.prompt({
      window: {title: game.i18n.localize("DEICIDE.Character.DivineLog")},
      content: `<p>${game.i18n.localize("DEICIDE.Character.DivineLogPrompt")}</p><label>${game.i18n.localize("DEICIDE.Character.DivineLogSource")} <input type="text" name="source" autofocus></label><label>${game.i18n.localize("DEICIDE.Character.DivineLogDelta")} <input type="number" name="delta" value="1" step="1"></label>`,
      ok: {label: game.i18n.localize("DEICIDE.Character.DivineLogOk"), callback: (event, button) => ({source: button.form.elements.source.value.trim(), delta: Number(button.form.elements.delta.value) || 0})}
    });
    if ( !entry || !entry.source ) return;
    const log = [...actor.system.divineAttentionLog.map(e => e.toObject?.() ?? e), {...entry, month}];
    await actor.update({"system.divineAttentionLog": log, "system.divineAttention": Math.max(actor.system.divineAttention + entry.delta, 0)});
  }
}

export {gradeFor, levelOneEntry};

export function abilityBreakdown(data) {
  const lines = [];
  const attack = data.attack;
  if ( attack ) {
    const basis = game.i18n.localize(DEICIDE.attackBases[attack.basis]?.label ?? attack.basis);
    lines.push(`Attack: ${basis} + ${game.i18n.localize(DEICIDE.mightSources[attack.source]?.label ?? attack.source)}${attack.might ? ` + ${attack.might}` : ""} vs ${game.i18n.localize(DEICIDE.defenses[attack.defense]?.label ?? attack.defense)}${attack.element ? `, ${attack.element}` : ""}${attack.strikes > 1 ? `, ${attack.strikes} strikes` : ""}${attack.crit ? `, crit +${attack.crit}` : ""}${attack.ignoreDef ? `, ignores ${attack.ignoreDef} DEF` : ""}`);
    for ( const bonus of attack.bonuses ?? [] ) lines.push(`Might +${bonus.might} when ${Object.entries(bonus.when ?? {}).map(([k, v]) => `${k} ${Array.isArray(v) ? v.join(" or ") : v}`).join(", ")}`);
  }
  if ( data.heal ) lines.push(`Heal: ${data.heal.formula}`);
  const costs = Object.entries(data.cost ?? {}).filter(([, v]) => v).map(([k, v]) => `${v} ${k === "soulPrice" ? "Soul Price" : k}`);
  if ( costs.length ) lines.push(`Costs: ${costs.join(", ")}`);
  if ( data.usage?.limit ) lines.push(`Once per ${data.usage.per}`);
  const mods = data.stance?.modifiers?.length ? data.stance.modifiers : (data.modifiers ?? []);
  for ( const m of mods ) lines.push(`${m.key} ${m.op === "mul" ? "x" : m.op === "set" ? "=" : (Number(m.value) >= 0 && typeof m.value === "number" ? "+" : "")}${m.value}${m.when ? ` when ${Object.entries(m.when).map(([k, v]) => `${k} ${Array.isArray(v) ? v.join(" or ") : typeof v === "object" ? JSON.stringify(v) : v}`).join(", ")}` : ""}`);
  for ( const status of data.statuses ?? [] ) lines.push(`Apply ${status.id}${status.turns ? ` for ${status.turns} turns` : ""} on ${status.target}${status.onCrit ? " on crit" : ""}`);
  for ( const line of describeEffects([...(data.effects ?? []), ...(data.stance?.effects ?? [])]) ) lines.push(line);
  if ( data.reaction?.trigger ) lines.push(`Reaction on ${Array.isArray(data.reaction.trigger) ? data.reaction.trigger.join(" or ") : data.reaction.trigger}${data.reaction.window?.tiles ? ` within ${data.reaction.window.tiles} tiles` : data.reaction.window?.adjacent ? " when adjacent" : ""}${data.reaction.roll?.d100Under ? `, d100 under ${data.reaction.roll.d100Under}` : ""}${data.reaction.usesPerRound ? `, ${data.reaction.usesPerRound} per round` : ""}`);
  if ( data.command ) lines.push(`Command: ${data.command.target}${data.command.companyTypes ? ` (${data.command.companyTypes.join(", ")})` : ""}${data.command.roll?.d100Under ? `, d100 under ${data.command.roll.d100Under}` : ""}: ${describeEffects(data.command.effects ?? []).join("; ")}`);
  if ( data.dungeon?.note ) lines.push(`Dungeon: ${data.dungeon.note}`);
  return lines.join("\n");
}
