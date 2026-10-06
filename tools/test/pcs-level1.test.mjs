import {readFileSync} from "node:fs";
import {join} from "node:path";
import {suite, assert} from "./harness.mjs";
import {ROOT, loadCatalog} from "../lib/sources.mjs";
import {equipmentFromKit} from "../lib/equipment.mjs";
import {createCharacter} from "../../module/rules/creation.mjs";
import {deriveCharacter} from "../../module/rules/derive.mjs";
import {attackPower, critChance} from "../../module/rules/resolve.mjs";
import {DEICIDE} from "../../module/config.mjs";

const fixtures = JSON.parse(readFileSync(join(ROOT, "fixtures", "pcs-level1.json"), "utf8"));
const catalog = loadCatalog();
const lookup = catalog.lookup();

function build(fixture, {mode = "war"} = {}) {
  const baseClass = fixture.classes.find(entry => lookup("class", entry.id)?.tier === 1)?.id ?? fixture.classes[0].id;
  const inputs = {
    people: fixture.people,
    peopleSubtype: fixture.peopleSubtype,
    background: fixture.background,
    baseClass,
    talent: fixture.talent,
    personalGrowth: fixture.personalGrowth,
    startSpread: fixture.startSpread
  };
  const created = createCharacter(inputs, lookup);
  assert.deepEqual(created.errors, [], `creation errors: ${created.errors.join(", ")}`);
  const equipment = equipmentFromKit(fixture.equipment);
  const derived = deriveCharacter(created.system, {
    lookup, equipment, context: {mode, classCatalog: catalog.all("class")}
  });
  return {created, equipment, derived};
}

for ( const [name, fixture] of Object.entries(fixtures) ) {
  if ( name.startsWith("_") ) continue;
  suite(`pcs-level1: ${name}`, test => {
    const {created, equipment, derived} = build(fixture);
    const system = created.system;

    test("background grants reproduce the fixture class list", () => {
      const classes = system.classes.map(({id, rank, cp100}) => ({id, rank, cp: cp100 / 100}));
      assert.deepEqual(classes, fixture.classes);
      assert.equal(system.activeClass, fixture.activeClass);
    });

    test("level 1 attributes", () => {
      assert.deepEqual(derived.values, fixture.attributes);
    });

    if ( fixture.grades ) test("grades", () => assert.deepEqual(derived.grades, fixture.grades));

    test("HP", () => assert.equal(derived.hp.max, fixture.hp));

    if ( "channel" in fixture ) test("Channel", () => assert.equal(derived.channel?.max ?? null, fixture.channel));
    if ( "channelBase" in fixture ) test("Channel before origin and kit", () => {
      assert.equal(derived.channel.formula, fixture.channelBase);
      assert.equal(derived.channel.innate, fixture.channelAfterOrigin);
      assert.equal(derived.channel.max, fixture.channelWithKit);
    });

    test("Manaburn start", () => assert.equal(system.manaburn, fixture.manaburn));

    if ( "matterCap" in fixture ) test("Matter capacity and its breakdown", () => {
      assert.equal(derived.matter.max, fixture.matterCap);
      const breakdown = fixture.matterCapBreakdown;
      assert.equal(derived.matter.formula, breakdown.base + breakdown.strQuarter);
      const bySource = Object.fromEntries(derived.matter.parts.map(part => [part.source, part.value]));
      assert.equal(bySource.alchemistCircle, breakdown.circle);
      assert.equal(bySource.ironGauntlet, breakdown.ironGauntlet);
      assert.equal(bySource.ironSatchel, breakdown.ironSatchel);
    });
    else test("no Matter capacity for a non alchemist", () => assert.equal(derived.matter, null));

    test("Move and command radius", () => {
      assert.equal(derived.move, fixture.move);
      assert.equal(derived.commandRadius, fixture.commandRadius);
    });

    test("cap tier", () => assert.equal(derived.capTier, fixture.capTier));

    if ( "divineAttention" in fixture ) test("Divine Attention start", () => assert.equal(system.divineAttention, fixture.divineAttention));
    if ( "stolenSlots" in fixture ) test("Stolen slots", () => assert.equal(derived.stolen.slots, fixture.stolenSlots));
    if ( "staticMax" in fixture ) test("Static maximum", () => assert.equal(derived.static.max, fixture.staticMax));

    test("known skills", () => {
      assert.deepEqual([...derived.skills.known].sort(), [...fixture.skills].sort());
    });

    for ( const [key, expected] of Object.entries(fixture.expectedAttacks ?? {}) ) {
      test(`attack: ${key}`, () => {
        const abilityId = derived.skills.known.find(id => id.toLowerCase().endsWith(key.toLowerCase()))
          ?? derived.skills.known.find(id => id.toLowerCase().includes(key.replace(/WithRedWater$/i, "").toLowerCase()));
        const ability = (key === "lance") ? null : lookup("ability", abilityId);
        if ( key !== "lance" ) assert.ok(ability, `ability for ${key} not found among ${derived.skills.known.join(", ")}`);
        const context = /WithRedWater$/.test(key) ? {catalyst: "redWater"} : {};
        const result = attackPower({attacker: derived.profile, ability, weapon: equipment.weapon, mode: "dungeon", context});
        assert.equal(result.attack, expected.attack, `attack power of ${key}`);
        assert.equal(result.label, expected.type, `damage label of ${key}`);
        if ( "channel" in expected ) assert.equal(ability.cost.channel, expected.channel);
        if ( "matter" in expected ) assert.equal(ability.cost.matter, expected.matter);
        if ( "range" in expected ) assert.deepEqual(ability.war.range, expected.range);
        if ( "soulPriceHp" in expected ) {
          const price = context.catalyst ? 0 : ability.cost.soulPrice;
          assert.equal(derived.soulPricePayer, "hp");
          assert.equal(price, expected.soulPriceHp);
        }
        if ( "castsBeforeOvercast" in expected ) {
          assert.equal(Math.floor(derived.channel.max / ability.cost.channel), expected.castsBeforeOvercast);
        }
        if ( "critPercent" in expected ) {
          const target = {attributes: {spd: 0}, defense: {avoid: 0}, classTypes: [], statuses: []};
          const crit = critChance({attacker: derived.profile, target, ability, weapon: equipment.weapon, mode: "dungeon"});
          assert.equal(crit.chance, expected.critPercent);
        }
      });
    }

    test("no derived value leaks into stored data", () => {
      for ( const key of ["hp", "channel", "matter", "move", "proficiencies", "grades"] ) {
        assert.ok(!(key in system) || (key === "hp"), `${key} must not be stored`);
      }
      assert.equal(system.level, 1);
      assert.equal(system.growthLog.length, 1);
    });
  });
}

suite("pcs-level1: fixtures share the rule tables", test => {
  test("every fixture class exists in the catalog", () => {
    for ( const [name, fixture] of Object.entries(fixtures) ) {
      if ( name.startsWith("_") ) continue;
      for ( const entry of fixture.classes ) assert.ok(lookup("class", entry.id), `${entry.id} missing`);
    }
  });
  test("base 6 plus spread plus background plus Talent sums to 58 or 66", () => {
    for ( const [name, fixture] of Object.entries(fixtures) ) {
      if ( name.startsWith("_") ) continue;
      const total = Object.values(fixture.attributes).reduce((a, b) => a + b, 0);
      const expected = 7 * DEICIDE.attributeBase + 12 + 4 + (fixture.talent.id === "earlyPeak" ? 8 : 0)
        + (fixture.peopleSubtype === "feline" ? 2 : 0);
      assert.equal(total, expected, `${name} attribute total`);
    }
  });
});
