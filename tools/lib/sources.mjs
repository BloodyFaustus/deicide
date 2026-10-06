import {createHash} from "node:crypto";
import {existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync} from "node:fs";
import {dirname, join, resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {Catalog} from "../../module/core/catalog.mjs";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const PACKS_SRC = join(ROOT, "packs-src");
export const PACKS_OUT = join(ROOT, "packs");

export const PACKS = [
  {folder: "classes", name: "deicide-classes", label: "Classes", type: "Item", catalog: true},
  {folder: "abilities", name: "deicide-abilities", label: "Abilities", type: "Item", catalog: true},
  {folder: "origins", name: "deicide-origins", label: "Origins", type: "Item", catalog: true},
  {folder: "weapons", name: "deicide-weapons", label: "Weapons", type: "Item", catalog: true},
  {folder: "armor", name: "deicide-armor", label: "Armor and Offhands", type: "Item", catalog: true},
  {folder: "accessories", name: "deicide-accessories", label: "Accessories and Pins", type: "Item", catalog: true},
  {folder: "consumables", name: "deicide-consumables", label: "Consumables and Supplies", type: "Item", catalog: true},
  {folder: "named", name: "deicide-named", label: "Named Items", type: "Item", catalog: true},
  {folder: "companies", name: "deicide-companies", label: "Companies and Ships", type: "Actor", catalog: true},
  {folder: "monsters", name: "deicide-monsters", label: "Monsters", type: "Actor", catalog: true},
  {folder: "npcs", name: "deicide-npcs", label: "Named NPCs", type: "Actor", catalog: false},
  {folder: "scenarios", name: "deicide-scenarios", label: "Scenarios", type: "JournalEntry", catalog: false}
];

const BASE62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

export function stableId(type, identifier) {
  const digest = createHash("sha1").update(`${type}:${identifier}`).digest();
  let id = "";
  for ( let i = 0; i < 16; i++ ) id += BASE62[digest[i] % 62];
  return id;
}

export function camelId(name) {
  const words = name.replace(/['’]/g, "").split(/[^A-Za-z0-9]+/).filter(Boolean);
  return words.map((word, index) => {
    const lower = word.toLowerCase();
    return index === 0 ? lower : lower.charAt(0).toUpperCase() + lower.slice(1);
  }).join("");
}

export function pascalId(name) {
  const id = camelId(name);
  return id.charAt(0).toUpperCase() + id.slice(1);
}

export function readSources(folder) {
  const dir = join(PACKS_SRC, folder);
  if ( !existsSync(dir) ) return [];
  const entries = [];
  const walk = current => {
    for ( const dirent of readdirSync(current, {withFileTypes: true}) ) {
      const path = join(current, dirent.name);
      if ( dirent.isDirectory() ) walk(path);
      else if ( dirent.name.endsWith(".json") ) entries.push(JSON.parse(readFileSync(path, "utf8")));
    }
  };
  walk(dir);
  return entries.sort((a, b) => String(a.system?.identifier ?? a.name).localeCompare(String(b.system?.identifier ?? b.name)));
}

export function writeSource(folder, entry, {force = false, fileName} = {}) {
  const dir = join(PACKS_SRC, folder);
  mkdirSync(dir, {recursive: true});
  const name = fileName ?? entry.system?.identifier ?? entry.flags?.deicide?.identifier ?? camelId(entry.name);
  const path = join(dir, `${name}.json`);
  if ( existsSync(path) && !force ) return false;
  writeFileSync(path, `${JSON.stringify(entry, null, 2)}\n`, "utf8");
  return true;
}

export function toCatalogEntry(doc) {
  const identifier = doc.system?.identifier;
  if ( !identifier ) return null;
  return {identifier, type: doc.type, name: doc.name, img: doc.img ?? null, system: {...doc.system, name: doc.name}};
}

export function loadCatalog() {
  const catalog = new Catalog();
  for ( const pack of PACKS ) {
    if ( !pack.catalog ) continue;
    catalog.load("builtin", readSources(pack.folder).map(toCatalogEntry).filter(Boolean));
  }
  return catalog;
}
