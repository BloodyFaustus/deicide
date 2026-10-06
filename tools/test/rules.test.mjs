import {readFileSync} from "node:fs";
import {join} from "node:path";
import {suite, assert} from "./harness.mjs";
import {ROOT, loadCatalog} from "../lib/sources.mjs";
import {DEICIDE} from "../../module/config.mjs";
import {evaluate} from "../../module/core/expression.mjs";
import {seededRng} from "../../module/core/random.mjs";
import {gradeFor, tenthsFor, qualityGrade, formatGraded, stepGrade} from "../../module/rules/grades.mjs";
import {
  scaleLine, classGrowthLine, applyLevel, capFor, classCaps, promotionBonusFor, applyPromotion, applyRankBonus,
  highestGrowthStats, rankForCp, trainedAttributes, levelOneEntry, attributeRecord
} from "../../module/rules/growth.mjs";
import {proficiencies, meetsPrereq, tierGatesFor, meetsWeaponGate, gradeForRank} from "../../module/rules/proficiency.mjs";
import {baseDelay, actionDelay, projectQueue, startingTicks, dismountPenalty} from "../../module/rules/delay.mjs";
import {pacingMultiplier, displayMultiplier, award, xpToNext, xpTotal, levelForXp, catchUpMultiplier, encounterAwards, stageCapacity} from "../../module/rules/pacing.mjs";
import {weaponProfile, weaponId, parseWeaponId, generatedWeaponSpecs, price, armorProfile, offhandProfile, accessoryProfile, shopPrice, sellPrice, promotionCost} from "../../module/rules/economy.mjs";
import {dungeonProfile, reachableRows} from "../../module/rules/collapse.mjs";
import {companyStats, companyHit, companyDamage, moraleThreshold, veterancyAfterBattle, qualityCap} from "../../module/rules/company.mjs";
import {decide, decideAll, reachable} from "../../module/rules/doctrine.mjs";
import {hitChance, critChance, damage, canDouble, strikeCount, resolveAttack, payChannel, soulPrice, absorb, wardedProgress, fleeChance} from "../../module/rules/resolve.mjs";

const tables = JSON.parse(readFileSync(join(ROOT, "fixtures", "system-tables.json"), "utf8"));
const catalog = loadCatalog();
const lookup = catalog.lookup();

suite("grades", test => {
  test("value to grade follows the table", () => {
    const expected = {1: "F", 4: "F", 5: "E", 8: "E", 12: "D", 16: "C", 18: "B", 24: "A", 28: "S", 29: "S+", 30: "S+", 31: "SS", 40: "SS", 41: "SSS", 50: "SSS"};
    for ( const [value, grade] of Object.entries(expected) ) assert.equal(gradeFor(Number(value)), grade, `value ${value}`);
    assert.equal(gradeFor(0), "F");
    assert.equal(gradeFor(99), "SSS");
  });
  test("growth tenths", () => {
    assert.equal(tenthsFor("S"), 9);
    assert.equal(tenthsFor("F"), 0);
    assert.throws(() => tenthsFor("SS"));
  });
  test("quality grades and formats", () => {
    assert.equal(qualityGrade(1), "D");
    assert.equal(qualityGrade(5), "S");
    assert.equal(formatGraded("STR", 18), "STR 18 (B)");
    assert.equal(stepGrade("E", 1), "D");
    assert.equal(stepGrade("S", 1), "S");
  });
});

