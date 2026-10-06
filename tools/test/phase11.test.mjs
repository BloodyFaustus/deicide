import {suite, assert} from "./harness.mjs";
import {loadCatalog} from "../lib/sources.mjs";
import {DEICIDE} from "../../module/config.mjs";
import {tickStatus, simulateStatus} from "../../module/rules/statuses.mjs";
import {wardedProgress} from "../../module/rules/resolve.mjs";
import {guardPreview, projectQueue, actionDelay} from "../../module/rules/delay.mjs";
import {deriveCharacter} from "../../module/rules/derive.mjs";
import {createCharacter} from "../../module/rules/creation.mjs";

const catalog = loadCatalog();
const lookup = catalog.lookup();

suite("phase 11: status durations by script", test => {
  const turn = {kind: "turnStart"};
  test("Poison burns 3 at each of the bearer's turn starts and ends after 3 turns", () => {
    const run = simulateStatus({statusId: "poison", duration: 3, expires: null}, [turn, turn, turn, turn]);
    assert.equal(run.ended, true);
    assert.equal(run.log.length, 3, "ends on the third turn");
    assert.equal(run.burnTotal, 9);
    assert.deepEqual(run.log.map(e => e.remaining), [2, 1, 0]);
  });
  test("Guard ends at the bearer's next turn", () => {
    const first = tickStatus({statusId: "guard", duration: null, expires: null}, turn);
    assert.equal(first.ended, true);
    const roundEnd = tickStatus({statusId: "guard", duration: null, expires: null}, {kind: "roundEnd", round: 1});
    assert.equal(roundEnd.ended, false, "War round end does not end Guard");
  });
  test("Warded breaks once 2 x MAG damage has been taken", () => {
    const mag = 16;
    let taken = 0;
    const steps = [10, 10, 12];
    const results = steps.map(amount => { const r = wardedProgress({taken, damage: amount, mag}); taken = r.taken; return r.broken; });
    assert.deepEqual(results, [false, false, true]);
    assert.equal(wardedProgress({taken: 0, damage: 32, mag}).threshold, 32);
  });
  test("a phase scoped order ends when the phase changes, a round order at round end, every order at battle end", () => {
    const order = {statusId: "ordered", duration: null, expires: {kind: "phase", round: 2, phase: "lathander"}};
    assert.equal(tickStatus(order, {kind: "phase", round: 2, phase: "lathander"}).ended, false);
    assert.equal(tickStatus(order, {kind: "phase", round: 2, phase: "enemy"}).ended, true);
    assert.equal(tickStatus(order, {kind: "roundEnd", round: 2}).ended, true);
    const roundOrder = {statusId: "steadfast", duration: null, expires: {kind: "round", round: 2}};
    assert.equal(tickStatus(roundOrder, {kind: "phase", round: 2, phase: "enemy"}).ended, false);
    assert.equal(tickStatus(roundOrder, {kind: "roundEnd", round: 2}).ended, true);
    assert.equal(tickStatus(roundOrder, {kind: "battle"}).ended, true);
    const untilOwnTurn = {statusId: "untargetable", duration: null, expires: {kind: "ownTurn"}};
    assert.equal(tickStatus(untilOwnTurn, turn).ended, true);
    assert.equal(tickStatus(untilOwnTurn, {kind: "roundEnd", round: 1}).ended, false);
  });
  test("a Barrier pool ends with the encounter", () => {
    assert.equal(tickStatus({statusId: "barrier", duration: null, expires: null}, {kind: "battle"}).ended, true);
    assert.equal(tickStatus({statusId: "barrier", duration: null, expires: null}, turn).ended, false);
  });
});

suite("phase 11: Guard preview", test => {
  test("guarding halves the following Delay and pushes the guard's own slot by the Guard action", () => {
    const entries = [
      {id: "a", nextTick: 0, spd: 10, delay: 60, defeated: false},
      {id: "b", nextTick: 10, spd: 8, delay: 40, defeated: false}
    ];
    const plain = projectQueue(entries, 6).map(e => `${e.id}${e.tick}`);
    const guard = guardPreview(entries, "a", 6).map(e => `${e.id}${e.tick}`);
    assert.deepEqual(plain, ["a0", "b10", "b50", "a60", "b90", "a120"]);
    const guardDelay = actionDelay({weight: DEICIDE.dungeonActions.guard.weight, spd: 10});
    assert.equal(guardDelay, 40, "Guard at Weight 6 for SPD 10 is 60 minus 20, floor 20 is below");
    assert.deepEqual(guard, ["b10", "a40", "b50", "a70", "b90", "a100"]);
  });
});

suite("phase 11: Hero layering", test => {
  test("Hero rides on the active class: skills and the SS cap, never the growth or training", () => {
    const base = createCharacter({people: "summoned", background: "failedHero", baseClass: "adept"}, lookup).system;
    const withHero = {...base, saturation: 50, classes: [...base.classes, {id: "hero", rank: 4, cp100: 1200}], activeClass: "adept"};
    const derived = deriveCharacter(withHero, {lookup, context: {mode: "war", classCatalog: catalog.all("class")}});
    assert.equal(derived.activeClass, "adept");
    assert.deepEqual(derived.layeredClasses, ["hero"]);
    assert.ok(derived.skills.known.includes("heroSaturatedStrike"));
    assert.ok(derived.skills.available.actions.includes("heroSaturatedStrike"), "Hero actions are usable from the active class");
    assert.ok(derived.skills.available.commands.includes("heroHerosPresence"));
    for ( const attr of DEICIDE.attributeIds ) assert.equal(derived.caps[attr], DEICIDE.adaptationCap, `${attr} cap is 40`);
    assert.equal(derived.capGrade, "SS");
    assert.deepEqual(derived.classTypes, lookup("class", "adept").types, "class types come from the active class");
  });
  test("the Hero class is gated on Saturation 50 and closed to Mercer", () => {
    const failed = createCharacter({people: "summoned", background: "failedHero", baseClass: "adept"}, lookup).system;
    const low = deriveCharacter({...failed, level: 20, saturation: 49}, {lookup, context: {classCatalog: catalog.all("class")}});
    assert.equal(low.availableClasses.find(c => c.id === "hero").ok, false);
    const high = deriveCharacter({...failed, level: 20, saturation: 50}, {lookup, context: {classCatalog: catalog.all("class")}});
    assert.equal(high.availableClasses.find(c => c.id === "hero").ok, true);
    const mercer = createCharacter({people: "summoned", background: "summonedHero", baseClass: "alchemist"}, lookup).system;
    const noSat = deriveCharacter({...mercer, level: 20, saturation: 90}, {lookup, context: {classCatalog: catalog.all("class")}});
    const hero = noSat.availableClasses.find(c => c.id === "hero");
    assert.equal(hero.ok, false);
    assert.ok(hero.missing.some(m => m.kind === "saturation"));
  });
});
