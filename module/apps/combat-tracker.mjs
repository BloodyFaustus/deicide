import {combatEngines} from "../combat/engines.mjs";

export class DeicideCombatTracker extends foundry.applications.sidebar.tabs.CombatTracker {

  static DEFAULT_OPTIONS = {
    actions: Object.assign({}, ...Array.from(combatEngines.values()).map(engine => engine.trackerActions ?? {}))
  };

  static PARTS = {
    header: {template: "templates/sidebar/tabs/combat/header.hbs"},
    tracker: {template: "systems/deicide/templates/combat/tracker.hbs", scrollable: [""]},
    footer: {template: "systems/deicide/templates/combat/footer.hbs"}
  };

  async _prepareTrackerContext(context, options) {
    await super._prepareTrackerContext(context, options);
    const combat = this.viewed;
    context.engine = combat?.type ?? null;
    context.started = Boolean(combat?.started);
    if ( combat?.started ) combat.engine.trackerContext(combat, context);
    return context;
  }

  async _prepareCombatContext(context, options) {
    await super._prepareCombatContext(context, options);
    const combat = this.viewed;
    context.engine = combat?.type ?? null;
    context.engineLabel = combat ? game.i18n.localize(combatEngines.get(combat.type)?.label ?? combat.type) : "";
    context.phase = combat?.system?.phase ?? null;
    context.tick = combat?.system?.tick ?? null;
    context.pendingDecisions = combat?.system?.doctrineQueue?.filter?.(entry => !entry.confirmed).length ?? 0;
    return context;
  }

  static addEngineActions(engine) {
    Object.assign(this.DEFAULT_OPTIONS.actions, engine.trackerActions ?? {});
  }
}

combatEngines.onRegister((id, engine) => DeicideCombatTracker.addEngineActions(engine));
