import {DEICIDE, SYSTEM_ID} from "../config.mjs";
import {Registry} from "../core/registry.mjs";
import {actionDelay, compareTicks, dismountPenalty, projectQueue, reinforcementTick, startingTicks} from "../rules/delay.mjs";
import {needsMorale, rollMorale} from "../rules/company.mjs";
import {decideAll} from "../rules/doctrine.mjs";
import {tickStatuses} from "./statuses.mjs";

export const combatEngines = new Registry("combatEngines");

export function engineForMode(mode) {
  for ( const engine of combatEngines.values() ) {
    if ( engine.modes.includes(mode) ) return engine;
  }
  return combatEngines.get("war");
}

export function sideOf(combatant) {
  const actor = combatant.actor;
  if ( actor?.type === "company" ) return actor.system.side === "enemy" ? "enemy" : "party";
  const disposition = combatant.token?.disposition ?? actor?.prototypeToken?.disposition ?? CONST.TOKEN_DISPOSITIONS.HOSTILE;
  return disposition === CONST.TOKEN_DISPOSITIONS.HOSTILE ? "enemy" : "party";
}

async function updateCombatants(combat, updates) {
  if ( updates.length ) await combat.updateEmbeddedDocuments("Combatant", updates, {turnEvents: false});
}

const warEngine = {
  id: "war",
  label: "DEICIDE.Mode.war",
  modes: ["war", "naval"],

  sort(a, b) {
    const sideOrder = side => side === "party" ? 0 : 1;
    return (sideOrder(a.system.side) - sideOrder(b.system.side))
      || (Number(a.system.acted) - Number(b.system.acted))
      || a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
  },

  async start(combat) {
    const updates = combat.combatants.map(c => ({_id: c.id, "system.acted": false, "system.side": sideOf(c), "system.tilesMoved": 0}));
    await updateCombatants(combat, updates);
    await combat.update({round: 1, turn: null, "system.phase": DEICIDE.war.phases[0], "system.doctrineQueue": []});
    await this.announce(combat);
    return combat;
  },

  activeSide(combat) {
    return combat.system.phase === "enemy" ? "enemy" : "party";
  },

  async toggleActed(combat, combatant, state) {
    const acted = state ?? !combatant.system.acted;
    await combatant.update({"system.acted": acted});
    if ( acted && (combat.turn !== null) && (combat.turns[combat.turn]?.id === combatant.id) ) await combat.update({turn: null});
  },

  async activate(combat, combatant) {
    if ( combatant.system.acted ) return;
    const index = combat.turns.findIndex(c => c.id === combatant.id);
    if ( index >= 0 ) await combat.update({turn: index});
  },

  async nextTurn(combat) {
    const phases = DEICIDE.war.phases;
    const index = phases.indexOf(combat.system.phase);
    if ( index >= phases.length - 1 ) return this.nextRound(combat);
    const phase = phases[index + 1];
    await combat.update({turn: null, "system.phase": phase});
    if ( phase === "enemy" ) await this.planEnemyPhase(combat);
    await this.announce(combat);
    return combat;
  },

  async previousTurn(combat) {
    const phases = DEICIDE.war.phases;
    const index = phases.indexOf(combat.system.phase);
    if ( index <= 0 ) return this.previousRound(combat);
    await combat.update({turn: null, "system.phase": phases[index - 1]});
    return combat;
  },

  async nextRound(combat) {
    await this.endRound(combat);
    const updates = combat.combatants.map(c => ({_id: c.id, "system.acted": false, "system.tilesMoved": 0, "system.reactionUsed": false}));
    await updateCombatants(combat, updates);
    await combat.update({round: combat.round + 1, turn: null, "system.phase": DEICIDE.war.phases[0], "system.doctrineQueue": []});
    await this.announce(combat);
    return combat;
  },

  async previousRound(combat) {
    if ( combat.round <= 1 ) return combat;
    await combat.update({round: combat.round - 1, turn: null, "system.phase": DEICIDE.war.phases.at(-1)});
    return combat;
  },

  async onCombatantAdded(combat, combatant) {
    await combatant.update({"system.side": sideOf(combatant), "system.acted": false});
  },

  async endAction(combat, combatant) {
    await this.toggleActed(combat, combatant, true);
  },

  async endRound(combat) {
    const log = [];
    for ( const combatant of combat.combatants ) {
      const actor = combatant.actor;
      if ( !actor ) continue;
      if ( actor.type === "company" && needsMorale(actor.system.strength) ) {
        const inRadius = this.inFriendlyRadius(combat, combatant);
        const result = rollMorale({quality: actor.system.quality, inRadius});
        log.push({kind: "morale", name: actor.name, ...result});
        if ( !result.passed ) {
          await actor.update({"system.routed": true, "system.strength": 0});
          await combatant.update({defeated: true});
        }
      }
      const ticked = await tickStatuses(actor, "roundEnd");
      for ( const entry of ticked ) log.push({kind: "status", name: actor.name, ...entry});
      if ( actor.type === "character" ) {
        const terrain = combatant.token?.getFlag(SYSTEM_ID, "terrain");
        if ( terrain === "fort" ) await actor.changePool("hp", Math.floor(actor.system.hp.max * DEICIDE.terrain.fort.healPercent / 100));
      }
    }
    if ( log.length ) {
      await ChatMessage.implementation.create({
        content: await foundry.applications.handlebars.renderTemplate("systems/deicide/templates/chat/round-end.hbs", {round: combat.round, log}),
        speaker: {alias: "War Mode"}
      });
    }
  },

  inFriendlyRadius(combat, combatant) {
    const token = combatant.token;
    if ( !token ) return false;
    const side = combatant.system.side;
    for ( const other of combat.combatants ) {
      if ( other.system.side !== side || other.id === combatant.id ) continue;
      const actor = other.actor;
      if ( !actor || !actor.derived?.isOfficer ) continue;
      const otherToken = other.token;
      if ( !otherToken ) continue;
      const distance = Math.max(Math.abs(otherToken.x - token.x), Math.abs(otherToken.y - token.y)) / (canvas.grid?.size ?? 100);
      if ( distance <= (actor.derived.commandRadius ?? 0) ) return true;
    }
    return false;
  },

  snapshot(combat) {
    const grid = canvas.grid?.size ?? 100;
    const scene = combat.scene ?? canvas.scene;
    const units = [];
    for ( const combatant of combat.combatants ) {
      const token = combatant.token;
      const actor = combatant.actor;
      if ( !token || !actor || combatant.isDefeated ) continue;
      units.push({
        id: combatant.id, side: combatant.system.side, kind: actor.type === "company" ? "company" : "character",
        x: Math.round(token.x / grid), y: Math.round(token.y / grid),
        defeated: combatant.isDefeated, officer: Boolean(actor.derived?.isOfficer),
        commandRadius: actor.derived?.commandRadius ?? 0,
        strength: actor.type === "company" ? actor.system.strength : undefined,
        hp: actor.type !== "company" ? actor.system.hp?.value : undefined
      });
    }
    const terrainGrid = scene?.getFlag(SYSTEM_ID, "terrainGrid") ?? null;
    return {
      width: Math.ceil((scene?.width ?? 2000) / grid),
      height: Math.ceil((scene?.height ?? 2000) / grid),
      terrain: (x, y) => game.deicide.terrain?.terrainAt(scene, x, y, terrainGrid) ?? "plain",
      units
    };
  },

  async planEnemyPhase(combat) {
    const snapshot = this.snapshot(combat);
    const companies = [];
    for ( const combatant of combat.combatants ) {
      const actor = combatant.actor;
      if ( actor?.type !== "company" || combatant.system.side !== "enemy" || combatant.isDefeated ) continue;
      if ( !actor.system.doctrine ) continue;
      const unit = snapshot.units.find(u => u.id === combatant.id);
      if ( !unit ) continue;
      companies.push({
        id: combatant.id, side: "enemy", x: unit.x, y: unit.y, type: actor.system.type, doctrine: actor.system.doctrine,
        move: actor.system.derived.move ?? 4, range: actor.system.derived.range ?? [1, 1],
        screenOfficerId: actor.system.screenOfficerId, classTypes: []
      });
    }
    const decisions = decideAll(snapshot, companies).map(decision => ({...decision, confirmed: false}));
    await combat.update({"system.doctrineQueue": decisions});
    return decisions;
  },

  async resolveDecision(combat, decision) {
    const combatant = combat.combatants.get(decision.companyId);
    const grid = canvas.grid?.size ?? 100;
    if ( combatant?.token && decision.move ) {
      await combatant.token.update({x: decision.move.x * grid, y: decision.move.y * grid}, {animate: false});
    }
    if ( combatant && decision.attack ) {
      const target = combat.combatants.get(decision.attack.targetId);
      if ( target ) await game.deicide.actions.companyAttack(combatant, target, {charge: Boolean(decision.move)});
    }
    const queue = combat.system.doctrineQueue.map(entry => entry.companyId === decision.companyId ? {...entry, confirmed: true} : entry);
    await combat.update({"system.doctrineQueue": queue});
    if ( combatant ) await this.toggleActed(combat, combatant, true);
  },

  async resolveAllDecisions(combat) {
    for ( const decision of combat.system.doctrineQueue ) {
      if ( !decision.confirmed ) await this.resolveDecision(combat, decision);
    }
  },

  async announce(combat) {
    const phase = combat.system.phase;
    await ChatMessage.implementation.create({
      content: `<p class="deicide-phase"><strong>Round ${combat.round}</strong>, ${phase === "enemy" ? "Enemy phase" : "Lathander phase"}.</p>`,
      speaker: {alias: "War Mode"}
    });
  },

  trackerContext(combat, context) {
    const side = this.activeSide(combat);
    context.phase = combat.system.phase;
    context.phaseLabel = combat.system.phase === "enemy" ? "Enemy phase" : "Lathander phase";
    context.activeSide = side;
    context.doctrineQueue = combat.system.doctrineQueue;
    context.pendingDecisions = combat.system.doctrineQueue.filter(entry => !entry.confirmed).length;
    context.groups = {party: [], enemy: []};
    for ( const turn of context.turns ) {
      const combatant = combat.combatants.get(turn.id);
      turn.side = combatant?.system.side ?? "party";
      turn.acted = Boolean(combatant?.system.acted);
      turn.canAct = (turn.side === side) && !turn.acted && !turn.isDefeated;
      turn.strength = combatant?.actor?.type === "company" ? combatant.actor.system.strength : null;
      turn.quality = combatant?.actor?.type === "company" ? combatant.actor.system.derived?.qualityGrade : null;
      turn.wavering = combatant?.actor?.type === "company" ? needsMorale(combatant.actor.system.strength) : false;
      context.groups[turn.side].push(turn);
    }
    return context;
  },

  trackerActions: {
    toggleActed: async function(event, target) {
      const combatant = this.viewed?.combatants.get(target.closest("[data-combatant-id]")?.dataset.combatantId);
      if ( combatant ) await warEngine.toggleActed(this.viewed, combatant);
    },
    endPhase: async function() {
      if ( this.viewed ) await warEngine.nextTurn(this.viewed);
    },
    resolveDecision: async function(event, target) {
      const combat = this.viewed;
      const decision = combat?.system.doctrineQueue.find(entry => entry.companyId === target.dataset.companyId);
      if ( decision ) await warEngine.resolveDecision(combat, decision);
    },
    resolveAll: async function() {
      if ( this.viewed ) await warEngine.resolveAllDecisions(this.viewed);
    },
    replan: async function() {
      if ( this.viewed ) await warEngine.planEnemyPhase(this.viewed);
    }
  }
};

