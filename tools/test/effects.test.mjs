import {suite, assert} from "./harness.mjs";
import {effectKinds, resolveEffects, describeEffects, resolveTargets, amountOf} from "../../module/rules/effects.mjs";
import {test as testCondition} from "../../module/core/predicate.mjs";

const actor = {id: "hero", profile: {kind: "character", attributes: {str: 12, mag: 16, skl: 10, spd: 8, def: 9, res: 11, cmd: 6}, defense: {def: 9, res: 11, avoid: 0}, hp: {value: 30, max: 40}, statuses: [], classTypes: ["infantry"], attuned: "fire"}};
const foe = {id: "foe", profile: {kind: "monster", attributes: {str: 0, mag: 0, skl: 0, spd: 10, def: 6, res: 4, cmd: 0}, defense: {def: 6, res: 4, avoid: 0}, hp: {value: 24, max: 24}, statuses: [], classTypes: ["armored"], tags: ["beast"]}};
const ctx = (extra = {}) => ({actor, targets: [{id: "foe", profile: foe.profile, hit: true, crit: false}], attacker: foe, engine: "war", groups: {row: ["foe", "foe2"], allies: ["ally1"], companies: ["coA", "coB"]}, ...extra});

suite("effects: kinds", test => {
  test("every spec kind is registered with apply and describe", () => {
    const expected = ["applyStatus", "removeStatus", "damage", "heal", "pool", "move", "terrain", "summon", "grantAction", "cancel", "strikeFirst", "reroll", "reveal", "nationTrack", "standing", "flag", "soulPriceCatalyst", "refundAction"];
    for ( const id of expected ) {
      const kind = effectKinds.get(id);
      assert.ok(kind, id);
      assert.equal(typeof kind.apply, "function", `${id} apply`);
      assert.equal(typeof kind.describe, "function", `${id} describe`);
    }
  });
  test("applyStatus with turns and a phase scoped duration", () => {
    const [marked] = resolveEffects([{kind: "applyStatus", statusId: "marked", target: "target", turns: 1}], ctx());
    assert.deepEqual([marked.type, marked.statusId, marked.turns, marked.targets], ["applyStatus", "marked", 1, ["foe"]]);
    const [formed] = resolveEffects([{kind: "applyStatus", statusId: "formed", target: "companies", turns: "thisPhase"}], ctx());
    assert.deepEqual(formed.targets, ["coA", "coB"]);
    assert.equal(formed.expires, "phase");
    const [poison] = resolveEffects([{kind: "applyStatus", statusId: "poison"}], ctx());
    assert.equal(poison.turns, 3, "table duration when none given");
  });
  test("removeStatus defaults to all", () => {
    const [out] = resolveEffects([{kind: "removeStatus", target: "self"}], ctx());
    assert.deepEqual([out.statusId, out.targets], ["all", ["hero"]]);
  });
  test("damage evaluates the amount, picks the defense by tag, and never drops under 1", () => {
    const [discharge] = resolveEffects([{kind: "damage", amount: "floor(mag / 2)", tag: "attunedElement", target: "attacker"}], ctx());
    assert.equal(discharge.amount, 8);
    assert.equal(discharge.tag, "fire");
    assert.equal(discharge.defenseId, "res");
    assert.deepEqual(discharge.entries, [{id: "foe", amount: 4, defense: 4}]);
    const [truth] = resolveEffects([{kind: "damage", amount: 10, tag: "truth", ignoresDefense: true}], ctx());
    assert.deepEqual(truth.entries, [{id: "foe", amount: 10, defense: 0}]);
    const [tiny] = resolveEffects([{kind: "damage", amount: 2, target: "target"}], ctx());
    assert.equal(tiny.entries[0].amount, 1);
  });
  test("heal and rowHalf", () => {
    const [heal] = resolveEffects([{kind: "heal", amount: "2 * mag", target: "ally"}], ctx());
    assert.equal(heal.amount, 32);
    const [half] = resolveEffects([{kind: "heal", amount: "2 * mag", target: "row", rowHalf: true}], ctx());
    assert.deepEqual([half.amount, half.targets], [16, ["foe", "foe2"]]);
  });
  test("pool deltas, including the Spellthief store", () => {
    const [refine] = resolveEffects([{kind: "pool", key: "matter", delta: -10}], ctx());
    assert.deepEqual([refine.key, refine.delta, refine.targets], ["matter", -10, ["hero"]]);
    const [stolen] = resolveEffects([{kind: "pool", key: "stolen", delta: "+ability"}], ctx());
    assert.equal(stolen.delta, "+ability");
    const [lancet] = resolveEffects([{kind: "pool", key: "channel", delta: "floor(damage / 4)"}], ctx({damage: 18}));
    assert.equal(lancet.delta, 4);
  });
  test("move collapses to a row swap in Dungeon Mode", () => {
    const [push] = resolveEffects([{kind: "move", mode: "push", tiles: 1, target: "target"}], ctx());
    assert.equal(push.mode, "push");
    const [swap] = resolveEffects([{kind: "move", mode: "push", tiles: 1, target: "target"}], ctx({engine: "dungeon"}));
    assert.equal(swap.mode, "swapRow");
    const [canto] = resolveEffects([{kind: "move", mode: "canto", target: "self"}], ctx({engine: "dungeon"}));
    assert.equal(canto.mode, "canto");
  });
  test("terrain becomes a Barrier of 4 x MAG in Dungeon Mode", () => {
    const [wall] = resolveEffects([{kind: "terrain", op: "wall"}], ctx());
    assert.deepEqual([wall.type, wall.op], ["terrain", "wall"]);
    const [barrier] = resolveEffects([{kind: "terrain", op: "wall"}], ctx({engine: "dungeon"}));
    assert.deepEqual([barrier.type, barrier.pool], ["barrier", 64]);
  });
  test("summon, grantAction, cancel, strikeFirst, reroll, reveal", () => {
    const outs = resolveEffects([
      {kind: "summon", companyType: "animal", strength: 40, quality: 2},
      {kind: "grantAction", count: 1, scope: "companiesInRadius", target: "companies"},
      {kind: "cancel", what: "triggeringAction"},
      {kind: "strikeFirst"},
      {kind: "reroll", which: "hit", count: 1},
      {kind: "reveal", what: "nextEnemyAction"}
    ], ctx());
    assert.deepEqual(outs.map(o => o.type), ["summon", "grantAction", "cancel", "strikeFirst", "reroll", "reveal"]);
    assert.deepEqual(outs[1].targets, ["coA", "coB"]);
  });
  test("nationTrack, standing, flag, soulPriceCatalyst", () => {
    const outs = resolveEffects([
      {kind: "nationTrack", track: "weapons", delta: 1, once: true},
      {kind: "standing", faction: "civilians", delta: 10},
      {kind: "flag", key: "cannotGuard", value: true},
      {kind: "soulPriceCatalyst"}
    ], ctx());
    assert.deepEqual(outs.map(o => o.type), ["nationTrack", "standing", "flag", "soulPriceCatalyst"]);
    assert.deepEqual([outs[0].once, outs[1].delta, outs[2].key, outs[2].targets], [true, 10, "cannotGuard", ["hero"]]);
  });
  test("refundAction reads the engine events", () => {
    const effect = {kind: "refundAction", condition: "onKillCharacter|onRoutCompany", usesPerRound: 1};
    assert.equal(resolveEffects([effect], ctx({events: ["onRoutCompany"]}))[0].granted, true);
    assert.equal(resolveEffects([effect], ctx({events: []}))[0].granted, false);
  });
});

