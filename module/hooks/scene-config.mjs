import {DEICIDE, SYSTEM_ID} from "../config.mjs";

export function registerSceneConfigHooks() {
  Hooks.on("renderSceneConfig", (app, html) => {
    const scene = app.document;
    const mode = scene.getFlag(SYSTEM_ID, "mode") ?? "war";
    const fog = Boolean(scene.getFlag(SYSTEM_ID, "fog"));
    const options = Object.entries(DEICIDE.modes).map(([id, entry]) => `<option value="${id}" ${id === mode ? "selected" : ""}>${game.i18n.localize(entry.label)}</option>`).join("");
    const fieldset = document.createElement("fieldset");
    fieldset.classList.add("deicide-scene");
    fieldset.innerHTML = `
      <legend>Deicide</legend>
      <div class="form-group">
        <label>Mode</label>
        <div class="form-fields"><select name="flags.${SYSTEM_ID}.mode">${options}</select></div>
        <p class="hint">War and Dungeon never share a scene. The mode picks the combat engine and which skills show.</p>
      </div>
      <div class="form-group">
        <label>Fog of war scenario</label>
        <div class="form-fields"><input type="checkbox" name="flags.${SYSTEM_ID}.fog" ${fog ? "checked" : ""}></div>
        <p class="hint">Enemies hidden beyond ${DEICIDE.war.fogRevealTiles} tiles. Tokens placed here get sight of ${DEICIDE.war.fogRevealTiles} tiles.</p>
      </div>`;
    const anchor = html.querySelector("[name='grid.type']")?.closest("fieldset") ?? html.querySelector(".tab[data-tab='basics'], .tab.active, form");
    anchor?.after(fieldset);
  });

  Hooks.on("preCreateToken", (tokenDocument, data, options, userId) => {
    const scene = tokenDocument.parent;
    if ( !scene?.getFlag(SYSTEM_ID, "fog") ) return;
    const range = DEICIDE.war.fogRevealTiles * (scene.grid.distance || 1);
    tokenDocument.updateSource({sight: {enabled: true, range}});
  });

  Hooks.on("updateScene", (scene, changes) => {
    if ( !foundry.utils.hasProperty(changes, `flags.${SYSTEM_ID}.fog`) ) return;
    const fog = Boolean(scene.getFlag(SYSTEM_ID, "fog"));
    if ( fog && !scene.tokenVision && game.user.isGM ) scene.update({tokenVision: true});
  });
}

export class TerrainBrush {

  static #active = null;

  static async start() {
    if ( !canvas.scene || !game.user.isGM ) return;
    if ( TerrainBrush.#active ) return TerrainBrush.stop();
    const terrains = Object.entries(DEICIDE.terrain).map(([id, entry]) => `<option value="${id}">${game.i18n.localize(entry.label)}</option>`).join("");
    const dialog = await foundry.applications.api.DialogV2.wait({
      window: {title: "Terrain brush"},
      content: `<p>Pick a terrain, then click grid squares on the canvas. Click the same square with Plain to clear it.</p><select name="terrain">${terrains}</select>`,
      buttons: [
        {action: "paint", label: "Paint", default: true, callback: (event, button) => button.form.elements.terrain.value},
        {action: "cancel", label: "Cancel"}
      ],
      rejectClose: false
    });
    if ( !dialog || dialog === "cancel" ) return;
    const terrain = dialog;
    const handler = async event => {
      if ( !canvas.ready || !canvas.scene ) return;
      const position = event.getLocalPosition?.(canvas.stage) ?? canvas.mousePosition;
      const size = canvas.grid.size;
      const x = Math.floor(position.x / size);
      const y = Math.floor(position.y / size);
      const grid = foundry.utils.deepClone(canvas.scene.getFlag(SYSTEM_ID, "terrainGrid") ?? {});
      if ( terrain === "plain" ) delete grid[`${x},${y}`];
      else grid[`${x},${y}`] = terrain;
      await canvas.scene.setFlag(SYSTEM_ID, "terrainGrid", grid);
      ui.notifications.info(`${x},${y}: ${terrain}`, {console: false});
    };
    canvas.stage.on("pointerdown", handler);
    TerrainBrush.#active = handler;
    ui.notifications.info(`Terrain brush: ${terrain}. Run the brush tool again to stop.`);
  }

  static stop() {
    if ( !TerrainBrush.#active ) return;
    canvas.stage.off("pointerdown", TerrainBrush.#active);
    TerrainBrush.#active = null;
    ui.notifications.info("Terrain brush stopped.");
  }

  static registerControls() {
    Hooks.on("getSceneControlButtons", controls => {
      const tokens = controls.tokens;
      if ( !tokens || !game.user.isGM ) return;
      tokens.tools.deicideTerrain = {
        name: "deicideTerrain", title: "Deicide terrain brush", icon: "fa-solid fa-mountain-sun", button: true,
        order: 100, onChange: () => TerrainBrush.start()
      };
      tokens.tools.deicideStage = {
        name: "deicideStage", title: "Deicide Dungeon stage", icon: "fa-solid fa-table-cells-large", button: true,
        order: 101, onChange: () => game.deicide.apps.DungeonStage.show(game.combat)
      };
      tokens.tools.deicideDeploy = {
        name: "deicideDeploy", title: "Deicide deployment", icon: "fa-solid fa-flag", button: true,
        order: 102, onChange: () => new game.deicide.apps.Deployment().render({force: true})
      };
    });
  }
}