suite("growth", test => {
  test("scaleLine keeps integer tenths and the exact total", () => {
    const soldier = scaleLine({str: 7, mag: 0, skl: 3, spd: 2, def: 9, res: 2, cmd: 3}, 20);
    assert.deepEqual(soldier, {str: 5, mag: 0, skl: 2, spd: 2, def: 7, res: 2, cmd: 2});
    const state = scaleLine({str: 3, mag: 9, skl: 7, spd: 2, def: 3, res: 5, cmd: 5}, 30);
    assert.equal(Object.values(state).reduce((a, b) => a + b, 0), 30);
    assert.deepEqual(scaleLine({str: 0, mag: 0, skl: 0, spd: 0, def: 0, res: 0, cmd: 0}, 20), attributeRecord(0));
  });
  test("class growth line scales to the tier total, Early Peak removes 0.3, Stoneblood locks MAG", () => {
    const stateAlchemist = lookup("class", "stateAlchemist");
    const earlyPeak = lookup("origin", "earlyPeak");
    const stoneblood = lookup("origin", "stoneblood");
    const plain = classGrowthLine(stateAlchemist);
    assert.equal(Object.values(plain).reduce((a, b) => a + b, 0), 30);
    const peak = classGrowthLine(stateAlchemist, {talent: earlyPeak});
    assert.equal(Object.values(peak).reduce((a, b) => a + b, 0), 27);
    const locked = classGrowthLine(lookup("class", "adept"), {people: stoneblood});
    assert.equal(locked.mag, 0);
  });
  test("caps by tier and grade with Talent bonuses", () => {
    assert.equal(capFor(1, "S"), 20);
    assert.equal(capFor(3, "A"), 29);
    assert.equal(capFor(4, "F"), 22);
    assert.equal(capFor(2, "C", 2), 23);
    const hardy = lookup("origin", "hardy");
    const caps = classCaps(lookup("class", "soldier"), {talent: hardy});
    assert.equal(caps.def, 21);
    assert.equal(caps.res, 17);
    const prodigy = lookup("origin", "prodigy");
    assert.equal(classCaps(lookup("class", "adept"), {talent: prodigy, talentChoice: {stat: "mag"}}).mag, 22);
  });
  test("applyLevel accumulates tenths, converts whole points, and stops at caps", () => {
    const soldier = lookup("class", "soldier");
    const manaborne = lookup("origin", "manaborne");
    let state = {
      level: 1, attributes: {str: 10, mag: 6, skl: 8, spd: 6, def: 10, res: 6, cmd: 8},
      growthTenths: attributeRecord(0), growthLog: [levelOneEntry(soldier)], promotionBonuses: [], rankBonuses: [], talent: {id: null}
    };
    const personal = {str: 3, mag: 0, skl: 3, spd: 0, def: 0, res: 0, cmd: 0};
    const first = applyLevel(state, soldier, manaborne, personal, null);
    assert.equal(first.level, 2);

    assert.deepEqual(first.entry.tenths, {str: 8, mag: 2, skl: 6, spd: 2, def: 7, res: 4, cmd: 3});
    assert.deepEqual(first.entry.gains, {});
    const second = applyLevel({...state, ...first}, soldier, manaborne, personal, null);
    assert.deepEqual(second.entry.gains, {str: 1, skl: 1, def: 1});
    assert.equal(second.growthTenths.str, 6);
    assert.equal(second.current.str, 11);

    let capped = {...state, attributes: {...state.attributes, str: 20}};
    const atCap = applyLevel(capped, soldier, manaborne, personal, null);
    assert.equal(atCap.entry.lost.str, 8);
    assert.equal(atCap.current.str, 20);
  });
  test("Late Bloomer is level gated and Wild rolls seven d100 from a seed", () => {
    const soldier = lookup("class", "soldier");
    const lateBloomer = lookup("origin", "lateBloomer");
    const foreign = lookup("origin", "foreignHuman");
    const base = {level: 1, attributes: attributeRecord(10), growthTenths: attributeRecord(0), growthLog: [], promotionBonuses: [], rankBonuses: [], talent: {id: "lateBloomer"}};
    const early = applyLevel(base, soldier, foreign, attributeRecord(0), lateBloomer);
    const late = applyLevel({...base, level: 14}, soldier, foreign, attributeRecord(0), lateBloomer);

    assert.equal(early.entry.tenths.str, 5);
    assert.equal(late.entry.tenths.str, 8);
    const wild = lookup("origin", "wild");
    const rolledA = applyLevel({...base, talent: {id: "wild"}}, soldier, foreign, attributeRecord(0), wild, {rng: seededRng(7)});
    const rolledB = applyLevel({...base, talent: {id: "wild"}}, soldier, foreign, attributeRecord(0), wild, {rng: seededRng(7)});
    assert.deepEqual(rolledA.entry.rolls, rolledB.entry.rolls);
    assert.equal(Object.keys(rolledA.entry.rolls).length, 7);
  });
  test("promotion and rank bonuses", () => {
    const knight = lookup("class", "knight");
    assert.deepEqual(promotionBonusFor(knight), {str: 1, def: 1});
    assert.deepEqual(promotionBonusFor(lookup("class", "paladin")), {str: 2, def: 2});
    const state = {attributes: attributeRecord(10), growthLog: [], promotionBonuses: [], rankBonuses: []};
    const caps = classCaps(knight);
    const promoted = applyPromotion(state, knight, caps);
    assert.equal(promoted.length, 1);
    assert.deepEqual(promoted[0].stats, {str: 1, def: 1});
    assert.equal(applyPromotion({...state, promotionBonuses: promoted}, knight, caps), promoted);
    assert.deepEqual(highestGrowthStats(lookup("class", "halberdier")), ["str", "skl", "def"]);
    const ranked = applyRankBonus(state, knight, 3, caps);
    assert.deepEqual(ranked, [{classId: "knight", rank: 3, stat: "str", value: 1}]);
    assert.equal(applyRankBonus(state, knight, 4, caps).length, 0);
    assert.equal(trainedAttributes({...state, promotionBonuses: promoted, rankBonuses: ranked}).str, 12);
  });
  test("rank for CP", () => {
    assert.equal(rankForCp(0), 1);
    assert.equal(rankForCp(3), 2);
    assert.equal(rankForCp(6), 2);
    assert.equal(rankForCp(63), 10);
    assert.equal(rankForCp(999), 10);
  });
  test("level 30 regression builds (deltas logged, not failed)", ({note}) => {
    const builds = tables.buildsLevel30_regression;
    const lines = [];
    for ( const [name, build] of Object.entries(builds) ) {
      if ( name.startsWith("_") ) continue;
      const people = lookup("origin", build.people);
      const segments = build.classes.map(text => {
        const [id, range] = text.split(" ");
        const [from, to] = range.split("-").map(Number);
        return {id, from, to, data: lookup("class", id)};
      });
      const base = segments[0].data;
      let state = {
        level: 1, attributes: attributeRecord(DEICIDE.attributeBase), growthTenths: attributeRecord(0),
        growthLog: [levelOneEntry(base)], promotionBonuses: [], rankBonuses: [], talent: {id: null}
      };
      for ( const [attr, value] of Object.entries(base.startSpread) ) state.attributes[attr] += value;
      for ( let level = 2; level <= 30; level++ ) {
        const segment = segments.find(entry => (level >= entry.from) && (level <= entry.to));
        if ( level === segment.from && segment.data.tier > 1 ) {
          state.promotionBonuses = applyPromotion(state, segment.data, classCaps(segment.data));
        }
        const {level: newLevel, growthTenths, growthLog} = applyLevel(state, segment.data, people, attributeRecord(0), null);
        state = {...state, level: newLevel, growthTenths, growthLog};
      }
      const final = trainedAttributes(state);
      const hp = evaluate(DEICIDE.formulas.hp, {level: 30, classHp: state.growthLog.reduce((sum, entry) => sum + entry.hp, 0), bonus: 0});
      const deltas = Object.entries(build.expected)
        .filter(([key]) => DEICIDE.attributeIds.includes(key) || (key === "hp"))
        .map(([key, expected]) => `${key} ${key === "hp" ? hp : final[key]} (expected ${expected}, delta ${(key === "hp" ? hp : final[key]) - expected})`);
      lines.push(`${name}: ${deltas.join(", ")}`);
    }
    for ( const line of lines ) note(line);
  });
});

