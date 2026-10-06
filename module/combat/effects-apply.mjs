import {DEICIDE} from "../config.mjs";
import {applyStatus, removeStatus} from "./statuses.mjs";

const CHARACTER_POOLS = {hp: "hp", channel: "channel", matter: "matter"};
const CHARACTER_NUMBERS = ["static", "dust", "saturation", "marks", "divineAttention", "manaburn", "debt"];

async function resolveActor(id) {
  if ( !id ) return null;
  if ( id.includes(".") ) return fromUuid(id);
  return game.actors.get(id) ?? null;
}

function combatantOf(combat, actor) {
  return combat?.combatants.find(c => c.actor?.uuid === actor.uuid || c.actor?.id === actor.id) ?? null;
}

export function expiryFor(expires, combat) {
  if ( !expires || !combat ) return null;
  if ( expires === "phase" ) return {round: combat.round, phase: combat.system?.phase ?? null, kind: "phase"};
  if ( expires === "round" ) return {round: combat.round, kind: "round"};
  if ( expires === "ownTurn" ) return {kind: "ownTurn"};
  if ( expires === "battle" ) return {kind: "battle"};
  if ( expires === "encounter" ) return {kind: "battle"};
  if ( expires === "session" ) return {kind: "session"};
  return {kind: String(expires)};
}

