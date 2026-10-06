import {readFileSync, readdirSync, statSync} from "node:fs";
import {join, dirname, resolve} from "node:path";
import {ROOT} from "./lib/sources.mjs";

const files = [];
const walk = dir => {
  for ( const name of readdirSync(dir) ) {
    const path = join(dir, name);
    if ( statSync(path).isDirectory() ) walk(path);
    else if ( path.endsWith(".mjs") ) files.push(path);
  }
};
walk(join(ROOT, "module"));

const namedExports = source => {
  const names = new Set();
  for ( const match of source.matchAll(/export\s+(?:async\s+)?(?:function\*?|class|const|let|var)\s+([A-Za-z_$][\w$]*)/g) ) names.add(match[1]);
  for ( const match of source.matchAll(/export\s*\{([^}]*)\}/g) ) {
    for ( const part of match[1].split(",") ) {
      const name = part.trim().split(/\s+as\s+/).pop();
      if ( name ) names.add(name);
    }
  }
  if ( /export\s+default/.test(source) ) names.add("default");
  return names;
};

const exportsOf = new Map(files.map(file => [resolve(file), namedExports(readFileSync(file, "utf8"))]));
let problems = 0;
for ( const file of files ) {
  const source = readFileSync(file, "utf8");
  for ( const match of source.matchAll(/import\s*\{([^}]*)\}\s*from\s*["'](\.[^"']+)["']/g) ) {
    const target = resolve(dirname(file), match[2]);
    const exported = exportsOf.get(target);
    if ( !exported ) { console.log(`MISSING FILE ${file}: ${match[2]}`); problems++; continue; }
    for ( const part of match[1].split(",") ) {
      const name = part.trim().split(/\s+as\s+/)[0];
      if ( name && !exported.has(name) ) { console.log(`MISSING EXPORT ${file}: ${name} from ${match[2]}`); problems++; }
    }
  }
}
console.log(problems ? `${problems} problems` : "every relative import resolves");
process.exit(problems ? 1 : 0);
