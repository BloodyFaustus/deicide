import {suite, assert} from "./harness.mjs";
import {evaluate, compile, variables} from "../../module/core/expression.mjs";
import {Registry} from "../../module/core/registry.mjs";
import {Pipeline} from "../../module/core/pipeline.mjs";
import {test as testCondition} from "../../module/core/predicate.mjs";
import {applyModifiers, applyStaged, resolve} from "../../module/core/modifiers.mjs";
import {seededRng, d100, rollUnder, weightedPick} from "../../module/core/random.mjs";
import {Catalog} from "../../module/core/catalog.mjs";

suite("expression", test => {
  test("arithmetic and precedence", () => {
    assert.equal(evaluate("1 + 2 * 3"), 7);
    assert.equal(evaluate("(1 + 2) * 3"), 9);
    assert.equal(evaluate("10 - 2 - 3"), 5);
    assert.equal(evaluate("-4 + 6"), 2);
    assert.equal(evaluate("7 % 3"), 1);
  });
  test("functions and variables", () => {
    assert.equal(evaluate("4 + floor(mag / 2) + floor(res / 2)", {mag: 16, res: 10}), 17);
    assert.equal(evaluate("max(20, 10 * weight - 2 * spd)", {weight: 6, spd: 30}), 20);
    assert.equal(evaluate("clamp(x, 0, 100)", {x: 140}), 100);
    assert.equal(evaluate("hp.value", {hp: {value: 12}}), 12);
  });
  test("comparisons, logic, ternary", () => {
    assert.equal(evaluate("skl >= 10 && spd < 5", {skl: 12, spd: 3}), 1);
    assert.equal(evaluate("inRadius ? 5 : 0", {inRadius: true}), 5);
    assert.equal(evaluate("!flag", {flag: false}), 1);
  });
  test("plain numbers pass through", () => assert.equal(evaluate(42), 42));
  test("errors", () => {
    assert.throws(() => evaluate("1 +"));
    assert.throws(() => evaluate("unknown + 1", {}));
    assert.throws(() => evaluate("nope(1)"));
  });
  test("variables and compile cache", () => {
    assert.deepEqual(variables("a + floor(b.c / 2)").sort(), ["a", "b.c"]);
    assert.equal(compile("x * 2"), compile("x * 2"));
  });
});

suite("registry and pipeline", test => {
  test("registry stores, lists, and notifies", () => {
    const registry = new Registry("things");
    let seen = null;
    registry.onRegister((id, entry) => { seen = [id, entry]; });
    registry.register("a", {v: 1});
    assert.deepEqual(seen, ["a", {v: 1}]);
    assert.equal(registry.get("a").v, 1);
    assert.throws(() => registry.get("missing", {strict: true}));
    assert.deepEqual(Array.from(registry.keys()), ["a"]);
  });
  test("pipeline order, insert, replace, remove, stop", () => {
    const pipeline = new Pipeline("p", [["a", ctx => { ctx.log.push("a"); }], ["c", ctx => { ctx.log.push("c"); }]]);
    pipeline.add("b", ctx => { ctx.log.push("b"); }, {before: "c"});
    pipeline.add("d", ctx => { ctx.log.push("d"); return false; }, {after: "c"});
    pipeline.add("e", ctx => { ctx.log.push("e"); });
    assert.deepEqual(pipeline.order, ["a", "b", "c", "d", "e"]);
    assert.deepEqual(pipeline.run({log: []}).log, ["a", "b", "c", "d"]);
    pipeline.replace("d", ctx => { ctx.log.push("D"); });
    pipeline.remove("b");
    assert.deepEqual(pipeline.run({log: []}).log, ["a", "c", "D", "e"]);
    assert.throws(() => pipeline.add("a", () => {}));
  });
});