export async function applyOutcomes(outcomes, {actor = null, combat = null, notes = []} = {}) {
  combat ??= game.combat?.started ? game.combat : null;
  for ( const outcome of outcomes ?? [] ) {
    const targets = [];
    for ( const id of outcome.targets ?? [] ) {
      const target = await resolveActor(id);
      if ( target ) targets.push(target);
    }
    switch ( outcome.type ) {
      case "applyStatus":
        for ( const target of targets ) {
          await applyStatus(target, outcome.statusId, {
            turns: outcome.turns ?? undefined, pool: outcome.pool ?? null, modifiers: outcome.modifiers ?? null,
            flags: outcome.flags ?? null, params: outcome.params ?? null, expires: expiryFor(outcome.expires, combat),
            sourceUuid: actor?.uuid ?? null
          });
          notes.push(`${target.name}: ${outcome.statusId}`);
        }
        break;
      case "removeStatus":
        for ( const target of targets ) {
          if ( outcome.statusId === "all" ) {
            for ( const effect of [...target.effects] ) if ( (effect.type === "status") && !effect.system.stance ) await effect.delete();
            notes.push(`${target.name}: statuses cleared`);
          }
          else if ( await removeStatus(target, outcome.statusId) ) notes.push(`${target.name}: ${outcome.statusId} removed`);
        }
        break;
      case "damage":
        for ( const entry of outcome.entries ?? [] ) {
          const target = await resolveActor(entry.id);
          if ( !target ) continue;
          if ( target.type === "company" ) await target.update({"system.strength": Math.max(target.system.strength - entry.amount, 0)});
          else await target.applyDamage(entry.amount);
          notes.push(`${target.name}: ${entry.amount} ${outcome.tag ?? ""} damage`.replace(/\s+/g, " "));
        }
        break;
      case "heal":
        for ( const target of targets ) {
          if ( target.type === "company" ) await target.update({"system.strength": Math.min(target.system.strength + outcome.amount, 100)});
          else await target.changePool("hp", outcome.amount);
          notes.push(`${target.name}: heals ${outcome.amount}`);
        }
        break;
      case "pool":
        for ( const target of targets ) {
          await changePoolOf(target, outcome.key, outcome.delta, outcome, actor);
          notes.push(`${target.name}: ${outcome.key} ${typeof outcome.delta === "number" && outcome.delta > 0 ? "+" : ""}${outcome.delta}`);
        }
        break;
      case "move":
        for ( const target of targets ) await moveActor(target, outcome, {combat, source: actor, notes});
        break;
      case "barrier":
        if ( combat?.type === "dungeon" ) {
          const side = outcome.side === "enemy" ? "enemy" : (combatantOf(combat, actor)?.system.side ?? "party");
          const key = `system.barriers.${side}.${outcome.row ?? "front"}`;
          const current = foundry.utils.getProperty(combat, key) ?? 0;
          await combat.update({[key]: current + outcome.pool});
          notes.push(`Barrier ${outcome.pool} on the ${side} ${outcome.row ?? "front"} row`);
        }
        else notes.push(`Barrier ${outcome.pool}: set it on the Dungeon stage`);
        break;
      case "terrain":
        notes.push(`Terrain ${outcome.op}${outcome.tileType ? ` (${outcome.tileType})` : ""}: use the terrain brush on the tile`);
        break;
      case "summon":
        await summonCompany(outcome, {actor, combat, notes});
        break;
      case "grantAction":
        for ( const target of targets ) {
          const combatant = combatantOf(combat, target);
          if ( !combatant ) continue;
          await combatant.update({"system.activations": (combatant.system.activations ?? 0) + (outcome.count ?? 1), "system.acted": false});
          notes.push(`${target.name}: ${outcome.count ?? 1} extra activation`);
        }
        break;
      case "refundAction": {
        if ( !outcome.granted || !actor ) break;
        const combatant = combatantOf(combat, actor);
        if ( !combatant ) break;
        if ( combat.type === "war" ) await combatant.update({"system.acted": false});
        else await combatant.update({"system.nextTick": Math.max(combatant.system.nextTick - (combatant.system.delayLast ?? 0), combat.system.tick), initiative: Math.max(combatant.system.nextTick - (combatant.system.delayLast ?? 0), combat.system.tick)});
        notes.push(`${actor.name}: action refunded`);
        break;
      }
      case "reveal": {
        const names = targets.map(t => t.name).join(", ");
        if ( (outcome.what === "fog") && outcome.radius && actor ) {
          const widened = await game.deicide.overlays?.revealFog(actor, outcome.radius);
          if ( widened ) notes.push(`${actor.name}: sight ${outcome.radius} tiles until the combat ends`);
        }
        await ChatMessage.implementation.create({
          content: `<p class="deicide-reveal"><strong>${actor?.name ?? "?"}</strong> reveals ${outcome.what}${names ? ` of ${names}` : ""}${outcome.radius ? ` within ${outcome.radius}` : ""}.</p>${revealText(outcome, targets)}`,
          whisper: game.users.filter(user => !user.isGM).map(user => user.id).concat(game.users.activeGM ? [game.users.activeGM.id] : []),
          speaker: {alias: actor?.name ?? "Deicide"}
        });
        break;
      }
      case "nationTrack": {
        const nation = game.deicide.nation.actor;
        if ( !nation ) { notes.push(`${outcome.track} track ${outcome.delta}: no Nation actor`); break; }
        const onceKey = `tracks.${outcome.track}.${actor?.uuid ?? "any"}`;
        if ( outcome.once && nation.getFlag("deicide", onceKey) ) break;
        const current = nation.system.tracks?.[outcome.track] ?? 0;
        await nation.update({[`system.tracks.${outcome.track}`]: Math.max(current + outcome.delta, 0)});
        if ( outcome.once ) await nation.setFlag("deicide", onceKey, true);
        notes.push(`${outcome.track} track ${outcome.delta > 0 ? "+" : ""}${outcome.delta}`);
        break;
      }
      case "standing": {
        const owner = actor;
        if ( !owner || (owner.type !== "character") ) break;
        const onceKey = `standing.${outcome.faction}.${outcome.source ?? "effect"}`;
        if ( outcome.effect?.once && owner.getFlag("deicide", onceKey) ) break;
        const current = owner.system.standingFaction?.[outcome.faction] ?? DEICIDE.standing.default;
        await owner.update({[`system.standingFaction.${outcome.faction}`]: Math.min(Math.max(current + outcome.delta, 0), 100)});
        if ( outcome.effect?.once ) await owner.setFlag("deicide", onceKey, true);
        notes.push(`${outcome.faction} Standing ${outcome.delta > 0 ? "+" : ""}${outcome.delta}`);
        break;
      }
      case "flag":
        for ( const target of targets ) {
          await target.setFlag("deicide", `effectFlags.${outcome.key}`, {value: outcome.value, duration: outcome.duration ?? null, source: outcome.source ?? null});
        }
        break;
      case "survive":
        for ( const target of targets ) {
          await target.update({"system.hp.value": Math.max(outcome.hp ?? 1, 1)});
          await removeStatus(target, "downed");
          notes.push(`${target.name} survives at ${outcome.hp ?? 1} HP`);
        }
        break;
      case "revive":
        for ( const target of targets ) {
          const max = target.system.hp?.max ?? 1;
          await target.update({"system.hp.value": Math.max(Math.floor(max * (outcome.fraction ?? 0.25)), 1)});
          await removeStatus(target, "downed");
          notes.push(`${target.name} revives at ${Math.round((outcome.fraction ?? 0.25) * 100)} percent`);
        }
        break;
      default:
        break;
    }
  }
  return notes;
}

async function changePoolOf(target, key, delta, outcome, source) {
  if ( target.type === "company" ) {
    if ( key !== "strength" ) return;
    const value = outcome.effect?.op === "set" ? delta : Math.min(Math.max(target.system.strength + delta, 0), 100);
    await target.update({"system.strength": value, "system.routed": value > 0 ? false : target.system.routed});
    return;
  }
  if ( target.type !== "character" ) return;
  if ( key in CHARACTER_POOLS ) {
    if ( typeof delta === "number" ) await target.changePool(key, delta);
    return;
  }
  if ( key === "stolen" ) {
    const stolen = [...(target.system.stolen ?? [])];
    const slots = target.derived?.stolen?.slots ?? 0;
    if ( (delta === "+ability") && outcome.abilityId && (stolen.length < slots) ) {
      stolen.push({abilityId: outcome.abilityId, casterMag: outcome.casterMag ?? 0});
      await target.update({"system.stolen": stolen});
    }
    return;
  }
  if ( key === "redWater" ) {
    const item = target.items.find(i => (i.type === "consumable") && (i.system.identifier === "redWater"));
    if ( item ) {
      const quantity = (item.system.quantity ?? 1) + delta;
      if ( quantity <= 0 ) await item.delete();
      else await item.update({"system.quantity": quantity});
    }
    return;
  }
  if ( CHARACTER_NUMBERS.includes(key) ) {
    if ( typeof delta !== "number" ) return;
    const current = target.system[key] ?? 0;
    await target.update({[`system.${key}`]: Math.max(current + delta, 0)});
  }
}

