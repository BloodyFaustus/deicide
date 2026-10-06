import {DEICIDE, SYSTEM_ID} from "../config.mjs";

export function sceneMode(scene = globalThis.canvas?.scene ?? globalThis.game?.scenes?.viewed ?? null) {
  const mode = scene?.getFlag?.(SYSTEM_ID, "mode");
  return (mode in DEICIDE.modes) ? mode : "war";
}

export function sceneEngine(scene) {
  return DEICIDE.modes[sceneMode(scene)]?.engine ?? "war";
}

export async function setSceneMode(scene, mode) {
  if ( !(mode in DEICIDE.modes) ) throw new Error(`Unknown scene mode "${mode}"`);
  return scene.setFlag(SYSTEM_ID, "mode", mode);
}

export function registerSceneModeHooks() {
  Hooks.on("canvasReady", () => {
    for ( const actor of game.actors ) actor.reset();
    for ( const app of Object.values(ui.windows ?? {}) ) app.render?.(false);
    game.actors.forEach(actor => Object.values(actor.apps).forEach(app => app.render(false)));
  });
  Hooks.on("updateScene", (scene, changes) => {
    if ( foundry.utils.hasProperty(changes, `flags.${SYSTEM_ID}.mode`) && (scene.id === canvas.scene?.id) ) {
      for ( const actor of game.actors ) actor.reset();
      game.actors.forEach(actor => Object.values(actor.apps).forEach(app => app.render(false)));
    }
  });
}