suite("proficiency", test => {
  test("rank to grade", () => {
    assert.equal(gradeForRank(1, "primary"), "E");
    assert.equal(gradeForRank(2, "primary"), "E");
    assert.equal(gradeForRank(10, "primary"), "S");
    assert.equal(gradeForRank(1, "secondary"), null);
    assert.equal(gradeForRank(10, "secondary"), "A");
  });
  test("max across classes plus starting grades and Savant", () => {
    const profs = proficiencies([
      {data: lookup("class", "alchemist"), rank: 10},
      {data: lookup("class", "stateAlchemist"), rank: 1}
    ], {starting: [{armor: "D"}]});
    assert.equal(profs.alchemy, "S");
    assert.equal(profs.gun, "S");
    assert.equal(profs.sword, "A");
    assert.equal(profs.authority, "A");
    assert.equal(profs.armor, "D");
    assert.equal(profs.riding, null);
    const savant = proficiencies([{data: lookup("class", "soldier"), rank: 1}], {starting: [{sword: "D"}], steps: {sword: 1}});
    assert.equal(savant.sword, "D");
    const chosen = proficiencies([{data: lookup("class", "captain"), rank: 1, choices: {weapon: "axe"}}]);
    assert.equal(chosen.axe, "E");
  });
  test("prerequisites, level gates, story gates", () => {
    const gates = tierGatesFor(30);
    assert.deepEqual(gates, [8, 16, 20]);
    assert.deepEqual(tierGatesFor(22), [5, 11, 13]);
    const knight = lookup("class", "knight");
    const ok = meetsPrereq(knight, {sword: "C", armor: "D"}, 8, gates);
    assert.ok(ok.ok);
    const low = meetsPrereq(knight, {sword: "C", armor: "D"}, 7, gates);
    assert.ok(!low.ok && !low.levelOk);
    const missing = meetsPrereq(knight, {sword: "C"}, 8, gates);
    assert.deepEqual(missing.missing, [{kind: "prof", prof: "armor", grade: "D"}]);
    const spellsword = lookup("class", "spellsword");
    assert.ok(meetsPrereq(spellsword, {reason: "C", sword: "D"}, 8, gates).ok);
    assert.ok(!meetsPrereq(spellsword, {reason: "D", sword: "D"}, 8, gates).ok);
    const elementalist = lookup("class", "elementalist");
    assert.ok(meetsPrereq(elementalist, {reason: "C", axe: "D"}, 8, gates).ok);
    const saint = lookup("class", "saint");
    assert.ok(!meetsPrereq(saint, {}, 20, gates).ok);
    assert.ok(meetsPrereq(saint, {}, 20, gates, {storyGates: ["godSponsorship"]}).ok);
    const deadeye = lookup("class", "deadeye");
    assert.ok(meetsPrereq(deadeye, {gun: "B", bow: "C"}, 16, gates).ok);
    assert.ok(!meetsPrereq(deadeye, {gun: "B", bow: "D"}, 16, gates).ok);
  });
  test("weapon tier gates", () => {
    assert.ok(meetsWeaponGate("sword", "iron", {sword: "E"}));
    assert.ok(!meetsWeaponGate("sword", "steel", {sword: "E"}));
    assert.ok(meetsWeaponGate("alchemy", "royal", {alchemy: "S"}));
  });
});

