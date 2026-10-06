import {DEICIDE} from "../config.mjs";
import {dungeonEngine} from "../combat/engines.mjs";
import {actionDelay, guardPreview} from "../rules/delay.mjs";
import {fleeChance} from "../rules/resolve.mjs";
import {rollUnder} from "../core/random.mjs";

const {HandlebarsApplicationMixin, ApplicationV2} = foundry.applications.api;

export class DungeonStage extends HandlebarsApplicationMixin(ApplicationV2) {

  static DEFAULT_OPTIONS = {
    id: "deicide-dungeon-stage",
    classes: ["deicide", "dungeon-stage"],
    window: {title: "DEICIDE.Stage.Title", icon: "fa-solid fa-table-cells-large", resizable: true},
    position: {width: 820, height: 620},
    actions: {
      target: DungeonStage.#onTarget,
      endAction: DungeonStage.#onEndAction,
      setBarrier: DungeonStage.#onSetBarrier,
      swapRow: DungeonStage.#onSwapRow,
      setSurprise: DungeonStage.#onSetSurprise,
      beginCombat: DungeonStage.#onBeginCombat,
      flee: DungeonStage.#onFlee,
      toggleGuardPreview: DungeonStage.#onToggleGuardPreview
    }
  };

  static PARTS = {
    stage: {template: "systems/deicide/templates/apps/dungeon-stage.hbs", scrollable: [".queue", ".battlefield"]}
  };

  static #instance = null;

  static show(combat = game.combat) {
    DungeonStage.#instance ??= new DungeonStage();
    DungeonStage.#instance.combat = combat;
    return DungeonStage.#instance.render({force: true});
  }

  combat = null;
  guardPreview = false;

