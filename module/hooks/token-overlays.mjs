import {DEICIDE, SYSTEM_ID} from "../config.mjs";
import {facingAngle, facingFromMove, isFlank} from "../rules/facing.mjs";
import {sceneMode} from "./scene-mode.mjs";

const COLORS = {facing: 0xffffff, ring: 0x44aa88, flank: 0xcc3333, badge: 0x222222, badgeText: "#ffffff"};
const BADGE_LETTERS = {hold: "H", advance: "A", volley: "V", screen: "S"};

function warScene() {
  return DEICIDE.modes[sceneMode()]?.engine === "war";
}

function tileOf(document) {
  const size = canvas.grid.size;
  return {x: Math.round(document.x / size), y: Math.round(document.y / size)};
}

function overlayOf(token) {
  if ( !token.deicideOverlay || token.deicideOverlay.destroyed ) {
    token.deicideOverlay = token.addChild(new PIXI.Container());
    token.deicideOverlay.eventMode = "none";
  }
  return token.deicideOverlay;
}

export function drawOverlays(token) {
  const actor = token.actor;
  const overlay = overlayOf(token);
  overlay.removeChildren().forEach(child => child.destroy({children: true}));
  if ( !actor || !warScene() || !["character", "company"].includes(actor.type) ) return;
  const w = token.w;
  const h = token.h;
  const size = canvas.grid.size;
  const derived = actor.derived ?? {};

  const facing = actor.system.facing ?? 0;
  const arrow = new PIXI.Graphics();
  arrow.beginFill(COLORS.facing, 0.9).lineStyle(1, 0x000000, 0.6);
  arrow.moveTo(0, -h / 2 + 2).lineTo(-6, -h / 2 + 12).lineTo(6, -h / 2 + 12).closePath().endFill();
  arrow.position.set(w / 2, h / 2);
  arrow.angle = facingAngle(facing);
  overlay.addChild(arrow);

  if ( derived.isOfficer && derived.commandRadius ) {
    const ring = new PIXI.Graphics();
    const radius = (derived.commandRadius + 0.5) * size;
    ring.lineStyle(2, COLORS.ring, token.controlled || token.hover ? 0.9 : 0.35);
    ring.drawCircle(w / 2, h / 2, radius);
    overlay.addChild(ring);
  }

  if ( (actor.type === "company") && actor.system.doctrine && (token.document.disposition === CONST.TOKEN_DISPOSITIONS.HOSTILE) ) {
    const letter = BADGE_LETTERS[actor.system.doctrine] ?? "?";
    const badge = new PIXI.Container();
    const back = new PIXI.Graphics().beginFill(COLORS.badge, 0.85).lineStyle(1, 0xffffff, 0.8).drawCircle(0, 0, 10).endFill();
    const text = new PIXI.Text(letter, {fontFamily: "Signika, sans-serif", fontSize: 13, fill: COLORS.badgeText, fontWeight: "bold"});
    text.anchor.set(0.5);
    badge.addChild(back, text);
    badge.position.set(w - 12, 12);
    overlay.addChild(badge);
  }

  if ( token.hover && token.deicideFlank ) {
    const label = new PIXI.Text(game.i18n.localize("DEICIDE.Overlay.Flank"), {fontFamily: "Signika, sans-serif", fontSize: 14, fill: "#ffffff", fontWeight: "bold", stroke: "#cc3333", strokeThickness: 3});
    label.anchor.set(0.5, 1);
    label.position.set(w / 2, -4);
    overlay.addChild(label);
  }
}

function flankedByControlled(token) {
  const target = token.actor;
  if ( !target || !warScene() ) return false;
  const targetTile = {...tileOf(token.document), facing: target.system.facing ?? 0};
  return canvas.tokens.controlled.some(other => {
    if ( (other === token) || !other.actor || (other.document.disposition === token.document.disposition) ) return false;
    return isFlank(tileOf(other.document), targetTile);
  });
}

function rangeForTiles(tiles) {
  return tiles * (canvas.scene?.grid.distance || 1);
}

export async function revealFog(actor, radius) {
  const token = actor?.getActiveTokens(true, true)[0];
  if ( !token || !canvas.scene?.getFlag(SYSTEM_ID, "fog") ) return false;
  const range = rangeForTiles(radius);
  if ( token.sight.range >= range ) return false;
  const original = token.getFlag(SYSTEM_ID, "sightBefore") ?? token.sight.range;
  await token.update({"sight.range": range, "sight.enabled": true, [`flags.${SYSTEM_ID}.sightBefore`]: original});
  return true;
}

export async function applySpotters(combat) {
  if ( !combat || (combat.type !== "war") || !canvas.scene?.getFlag(SYSTEM_ID, "fog") || !game.user.isGM ) return;
  for ( const combatant of combat.combatants ) {
    const actor = combatant.actor;
    const token = combatant.token;
    if ( !actor || !token || (actor.type !== "character") || !actor.derived?.flags?.lineOfSightFromCompanies ) continue;
    const range = rangeForTiles((actor.derived.commandRadius ?? 0) + DEICIDE.war.fogRevealTiles);
    if ( token.sight.range >= range ) continue;
    const original = token.getFlag(SYSTEM_ID, "sightBefore") ?? token.sight.range;
    await token.update({"sight.range": range, "sight.enabled": true, [`flags.${SYSTEM_ID}.sightBefore`]: original});
  }
}

export async function restoreSight(combat) {
  for ( const combatant of combat?.combatants ?? [] ) {
    const token = combatant.token;
    const before = token?.getFlag(SYSTEM_ID, "sightBefore");
    if ( (before === undefined) || (before === null) ) continue;
    await token.update({"sight.range": before, [`flags.${SYSTEM_ID}.-=sightBefore`]: null});
  }
}

export function registerTokenOverlays() {
  const draw = token => {
    try { drawOverlays(token); }
    catch ( error ) { console.error(`${SYSTEM_ID} | token overlay`, error); }
  };

  Hooks.on("drawToken", draw);
  Hooks.on("refreshToken", draw);
  Hooks.on("hoverToken", (token, hovered) => {
    token.deicideFlank = hovered && flankedByControlled(token);
    drawOverlays(token);
  });
  Hooks.on("controlToken", () => {
    for ( const token of canvas.tokens?.placeables ?? [] ) if ( token.actor?.derived?.isOfficer ) drawOverlays(token);
  });

  Hooks.on("preUpdateToken", (document, changes, options, userId) => {
    if ( (game.user.id !== userId) || !warScene() ) return;
    const actor = document.actor;
    if ( !actor || !["character", "company"].includes(actor.type) ) return;
    if ( !("x" in changes) && !("y" in changes) ) return;
    const size = canvas.grid.size;
    const dx = Math.round(((changes.x ?? document.x) - document.x) / size);
    const dy = Math.round(((changes.y ?? document.y) - document.y) / size);
    const facing = facingFromMove(dx, dy, actor.system.facing ?? 0);
    if ( facing !== (actor.system.facing ?? 0) ) actor.update({"system.facing": facing});
  });
  Hooks.on("updateActor", (actor, changes) => {
    if ( !foundry.utils.hasProperty(changes, "system.facing") && !foundry.utils.hasProperty(changes, "system.doctrine") ) return;
    for ( const token of actor.getActiveTokens() ) drawOverlays(token);
  });
  Hooks.on("combatStart", combat => applySpotters(combat));
  Hooks.on("combatRound", combat => applySpotters(combat));
}

export const overlays = {drawOverlays, revealFog, applySpotters, restoreSight};
