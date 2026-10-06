import {suite, assert} from "./harness.mjs";
import {DEICIDE} from "../../module/config.mjs";
import {loadCatalog} from "../lib/sources.mjs";
import {generateNpc} from "../../module/rules/generate/npc.mjs";
import {generateArmy, rollQuality} from "../../module/rules/generate/army.mjs";
import {generateLoot, tierAbove} from "../../module/rules/generate/loot.mjs";
import {benchmarkMonsters, planEncounter} from "../../module/rules/generate/encounter.mjs";
import {meetsWeaponGate} from "../../module/rules/proficiency.mjs";
import {seededRng} from "../../module/core/random.mjs";

const lookup = loadCatalog().lookup();

suite("generators: NPC", test => {
  test("the acceptance call returns a valid actor, and seed 7 twice is deep equal", () => {
    const input = {level: 12, classLine: ["soldier", "knight"], people: "dwarf", profile: "enemy", seed: 7};
    const a = generateNpc(input, lookup);
    const b = generateNpc(input, lookup);
    assert.deepEqual(a.errors, []);
    assert.deepEqual(a.actor, b.actor);
    assert.equal(a.actor.type, "character");
    assert.equal(a.actor.system.level, 12);
    assert.equal(a.actor.system.activeClass, "knight");
    assert.equal(a.actor.system.growthLog.length, 12);
    assert.ok(a.actor.items.some(item => item.type === "weapon" && item.system.equipped));
    assert.ok(a.actor.items.some(item => item.type === "armor"));
    assert.equal(a.actor.system.recruit.profile, "", "enemies are not recruits");
    assert.ok(!a.actor.items.some(item => item.type === "ability"), "enemies carry no personal skill");
    assert.ok(a.summary.includes("Knight"), a.summary);
  });
  test("a different seed gives a different NPC", () => {
    const a = generateNpc({level: 12, classLine: ["soldier", "knight"], people: "dwarf", profile: "enemy", seed: 7}, lookup);
    const b = generateNpc({level: 12, classLine: ["soldier", "knight"], people: "dwarf", profile: "enemy", seed: 8}, lookup);
    assert.ok((a.actor.name !== b.actor.name) || (JSON.stringify(a.actor.system.growthLog) !== JSON.stringify(b.actor.system.growthLog)));
  });
  test("200 level 12 Knights: at least 60 percent Heavy, zero Tomes, every weapon gate met", () => {
    let heavy = 0;
    let tomes = 0;
    for ( let seed = 1; seed <= 200; seed++ ) {
      const {actor, errors, detail} = generateNpc({level: 12, classLine: ["soldier", "knight"], people: "dwarf", profile: "enemy", seed}, lookup);
      assert.deepEqual(errors, []);
      const armor = actor.items.find(item => item.type === "armor");
      if ( armor && DEICIDE.armor[armor.system.identifier].weight === "heavy" ) heavy++;
      for ( const weapon of actor.items.filter(item => item.type === "weapon") ) {
        if ( weapon.system.line === "tome" ) tomes++;
        const prof = DEICIDE.weaponGenerator.lines[weapon.system.line].prof;
        assert.ok(meetsWeaponGate(prof, weapon.system.tier, detail.proficiencies), `${actor.name} cannot wield ${weapon.system.identifier}`);
      }
    }
    assert.ok(heavy >= 120, `${heavy} of 200 in Heavy`);
    assert.equal(tomes, 0);
    return `Knights in Heavy: ${heavy} of 200`;
  });
  test("a level 1 Soldier with budget 60 gets an Iron sword, axe, or lance, Iron Medium, Iron Buckler, and one accessory at 10 Dust or less", () => {
    const lines = new Set();
    for ( let seed = 1; seed <= 40; seed++ ) {
      const {actor, detail} = generateNpc({level: 1, classLine: ["soldier"], people: "foreignHuman", profile: "standard", seed, budgetDust: 60}, lookup);
      const weapon = actor.items.find(item => item.type === "weapon" && !item.system.asSidearm);
      assert.equal(weapon.system.tier, "iron");
      assert.ok(["sword", "axe", "lance"].includes(weapon.system.line), weapon.system.line);
      lines.add(weapon.system.line);
      assert.equal(detail.kit.armor, "ironMedium");
      assert.equal(detail.kit.offhand, "ironBuckler");
      const accessories = actor.items.filter(item => item.type === "accessory");
      assert.equal(accessories.length, 1);
      assert.ok(DEICIDE.accessories[accessories[0].system.identifier].price <= 10);
      assert.ok(detail.spent <= 60);
    }
    assert.ok(lines.size >= 2, "the weapon line varies with the seed");
  });
  test("recruit profiles: Veteran is Early Peak, Standard is Steady, Prodigy is Prodigy, Specialist is Savant, and a recruit carries a personal skill", () => {
    const expected = {veteran: "earlyPeak", standard: "steady", prodigy: "prodigy", specialist: "savant"};
    for ( const [profile, talent] of Object.entries(expected) ) {
      const {actor, errors} = generateNpc({level: 8, classLine: ["cadet", "captain"], people: "foreignHuman", profile, seed: 11}, lookup);
      assert.deepEqual(errors, []);
      assert.equal(actor.system.talent.id, talent);
      assert.equal(actor.system.recruit.profile, profile);
      const skill = actor.items.find(item => item.type === "ability");
      assert.ok(skill, `${profile} has a personal skill`);
      assert.equal(actor.system.recruit.personalSkillId, skill.system.identifier);
      assert.equal(skill.system.source.kind, "personal");
    }
  });
  test("ranks split 70 to 30 at 6 CP per level times P, and a fixed rank is honored", () => {
    const {detail, actor} = generateNpc({level: 12, classLine: ["soldier", "knight"], people: "dwarf", profile: "enemy", seed: 1, dials: {S: 45, L: 30}}, lookup);
    assert.equal(detail.totalCp100, Math.round(6 * 12 * (25 * 30 * 29 / (480 * 45)) * 100));
    assert.equal(detail.ranks.knight.rank, 8);
    assert.equal(detail.ranks.soldier.rank, 5);
    assert.equal(actor.system.loadout.secondary, "soldier");
    const petra = generateNpc({level: 7, classLine: ["rogue", "assassin"], people: "foreignHuman", profile: "veteran", seed: 3, ranks: {rogue: 7, assassin: 5}, classAt: {assassin: 5}, faction: "offweiss", named: true}, lookup);
    assert.deepEqual(petra.errors, []);
    assert.equal(petra.detail.ranks.rogue.rank, 7);
    assert.equal(petra.detail.ranks.assassin.rank, 5);
    assert.equal(petra.actor.system.activeClass, "assassin");
    assert.equal(petra.detail.budget, 90, "named: 60 x 1.5");
  });
  test("a Named item replaces the generated slot", () => {
    const {actor, errors} = generateNpc({level: 10, classLine: ["alchemist", "transmuter"], people: "foreignHuman", profile: "specialist", seed: 5, namedItems: ["breakwaterAegis"]}, lookup);
    assert.deepEqual(errors, []);
    assert.ok(actor.items.some(item => (item.type === "named") && (item.system.identifier === "breakwaterAegis")));
    assert.ok(!actor.items.some(item => item.type === "offhand"));
  });
});

