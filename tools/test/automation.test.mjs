import {suite, assert} from "./harness.mjs";
import {loadCatalog} from "../lib/sources.mjs";
import {validateAutomation} from "../validate-automation.mjs";
import {eligibleReactions} from "../../module/rules/reactions.mjs";
import {resolveEffects} from "../../module/rules/effects.mjs";
import {commandTargets} from "../../module/rules/commands.mjs";
import {deriveCharacter} from "../../module/rules/derive.mjs";
import {createCharacter} from "../../module/rules/creation.mjs";
import {activeBonds} from "../../module/rules/bonds.mjs";

const catalog = loadCatalog();
const lookup = catalog.lookup();

const profile = (attributes, extra = {}) => ({kind: "character", attributes, defense: {def: attributes.def, res: attributes.res, avoid: 0}, hp: {value: 30, max: 40}, statuses: [], classTypes: [], ...extra});
const soldier = profile({str: 12, mag: 4, skl: 9, spd: 8, def: 12, res: 6, cmd: 6});
const mage = profile({str: 4, mag: 18, skl: 12, spd: 9, def: 6, res: 12, cmd: 5});
const enemyMage = profile({str: 4, mag: 14, skl: 10, spd: 9, def: 6, res: 10, cmd: 5});
const reactionOf = id => ({id, name: lookup("ability", id).name, data: lookup("ability", id)});

suite("automation: validator", test => {
  test("zero manual abilities in Tier 1 and Tier 2, under 40 overall", () => {
    const report = validateAutomation();
    assert.deepEqual(report.tierFailures, []);
    assert.ok(report.manual.length < 40, `${report.manual.length} manual`);
    assert.deepEqual(report.mismatched, [], "stored grades match recomputed grades");
    assert.equal(report.byTier[1].manual, 0);
    assert.equal(report.byTier[2].manual, 0);
  });
});

suite("automation: the five acceptance reactions fire from the catalog", test => {
  const attacker = {id: "e", side: "enemy", x: 2, y: 1, row: "front", profile: enemyMage, tilesMoved: 0};
  test("Brace", () => {
    const event = {phase: "after", engine: "war", attacker, action: {source: "weapon", range: [1, 1]}, targets: [{id: "a", side: "party", hit: true, damage: 10}]};
    const prompts = eligibleReactions({event, reactors: [{id: "a", side: "party", x: 1, y: 1, row: "front", profile: soldier, reactions: [reactionOf("soldierBrace")]}]});
    assert.equal(prompts[0]?.options[0]?.abilityId, "soldierBrace");
    assert.deepEqual(lookup("ability", "soldierBrace").modifiers.map(m => m.key), ["damageTaken"]);
  });
  test("Cover", () => {
    const event = {phase: "before", engine: "war", attacker, action: {source: "weapon", range: [1, 1]}, targets: [{id: "a", side: "party", x: 1, y: 1}]};
    const prompts = eligibleReactions({event, reactors: [{id: "c", side: "party", x: 1, y: 2, row: "front", profile: soldier, reactions: [reactionOf("cadetCover")]}]});
    assert.equal(prompts[0]?.options[0]?.abilityId, "cadetCover");
    const [out] = resolveEffects(lookup("ability", "cadetCover").effects, {actor: {id: "c", profile: soldier}, targets: [{id: "a"}]});
    assert.deepEqual([out.type, out.to], ["redirect", "self"]);
  });
  test("Counterspell with its roll and cost", () => {
    const event = {phase: "before", engine: "war", attacker, action: {source: "spell", element: "fire", range: [1, 2]}, targets: [{id: "a", side: "party"}]};
    const [prompt] = eligibleReactions({event, reactors: [{id: "m", side: "party", x: 4, y: 1, row: "back", profile: mage, reactions: [reactionOf("magusCounterspell")]}]});
    assert.equal(prompt.options[0].abilityId, "magusCounterspell");
    assert.equal(prompt.options[0].roll, 10 + 3 * 12 - 2 * 14);
    assert.deepEqual(prompt.options[0].cost, {channel: 4});
    assert.equal(prompt.options[0].priority, 1, "cancels resolve before reductions");
  });
  test("Vantage at or below half HP, strikes first", () => {
    const event = {phase: "before", engine: "war", attacker, action: {source: "weapon", range: [1, 1]}, targets: [{id: "a", side: "party"}]};
    const hurt = {...soldier, hp: {value: 20, max: 40}};
    const [prompt] = eligibleReactions({event, reactors: [{id: "a", side: "party", x: 1, y: 1, row: "front", profile: hurt, reactions: [reactionOf("pinVantage")]}]});
    assert.equal(prompt.options[0].abilityId, "pinVantage");
    assert.equal(prompt.options[0].priority, 0);
    assert.equal(eligibleReactions({event, reactors: [{id: "a", side: "party", x: 1, y: 1, row: "front", profile: soldier, reactions: [reactionOf("pinVantage")]}]}).length, 0);
  });
  test("Spellthief from any row in Dungeon Mode, cancels and stores", () => {
    const rista = profile({str: 8, mag: 6, skl: 14, spd: 12, def: 7, res: 7, cmd: 4});
    const event = {phase: "before", engine: "dungeon", attacker: {...attacker, row: "back"}, action: {source: "spell", element: "void", range: [1, 2]}, targets: [{id: "a", side: "party"}]};
    const [prompt] = eligibleReactions({event, reactors: [{id: "r", side: "party", row: "front", profile: rista, reactions: [reactionOf("originSpellthief")]}]});
    assert.equal(prompt.options[0].abilityId, "originSpellthief");
    assert.equal(prompt.options[0].roll, 20 + 3 * 14 - 2 * 14);
    const kinds = resolveEffects(lookup("ability", "originSpellthief").effects, {actor: {id: "r", profile: rista}, attacker: {id: "e", profile: enemyMage}, targets: [{id: "a"}]}).map(o => o.type);
    assert.deepEqual(kinds, ["cancel", "pool"]);
  });
});