suite("delay", test => {
  test("the Delay table", () => {
    const expected = {5: [50, 70, 110], 10: [40, 60, 100], 15: [30, 50, 90], 20: [20, 40, 80], 25: [20, 30, 70], 30: [20, 20, 60]};
    for ( const [spd, row] of Object.entries(expected) ) {
      [6, 8, 12].forEach((weight, i) => assert.equal(baseDelay(weight, Number(spd)), row[i], `SPD ${spd} W${weight}`));
    }
  });
  test("penalties, Guard, fixed boss Delay", () => {
    assert.equal(actionDelay({weight: 8, spd: 10, penalty: 10}), 70);
    assert.equal(actionDelay({weight: 8, spd: 10, halved: true}), 30);
    assert.equal(actionDelay({weight: 6, spd: 30, halved: true}), 10);
    assert.equal(actionDelay({weight: 8, spd: 10, fixed: 30}), 30);
    assert.equal(dismountPenalty(["mounted"]), 10);
    assert.equal(dismountPenalty(["flying"]), 15);
    assert.equal(dismountPenalty(["flying"], {arena: true}), 0);
    assert.deepEqual(startingTicks("party"), {party: 20, enemy: 0});
  });
  test("projected queue never desyncs", () => {
    const order = projectQueue([
      {id: "a", nextTick: 0, spd: 12, delay: 50}, {id: "b", nextTick: 0, spd: 10, delay: 40}, {id: "boss", nextTick: 20, spd: 12, delay: 30}
    ], 6);
    assert.deepEqual(order.map(entry => entry.id), ["a", "b", "boss", "b", "a", "boss"]);
  });
});

suite("enemies and benchmarks", test => {
  test("DEF formulas reproduce every benchmark row", () => {
    for ( const row of DEICIDE.benchmarks ) {
      assert.equal(evaluate(DEICIDE.enemyFormulas.standardDef, {level: row.level}), row.stdDef, `standard DEF at ${row.level}`);
      assert.equal(evaluate(DEICIDE.enemyFormulas.bossDef, {level: row.level}), row.bossDef, `boss DEF at ${row.level}`);
    }
  });
});

suite("pacing", test => {
  test("the P table", () => {
    const expected = {20: {20: 0.99, 25: 1.56, 30: 2.27}, 25: {20: 0.79, 25: 1.25, 30: 1.81}, 30: {20: 0.66, 25: 1.04, 30: 1.51},
      35: {20: 0.57, 25: 0.89, 30: 1.29}, 40: {20: 0.49, 25: 0.78, 30: 1.13}, 45: {20: 0.44, 25: 0.69, 30: 1.01}, 50: {20: 0.40, 25: 0.63, 30: 0.91}};
    for ( const [S, row] of Object.entries(expected) ) {
      for ( const [L, P] of Object.entries(row) ) assert.equal(displayMultiplier({S: Number(S), L: Number(L)}), P, `S ${S} L ${L}`);
    }
  });
  test("awards and XP curve", () => {
    assert.equal(award(60, pacingMultiplier({S: 35, L: 30})), 78);
    assert.equal(xpToNext(1), 50);
    assert.equal(xpTotal(30), 21750);
    assert.equal(levelForXp(149), 2);
    assert.equal(levelForXp(150), 3);
    assert.equal(levelForXp(99999, 30), 30);
    assert.equal(catchUpMultiplier(10, 15), 3);
    assert.equal(catchUpMultiplier(12, 15), 2);
    assert.equal(catchUpMultiplier(13, 15), 1);
    assert.equal(catchUpMultiplier(16, 15), 0);
    const awards = encounterAwards({kind: "boss", level: 10, dials: {S: 45, L: 30}});
    assert.equal(awards.xp, 151);
    assert.equal(awards.cp, 5);
    assert.equal(stageCapacity(4), 6);
    assert.equal(stageCapacity(5), 7);
    assert.equal(stageCapacity(9), 8);
  });
});

