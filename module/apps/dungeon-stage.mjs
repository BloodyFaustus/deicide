import {DEICIDE} from "../config.mjs";
import {dungeonEngine} from "../combat/engines.mjs";

const {HandlebarsApplicationMixin, ApplicationV2} = foundry.applications.api;

export class DungeonStage extends HandlebarsApplicationMixin(ApplicationV2) {

  static DEFAULT_OPTIONS = {
    id: "deicide-dungeon-stage",
    classes: ["deicide", "dungeon-stage"],
    window: {title: "Dungeon stage", icon: "fa-solid fa-table-cells-large", resizable: true},
    position: {width: 760, height: 560},
    actions: {
      target: DungeonStage.#onTarget,
      endAction: DungeonStage.#onEndAction,
      setBarrier: DungeonStage.#onSetBarrier,
      swapRow: DungeonStage.#onSwapRow
    }
  };

  static PARTS = {
    stage: {template: "systems/deicide/templates/apps/dungeon-stage.hbs", scrollable: [".queue"]}
  };

  static #instance = null;

  static show(combat = game.combat) {
    DungeonStage.#instance ??= new DungeonStage();
    DungeonStage.#instance.combat = combat;
    return DungeonStage.#instance.render({force: true});
  }

  combat = null;

  async _prepareContext(options) {
    const combat = this.combat ?? game.combat;
    const context = {combat, isGM: game.user.isGM, rows: {party: {front: [], back: []}, enemy: {front: [], back: []}}, capacity: DEICIDE.dungeon.rowCapacity};
    if ( !combat || (combat.type !== "dungeon") ) return context;
    const current = dungeonEngine.current(combat);
    for ( const combatant of combat.turns ) {
      const actor = combatant.actor;
      const entry = {
        id: combatant.id, name: combatant.name, img: combatant.img, side: combatant.system.side, row: combatant.system.row,
        nextTick: combatant.system.nextTick, current: current?.id === combatant.id, defeated: combatant.isDefeated,
        hp: actor?.system.hp ? `${actor.system.hp.value}/${actor.system.hp.max}` : "",
        guard: combatant.system.guardNext, targeted: combatant.token ? game.user.targets.has(combatant.token.object) : false,
        statuses: Array.from(actor?.statuses ?? [])
      };
      context.rows[entry.side]?.[entry.row]?.push(entry);
    }
    context.tick = combat.system.tick;
    context.barriers = combat.system.barriers;
    context.projection = dungeonEngine.projection(combat);
    context.currentName = current?.name ?? "";
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
        await this.#moveToRow(data.combatantId, cell.dataset.side, cell.dataset.row);
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
    }
  }

  #hooked = false;

  async #moveToRow(combatantId, side, row) {
    const combat = this.combat ?? game.combat;
    const combatant = combat?.combatants.get(combatantId);
    if ( !combatant || !game.user.isGM && !combatant.isOwner ) return;
    if ( combatant.system.side !== side ) {
      ui.notifications?.warn("A combatant cannot change sides.");
      return;
    }
    const occupants = combat.combatants.filter(c => (c.id !== combatantId) && (c.system.side === side) && (c.system.row === row) && !c.isDefeated);
    if ( occupants.length >= DEICIDE.dungeon.rowCapacity ) {
      ui.notifications?.warn(`That row holds ${DEICIDE.dungeon.rowCapacity}.`);
      return;
    }
    await combatant.update({"system.row": row});
    if ( combatant.actor ) await combatant.actor.update({"system.row": row});
  }

  static async #onTarget(event, target) {
    const combat = this.combat ?? game.combat;
    const combatant = combat?.combatants.get(target.closest("[data-combatant-id]")?.dataset.combatantId);
    const token = combatant?.token?.object;
    if ( token ) token.setTarget(!game.user.targets.has(token), {releaseOthers: !event.shiftKey});
    else ui.notifications?.info("That combatant has no token to target. Use the actor directly.");
    this.render();
  }

  static async #onEndAction(event, target) {
    const combat = this.combat ?? game.combat;
    const current = combat ? dungeonEngine.current(combat) : null;
    if ( !current ) return;
    await dungeonEngine.endAction(combat, current, {weight: Number(target.dataset.weight) || undefined, guard: target.dataset.guard === "true"});
  }

  static async #onSwapRow(event, target) {
    const combat = this.combat ?? game.combat;
    const combatant = combat?.combatants.get(target.closest("[data-combatant-id]")?.dataset.combatantId);
    if ( !combatant ) return;
    await this.#moveToRow(combatant.id, combatant.system.side, combatant.system.row === "front" ? "back" : "front");
  }

  static async #onSetBarrier(event, target) {
    const combat = this.combat ?? game.combat;
    if ( !combat || !game.user.isGM ) return;
    const {side, row} = target.dataset;
    const current = combat.system.barriers[side]?.[row] ?? 0;
    const value = await foundry.applications.api.DialogV2.prompt({
      window: {title: `Barrier on the ${side} ${row} row`},
      content: `<input type="number" name="pool" value="${current}" min="0" step="1" autofocus>`,
      ok: {label: "Set", callback: (event, button) => Number(button.form.elements.pool.value)}
    });
    if ( typeof value === "number" ) await combat.update({[`system.barriers.${side}.${row}`]: Math.max(value, 0)});
  }
}
