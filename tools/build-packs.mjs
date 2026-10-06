import {mkdirSync, mkdtempSync, rmSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {compilePack} from "@foundryvtt/foundryvtt-cli";
import {PACKS, PACKS_OUT, readSources} from "./lib/sources.mjs";

const COLLECTIONS = {Item: "items", Actor: "actors", JournalEntry: "journal"};
const EMBEDDED = {
  actors: {items: "items", effects: "effects"},
  items: {effects: "effects"},
  journal: {pages: "pages"}
};

function addKeys(doc, collection, parentKeyPath = "", parentIdPath = "") {
  const keyPath = parentKeyPath ? `${parentKeyPath}.${collection}` : collection;
  const idPath = parentIdPath ? `${parentIdPath}.${doc._id}` : doc._id;
  doc._key = `!${keyPath}!${idPath}`;
  for ( const [field, child] of Object.entries(EMBEDDED[collection] ?? {}) ) {
    for ( const embedded of doc[field] ?? [] ) addKeys(embedded, child, keyPath, idPath);
  }
}

const only = process.argv.slice(2);
const staging = mkdtempSync(join(tmpdir(), "deicide-packs-"));
try {
  for ( const pack of PACKS ) {
    if ( only.length && !only.includes(pack.folder) ) continue;
    const docs = readSources(pack.folder);
    const dir = join(staging, pack.folder);
    mkdirSync(dir, {recursive: true});
    for ( const doc of docs ) {
      const copy = structuredClone(doc);
      addKeys(copy, COLLECTIONS[pack.type]);
      writeFileSync(join(dir, `${copy._id}.json`), JSON.stringify(copy), "utf8");
    }
    const dest = join(PACKS_OUT, pack.name);
    await compilePack(dir, dest, {log: false});
    console.log(`${pack.name}: ${docs.length} documents`);
  }
}
finally {
  rmSync(staging, {recursive: true, force: true});
}