suite("generators: Army", test => {
  test("same seed, same army. Sizes and reinforcements follow the tables", () => {
    const input = {side: "offweiss", battleSize: "battle", officers: 2, partyLevel: 5, seed: 4, tracks: {soldiers: 10, weapons: 4, magical: 7, allies: 6}};
    const a = generateArmy(input, lookup);
    const b = generateArmy(input, lookup);
    assert.deepEqual(a.card, b.card);
    assert.deepEqual(a.officers.map(o => o.actor), b.officers.map(o => o.actor));
    const total = a.companies.length + a.reinforcements.reduce((sum, r) => sum + r.companies.length, 0);
    assert.equal(total, 8);
    assert.equal(a.reinforcements.length, 1);
    assert.equal(a.reinforcements[0].companies.length, 2);
    assert.ok([3, 4].includes(a.reinforcements[0].round));
    assert.equal(a.officers.length, 2);
    assert.equal(a.officers[0].level, 7, "the commander is 2 levels above the party");
    assert.equal(a.officers[1].level, 5);
    assert.equal(a.scenario.kind, "war");
    const skirmish = generateArmy({side: "lathander", battleSize: "skirmish", officers: 0, seed: 1}, lookup);
    assert.equal(skirmish.companies.length + skirmish.reinforcements.reduce((s, r) => s + r.companies.length, 0), 4);
    const invasion = generateArmy({side: "offweiss", battleSize: "invasion", officers: 0, seed: 1, tracks: {soldiers: 10, weapons: 7, magical: 7, allies: 6}}, lookup);
    assert.equal(invasion.companies.length + invasion.reinforcements.reduce((s, r) => s + r.companies.length, 0), 12);
  });
  test("Quality never passes the Weapons cap, Legionaries are 5, battlemages respect the Magical cap, and the bell leans to the cap", () => {
    const counts = {};
    for ( let seed = 1; seed <= 200; seed++ ) {
      const army = generateArmy({side: "offweiss", battleSize: "battle", officers: 0, seed, tracks: {soldiers: 10, weapons: 6, magical: 3, allies: 6}}, lookup);
      for ( const company of [...army.companies, ...army.reinforcements.flatMap(r => r.companies)] ) {
        if ( company.type === "legionary" ) assert.equal(company.quality, 5);
        else if ( company.type === "battlemage" ) assert.ok(company.quality <= 2, `battlemage Q${company.quality}`);
        else { assert.ok(company.quality <= 3); counts[company.quality] = (counts[company.quality] ?? 0) + 1; }
      }
    }
    assert.ok(counts[3] > counts[2] && counts[2] > counts[1], JSON.stringify(counts));
    const rng = seededRng(9);
    for ( let i = 0; i < 50; i++ ) assert.equal(rollQuality(1, rng), 1);
  });
});

