import {readdirSync} from "node:fs";
import {dirname, join} from "node:path";
import {fileURLToPath, pathToFileURL} from "node:url";
import {run} from "./harness.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const files = readdirSync(here).filter(name => name.endsWith(".test.mjs")).sort();
for ( const file of files ) await import(pathToFileURL(join(here, file)).href);

const {passed, failed, notes} = await run();
if ( notes.length ) {
  console.log("\nNotes");
  for ( const note of notes ) console.log(`  ${note}`);
}
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
