import {DEICIDE} from "../../config.mjs";
import {army, publishScenario} from "./generate.mjs";
import {describeArmy} from "../../rules/generate/army.mjs";

const {HandlebarsApplicationMixin, ApplicationV2} = foundry.applications.api;

export class ScenarioBuilder extends HandlebarsApplicationMixin(ApplicationV2) {

  static DEFAULT_OPTIONS = {
    id: "deicide-scenario-builder",
    classes: ["deicide", "gm-tool", "scenario-builder"],
    tag: "form",
    window: {title: "DEICIDE.Generate.ScenarioTitle", icon: "fa-solid fa-map", resizable: true},
    position: {width: 720, height: 760},
    form: {handler: ScenarioBuilder.#onSubmit, submitOnChange: true, closeOnSubmit: false},
    actions: {
      pullArmy: ScenarioBuilder.#onPullArmy,
      clearArmy: ScenarioBuilder.#onClearArmy,
      publish: ScenarioBuilder.#onPublish
    }
  };

  static PARTS = {
    body: {template: "systems/deicide/templates/apps/gm/scenario-builder.hbs", scrollable: [""]}
  };

  #input = null;

  #army = null;

  static open(input = {}) {
    const app = new ScenarioBuilder();
    app.#input = {...app.#defaults(), ...input};
    return app.render({force: true});
  }

  #defaults() {
    const nation = game.deicide.nation.actor;
    return {
      kind: "war", name: "", warMonth: nation?.system.warMonth ?? 1, difficulty: "standard",
      mapWidth: 24, mapHeight: 20, terrain: "", fog: false, naval: false, arena: false,
      victoryType: "rout", victoryRounds: 10, victoryNote: "", defeat: "",
      side: "offweiss", battleSize: "battle", officers: 1, chained: false,
      region: "", floors: "stone", encounters: "", bossId: "", hazards: "",
      payoutTracks: "", drops: "", dust: 0, briefing: ""
    };
  }

  async _prepareContext() {
    this.#input ??= this.#defaults();
    const input = this.#input;
    const monsters = game.deicide.catalog.all("monster").map(entry => ({id: entry.identifier, name: entry.name, boss: Boolean(entry.system.boss)})).sort((a, b) => a.name.localeCompare(b.name));
    return {
      input, isWar: input.kind === "war",
      difficulties: Object.keys(DEICIDE.difficulty).map(id => ({id, label: game.i18n.localize(`DEICIDE.Generate.Difficulty.${id}`)})),
      victoryTypes: ["rout", "seize", "survive", "escort", "breach"].map(id => ({id, label: game.i18n.localize(`DEICIDE.Generate.Victory.${id}`)})),
      sides: Object.keys(DEICIDE.generate.names).map(id => ({id, label: game.i18n.localize(`DEICIDE.Generate.Side.${id}`)})),
      battleSizes: ["skirmish", "battle", "invasion"].map(id => ({id, label: game.i18n.localize(`DEICIDE.Generate.BattleSize.${id}`)})),
      monsters,
      army: this.#army ? {text: describeArmy(this.#army.card, this.#army.side), officers: this.#army.officers.map(o => o.summary)} : null,
      isGM: game.user.isGM
    };
  }

  static async #onSubmit(event, form, formData) {
    const data = formData.object;
    const next = {...this.#input};
    for ( const [key, value] of Object.entries(data) ) {
      if ( key in next ) next[key] = (typeof next[key] === "number") ? (Number(value) || 0) : ((typeof next[key] === "boolean") ? Boolean(value) : (value ?? ""));
    }
    this.#input = next;
    this.render();
  }

  static async #onPullArmy() {
    const i = this.#input;
    this.#army = army({side: i.side, battleSize: i.battleSize, officers: i.officers, chained: i.chained, warMonth: i.warMonth, difficulty: i.difficulty, seed: Math.floor(Math.random() * 100000)});
    if ( this.#army.errors.length ) ui.notifications.warn(this.#army.errors.join(" "));
    this.render();
  }

  static async #onClearArmy() {
    this.#army = null;
    this.render();
  }

  static parseTracks(text) {
    const tracks = {};
    for ( const part of String(text ?? "").split(",") ) {
      const match = /^\s*([a-zA-Z]+)\s*([+-]?\s*\d+)\s*$/.exec(part);
      if ( match && (match[1] in DEICIDE.nationTracks) ) tracks[match[1]] = Number(match[2].replace(/\s/g, ""));
    }
    return tracks;
  }

  #scenario() {
    const i = this.#input;
    const payout = {tracks: ScenarioBuilder.parseTracks(i.payoutTracks), drops: String(i.drops).split(",").map(s => s.trim()).filter(Boolean), dust: Number(i.dust) || 0};
    const name = i.name || game.i18n.localize(i.kind === "war" ? "DEICIDE.Generate.WarCard" : "DEICIDE.Generate.DungeonCard");
    let card;
    let text;
    if ( i.kind === "war" ) {
      const enemy = this.#army?.card.enemy ?? {officers: [], companies: [], reinforcements: []};
      card = {
        map: {size: [Number(i.mapWidth) || 24, Number(i.mapHeight) || 20], grid: "square", terrainRegions: String(i.terrain).split(",").map(s => s.trim()).filter(Boolean), fog: Boolean(i.fog)},
        flags: {naval: Boolean(i.naval), arena: Boolean(i.arena)},
        victory: {type: i.victoryType, rounds: i.victoryType === "survive" ? (Number(i.victoryRounds) || 10) : null, note: i.victoryNote},
        defeat: i.defeat,
        deployment: {sheets: "N", swornSlots: "officers + 2", companySlots: "2 x soldiers"},
        enemy,
        intelligence: []
      };
      const enemyText = this.#army ? describeArmy(this.#army.card, this.#army.side) : "";
      text = `<p>${game.i18n.format("DEICIDE.Generate.MonthLine", {month: i.warMonth})} ${i.victoryNote || ""}</p>${enemyText ? `<p>${enemyText}</p>` : ""}${i.briefing ? `<p>${i.briefing}</p>` : ""}`;
    }
    else {
      card = {
        region: i.region,
        floors: String(i.floors).split(",").map((surface, index) => ({rooms: [], shortRest: index === 0, matterSurfaces: surface.trim() || "none"})),
        encounters: String(i.encounters).split("\n").map(line => line.trim()).filter(Boolean).map(line => {
          const [room, enemies] = line.split(":");
          return {room: room.trim(), enemies: String(enemies ?? "").split(",").map(s => s.trim()).filter(Boolean), surprise: "none", arena: false, difficulty: i.difficulty};
        }),
        boss: i.bossId ? {id: i.bossId, room: "", phaseBreaks: [50]} : null,
        hazards: {plagueZones: [], manaburnExposure: /manaburn/i.test(i.hazards), traps: String(i.hazards).split(",").map(s => s.trim()).filter(s => s && !/manaburn/i.test(s))},
        vault: null,
        deployment: {sheets: "N", swornSlots: 2}
      };
      text = `<p>${game.i18n.format("DEICIDE.Generate.MonthLine", {month: i.warMonth})} ${i.region}.</p>${i.briefing ? `<p>${i.briefing}</p>` : ""}`;
    }
    return {name, kind: i.kind, warMonth: Number(i.warMonth) || 1, difficulty: i.difficulty, card, payout, text};
  }

  static async #onPublish() {
    const entry = await publishScenario(this.#scenario(), {officers: this.#army?.officers ?? []});
    ui.notifications.info(game.i18n.format("DEICIDE.Generate.Published", {name: entry.name}));
  }
}
