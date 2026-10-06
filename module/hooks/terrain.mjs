import {DEICIDE, SYSTEM_ID} from "../config.mjs";

export function terrainAt(scene, x, y, grid = null) {
  if ( !scene ) return "plain";
  const size = scene.grid?.size ?? 100;
  const point = {x: x * size + size / 2, y: y * size + size / 2, elevation: 0};
  for ( const region of scene.regions ?? [] ) {
    const behavior = region.behaviors.find(b => (b.type === "terrain") && !b.disabled);
    if ( !behavior ) continue;
    if ( region.testPoint?.(point) ) return behavior.system.terrain;
  }
  const flag = grid ?? scene.getFlag(SYSTEM_ID, "terrainGrid") ?? null;
  const id = flag?.[`${x},${y}`];
  return (id in DEICIDE.terrain) ? id : "plain";
}

export function terrainUnderToken(tokenDocument) {
  const scene = tokenDocument.parent;
  const size = scene?.grid?.size ?? 100;
  const id = terrainAt(scene, Math.round(tokenDocument.x / size), Math.round(tokenDocument.y / size));
  return {id, ...DEICIDE.terrain[id]};
}

async function recordTerrain(tokenDocument, id) {
  if ( tokenDocument.getFlag(SYSTEM_ID, "terrain") === id ) return;
  await tokenDocument.setFlag(SYSTEM_ID, "terrain", id);
}

export async function harvest(actor, tokenDocument = actor?.getActiveTokens?.()[0]?.document) {
  if ( !actor?.derived?.isAlchemist ) { ui.notifications?.warn(`${actor?.name} is not an alchemist.`); return null; }
  const scene = tokenDocument?.parent;
  if ( !scene ) { ui.notifications?.warn("Harvest needs a token on a scene."); return null; }
  const size = scene.grid?.size ?? 100;
  const cx = Math.round(tokenDocument.x / size);
  const cy = Math.round(tokenDocument.y / size);
  for ( let dx = -1; dx <= 1; dx++ ) {
    for ( let dy = -1; dy <= 1; dy++ ) {
      const x = cx + dx;
      const y = cy + dy;
      const id = terrainAt(scene, x, y);
      if ( !DEICIDE.terrain[id]?.matter ) continue;
      const yield_ = actor.derived.harvestYield ?? DEICIDE.matter.warTileYield;

      const point = {x: x * size + size / 2, y: y * size + size / 2, elevation: 0};
      const region = scene.regions.find(r => r.testPoint?.(point) && r.behaviors.some(b => (b.type === "terrain") && !b.disabled));
      if ( region ) {
        const behavior = region.behaviors.find(b => b.type === "terrain");
        await behavior.update({"system.terrain": "plain", "system.matter": false});
      }
      else {
        const grid = foundry.utils.deepClone(scene.getFlag(SYSTEM_ID, "terrainGrid") ?? {});
        delete grid[`${x},${y}`];
        await scene.setFlag(SYSTEM_ID, "terrainGrid", grid);
      }
      await actor.changePool("matter", yield_);
      await ChatMessage.implementation.create({content: `<p>${actor.name} harvests ${yield_} Matter from the ${id} at ${x},${y}. The tile is now Plain.</p>`, speaker: ChatMessage.implementation.getSpeaker({actor})});
      const combatant = game.combat?.combatantFor?.(actor);
      if ( combatant && game.combat.started ) await game.combat.endAction(combatant, {weight: DEICIDE.dungeonActions.harvest.weight});
      return {harvested: yield_, tile: {x, y}};
    }
  }
  ui.notifications?.warn("No Matter tile adjacent.");
  return null;
}

export async function transmuteTile(scene, x, y, terrainId) {
  if ( !(terrainId in DEICIDE.terrain) ) throw new Error(`Unknown terrain "${terrainId}"`);
  const size = scene.grid?.size ?? 100;
  const point = {x: x * size + size / 2, y: y * size + size / 2, elevation: 0};
  const region = scene.regions.find(r => r.testPoint?.(point) && r.behaviors.some(b => (b.type === "terrain") && !b.disabled));
  if ( region ) {
    const behavior = region.behaviors.find(b => b.type === "terrain");
    return behavior.update({"system.terrain": terrainId, "system.matter": null, "system.avoid": null, "system.moveCost": null});
  }
  const grid = foundry.utils.deepClone(scene.getFlag(SYSTEM_ID, "terrainGrid") ?? {});
  if ( terrainId === "plain" ) delete grid[`${x},${y}`];
  else grid[`${x},${y}`] = terrainId;
  return scene.setFlag(SYSTEM_ID, "terrainGrid", grid);
}

export const terrain = {
  terrainAt,
  terrainUnderToken,
  harvest,
  transmuteTile,

  async onEnter(event, behavior) {
    if ( !game.user.isActiveGM ) return;
    await recordTerrain(event.data.token, behavior.terrain);
  },

  async onExit(event, behavior) {
    if ( !game.user.isActiveGM ) return;
    const row = terrainUnderToken(event.data.token);
    await recordTerrain(event.data.token, row.id);
  },

  async onRoundStart(event, behavior) {
    if ( !game.user.isActiveGM ) return;
    const table = behavior.table;
    const actor = event.data.token.actor;
    if ( !actor || !table.burnPerRound ) return;
    if ( actor.derived?.immunities?.includes("plagueBurn") ) return;
    await actor.applyDamage(table.burnPerRound);
    await ChatMessage.implementation.create({content: `<p>${actor.name} takes ${table.burnPerRound} Burn from the plague zone.</p>`, speaker: {alias: "Terrain"}});
  },

  register() {
    Hooks.on("moveToken", async (tokenDocument, movement, operation, user) => {
      if ( !game.user.isActiveGM ) return;
      const scene = tokenDocument.parent;
      if ( !scene?.getFlag(SYSTEM_ID, "terrainGrid") && !scene?.regions?.size ) return;
      const row = terrainUnderToken(tokenDocument);
      await recordTerrain(tokenDocument, row.id);
      const combatant = game.combat?.combatantFor?.(tokenDocument.actor);
      if ( combatant && game.combat?.type === "war" ) {
        const tiles = Math.round((movement?.passed?.distance ?? 0) / (scene.grid.distance || 1));
        await combatant.update({"system.tilesMoved": combatant.system.tilesMoved + tiles});
      }
    });
  }
};