  #entries(combat) {
    return combat.turns.map(c => ({
      id: c.id, nextTick: c.system.nextTick, spd: c.actor?.profile?.attributes?.spd ?? 0, fixed: c.actor?.system.derived?.fixedDelay ?? null,
      delay: c.system.delayLast ?? actionDelay({weight: DEICIDE.delay.defaultWeight, spd: c.actor?.profile?.attributes?.spd ?? 0, fixed: c.actor?.system.derived?.fixedDelay ?? null}),
      defeated: c.isDefeated
    }));
  }

  async _prepareContext(options) {
    const combat = this.combat ?? game.combat;
    const context = {
      combat, isGM: game.user.isGM, rows: {party: {front: [], back: []}, enemy: {front: [], back: []}}, capacity: DEICIDE.dungeon.rowCapacity,
      surpriseOptions: [{id: "none", label: "DEICIDE.Stage.SurpriseNone"}, {id: "party", label: "DEICIDE.Stage.SurpriseParty"}, {id: "enemy", label: "DEICIDE.Stage.SurpriseEnemy"}]
    };
    if ( !combat || (combat.type !== "dungeon") ) return context;
    context.started = combat.started;
    context.surprise = combat.system.surprise;
    const current = combat.started ? dungeonEngine.current(combat) : null;
    const bosses = [];
    for ( const combatant of combat.combatants ) {
      const actor = combatant.actor;
      const entry = {
        id: combatant.id, name: combatant.name, img: combatant.img, side: combatant.system.side, row: combatant.system.row,
        nextTick: combatant.system.nextTick, current: current?.id === combatant.id, defeated: combatant.isDefeated,
        hp: actor?.system.hp ? `${actor.system.hp.value}/${actor.system.hp.max}` : "",
        hpPercent: actor?.system.hp ? Math.round((actor.system.hp.value / Math.max(actor.system.hp.max, 1)) * 100) : null,
        guard: combatant.system.guardNext, targeted: combatant.token ? game.user.targets.has(combatant.token.object) : false,
        statuses: Array.from(actor?.statuses ?? []),
        canSwap: dungeonEngine.canSwapRow(combatant), mine: combatant.isOwner, fled: combatant.system.fled
      };
      context.rows[entry.side]?.[entry.row]?.push(entry);
      if ( actor?.type === "monster" && actor.system.derived?.isBoss ) {
        bosses.push({
          name: actor.name, phase: actor.system.derived.phase, percent: entry.hpPercent,
          breaks: actor.system.phaseBreaks.map(b => ({percent: b.percent, note: b.note, triggered: b.triggered}))
        });
      }
    }
    context.bosses = bosses;
    context.tick = combat.system.tick;
    const barriers = combat.system.barriers;
    const barrierMax = Math.max(1, ...["party", "enemy"].flatMap(side => [barriers[side].front, barriers[side].back]));
    context.barriers = {
      party: {front: {pool: barriers.party.front, width: Math.round(barriers.party.front / barrierMax * 100)}, back: {pool: barriers.party.back, width: Math.round(barriers.party.back / barrierMax * 100)}},
      enemy: {front: {pool: barriers.enemy.front, width: Math.round(barriers.enemy.front / barrierMax * 100)}, back: {pool: barriers.enemy.back, width: Math.round(barriers.enemy.back / barrierMax * 100)}}
    };
    const entries = combat.started ? this.#entries(combat) : [];
    const name = id => combat.combatants.get(id)?.name ?? "?";
    context.projection = combat.started ? dungeonEngine.projection(combat) : [];
    context.guardPreview = this.guardPreview;
    context.guardProjection = (combat.started && current && this.guardPreview) ? guardPreview(entries, current.id).map(e => ({...e, name: name(e.id), current: e.id === current.id})) : [];
    context.currentName = current?.name ?? "";
    context.currentIsParty = current?.system.side === "party";
    context.currentCanGuard = current ? !(current.actor?.derived?.flags?.cannotGuard) : false;
    if ( current && (current.system.side === "party") ) {
      const enemies = combat.combatants.filter(c => (c.system.side === "enemy") && !c.isDefeated);
      const fastest = Math.max(0, ...enemies.map(c => c.actor?.profile?.attributes?.spd ?? 0));
      const boss = enemies.some(c => c.actor?.system.derived?.isBoss);
      context.flee = {
        chance: fleeChance({spd: current.actor?.profile?.attributes?.spd ?? 0, fastestEnemySpd: fastest, boss}),
        backRow: current.system.row === "back", boss, weight: DEICIDE.dungeonActions.flee.weight
      };
    }
    return context;
  }

  _onRender(context, options) {
    super._onRender(context, options);
    const root = this.element;
    for ( const card of root.querySelectorAll(".unit[draggable]") ) {
      card.addEventListener("dragstart", event => {
        event.dataTransfer.setData("text/plain", JSON.stringify({combatantId: card.dataset.combatantId}));
        event.dataTransfer.effectAllowed = "move";
      });
    }
    for ( const cell of root.querySelectorAll(".row-cell") ) {
      cell.addEventListener("dragover", event => { event.preventDefault(); cell.classList.add("drop-target"); });
      cell.addEventListener("dragleave", () => cell.classList.remove("drop-target"));
      cell.addEventListener("drop", async event => {
        event.preventDefault();
        cell.classList.remove("drop-target");
        let data;
        try { data = JSON.parse(event.dataTransfer.getData("text/plain")); } catch { return; }
        await this.#moveToRow(data.combatantId, cell.dataset.side, cell.dataset.row, {paid: true});
      });
    }
    if ( !this.#hooked ) {
      this.#hooked = true;
      const refresh = () => { if ( this.rendered ) this.render(); };
      Hooks.on("updateCombat", refresh);
      Hooks.on("updateCombatant", refresh);
      Hooks.on("createCombatant", refresh);
      Hooks.on("deleteCombatant", refresh);
      Hooks.on("targetToken", refresh);
      Hooks.on("updateActor", refresh);
      Hooks.on("deicide.phaseBreak", refresh);
    }
  }

  #hooked = false;

  async #moveToRow(combatantId, side, row, {paid = false} = {}) {
    const combat = this.combat ?? game.combat;
    const combatant = combat?.combatants.get(combatantId);
    if ( !combatant || (!game.user.isGM && !combatant.isOwner) ) return;
    if ( combatant.system.side !== side ) {
      ui.notifications?.warn(game.i18n.localize("DEICIDE.Stage.NoSideChange"));
      return;
    }
    if ( combatant.system.row === row ) return;
    if ( !dungeonEngine.canSwapRow(combatant) ) {
      ui.notifications?.warn(game.i18n.format("DEICIDE.Stage.CannotSwap", {name: combatant.name}));
      return;
    }
    const occupants = combat.combatants.filter(c => (c.id !== combatantId) && (c.system.side === side) && (c.system.row === row) && !c.isDefeated);
    if ( occupants.length >= DEICIDE.dungeon.rowCapacity ) {
      ui.notifications?.warn(game.i18n.format("DEICIDE.Stage.RowFull", {capacity: DEICIDE.dungeon.rowCapacity}));
      return;
    }
    await combatant.update({"system.row": row});
    if ( combatant.actor ) await combatant.actor.update({"system.row": row});
    const current = combat.started ? dungeonEngine.current(combat) : null;
    if ( paid && current && (current.id === combatant.id) ) {
      await dungeonEngine.endAction(combat, combatant, {weight: DEICIDE.dungeonActions.swapRow.weight});
      ui.notifications?.info(game.i18n.format("DEICIDE.Stage.SwapPaid", {name: combatant.name, weight: DEICIDE.dungeonActions.swapRow.weight}));
    }
  }

  static async #onTarget(event, target) {
    const combat = this.combat ?? game.combat;
    const combatant = combat?.combatants.get(target.closest("[data-combatant-id]")?.dataset.combatantId);
    const token = combatant?.token?.object;
    if ( token ) token.setTarget(!game.user.targets.has(token), {releaseOthers: !event.shiftKey});
    else ui.notifications?.info(game.i18n.localize("DEICIDE.Stage.NoToken"));
    this.render();
  }

  static async #onEndAction(event, target) {
    const combat = this.combat ?? game.combat;
    const current = combat ? dungeonEngine.current(combat) : null;
    if ( !current ) return;
    if ( !game.user.isGM && !current.isOwner ) return;
    await dungeonEngine.endAction(combat, current, {weight: Number(target.dataset.weight) || undefined, guard: target.dataset.guard === "true"});
  }

  static async #onSwapRow(event, target) {
    const combat = this.combat ?? game.combat;
    const combatant = combat?.combatants.get(target.closest("[data-combatant-id]")?.dataset.combatantId);
    if ( !combatant ) return;
    await this.#moveToRow(combatant.id, combatant.system.side, combatant.system.row === "front" ? "back" : "front", {paid: true});
  }

  static async #onSetBarrier(event, target) {
    const combat = this.combat ?? game.combat;
    if ( !combat || !game.user.isGM ) return;
    const {side, row} = target.dataset;
    const current = combat.system.barriers[side]?.[row] ?? 0;
    const value = await foundry.applications.api.DialogV2.prompt({
      window: {title: game.i18n.format("DEICIDE.Stage.BarrierTitle", {side, row})},
      content: `<input type="number" name="pool" value="${current}" min="0" step="1" autofocus>`,
      ok: {label: game.i18n.localize("DEICIDE.Stage.Set"), callback: (event, button) => Number(button.form.elements.pool.value)}
    });
    if ( typeof value === "number" ) await combat.update({[`system.barriers.${side}.${row}`]: Math.max(value, 0)});
  }

  static async #onSetSurprise(event, target) {
    const combat = this.combat ?? game.combat;
    if ( !combat || !game.user.isGM || combat.started ) return;
    await combat.update({"system.surprise": target.dataset.surprise});
  }

  static async #onBeginCombat() {
    const combat = this.combat ?? game.combat;
    if ( !combat || !game.user.isGM || combat.started ) return;
    await combat.startCombat();
  }

  static async #onToggleGuardPreview() {
    this.guardPreview = !this.guardPreview;
    this.render();
  }

  static async #onFlee() {
    const combat = this.combat ?? game.combat;
    const current = combat ? dungeonEngine.current(combat) : null;
    if ( !current || (current.system.side !== "party") ) return;
    if ( !game.user.isGM && !current.isOwner ) return;
    if ( current.system.row !== DEICIDE.dungeonActions.flee.row ) {
      ui.notifications?.warn(game.i18n.localize("DEICIDE.Stage.FleeBackRow"));
      return;
    }
    const enemies = combat.combatants.filter(c => (c.system.side === "enemy") && !c.isDefeated);
    const boss = enemies.some(c => c.actor?.system.derived?.isBoss);
    const fastest = Math.max(0, ...enemies.map(c => c.actor?.profile?.attributes?.spd ?? 0));
    const chance = fleeChance({spd: current.actor?.profile?.attributes?.spd ?? 0, fastestEnemySpd: fastest, boss});
    if ( boss ) { ui.notifications?.warn(game.i18n.localize("DEICIDE.Stage.FleeBoss")); return; }
    const roll = await new Roll("1d100").evaluate();
    const success = rollUnder(roll.total, chance);
    await ChatMessage.implementation.create({
      content: `<p class="deicide-flee"><strong>${current.name}</strong> flees: d100 ${roll.total} under ${chance}, ${success ? "escapes" : "fails"}.</p>`,
      rolls: [roll], speaker: ChatMessage.implementation.getSpeaker({actor: current.actor})
    });
    if ( success ) await current.update({"system.fled": true, defeated: true});
    await dungeonEngine.endAction(combat, current, {weight: DEICIDE.dungeonActions.flee.weight});
  }
}