suite("generators: Loot", test => {
  test("same seed, same loot. Boss drops one tier above shop access, officers roll the weapon, Homunculi drop catalysts", () => {
    const boss = generateLoot({encounter: "boss", partyLevel: 10, shopTier: "steel", partyLines: ["sword"], seed: 2, P: 1.29});
    assert.deepEqual(boss, generateLoot({encounter: "boss", partyLevel: 10, shopTier: "steel", partyLines: ["sword"], seed: 2, P: 1.29}));
    assert.equal(boss.items.length, 1);
    assert.equal(boss.items[0].system.tier, "silver");
    assert.equal(boss.items[0].system.line, "sword");
    assert.equal(boss.dust, Math.round((24 + 20) * 1.29));
    assert.equal(tierAbove("royal"), "royal");
    let dropped = 0;
    for ( let seed = 1; seed <= 200; seed++ ) {
      const officer = generateLoot({encounter: "officer", officerWeapon: "steelLance", seed, P: 1});
      assert.equal(officer.dust, 6);
      if ( officer.items.length ) { dropped++; assert.equal(officer.items[0].system.identifier, "steelLance"); }
    }
    assert.ok(dropped >= 80 && dropped <= 120, `${dropped} of 200 dropped`);
    const wrath = generateLoot({encounter: "homunculus", homunculusId: "wrath", seed: 1}, lookup);
    assert.deepEqual(wrath.items.map(item => [item.system.identifier, item.system.quantity]), [["redWater", 2], ["stoneFragment", 1]]);
    const standard = generateLoot({encounter: "standard", mode: "dungeon", partyLevel: 5, P: 1});
    assert.equal(standard.dust, 0);
    assert.equal(standard.items.length, 0);
  });
  test("a rogue heavy party weights Killer to 40", () => {
    const prefixes = {};
    for ( let seed = 1; seed <= 300; seed++ ) {
      const loot = generateLoot({encounter: "boss", partyLevel: 10, shopTier: "steel", partyLines: ["sword"], partyClasses: ["rogue", "assassin", "soldier"], seed, P: 1});
      const prefix = loot.items[0].system.prefix ?? "none";
      prefixes[prefix] = (prefixes[prefix] ?? 0) + 1;
    }
    assert.ok(prefixes.killer > (prefixes.keen ?? 0), JSON.stringify(prefixes));
    return `prefix spread: ${JSON.stringify(prefixes)}`;
  });
});

suite("generators: Encounter", test => {
  test("N 5, S 35, L 30, Standard, level 10: P 1.29, 5 to 7 enemies, boss HP 400, XP 39, CP 1.29", () => {
    const plan = planEncounter({N: 5, S: 35, L: 30, partyLevel: 10, difficulty: "standard", kind: "dungeonFight"});
    assert.equal(plan.displayP, 1.29);
    assert.deepEqual(plan.count, [5, 7]);
    assert.equal(plan.boss.hp, 400);
    assert.equal(plan.awards.xp, 39);
    assert.equal(plan.awards.cp, 1.29);
    assert.equal(plan.awards.cp100, 129);
    assert.equal(plan.enemyLevel, 10);
    assert.equal(plan.standard.hp, 50);
    assert.equal(plan.standard.def, 12);
  });
  test("difficulty moves the level, the count, and the boss row", () => {
    const hard = planEncounter({N: 4, S: 45, L: 30, partyLevel: 10, difficulty: "hard", kind: "boss"});
    assert.equal(hard.enemyLevel, 12);
    assert.deepEqual(hard.count, [6, 7]);
    assert.equal(hard.altCount, 6);
    assert.equal(hard.boss.row, 20, "two rows up from the level 10 row");
    assert.equal(hard.boss.hp, 500);
    const easy = planEncounter({N: 4, S: 45, L: 30, partyLevel: 10, difficulty: "easy"});
    assert.equal(easy.enemyLevel, 8);
    assert.deepEqual(easy.count, [4, 4]);
  });
  test("benchmark monsters carry the row's numbers and generic moves", () => {
    const plan = planEncounter({N: 5, S: 35, L: 30, partyLevel: 10});
    const standards = benchmarkMonsters(plan);
    assert.equal(standards.length, 5);
    assert.equal(standards[0].system.hp.max, 50);
    assert.equal(standards[0].items[0].system.attack.might, 22);
    const [boss] = benchmarkMonsters(plan, {boss: true});
    assert.equal(boss.system.hp.max, 400);
    assert.equal(boss.system.boss, true);
    assert.equal(boss.items[0].system.attack.might, 34);
    assert.equal(boss.system.phaseBreaks.length, 1);
  });
});
