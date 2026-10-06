import {SYSTEM_ID} from "../config.mjs";
import {sceneMode} from "../hooks/scene-mode.mjs";
import {combatEngines, engineForMode} from "../combat/engines.mjs";

export class DeicideCombat extends foundry.documents.Combat {

  get engine() {
    return combatEngines.get(this.type) ?? combatEngines.get("war");
  }

  async _preCreate(data, options, user) {
    const allowed = await super._preCreate(data, options, user);
    if ( allowed === false ) return false;
    const scene = this.scene ?? game.scenes.get(data.scene) ?? canvas.scene ?? null;
    const mode = sceneMode(scene);
    const wanted = engineForMode(mode).id;
    const requested = (data.type && (data.type !== "base")) ? data.type : null;
    if ( requested && (requested !== wanted) ) {
      const message = `A ${requested} combat cannot start on a ${mode} scene.`;
      ui.notifications?.error(message);
      throw new Error(message);
    }
    if ( this.type !== wanted ) this.updateSource({type: wanted, system: _replace({})});
  }

  _sortCombatants(a, b) {

    const engine = a.parent?.engine ?? combatEngines.get("war");
    return engine.sort(a, b);
  }

  async startCombat() {
    Hooks.callAll("combatStart", this, {round: 1, turn: null});
    await this.engine.start(this);
    foundry.documents.ActiveEffect.registry?.refresh?.("combatStart", {combat: this});
    return this;
  }

  async nextTurn() {
    if ( this.round === 0 ) return this.startCombat();
    return this.engine.nextTurn(this);
  }

  async previousTurn() {
    return this.engine.previousTurn(this);
  }

  async nextRound() {
    if ( this.round === 0 ) return this.startCombat();
    return this.engine.nextRound(this);
  }

  async previousRound() {
    return this.engine.previousRound(this);
  }

  async endAction(combatant, options = {}) {
    return this.engine.endAction(this, combatant, options);
  }

  combatantFor(actor) {
    return this.combatants.find(c => c.actor?.id === actor?.id) ?? null;
  }

  async _manageTurnEvents() {
    Hooks.callAll("combatTurnChange", this, this.previous, this.current);
  }

  async _onCreateDescendantDocuments(parent, collection, documents, data, options, userId) {
    await super._onCreateDescendantDocuments(parent, collection, documents, data, options, userId);
    if ( (collection !== "combatants") || (game.user.id !== userId) ) return;
    for ( const combatant of documents ) {
      if ( combatant.type === "unit" ) await this.engine.onCombatantAdded?.(this, combatant);
    }
  }
}

export class DeicideCombatant extends foundry.documents.Combatant {

  async _preCreate(data, options, user) {
    const allowed = await super._preCreate(data, options, user);
    if ( allowed === false ) return false;
    if ( this.type !== "unit" ) this.updateSource({type: "unit", system: _replace({})});
  }

  async rollInitiative() {
    return this;
  }
}

export {SYSTEM_ID};
