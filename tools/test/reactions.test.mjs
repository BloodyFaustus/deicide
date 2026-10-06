import {suite, assert} from "./harness.mjs";
import {eligibleReactions, triggersFor, orderReactions, inWindow, priorityOf} from "../../module/rules/reactions.mjs";
import {activeBonds, bondsOf, bondRankFor, logAdjacency, accrueBondPoints, bondModifiers} from "../../module/rules/bonds.mjs";
import {commandTargets, inAnyRadius} from "../../module/rules/commands.mjs";

const profile = (attributes, extra = {}) => ({kind: "character", attributes, defense: {def: attributes.def, res: attributes.res, avoid: 0}, hp: {value: 30, max: 40}, statuses: [], classTypes: [], ...extra});
const soldier = profile({str: 12, mag: 4, skl: 9, spd: 8, def: 12, res: 6, cmd: 6});
const mage = profile({str: 4, mag: 18, skl: 12, spd: 9, def: 6, res: 12, cmd: 5});
const enemyMage = profile({str: 4, mag: 14, skl: 10, spd: 9, def: 6, res: 10, cmd: 5});

const BRACE = {id: "soldierBrace", name: "Brace", data: {type: "reaction", reaction: {trigger: "hitByPhysical", window: {self: true}}, modifiers: [{key: "damageTaken", value: "-floor(def/4)"}], effects: []}};
const COVER = {id: "cadetCover", name: "Cover", data: {type: "reaction", reaction: {trigger: "allyTargeted", window: {adjacent: true}}, effects: [{kind: "flag", key: "coverTarget", value: true}]}};
const COUNTERSPELL = {id: "magusCounterspell", name: "Counterspell", data: {type: "reaction", reaction: {trigger: "enemyCast", window: {tiles: 3, row: "any"}, roll: {d100Under: "10 + 3 * skl - 2 * casterMag"}, cost: {channel: 4}}, effects: [{kind: "cancel", what: "triggeringAction"}]}};
const VANTAGE = {id: "pinVantage", name: "Vantage", data: {type: "reaction", reaction: {trigger: "targetedByAttack", window: {self: true}, when: {hpAtOrBelow: 0.5}}, effects: [{kind: "strikeFirst"}]}};
const SPELLTHIEF = {id: "originSpellthief", name: "Spellthief", data: {type: "reaction", reaction: {trigger: "enemyCast", window: {tiles: 3, row: "any"}, roll: {d100Under: "20 + 3 * skl - 2 * casterMag"}}, effects: [{kind: "cancel", what: "triggeringAction"}, {kind: "pool", key: "stolen", delta: "+ability"}]}};

suite("reactions: triggers", test => {
  test("an attack raises the before and after triggers on its target", () => {
    const reactor = {id: "a", side: "party", x: 1, y: 1, row: "front", profile: soldier};
    const before = triggersFor({reactor, event: {phase: "before", engine: "war", attacker: {id: "e", side: "enemy", x: 2, y: 1, tilesMoved: 3, mounted: true}, action: {source: "weapon", range: [1, 1]}, targets: [{id: "a", side: "party"}]}});
    assert.deepEqual([...before].sort(), ["attackedAfterMoving", "mountedAttacker", "targetedByAttack"]);
    const after = triggersFor({reactor, event: {phase: "after", engine: "war", attacker: {id: "e", side: "enemy"}, action: {source: "weapon", range: [1, 1]}, targets: [{id: "a", side: "party", hit: true, damage: 12}]}});
    assert.deepEqual([...after].sort(), ["hitByAttack", "hitByPhysical"]);
    const miss = triggersFor({reactor, event: {phase: "after", engine: "war", attacker: {id: "e", side: "enemy"}, action: {source: "weapon", range: [1, 1]}, targets: [{id: "a", side: "party", hit: false}]}});
    assert.deepEqual([...miss], ["missedByMelee"]);
  });
  test("a cast raises enemyCast for enemies and allyTargeted for the target's allies", () => {
    const ally = {id: "b", side: "party", x: 3, y: 1, row: "back", profile: mage};
    const set = triggersFor({reactor: ally, event: {phase: "before", engine: "war", attacker: {id: "e", side: "enemy"}, action: {source: "spell", element: "fire", range: [1, 2]}, targets: [{id: "a", side: "party"}]}});
    assert.deepEqual([...set].sort(), ["allyTargeted", "enemyCast"]);
  });
  test("windows", () => {
    assert.equal(inWindow({tiles: 3}, {x: 0, y: 0}, {x: 3, y: 2}, "war"), true);
    assert.equal(inWindow({tiles: 3}, {x: 0, y: 0}, {x: 4, y: 0}, "war"), false);
    assert.equal(inWindow({adjacent: true}, {x: 0, y: 0}, {x: 1, y: 1}, "war"), true);
    assert.equal(inWindow({row: "any"}, {row: "back"}, {row: "front"}, "dungeon"), true);
    assert.equal(inWindow({adjacent: true}, {row: "back"}, {row: "front"}, "dungeon"), false);
  });
});

