import {Catalog} from "../core/catalog.mjs";
import {SYSTEM_ID} from "../config.mjs";
import {ENTRIES as BUILTIN} from "./builtin.mjs";

export const CATALOG_TYPES = ["class", "ability", "origin", "weapon", "armor", "offhand", "accessory", "pin", "consumable", "named"];

export function buildCatalog() {
  const catalog = new Catalog();
  catalog.load("builtin", BUILTIN);

  Hooks.callAll("deicide.registerContent", catalog);
  return catalog;
}

function entryFromDocument(doc) {
  if ( !CATALOG_TYPES.includes(doc.type) ) return null;
  const identifier = doc.system?.identifier;
  if ( !identifier ) return null;
  return {identifier, type: doc.type, name: doc.name, img: doc.img, uuid: doc.uuid, system: doc.system};
}

export function syncWorldLayer(catalog) {
  const entries = [];
  for ( const item of game.items ) {
    const entry = entryFromDocument(item);
    if ( entry ) entries.push(entry);
  }
  catalog.load("world", entries, {replace: true});
}

export async function scanCompendiums(catalog) {
  const entries = [];
  for ( const pack of game.packs ) {
    if ( pack.metadata.type !== "Item" ) continue;
    if ( pack.metadata.packageName === SYSTEM_ID ) continue;
    if ( pack.metadata.system && (pack.metadata.system !== SYSTEM_ID) ) continue;
    let documents;
    try { documents = await pack.getDocuments(); }
    catch ( error ) { console.warn(`Deicide | Could not read pack ${pack.collection}`, error); continue; }
    for ( const doc of documents ) {
      const entry = entryFromDocument(doc);
      if ( entry ) entries.push(entry);
    }
  }
  catalog.load("compendium", entries, {replace: true});
  return entries.length;
}

export const refreshActors = foundry.utils.debounce(() => {
  for ( const actor of game.actors ) {
    actor.reset();
    for ( const app of Object.values(actor.apps) ) app.render(false);
  }
  for ( const token of canvas?.tokens?.placeables ?? [] ) token.actor?.reset?.();
}, 50);

export function registerCatalogHooks(catalog) {
  const isWorldItem = item => !item.parent && !item.pack;
  const resync = item => {
    if ( !isWorldItem(item) || !CATALOG_TYPES.includes(item.type) ) return;
    syncWorldLayer(catalog);
    refreshActors();
  };
  Hooks.on("createItem", resync);
  Hooks.on("updateItem", resync);
  Hooks.on("deleteItem", resync);
}