suite("automation: Commands, Stances, Bonds", test => {
  test("Double Time grants one activation to every company in radius", () => {
    const doubleTime = lookup("ability", "warlordDoubleTime");
    const snapshot = {units: [
      {id: "off", side: "party", kind: "character", x: 5, y: 5, officer: true, commandRadius: 3},
      {id: "c1", side: "party", kind: "company", type: "infantry", x: 6, y: 5},
      {id: "c2", side: "party", kind: "company", type: "archer", x: 7, y: 7},
      {id: "c3", side: "party", kind: "company", type: "infantry", x: 12, y: 12},
      {id: "e1", side: "enemy", kind: "company", type: "infantry", x: 4, y: 4}
    ]};
    const targets = commandTargets(doubleTime.command, snapshot, snapshot.units[0]);
    assert.deepEqual(targets.map(u => u.id), ["c1", "c2"]);
    const outcomes = resolveEffects(doubleTime.command.effects, {actor: {id: "off"}, targets: targets.map(u => ({id: u.id})), groups: {companies: targets.map(u => u.id)}});
    assert.deepEqual(outcomes.map(o => [o.type, o.count, o.targets]), [["grantAction", 1, ["c1", "c2"]]]);
  });
  test("Hold the Line forms up companies for the phase", () => {
    const hold = lookup("ability", "soldierHoldTheLine");
    const [out] = resolveEffects(hold.command.effects, {actor: {id: "off"}, targets: [{id: "c1"}], groups: {companies: ["c1"]}});
    assert.deepEqual([out.type, out.statusId, out.expires, out.targets], ["applyStatus", "formed", "phase", ["c1"]]);
  });
  test("Shield Wall sets cannotSwapRow on the derived flags in Dungeon Mode", () => {
    const {system} = createCharacter({people: "manaborne", background: "conscript", baseClass: "soldier"}, lookup);
    const withStance = {...system, loadout: {...system.loadout, stance: "soldierShieldWall"}};
    const dungeon = deriveCharacter(withStance, {lookup, context: {mode: "dungeon"}});
    assert.equal(dungeon.flags.cannotSwapRow, true);
    assert.equal(dungeon.defense.def, deriveCharacter(system, {lookup, context: {mode: "dungeon"}}).defense.def + 4);
    const war = deriveCharacter(withStance, {lookup, context: {mode: "war"}});
    assert.equal(war.flags.cannotSwapRow, undefined, "stances only hold in Dungeon Mode");
  });
  test("Berserk forbids Guard through its stance flag", () => {
    const berserk = lookup("ability", "pinBerserk");
    assert.ok(berserk.stance.effects.some(e => (e.kind === "flag") && (e.key === "cannotGuard")));
  });
  test("Dual Strike is offered once per round to an adjacent Bond A partner", () => {
    const units = [
      {id: "u1", actorId: "A", side: "party", x: 1, y: 1, row: "front", bonds: [{actorId: "B", points: 15}]},
      {id: "u2", actorId: "B", side: "party", x: 1, y: 2, row: "front", bonds: [{actorId: "A", points: 15}]}
    ];
    const pairs = activeBonds(units, "war");
    assert.equal(pairs[0].rank.id, "A");
    const event = {phase: "before", engine: "war", attacker: {id: "u1", side: "party", x: 1, y: 1, profile: soldier}, action: {source: "weapon", range: [1, 1]}, targets: [{id: "e", side: "enemy", x: 2, y: 1}]};
    const partner = {id: "u2", side: "party", x: 1, y: 2, profile: mage, reactions: [], bonds: [{partnerId: "u1", rank: "A"}]};
    assert.equal(eligibleReactions({event, reactors: [partner]})[0].options[0].abilityId, "dualStrike");
    assert.equal(eligibleReactions({event, reactors: [{...partner, usedThisRound: {dualStrike: 1}}]}).length, 0);
  });
});