suite("effects: resolver gates", test => {
  test("when conditions use the Stage 2 vocabulary", () => {
    const low = {kind: "applyStatus", statusId: "marked", when: {hpAtOrBelow: 0.75}};
    assert.equal(resolveEffects([low], ctx()).length, 1, "30 of 40 is at or below 75 percent");
    const high = {kind: "applyStatus", statusId: "marked", when: {hpBelow: 0.5}};
    assert.equal(resolveEffects([high], ctx()).length, 0);
    const armored = {kind: "flag", key: "x", when: {targetType: "armored"}};
    assert.equal(resolveEffects([armored], ctx()).length, 1);
  });
  test("chance gates onHit and onCrit per target", () => {
    const onCrit = {kind: "applyStatus", statusId: "thrall", chance: "onCrit"};
    assert.equal(resolveEffects([onCrit], ctx()).length, 0);
    const crit = ctx({targets: [{id: "foe", profile: foe.profile, hit: true, crit: true}]});
    assert.equal(resolveEffects([onCrit], crit).length, 1);
    const onHit = {kind: "applyStatus", statusId: "poison", chance: "onHit"};
    const miss = ctx({targets: [{id: "foe", profile: foe.profile, hit: false, crit: false}]});
    assert.equal(resolveEffects([onHit], miss).length, 0);
  });
  test("unknown kinds surface as unknown outcomes and never throw", () => {
    const [out] = resolveEffects([{kind: "teleportToMoon"}], ctx());
    assert.deepEqual([out.type, out.kind], ["unknown", "teleportToMoon"]);
  });
  test("target words resolve through the groups", () => {
    const c = ctx();
    assert.deepEqual(resolveTargets("self", c), ["hero"]);
    assert.deepEqual(resolveTargets("attacker", c), ["foe"]);
    assert.deepEqual(resolveTargets("row", c), ["foe", "foe2"]);
    assert.deepEqual(resolveTargets("allies", c), ["ally1"]);
    assert.deepEqual(resolveTargets("alliesInRadius", c), ["ally1"], "falls back to allies");
  });
  test("amounts take expressions over attributes", () => {
    assert.equal(amountOf("floor(def / 4)", ctx()), 2);
    assert.equal(amountOf(7, ctx()), 7);
  });
  test("describeEffects reads from data, not text", () => {
    const lines = describeEffects([{kind: "move", mode: "push", tiles: 1, target: "target"}, {kind: "flag", key: "cannotSwapRow", value: true}]);
    assert.equal(lines.length, 2);
    assert.ok(/push 1 tile/.test(lines[0]));
    assert.ok(/cannotSwapRow/.test(lines[1]));
  });
});