suite("predicate and modifiers", test => {
  test("conditions", () => {
    const context = {engine: "dungeon", flank: true, subject: {statuses: ["warded"], classTypes: ["armored"], tags: new Set(["reason"])}};
    assert.ok(testCondition({engine: "dungeon"}, context));
    assert.ok(!testCondition({engine: "war"}, context));
    assert.ok(testCondition({status: "warded", classType: "armored", tag: "reason"}, context));
    assert.ok(testCondition({notStatus: "guard"}, context));
    assert.ok(testCondition({any: [{engine: "war"}, {flank: true}]}, context));
    assert.ok(!testCondition({unknownTest: 1}, context), "unknown tests fail closed");
    assert.ok(testCondition(null, context));
  });
  test("apply order: add, mul, max, min, set", () => {
    const mods = [
      {key: "x", value: 3}, {key: "x", op: "mul", value: 0.5}, {key: "x", op: "max", value: 2},
      {key: "x", op: "min", value: 100}
    ];
    assert.equal(applyModifiers(10, mods).value, 6);
    assert.equal(applyModifiers(10, [...mods, {key: "x", op: "set", value: 1}, {key: "x", op: "set", value: 4}]).value, 1);
  });
  test("resolve filters by key and condition, evaluates expressions", () => {
    const mods = [
      {key: "channel.max", value: "floor(mag / 4)"},
      {key: "channel.max", value: 4, when: {engine: "war"}},
      {key: "other", value: 99}
    ];
    assert.equal(resolve(10, mods, "channel.max", {scope: {mag: 16}, context: {engine: "dungeon"}}).value, 14);
    assert.equal(resolve(10, mods, "channel.max", {scope: {mag: 16}, context: {engine: "war"}}).value, 18);
  });
  test("staged resolution", () => {
    const mods = [
      {key: "c", value: 2, stage: "innate"}, {key: "c", op: "mul", value: 0.5, stage: "origin"},
      {key: "c", value: 3}, {key: "c", op: "mul", value: 1.5, stage: "final"}
    ];
    const result = applyStaged(17, mods, "c", ["innate", "origin", "gear", "final"], {defaultStage: "gear"});
    assert.equal(result.byStage.innate, 19);
    assert.equal(result.byStage.origin, 9);
    assert.equal(result.byStage.gear, 12);
    assert.equal(result.value, 18);
  });
});

suite("random", test => {
  test("seeded sequences repeat", () => {
    const a = seededRng("deicide");
    const b = seededRng("deicide");
    const rollsA = Array.from({length: 5}, () => d100(a));
    const rollsB = Array.from({length: 5}, () => d100(b));
    assert.deepEqual(rollsA, rollsB);
    assert.ok(rollsA.every(roll => (roll >= 1) && (roll <= 100)));
  });
  test("rollUnder is at or under the threshold", () => {
    assert.ok(rollUnder(75, 75));
    assert.ok(!rollUnder(76, 75));
    assert.ok(!rollUnder(1, 0));
    assert.ok(rollUnder(100, 140));
  });
  test("weighted pick", () => {
    const rng = seededRng(1);
    const counts = {a: 0, b: 0};
    for ( let i = 0; i < 1000; i++ ) counts[weightedPick({a: 90, b: 10}, rng)]++;
    assert.ok(counts.a > counts.b * 4);
  });
});

suite("catalog", test => {
  test("layers override by priority and lookups fall through", () => {
    const catalog = new Catalog();
    catalog.load("builtin", [{identifier: "soldier", type: "class", name: "Soldier", system: {identifier: "soldier", hp: 4}}]);
    catalog.load("world", [{identifier: "soldier", type: "class", name: "Soldier", system: {identifier: "soldier", hp: 5}}]);
    assert.equal(catalog.system("class", "soldier").hp, 5);
    catalog.clear("world");
    assert.equal(catalog.system("class", "soldier").hp, 4);
    const lookup = catalog.lookup([{identifier: "soldier", type: "class", system: {identifier: "soldier", hp: 9}}]);
    assert.equal(lookup("class", "soldier").hp, 9);
    assert.equal(lookup("class", "nope"), null);
    assert.deepEqual(catalog.counts(), {class: 1});
  });
});