const dungeonEngine = {
  id: "dungeon",
  label: "DEICIDE.Mode.dungeon",
  modes: ["dungeon", "arena"],

  sort(a, b) {
    return compareTicks(
      {id: a.id, nextTick: a.system.nextTick, spd: a.actor?.profile?.attributes?.spd ?? 0},
      {id: b.id, nextTick: b.system.nextTick, spd: b.actor?.profile?.attributes?.spd ?? 0}
    );
  },

  async start(combat) {
    const ticks = startingTicks(combat.system.surprise);
    const updates = combat.combatants.map(c => {
      const side = sideOf(c);
      return {
        _id: c.id, "system.side": side, "system.nextTick": ticks[side], initiative: ticks[side],
        "system.acted": false, "system.guardNext": false, "system.reactionUsed": false,
        "system.row": c.actor?.system.row ?? "front"
      };
    });
    await updateCombatants(combat, updates);
    await combat.update({round: 1, turn: 0, "system.tick": 0});
    combat.setupTurns();
    await this.announceTurn(combat);
    return combat;
  },

  current(combat) {
    return combat.turns[0] ?? null;
  },

  async endAction(combat, combatant, {weight, penalty = 0, guard = false} = {}) {
    const actor = combatant.actor;
    const profile = actor?.profile;
    const spd = profile?.attributes?.spd ?? 0;
    const fixed = actor?.system.derived?.fixedDelay ?? null;
    let totalPenalty = penalty + (actor?.derived?.delayPenalty ?? 0);
    if ( actor?.type === "character" ) totalPenalty += dismountPenalty(actor.derived.classTypes ?? [], {arena: combat.system.arena});
    if ( actor?.statuses?.has("stagger") ) totalPenalty += DEICIDE.delay.staggerPenalty;
    const delay = actionDelay({weight: weight ?? DEICIDE.delay.defaultWeight, spd, penalty: totalPenalty, halved: combatant.system.guardNext, fixed});
    const from = combatant.system.nextTick;
    await combatant.update({
      "system.nextTick": from + delay, initiative: from + delay, "system.weightLast": weight ?? DEICIDE.delay.defaultWeight,
      "system.delayLast": delay, "system.guardNext": guard, "system.reactionUsed": false, "system.acted": true
    });
    if ( actor ) {
      if ( guard ) await game.deicide.statuses.apply(actor, "guard");
      else if ( actor.statuses?.has("guard") ) await game.deicide.statuses.remove(actor, "guard");
    }
    await combat.update({turn: 0, "system.tick": from, "system.log": [...combat.system.log.slice(-99), {tick: from, combatantId: combatant.id, delay, weight}]});
    combat.setupTurns();
    await this.announceTurn(combat);
    return delay;
  },

  async nextTurn(combat) {
    const current = this.current(combat);
    if ( !current ) return combat;
    await this.endAction(combat, current);
    return combat;
  },

  async previousTurn(combat) {
    const last = combat.system.log.at(-1);
    if ( !last ) return combat;
    const combatant = combat.combatants.get(last.combatantId);
    if ( combatant ) await combatant.update({"system.nextTick": last.tick, initiative: last.tick});
    await combat.update({turn: 0, "system.tick": last.tick, "system.log": combat.system.log.slice(0, -1)});
    combat.setupTurns();
    return combat;
  },

  async nextRound(combat) {
    return this.nextTurn(combat);
  },

  async previousRound(combat) {
    return this.previousTurn(combat);
  },

  async onCombatantAdded(combat, combatant) {
    const tick = combat.started ? reinforcementTick(combat.system.tick) : 0;
    await combatant.update({"system.side": sideOf(combatant), "system.nextTick": tick, initiative: tick, "system.row": combatant.actor?.system.row ?? "front"});
  },

  async announceTurn(combat) {
    const current = this.current(combat);
    if ( !current?.actor ) return;
    const ticked = await tickStatuses(current.actor, "turnStart");
    const content = await foundry.applications.handlebars.renderTemplate("systems/deicide/templates/chat/tick.hbs", {
      tick: current.system.nextTick, name: current.name, ticked
    });
    await ChatMessage.implementation.create({content, speaker: {alias: "Dungeon Mode"}});
  },

  projection(combat, count = 10) {
    const entries = combat.turns.map(c => ({
      id: c.id, nextTick: c.system.nextTick, spd: c.actor?.profile?.attributes?.spd ?? 0,
      delay: c.system.delayLast ?? actionDelay({weight: DEICIDE.delay.defaultWeight, spd: c.actor?.profile?.attributes?.spd ?? 0, fixed: c.actor?.system.derived?.fixedDelay ?? null}),
      defeated: c.isDefeated
    }));
    return projectQueue(entries, count).map(entry => ({...entry, name: combat.combatants.get(entry.id)?.name ?? "?"}));
  },

  trackerContext(combat, context) {
    context.tick = combat.system.tick;
    context.projection = this.projection(combat);
    context.rows = {party: {front: [], back: []}, enemy: {front: [], back: []}};
    for ( const turn of context.turns ) {
      const combatant = combat.combatants.get(turn.id);
      turn.side = combatant?.system.side ?? "party";
      turn.row = combatant?.system.row ?? "front";
      turn.nextTick = combatant?.system.nextTick ?? 0;
      turn.guard = Boolean(combatant?.system.guardNext);
      turn.current = combat.turns[0]?.id === turn.id;
      context.rows[turn.side]?.[turn.row]?.push(turn);
    }
    return context;
  },

  trackerActions: {
    endAction: async function(event, target) {
      const combat = this.viewed;
      const current = dungeonEngine.current(combat);
      if ( !current ) return;
      const weight = Number(target.dataset.weight) || undefined;
      const guard = target.dataset.guard === "true";
      await dungeonEngine.endAction(combat, current, {weight, guard});
    },
    swapRow: async function(event, target) {
      const combat = this.viewed;
      const combatant = combat?.combatants.get(target.closest("[data-combatant-id]")?.dataset.combatantId);
      if ( !combatant ) return;
      const row = combatant.system.row === "front" ? "back" : "front";
      await combatant.update({"system.row": row});
      if ( combatant.actor ) await combatant.actor.update({"system.row": row});
    },
    openStage: function() {
      game.deicide.apps.DungeonStage?.show(this.viewed);
    }
  }
};

combatEngines.register("war", warEngine);
combatEngines.register("dungeon", dungeonEngine);

export {warEngine, dungeonEngine};
