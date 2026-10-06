import {deepStrictEqual, strictEqual, ok} from "node:assert/strict";

const suites = [];

export function suite(name, fn) {
  const tests = [];
  suites.push({name, tests});
  fn((title, body) => tests.push({title, body}));
}

export const assert = {
  equal: strictEqual,
  deepEqual: deepStrictEqual,
  ok,
  close(actual, expected, tolerance = 1e-9, message) {
    ok(Math.abs(actual - expected) <= tolerance, message ?? `expected ${actual} to be within ${tolerance} of ${expected}`);
  },
  throws(fn, message) {
    let threw = false;
    try { fn(); } catch { threw = true; }
    ok(threw, message ?? "expected the function to throw");
  }
};

export async function run() {
  let passed = 0;
  let failed = 0;
  const notes = [];
  for ( const {name, tests} of suites ) {
    console.log(`\n${name}`);
    for ( const {title, body} of tests ) {
      try {
        const result = await body({note: text => notes.push(`${name}: ${text}`)});
        if ( typeof result === "string" ) notes.push(`${name}: ${result}`);
        passed++;
        console.log(`  ok   ${title}`);
      }
      catch ( error ) {
        failed++;
        console.log(`  FAIL ${title}`);
        console.log(`       ${String(error.message ?? error).split("\n").join("\n       ")}`);
      }
    }
  }
  return {passed, failed, notes};
}