suite("economy", test => {
  test("weapon expectations from system-tables.json", () => {
    for ( const [id, expected] of Object.entries(tables.weaponGenerator.expected) ) {
      const profile = weaponProfile(parseWeaponId(id));
      assert.equal(profile.pp, expected.pp, `${id} PP`);
      assert.equal(profile.price, expected.price, `${id} price`);
    }
  });
  test("Royal Killer Sword: Might 15, Acc +25, Crit 40, PP 32, price 204", () => {
    const sword = weaponProfile({line: "sword", tier: "royal", prefix: "killer"});
    assert.equal(sword.might, 15);
    assert.equal(sword.acc, 25);
    assert.equal(sword.crit, 40);
    assert.equal(sword.pp, 32);
    assert.equal(sword.price, 204);
    assert.equal(sword.weight, 4);
    assert.equal(sword.identifier, "royalKillerSword");
    assert.equal(sword.name, "Royal Killer Sword");
  });
  test("tier prices by line", () => {
    assert.deepEqual(["iron", "steel", "silver", "royal"].map(tier => weaponProfile({line: "lance", tier}).price), [16, 39, 72, 156]);
    assert.deepEqual(["iron", "steel", "silver", "royal"].map(tier => weaponProfile({line: "gun", tier}).price), [20, 45, 80, 168]);
  });
  test("caster lines carry bonuses, Channel, Matter, and the Royal spell Weight", () => {
    const tome = weaponProfile({line: "tome", tier: "royal"});
    assert.equal(tome.spellBonus, 12);
    assert.equal(tome.channel, 4);
    assert.equal(tome.spellWeight, -1);
    assert.equal(tome.acc, 25);
    const gauntlet = weaponProfile({line: "gauntlet", tier: "iron"});
    assert.equal(gauntlet.alchemyBonus, 2);
    assert.equal(gauntlet.matter, 2);
    assert.deepEqual(gauntlet.modifiers, [{key: "matter.max", value: 2}]);
  });
  test("prefix rules and ids", () => {
    assert.throws(() => weaponProfile({line: "gun", tier: "iron", prefix: "reach"}));
    assert.throws(() => weaponProfile({line: "sword", tier: "steel", prefix: "brave"}));
    const siege = weaponProfile({line: "bow", tier: "silver", prefix: "siege"});
    assert.deepEqual(siege.range, [3, 6]);
    assert.equal(siege.weight, 10);
    const reach = weaponProfile({line: "lance", tier: "iron", prefix: "reach"});
    assert.deepEqual(reach.range, [1, 2]);
    assert.equal(weaponId({line: "sword", tier: "steel", prefix: "killer"}), "steelKillerSword");
    assert.deepEqual(parseWeaponId("silverHorseslayerLance"), {tier: "silver", prefix: "horseslayer", line: "lance"});
    assert.equal(parseWeaponId("nothing"), null);
    const forged = weaponProfile({line: "axe", tier: "iron", forge: 3});
    assert.equal(forged.might, 13);
    assert.equal(forged.acc, 15);
  });
  test("the generator emits 256 martial weapons plus 12 caster lines", () => {
    const specs = generatedWeaponSpecs();
    assert.equal(specs.filter(spec => DEICIDE.martialLines.includes(spec.line)).length, 256);
    assert.equal(specs.filter(spec => DEICIDE.casterLines.includes(spec.line)).length, 12);
    const ids = new Set(specs.map(weaponId));
    assert.equal(ids.size, specs.length);
  });
  test("armor, offhand, accessories", () => {
    const medium = armorProfile("ironMedium");
    assert.equal(medium.price, 10);
    assert.ok(medium.modifiers.some(m => (m.key === "delay") && (m.value === 4)));
    const royalHeavy = armorProfile("royalHeavy");
    assert.equal(royalHeavy.price, 115);
    assert.ok(royalHeavy.modifiers.some(m => (m.key === "hp.max") && (m.value === 5)));
    const focus = offhandProfile("focus", "royal");
    assert.equal(focus.price, 80);
    assert.ok(focus.modifiers.some(m => (m.key === "channel.max") && (m.value === 5)));
    const tower = offhandProfile("towerShield", "iron");
    assert.equal(tower.price, 20);
    assert.throws(() => offhandProfile("towerShield", "steel"));
    const ring = accessoryProfile("royalRing", {attribute: "mag", secondAttribute: "res"});
    assert.deepEqual(ring.modifiers, [
      {key: "attributes.mag", value: 4, accessory: true}, {key: "attributes.res", value: 1, accessory: true}
    ]);
    assert.equal(price(9), 16);
  });
  test("shop and sell prices, promotion costs", () => {
    assert.equal(shopPrice(100, {standing: 30}), 125);
    assert.equal(shopPrice(100, {standing: 10}), null);
    assert.equal(shopPrice(100, {shop: "underworld"}), 200);
    assert.equal(shopPrice(100, {dustCollapse: true}), 150);
    assert.equal(sellPrice(99), 49);
    assert.equal(sellPrice(99, {named: true}), null);
    assert.deepEqual(promotionCost(3), {dust: 60, legitimacy: 1});
    assert.deepEqual(promotionCost(2, {crownPatron: true}), {dust: 10, legitimacy: 0});
  });
});

suite("collapse", test => {
  test("the Collapse table", () => {
    const bolt = lookup("ability", "adeptBolt");
    assert.deepEqual(dungeonProfile(bolt), {available: true, reach: "any", requiresFrontRow: false, target: "single", side: "enemy", rowSwap: false, barrier: null, weight: 8, overridden: false, note: ""});
    const cleave = lookup("ability", "soldierCleave");
    assert.equal(dungeonProfile(cleave, {weapon: {range: [1, 1]}}).target, "column");
    assert.equal(dungeonProfile(cleave, {weapon: {range: [1, 1]}}).reach, "front");
    const burst = lookup("ability", "adeptBurst");
    assert.equal(dungeonProfile(burst).target, "row");
    const annihilate = lookup("ability", "magusAnnihilate");
    assert.equal(dungeonProfile(annihilate).target, "all");
    const bash = lookup("ability", "soldierBash");
    assert.ok(dungeonProfile(bash, {weapon: {range: [1, 1]}}).rowSwap);
    const wall = lookup("ability", "alchemistWall");
    assert.deepEqual(dungeonProfile(wall, {mag: 14}).barrier, {formula: "4 * mag", pool: 56});
    const command = lookup("ability", "soldierHoldTheLine");
    assert.ok(!dungeonProfile(command).available);
    const stance = lookup("ability", "soldierShieldWall");
    assert.ok(dungeonProfile(stance).available);
  });
  test("overrides merge over the derived profile", () => {
    const barrier = lookup("ability", "wardenBarrier");
    const profile = dungeonProfile(barrier, {mag: 10});
    assert.ok(profile.overridden);
    assert.equal(profile.barrier.pool, 30);
    assert.equal(profile.target, "row");
    const bridge = lookup("ability", "transmuterBridge");
    assert.ok(!dungeonProfile(bridge).available);
  });
  test("reachable rows", () => {
    assert.deepEqual(reachableRows({reach: "front"}, "front"), ["front"]);
    assert.deepEqual(reachableRows({reach: "front"}, "back"), []);
    assert.deepEqual(reachableRows({reach: "front"}, "back", {ownFrontEmpty: true, enemyFrontEmpty: true}), ["back"]);
    assert.deepEqual(reachableRows({reach: "any"}, "back"), ["front", "back"]);
  });
});