suite("predicates: Stage 2 vocabulary", test => {
  const target = {kind: "character", classTypes: ["officer"], statuses: ["warded"], hp: {value: 20, max: 20}, side: "enemy"};
  test("attackerRange, adjacent, moved, fromFlank, night", () => {
    assert.equal(testCondition({attackerRange: {max: 1}}, {distance: 1}), true);
    assert.equal(testCondition({attackerRange: {min: 2}}, {distance: 1}), false);
    assert.equal(testCondition({adjacent: true}, {distance: 1}), true);
    assert.equal(testCondition({adjacent: true}, {distance: 3}), false);
    assert.equal(testCondition({moved: {min: 5}}, {tilesMoved: 5}), true);
    assert.equal(testCondition({fromFlank: true}, {flank: true}), true);
    assert.equal(testCondition({night: true}, {}), false);
  });
  test("target tests", () => {
    assert.equal(testCondition({targetIsOfficer: true}, {target}), true);
    assert.equal(testCondition({targetHasStatus: "warded"}, {target}), true);
    assert.equal(testCondition({targetUndamaged: true}, {target}), true);
    assert.equal(testCondition({targetUndamaged: true}, {target: {...target, hp: {value: 19, max: 20}}}), false);
    assert.equal(testCondition({targetType: ["company", "officer"]}, {target}), true);
  });
  test("bondRank, firstThisEncounter, trigger, elementTag, damageAtLeast", () => {
    assert.equal(testCondition({bondRank: "A"}, {bondRank: "A"}), true);
    assert.equal(testCondition({firstThisEncounter: true}, {firstThisEncounter: true}), true);
    assert.equal(testCondition({trigger: "hitByPhysical"}, {trigger: "hitByPhysical"}), true);
    assert.equal(testCondition({elementTag: "fire"}, {action: {tags: ["fire", "reason"], element: "fire"}}), true);
    assert.equal(testCondition({damageAtLeast: 20}, {damage: 22}), true);
  });
});