suite("reactions: the five acceptance reactions fire", test => {
  const attacker = {id: "e", side: "enemy", x: 2, y: 1, row: "front", profile: enemyMage, tilesMoved: 0};
  test("Brace fires on a physical hit against its bearer only", () => {
    const reactors = [{id: "a", side: "party", x: 1, y: 1, row: "front", profile: soldier, reactions: [BRACE]}];
    const event = {phase: "after", engine: "war", attacker, action: {source: "weapon", range: [1, 1]}, targets: [{id: "a", side: "party", hit: true, damage: 10}]};
    const prompts = eligibleReactions({event, reactors});
    assert.equal(prompts.length, 1);
    assert.equal(prompts[0].options[0].abilityId, "soldierBrace");
    const spell = {...event, action: {source: "spell", element: "fire", range: [1, 2]}};
    assert.equal(eligibleReactions({event: spell, reactors}).length, 0, "not against a spell");
  });
  test("Cover fires for an adjacent ally, not a distant one", () => {
    const event = {phase: "before", engine: "war", attacker, action: {source: "weapon", range: [1, 1]}, targets: [{id: "a", side: "party", x: 1, y: 1}]};
    const near = [{id: "c", side: "party", x: 1, y: 2, row: "front", profile: soldier, reactions: [COVER]}];
    assert.equal(eligibleReactions({event, reactors: near})[0]?.options[0]?.abilityId, "cadetCover");
    const far = [{id: "c", side: "party", x: 5, y: 5, row: "front", profile: soldier, reactions: [COVER]}];
    assert.equal(eligibleReactions({event, reactors: far}).length, 0);
  });
  test("Counterspell fires on an enemy cast within 3 tiles with its roll computed", () => {
    const reactors = [{id: "m", side: "party", x: 4, y: 1, row: "back", profile: mage, reactions: [COUNTERSPELL]}];
    const event = {phase: "before", engine: "war", attacker, action: {source: "spell", element: "fire", range: [1, 2]}, targets: [{id: "a", side: "party"}]};
    const [prompt] = eligibleReactions({event, reactors});
    assert.equal(prompt.options[0].abilityId, "magusCounterspell");
    assert.equal(prompt.options[0].roll, 10 + 3 * 12 - 2 * 14);
    assert.deepEqual(prompt.options[0].cost, {channel: 4});
    const dungeon = {...event, engine: "dungeon", attacker: {...attacker, row: "back"}};
    assert.equal(eligibleReactions({event: dungeon, reactors: [{...reactors[0], row: "front"}]}).length, 1, "any row in Dungeon Mode");
  });
  test("Vantage fires only at or below half HP", () => {
    const hurt = {...soldier, hp: {value: 20, max: 40}};
    const event = {phase: "before", engine: "war", attacker, action: {source: "weapon", range: [1, 1]}, targets: [{id: "a", side: "party"}]};
    const prompts = eligibleReactions({event, reactors: [{id: "a", side: "party", x: 1, y: 1, row: "front", profile: hurt, reactions: [VANTAGE]}]});
    assert.equal(prompts[0]?.options[0]?.abilityId, "pinVantage");
    assert.equal(prompts[0].options[0].priority, 0, "strike first resolves before the trigger");
    const healthy = eligibleReactions({event, reactors: [{id: "a", side: "party", x: 1, y: 1, row: "front", profile: soldier, reactions: [VANTAGE]}]});
    assert.equal(healthy.length, 0);
  });
  test("Spellthief fires from any row in Dungeon Mode and from 3 tiles in War", () => {
    const rista = profile({str: 8, mag: 6, skl: 14, spd: 12, def: 7, res: 7, cmd: 4});
    const event = {phase: "before", engine: "dungeon", attacker: {...attacker, row: "back"}, action: {source: "spell", element: "void", range: [1, 2]}, targets: [{id: "a", side: "party"}]};
    const [prompt] = eligibleReactions({event, reactors: [{id: "r", side: "party", row: "front", profile: rista, reactions: [SPELLTHIEF]}]});
    assert.equal(prompt.options[0].abilityId, "originSpellthief");
    assert.equal(prompt.options[0].roll, 20 + 3 * 14 - 2 * 14);
    const war = {...event, engine: "war"};
    assert.equal(eligibleReactions({event: war, reactors: [{id: "r", side: "party", x: 6, y: 1, profile: rista, reactions: [SPELLTHIEF]}]}).length, 0, "4 tiles is out of the window");
  });
  test("a used reaction and the per round limit block the prompt", () => {
    const event = {phase: "after", engine: "war", attacker, action: {source: "weapon", range: [1, 1]}, targets: [{id: "a", side: "party", hit: true}]};
    assert.equal(eligibleReactions({event, reactors: [{id: "a", side: "party", x: 1, y: 1, profile: soldier, reactions: [BRACE], used: true}]}).length, 0);
    const once = {id: "x", name: "Evasive Roll", data: {type: "reaction", reaction: {trigger: "hitByAttack", usesPerRound: 1}}};
    assert.equal(eligibleReactions({event, reactors: [{id: "a", side: "party", x: 1, y: 1, profile: soldier, reactions: [once], usedThisRound: {x: 1}}]}).length, 0);
  });
  test("Dual Strike is offered to an adjacent Bond A partner once per round", () => {
    const event = {phase: "before", engine: "war", attacker: {id: "a", side: "party", x: 1, y: 1, profile: soldier}, action: {source: "weapon", range: [1, 1]}, targets: [{id: "e", side: "enemy", x: 2, y: 1}]};
    const partner = {id: "b", side: "party", x: 1, y: 2, profile: mage, reactions: [], bonds: [{partnerId: "a", rank: "A"}]};
    const [prompt] = eligibleReactions({event, reactors: [partner]});
    assert.equal(prompt.options[0].abilityId, "dualStrike");
    assert.equal(eligibleReactions({event, reactors: [{...partner, usedThisRound: {dualStrike: 1}}]}).length, 0);
    assert.equal(eligibleReactions({event, reactors: [{...partner, bonds: [{partnerId: "a", rank: "B"}]}]}).length, 0);
  });
  test("ordering: strike first, cancels, then reductions in the defender's order", () => {
    const sorted = orderReactions([
      {abilityId: "brace", priority: priorityOf(BRACE.data), order: 0},
      {abilityId: "counter", priority: priorityOf(COUNTERSPELL.data), order: 1},
      {abilityId: "vantage", priority: priorityOf(VANTAGE.data), order: 2}
    ]);
    assert.deepEqual(sorted.map(r => r.abilityId), ["vantage", "counter", "brace"]);
  });
});