suite("company", test => {
  test("derived stats and Hit", () => {
    const stats = companyStats({quality: 2, strength: 100, type: "archer"});
    assert.equal(stats.def, 8);
    assert.equal(stats.res, 6);
    assert.equal(stats.atkVsCharacter, 28);
    assert.equal(stats.atkVsCompany, 16);
    assert.deepEqual(stats.range, [2, 3]);
    assert.equal(companyHit({quality: 2, targetSpd: 10, targetAvoid: 20}), 40);
    assert.equal(moraleThreshold({quality: 3, inRadius: true}), 75);
    const ship = companyStats({quality: 2, strength: 100, type: "ship", shipClass: "frigate"});
    assert.equal(ship.def, 10);
    assert.equal(ship.broadsideMight, 10);
  });
  test("damage and type multipliers", () => {
    const pike = companyDamage({attacker: {quality: 2, strength: 100, type: "pike"}, target: {quality: 2, strength: 100, type: "cavalry"}, targetKind: "company"});
    assert.equal(pike.total, 16);
    const infantry = companyDamage({attacker: {quality: 2, strength: 100, type: "infantry"}, target: {quality: 2, strength: 100, type: "cavalry"}, targetKind: "company"});
    assert.equal(infantry.total, 8);
    const vsCharacter = companyDamage({attacker: {quality: 1, strength: 50, type: "infantry"}, target: {defense: {def: 8, res: 6}}, targetKind: "character"});
    assert.equal(vsCharacter.total, 6);
  });
  test("veterancy and quality caps", () => {
    const promoted = veterancyAfterBattle({quality: 2, strength: 80, veterancy: 4, veterancyQuality: 0}, {qualityCap: 3});
    assert.ok(promoted.promoted);
    assert.equal(promoted.quality, 3);
    assert.equal(promoted.veterancy, 0);
    const routed = veterancyAfterBattle({quality: 3, strength: 0, veterancy: 3, veterancyQuality: 1}, {routed: true});
    assert.ok(routed.demoted);
    assert.equal(routed.quality, 2);
    assert.equal(qualityCap({weapons: 2, magical: 3}), 1);
    assert.equal(qualityCap({weapons: 7, magical: 3}, "battlemage"), 2);
  });
});

suite("doctrine", test => {
  const snapshot = {
    width: 10, height: 10,
    terrain: (x, y) => (x === 5) ? "river" : "plain",
    units: [
      {id: "officer", side: "enemy", kind: "character", x: 1, y: 1, officer: true, commandRadius: 3},
      {id: "officer2", side: "enemy", kind: "character", x: 6, y: 1, officer: true, commandRadius: 3},
      {id: "inf", side: "enemy", kind: "company", x: 2, y: 2, strength: 100},
      {id: "far", side: "enemy", kind: "company", x: 9, y: 9, strength: 100},
      {id: "pc", side: "lathander", kind: "character", x: 7, y: 2, hp: 30}
    ]
  };
  test("Hold attacks in range and never moves", () => {
    const decision = decide(snapshot, {id: "inf", side: "enemy", x: 2, y: 2, type: "infantry", doctrine: "hold", move: 4, range: [1, 1]});
    assert.equal(decision.move, null);
    assert.equal(decision.attack, null);
  });
  test("Advance closes with the nearest enemy and attacks when it arrives", () => {
    const decision = decide(snapshot, {id: "inf", side: "enemy", x: 2, y: 2, type: "infantry", doctrine: "advance", move: 7, range: [1, 1]});
    assert.ok(decision.move);
    assert.equal(decision.attack?.targetId, "pc");
    assert.equal(decision.attack.distance, 1);
  });
  test("a company outside every command radius only Holds", () => {
    const decision = decide(snapshot, {id: "far", side: "enemy", x: 9, y: 9, type: "infantry", doctrine: "advance", move: 4, range: [1, 1]});
    assert.equal(decision.effective, "hold");
    assert.equal(decision.reason, "outsideCommandRadius");
  });
  test("cavalry cannot cross a river", () => {
    const tiles = reachable(snapshot, {id: "inf", side: "enemy", x: 4, y: 2, type: "cavalry", move: 7});
    assert.ok(!Array.from(tiles.values()).some(tile => tile.x >= 5));
  });
  test("Volley keeps max range and retreats from an adjacent enemy", () => {
    const close = {...snapshot, units: snapshot.units.map(unit => (unit.id === "pc") ? {...unit, x: 8} : unit)};
    const archers = {id: "inf", side: "enemy", x: 7, y: 2, type: "archer", doctrine: "volley", move: 4, range: [2, 3]};
    const decision = decide(close, archers);
    assert.ok(decision.move, "the archers retreat 1 tile");
    assert.equal(decision.move.x, 6);
    assert.equal(decision.attack?.targetId, "pc");
    assert.equal(decision.attack.distance, 2);

    const standing = decide(snapshot, {...archers, x: 4});
    assert.equal(standing.move, null);
    assert.equal(standing.attack?.targetId, "pc");
  });
  test("decideAll applies moves in order", () => {
    const companies = [
      {id: "inf", side: "enemy", x: 2, y: 2, type: "infantry", doctrine: "advance", move: 7, range: [1, 1]},
      {id: "far", side: "enemy", x: 9, y: 9, type: "infantry", doctrine: "hold", move: 4, range: [1, 1]}
    ];
    const decisions = decideAll(snapshot, companies);
    assert.equal(decisions.length, 2);
  });
});