async function moveActor(target, outcome, {combat, source, notes}) {
  const combatant = combatantOf(combat, target);
  const immune = target.derived?.immunities ?? [];
  const flags = target.derived?.flags ?? {};
  if ( outcome.mode === "swapRow" ) {
    if ( !combatant || (combat.type !== "dungeon") ) { notes.push(`${target.name}: forced row swap`); return; }
    if ( immune.includes("rowSwap") || flags.immovable || flags.cannotSwapRow ) { notes.push(`${target.name} cannot be moved`); return; }
    const row = combatant.system.row === "front" ? "back" : "front";
    await combatant.update({"system.row": row});
    await target.update({"system.row": row});
    notes.push(`${target.name}: swapped to the ${row} row`);
    return;
  }
  if ( ["push", "pull"].includes(outcome.mode) ) {
    const token = combatant?.token?.object ?? target.getActiveTokens()[0];
    const sourceToken = source ? (combatantOf(combat, source)?.token?.object ?? source.getActiveTokens()[0]) : null;
    if ( !token || !sourceToken ) { notes.push(`${target.name}: ${outcome.mode} ${outcome.tiles} tile`); return; }
    if ( immune.includes(outcome.mode) || flags.immovable ) { notes.push(`${target.name} cannot be moved`); return; }
    const grid = canvas.grid.size;
    const dx = Math.sign(token.document.x - sourceToken.document.x);
    const dy = Math.sign(token.document.y - sourceToken.document.y);
    const sign = outcome.mode === "push" ? 1 : -1;
    const x = token.document.x + sign * dx * grid * (outcome.tiles ?? 1);
    const y = token.document.y + sign * dy * grid * (outcome.tiles ?? 1);
    await token.document.update({x, y}, {animate: false});
    notes.push(`${target.name}: ${outcome.mode} ${outcome.tiles ?? 1} tile`);
    return;
  }
  notes.push(`${target.name}: ${outcome.mode}${outcome.tiles ? ` ${outcome.tiles} tiles` : ""} (move the token)`);
}

async function summonCompany(outcome, {actor, combat, notes}) {
  const entry = game.deicide.catalog.get("company", `${outcome.companyType}Company`);
  const side = actor?.type === "company" ? actor.system.side : (combatantOf(combat, actor)?.system.side === "enemy" ? "enemy" : "lathander");
  const data = {
    name: `${actor?.name ?? "Summoned"}'s ${outcome.companyType} company`,
    type: "company",
    img: entry?.img ?? "icons/svg/tower.svg",
    system: {...(entry?.system ?? {type: outcome.companyType}), strength: outcome.strength, quality: outcome.quality, side, owner: actor?.id ?? null},
    flags: {deicide: {summoned: true, duration: outcome.duration, summonerUuid: actor?.uuid ?? null}}
  };
  const company = await Actor.implementation.create(data);
  const sourceToken = actor ? (combatantOf(combat, actor)?.token ?? actor.getActiveTokens()[0]?.document) : null;
  if ( sourceToken && canvas.scene ) {
    const grid = canvas.grid.size;
    const tokenData = await company.getTokenDocument({x: sourceToken.x + grid, y: sourceToken.y});
    const [token] = await canvas.scene.createEmbeddedDocuments("Token", [tokenData.toObject()]);
    if ( combat && token ) await combat.createEmbeddedDocuments("Combatant", [{tokenId: token.id, sceneId: canvas.scene.id, actorId: company.id, type: "unit"}]);
  }
  notes.push(`${company.name} enters at Strength ${outcome.strength}, Quality ${outcome.quality}`);
}

function revealText(outcome, targets) {
  const lines = [];
  for ( const target of targets ) {
    const system = target.system;
    if ( target.type === "company" ) lines.push(`<li>${target.name}: Strength ${system.strength}, Quality ${system.quality}, doctrine ${system.doctrine ?? "none"}</li>`);
    else if ( system.hp ) lines.push(`<li>${target.name}: HP ${system.hp.value}/${system.hp.max}${system.channel ? `, Channel ${system.channel.value}/${system.channel.max}` : ""}${typeof system.saturation === "number" ? `, Saturation ${system.saturation}` : ""}, statuses ${Array.from(target.statuses ?? []).join(", ") || "none"}</li>`);
  }
  return lines.length ? `<ul class="plain">${lines.join("")}</ul>` : "";
}

export const effectsApply = {applyOutcomes, expiryFor};
