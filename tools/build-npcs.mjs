import {rmSync, existsSync} from "node:fs";
import {join} from "node:path";
import {PACKS_SRC, loadCatalog, stableId, writeSource} from "./lib/sources.mjs";
import {generateNpc} from "../module/rules/generate/npc.mjs";
import {npcs} from "./content/npcs.mjs";

const lookup = loadCatalog().lookup();
const dir = join(PACKS_SRC, "npcs");
if ( existsSync(dir) ) rmSync(dir, {recursive: true, force: true});

let count = 0;
for ( const npc of npcs ) {
  const result = generateNpc({...npc.input, name: npc.name, faction: npc.faction, role: npc.role, description: npc.description}, lookup);
  if ( result.errors.length ) throw new Error(`${npc.name}: ${result.errors.join(" ")}`);
  const actor = result.actor;
  actor._id = stableId("npc", npc.id);
  actor.system.recruit.status = npc.status ?? actor.system.recruit.status;
  if ( npc.standing ) actor.system.standingPersonal = {party: npc.standing};
  actor.flags.deicide.identifier = npc.id;
  actor.flags.deicide.generated = {...actor.flags.deicide.generated, role: npc.role, recruit: npc.recruit ?? null};
  actor.items = actor.items.map((item, index) => ({...item, _id: stableId("npcItem", `${npc.id}:${item.system.identifier}:${index}`), effects: [], folder: null, sort: 0, ownership: {default: 0}, flags: {deicide: {generated: true}}}));
  Object.assign(actor, {folder: null, sort: 0, ownership: {default: 0}});
  writeSource("npcs", actor, {force: true, fileName: npc.id});
  count++;
  console.log(`${npc.name}: level ${result.detail.level}, ${actor.system.activeClass}, ${Object.entries(result.detail.ranks).map(([id, r]) => `${id} ${r.rank}`).join(", ")}, budget ${result.detail.budget}, spent ${result.detail.spent}, HP ${result.detail.hp}`);
  console.log(`  ${result.summary}`);
}
console.log(`npcs ${count}`);
