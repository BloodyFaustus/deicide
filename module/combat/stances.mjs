import {DEICIDE} from "../config.mjs";
import {resolveEffects} from "../rules/effects.mjs";
import {applyOutcomes} from "./effects-apply.mjs";

export function activeStance(actor) {
  return actor?.effects.find(effect => (effect.type === "status") && effect.system.stance) ?? null;
}

export function stanceFlags(stance) {
  const flags = {};
  for ( const effect of stance?.effects ?? [] ) {
    if ( effect.kind === "flag" ) flags[effect.key] = effect.value ?? true;
  }
  return flags;
}

function outcomeContext(actor, extra = {}) {
  return {actor: {id: actor.uuid, profile: actor.profile}, targets: [], engine: game.deicide.scene.engine(), ...extra};
}

export async function enterStance(actor, abilityId, {payWeight = true} = {}) {
  const ability = actor.lookup("ability", abilityId);
  if ( !ability || (ability.type !== "stance") ) throw new Error(`${abilityId} is not a stance`);
  const known = actor.derived?.skills?.available?.stances ?? [];
  if ( !known.includes(abilityId) ) {
    ui.notifications?.warn(`${actor.name} cannot take ${ability.name} now.`);
    return null;
  }
  const current = activeStance(actor);
  if ( current?.system.abilityId === abilityId ) return current;
  if ( current ) await exitStance(actor, {payWeight: false});

  const block = ability.stance ?? {modifiers: ability.modifiers ?? [], effects: []};
  const [effect] = await actor.createEmbeddedDocuments("ActiveEffect", [{
    name: ability.name,
    img: "icons/svg/statue.svg",
    type: "status",
    statuses: ["stance"],
    duration: {value: null, units: "turns", expiry: null},
    system: {
      statusId: "stance", stackRule: "refresh", stance: true, abilityId, flags: stanceFlags(block),
      modifiers: block.modifiers ?? [], description: ability.summary ?? ""
    }
  }]);
  await actor.update({"system.loadout.stance": abilityId});
  if ( block.onEnter?.length ) await applyOutcomes(resolveEffects(block.onEnter, outcomeContext(actor)), {actor});
  const combat = game.combat?.started ? game.combat : null;
  const combatant = combat?.combatantFor(actor);
  if ( payWeight && combat && combatant && (combat.type === "dungeon") ) {
    await combat.endAction(combatant, {weight: DEICIDE.dungeonActions.stance.weight});
  }
  Hooks.callAll("deicide.stanceEntered", actor, ability);
  return effect ?? null;
}

export async function exitStance(actor, {payWeight = false} = {}) {
  const current = activeStance(actor);
  if ( !current ) return false;
  const ability = actor.lookup("ability", current.system.abilityId);
  await current.delete();
  await actor.update({"system.loadout.stance": null});
  const block = ability?.stance;
  if ( block?.onExit?.length ) await applyOutcomes(resolveEffects(block.onExit, outcomeContext(actor)), {actor});
  const combat = game.combat?.started ? game.combat : null;
  const combatant = combat?.combatantFor(actor);
  if ( payWeight && combat && combatant && (combat.type === "dungeon") ) {
    await combat.endAction(combatant, {weight: DEICIDE.dungeonActions.stance.weight});
  }
  Hooks.callAll("deicide.stanceLeft", actor, ability);
  return true;
}

export async function toggleStance(actor, abilityId) {
  const current = activeStance(actor);
  if ( current?.system.abilityId === abilityId ) return exitStance(actor, {payWeight: true});
  return enterStance(actor, abilityId);
}

export function effectFlags(actor) {
  const flags = {};
  for ( const effect of actor?.effects ?? [] ) {
    if ( effect.type !== "status" ) continue;
    Object.assign(flags, DEICIDE.statuses[effect.system.statusId]?.flags ?? {}, effect.system.flags ?? {});
  }
  return flags;
}

export const stances = {enter: enterStance, exit: exitStance, toggle: toggleStance, active: activeStance, flags: effectFlags};