suite("bonds", test => {
  const units = [
    {id: "u1", actorId: "A", side: "party", x: 1, y: 1, row: "front", bonds: [{actorId: "B", points: 15}]},
    {id: "u2", actorId: "B", side: "party", x: 2, y: 2, row: "back", bonds: [{actorId: "A", points: 15}]},
    {id: "u3", actorId: "C", side: "party", x: 9, y: 9, row: "front", bonds: [{actorId: "A", points: 3}]}
  ];
  test("ranks from points", () => {
    assert.equal(bondRankFor(2), null);
    assert.equal(bondRankFor(3).id, "C");
    assert.equal(bondRankFor(8).id, "B");
    assert.equal(bondRankFor(15).id, "A");
  });
  test("War adjacency is Chebyshev 1, Dungeon is the same row", () => {
    const war = activeBonds(units, "war");
    assert.deepEqual(war.map(p => [p.a, p.b, p.rank.id]), [["u1", "u2", "A"]]);
    const dungeon = activeBonds(units, "dungeon");
    assert.deepEqual(dungeon.map(p => [[p.a, p.b].sort().join(":"), p.rank.id]), [["u1:u3", "C"]]);
  });
  test("bond modifiers carry the bond source and the highest rank wins", () => {
    const pairs = activeBonds(units, "war");
    const mine = bondsOf("u1", pairs);
    assert.equal(mine.rank, "A");
    assert.deepEqual(mine.modifiers.map(m => [m.key, m.value, m.source]), [["hit", 10, "bond"], ["avoid", 10, "bond"], ["might", 1, "bond"], ["defense.def", 1, "bond"]]);
    assert.deepEqual(bondModifiers("C").map(m => m.key), ["hit", "avoid"]);
  });
  test("points accrue after 3 adjacent rounds", () => {
    let log = {};
    const pairs = activeBonds(units, "war");
    for ( let i = 0; i < 2; i++ ) log = logAdjacency(log, pairs);
    assert.deepEqual(accrueBondPoints(log), []);
    log = logAdjacency(log, pairs);
    assert.deepEqual(accrueBondPoints(log), [{actorA: "A", actorB: "B", rounds: 3, points: 1}]);
  });
});

suite("commands", test => {
  const snapshot = {units: [
    {id: "off", side: "party", kind: "character", x: 5, y: 5, officer: true, commandRadius: 2},
    {id: "c1", side: "party", kind: "company", type: "infantry", x: 6, y: 5},
    {id: "c2", side: "party", kind: "company", type: "archer", x: 7, y: 7},
    {id: "c3", side: "party", kind: "company", type: "infantry", x: 9, y: 9},
    {id: "e1", side: "enemy", kind: "company", type: "infantry", x: 4, y: 4}
  ]};
  const officer = snapshot.units[0];
  test("companies in radius, by type, one company, enemies within", () => {
    assert.deepEqual(commandTargets({target: "companiesInRadius"}, snapshot, officer).map(u => u.id), ["c1", "c2"]);
    assert.deepEqual(commandTargets({target: "companiesInRadius", companyTypes: ["archer"]}, snapshot, officer).map(u => u.id), ["c2"]);
    assert.deepEqual(commandTargets({target: "oneCompany"}, snapshot, officer, {chosenId: "c2"}).map(u => u.id), ["c2"]);
    assert.deepEqual(commandTargets({target: "enemyCompaniesWithin", radius: 3}, snapshot, officer).map(u => u.id), ["e1"]);
  });
  test("inAnyRadius", () => {
    assert.equal(inAnyRadius(snapshot.units[1], snapshot), true);
    assert.equal(inAnyRadius(snapshot.units[3], snapshot), false);
  });
});