suite("resolution", test => {
  const attacker = {kind: "character", level: 1, attributes: {str: 12, mag: 6, skl: 8, spd: 10, def: 10, res: 6, cmd: 8}, defense: {def: 13, res: 7, avoid: 0}, hp: {value: 26, max: 26}, classTypes: ["infantry"], statuses: [], affinities: [], modifiers: []};
  const target = {kind: "monster", level: 2, attributes: {str: 10, mag: 4, skl: 6, spd: 10, def: 8, res: 6, cmd: 4}, defense: {def: 8, res: 6, avoid: 0}, hp: {value: 24, max: 24}, classTypes: [], statuses: [], affinities: [], weakness: "frost", resistance: "lightning", modifiers: []};
  const lance = weaponProfile({line: "lance", tier: "iron"});
  test("Hit and Crit", () => {
    const hit = hitChance({attacker, target, weapon: lance, context: {terrainAvoid: 20}});
    assert.equal(hit.chance, 75 + 16 + 5 - (20 + 20));
    const flank = hitChance({attacker, target, weapon: lance, mode: "war", context: {flank: true}});
    assert.equal(flank.chance, 76 + 10);
    const crit = critChance({attacker, target, weapon: lance});
    assert.equal(crit.chance, 4);
    const monsterHit = hitChance({attacker: {...target, hitBase: 70}, target: attacker, weapon: null, ability: {attack: {basis: "str", source: "none", defense: "def", might: 12}}});
    assert.equal(monsterHit.chance, 70 - 20);
  });
  test("physical damage, minimum 1, Crit floor", () => {
    const result = damage({attacker, target, weapon: lance});
    assert.equal(result.attack, 20);
    assert.equal(result.total, 12);
    assert.equal(result.critTotal, 18);
    const weak = damage({attacker: {...attacker, attributes: {...attacker.attributes, str: 1}}, target, weapon: lance});
    assert.equal(weak.total, 1);
  });
  test("triangle, doubling, Brave", () => {
    const advantage = damage({attacker, target, weapon: lance, context: {targetWeaponProf: "sword"}});
    assert.equal(advantage.attack, 22);
    const disadvantage = hitChance({attacker, target, weapon: lance, context: {targetWeaponProf: "axe"}});
    assert.equal(disadvantage.chance, 76 - 10);
    assert.ok(canDouble({attacker: {...attacker, attributes: {...attacker.attributes, spd: 15}}, target, weapon: lance}));
    assert.ok(!canDouble({attacker: {...attacker, attributes: {...attacker.attributes, spd: 15}}, target, weapon: lance, mode: "dungeon"}));
    assert.ok(!canDouble({attacker: {...attacker, attributes: {...attacker.attributes, spd: 15}}, target, weapon: weaponProfile({line: "gun", tier: "iron", prefix: "siege"})}));
    const brave = weaponProfile({line: "sword", tier: "silver", prefix: "brave"});
    assert.equal(strikeCount({attacker: {...attacker, attributes: {...attacker.attributes, spd: 15}}, target, weapon: brave}), 4);
  });
  test("effectiveness: bows, guns, Reason, Alchemy, slayers, Officer tag", () => {
    const bow = weaponProfile({line: "bow", tier: "iron"});
    const flyer = {...target, classTypes: ["flying"]};
    assert.equal(damage({attacker, target: flyer, weapon: bow}).multiplier, 2);
    const gun = weaponProfile({line: "gun", tier: "iron"});
    assert.equal(damage({attacker, target, weapon: gun}).attack, 12 + 9 + 6);
    const warded = {...target, statuses: ["warded"]};
    assert.equal(damage({attacker, target: warded, weapon: gun}).attack, 12);
    const marksman = {...attacker, modifiers: [{key: "weaponMight.gunVsWarded", op: "set", value: 3}]};
    assert.equal(damage({attacker: marksman, target: warded, weapon: gun}).attack, 15);
    const armored = {...target, classTypes: ["armored"], defense: {def: 12, res: 6, avoid: 0}};
    const bolt = lookup("ability", "adeptBolt");
    const tome = weaponProfile({line: "tome", tier: "iron"});
    const caster = {...attacker, attributes: {...attacker.attributes, mag: 16}};
    assert.equal(damage({attacker: caster, target: armored, weapon: tome, ability: bolt}).defense, 6);
    const spike = lookup("ability", "alchemistStoneSpike");
    const gauntlet = weaponProfile({line: "gauntlet", tier: "iron"});
    const alchemy = damage({attacker: caster, target: armored, weapon: gauntlet, ability: spike});
    assert.equal(alchemy.multiplier, 2);
    assert.equal(alchemy.total, (16 + 2 + 8 - 12) * 2);
    const slayer = weaponProfile({line: "lance", tier: "iron", prefix: "horseslayer"});
    assert.equal(damage({attacker, target: {...target, classTypes: ["mounted"]}, weapon: slayer}).multiplier, 2);
    const officerHunter = {...attacker, modifiers: []};
    const assassinate = {...lookup("ability", "shadowAssassinate")};
    const officer = {...target, classTypes: ["officer"]};
    const fromFlank = damage({attacker: officerHunter, target: officer, weapon: weaponProfile({line: "dagger", tier: "iron"}), ability: assassinate, context: {flank: true}});
    assert.equal(fromFlank.attack, 12 + 4 + 10 + 6 + 9);
  });
  test("elements: weakness, resistance, opposition, Divine beings, Truth", () => {
    const frost = {type: "action", attack: {basis: "mag", source: "spell", defense: "res", might: 6, element: "frost"}, tags: []};
    const caster = {...attacker, attributes: {...attacker.attributes, mag: 16}};
    assert.equal(damage({attacker: caster, target, ability: frost}).multiplier, 1.5);
    const lightning = {...frost, attack: {...frost.attack, element: "lightning"}};
    assert.equal(damage({attacker: caster, target, ability: lightning}).multiplier, 0.5);

    const fire = {...frost, attack: {...frost.attack, element: "fire"}};
    const frostAttuned = {...target, weakness: null, resistance: null, affinities: ["frost"]};
    assert.equal(damage({attacker: caster, target: frostAttuned, ability: fire}).multiplier, 1.5);
    const waterAttuned = {...target, weakness: null, resistance: null, affinities: ["water"]};
    assert.equal(damage({attacker: caster, target: waterAttuned, ability: fire}).multiplier, 1);
    assert.equal(damage({attacker: caster, target: waterAttuned, ability: lightning}).multiplier, 1.5);
    const god = {...target, weakness: null, resistance: null, divineBeing: true, defense: {def: 30, res: 30, avoid: 0}};
    assert.equal(damage({attacker: caster, target: god, ability: fire}).multiplier, 0.5);
    const voidSpell = {...frost, attack: {...frost.attack, element: "void"}};
    assert.equal(damage({attacker: caster, target: god, ability: voidSpell}).multiplier, 1);
    const truth = lookup("ability", "stateAlchemistDeconstruction");
    const mercer = {...caster, truthMultiplier: 1};
    const result = damage({attacker: mercer, target: {...god, statuses: ["warded", "guard"]}, ability: truth, weapon: weaponProfile({line: "gauntlet", tier: "iron"})});
    assert.equal(result.total, 16 + 2 + 14);
    assert.ok(result.isTruth);
    assert.equal(result.defense, 0);
    const student = {...caster, truthMultiplier: 0.5};
    assert.equal(damage({attacker: student, target: god, ability: truth, weapon: weaponProfile({line: "gauntlet", tier: "iron"})}).total, 16);
  });
  test("Guard halves, immunity zeroes", () => {
    const guarded = {...target, statuses: ["guard"]};
    assert.equal(damage({attacker, target: guarded, weapon: lance}).total, 6);
    const immune = {...target, immunities: ["frost"]};
    const frost = {type: "action", attack: {basis: "mag", source: "spell", defense: "res", might: 6, element: "frost"}, tags: []};
    assert.equal(damage({attacker, target: immune, ability: frost}).total, 0);
  });
  test("resolveAttack rolls from a seed and reports every strike", () => {
    const result = resolveAttack({attacker, target, weapon: lance}, seededRng(3));
    assert.equal(result.strikes.length, 1);
    assert.ok(result.total === 0 || result.total === 12 || result.total === 18);
    const again = resolveAttack({attacker, target, weapon: lance}, seededRng(3));
    assert.deepEqual(again.strikes, result.strikes);
  });
  test("Channel, Overcast, Soul Price, Barrier, Warded, Flee", () => {
    assert.deepEqual(payChannel({cost: 6, channel: 4}), {paid: 4, overcast: 2, burn: 4, channel: 0});
    assert.deepEqual(payChannel({cost: 6, channel: 4, burnPerPoint: 1}), {paid: 4, overcast: 2, burn: 2, channel: 0});
    assert.equal(payChannel({cost: 6, channel: 4, reduction: 1, multiplier: 0.5}).burn, 2);
    assert.equal(payChannel({cost: 6, channel: 4, immune: true}).burn, 0);
    assert.deepEqual(soulPrice({price: 8, payer: "hp"}), {hp: 8, channel: 0, catalyst: null, price: 8});
    assert.deepEqual(soulPrice({price: 8, payer: "channel", multiplier: 0.5}), {hp: 0, channel: 4, catalyst: null, price: 4});
    assert.equal(soulPrice({price: 8, payer: "hp", catalyst: "redWater"}).hp, 0);
    assert.deepEqual(absorb(10, 4), {toHp: 6, absorbed: 4, pool: 0, broken: true});
    assert.deepEqual(wardedProgress({taken: 10, damage: 12, mag: 10}), {taken: 22, threshold: 20, broken: true});
    assert.equal(fleeChance({spd: 12, fastestEnemySpd: 10}), 54);
    assert.equal(fleeChance({spd: 12, fastestEnemySpd: 10, boss: true}), 0);
  });
});
