import {suite, assert} from "./harness.mjs";
import {loadCatalog} from "../lib/sources.mjs";
import {DEICIDE} from "../../module/config.mjs";
import {createCharacter} from "../../module/rules/creation.mjs";
import {classGrowthLine} from "../../module/rules/growth.mjs";
import {encounterAwards} from "../../module/rules/pacing.mjs";

const catalog = loadCatalog();
const lookup = catalog.lookup();

suite("decisions: origins", test => {
  test("Beastman has four subtypes with the decided start bonuses", () => {
    const beastman = lookup("origin", "beastman");
    assert.deepEqual(beastman.subtypes.feline.startBonus, {spd: 2});
    assert.deepEqual(beastman.subtypes.canine.startBonus, {skl: 2});
    assert.deepEqual(beastman.subtypes.ursine.startBonus, {str: 2});
    assert.deepEqual(beastman.subtypes.avian.growth, {skl: "D", str: "D", spd: "E", def: "E"});
    assert.deepEqual(beastman.subtypes.avian.proficiencies, {flying: "D"});
  });
  test("every faction starts at 40 and backgrounds list absolute values", () => {
    const {system, errors} = createCharacter({people: "manaborne", peopleSubtype: "", background: "duneHunter", baseClass: "soldier"}, lookup);
    assert.deepEqual(errors, []);
    for ( const faction of Object.keys(DEICIDE.factions) ) assert.ok(faction in system.standingFaction, faction);
    assert.equal(system.standingFaction.duneTribes, 70);
    assert.equal(system.standingFaction.crown, 30);
    assert.equal(system.standingFaction.army, 40);
    const noble = createCharacter({people: "manaborne", background: "nobleCadet", baseClass: "cadet"}, lookup).system;
    assert.equal(noble.standingFaction.crown, 60);
    const hedge = createCharacter({people: "manaborne", background: "hedgeMage", baseClass: "adept"}, lookup).system;
    assert.equal(hedge.standingFaction.mages, 55);
    assert.equal(hedge.standingFaction.civilians, 30);
    const survivor = createCharacter({people: "highElf", background: "manaburnSurvivor", baseClass: "adept"}, lookup).system;
    assert.equal(survivor.standingFaction.temple, 30);
    assert.equal(survivor.standingFaction.mages, 30);
  });
  test("creation stores CP in hundredths", () => {
    const {system} = createCharacter({people: "manaborne", background: "conscript", baseClass: "soldier"}, lookup);
    assert.deepEqual(system.classes.map(({id, rank, cp100}) => ({id, rank, cp100})), [{id: "soldier", rank: 2, cp100: 300}]);
  });
});

suite("decisions: classes", test => {
  test("enemy class growth lines", () => {
    const legionary = lookup("class", "imperialLegionary");
    assert.deepEqual(legionary.growth, {str: "A", mag: "F", skl: "B", spd: "D", def: "S", res: "C", cmd: "C"});
    assert.equal(legionary.hp, 4);
    assert.deepEqual(legionary.trains, {primary: ["lance", "armor"], secondary: ["authority", "sword"]});
    const inquisitor = lookup("class", "inquisitor");
    assert.deepEqual(inquisitor.growth, {str: "B", mag: "B", skl: "A", spd: "C", def: "C", res: "A", cmd: "C"});
    assert.equal(inquisitor.tier, 3);
    assert.deepEqual(inquisitor.trains, {primary: ["sword", "faith"], secondary: ["reason", "void"]});
    assert.equal(Object.values(classGrowthLine(legionary)).reduce((a, b) => a + b, 0), DEICIDE.tierGrowthTenths[2]);
  });
  test("the Divine Agent class is gone", () => {
    assert.equal(lookup("class", "divineAgent"), null);
    assert.equal(lookup("ability", "divineAgentJudgement"), null);
  });
  test("Great Knight plays at Move 5", () => {
    assert.equal(lookup("class", "greatKnight").move, 5);
  });
});

suite("decisions: monsters and items", test => {
  test("Caldus Rime stat block", () => {
    const caldus = lookup("monster", "caldusRime");
    assert.equal(caldus.level, 30);
    assert.equal(caldus.hp.max, 900);
    assert.equal(caldus.def, 30);
    assert.equal(caldus.res, 42);
    assert.equal(caldus.mag, 34);
    assert.equal(caldus.skl, 30);
    assert.equal(caldus.spd, 24);
    assert.deepEqual(caldus.delay, {mode: "fixed", value: 25});
    assert.equal(caldus.weakness, "void");
    assert.equal(caldus.divineBeing, true);
    assert.deepEqual(caldus.phaseBreaks.map(entry => entry.percent), [50, 25]);
    assert.deepEqual(caldus.yield.drops, ["caldussMantle"]);
    assert.equal(caldus.yield.divineAttention, 2);
  });
  test("Homunculus levels and SPD", () => {
    const expected = {lust: [12, 14], greed: [16, 10], envy: [18, 16], wrath: [20, 15], pride: [26, 18]};
    for ( const [id, [level, spd]] of Object.entries(expected) ) {
      const monster = lookup("monster", id);
      assert.equal(monster.level, level, `${id} level`);
      assert.equal(monster.spd, spd, `${id} spd`);
      assert.deepEqual(monster.delay, {mode: "fixed", value: 30}, `${id} delay`);
    }
  });
  test("Breakwater Aegis replaces the Wall of Marr", () => {
    assert.equal(lookup("named", "wallOfMarr"), null);
    const aegis = lookup("named", "breakwaterAegis");
    assert.ok(aegis);
    assert.ok(/Ilwen Ashcroft/.test(aegis.hook));
  });
});

suite("decisions: cp100 awards", test => {
  test("a Dungeon fight at P 0.44 awards 44 hundredths, never 0", () => {
    const awards = encounterAwards({kind: "dungeonFight", level: 5, dials: {S: 45, L: 20}});
    assert.equal(awards.cp100, Math.round(awards.multiplier * 100));
    assert.ok(awards.cp100 > 0);
    assert.equal(awards.cp, awards.cp100 / 100);
  });
});
