import {readFileSync} from "node:fs";
import {join} from "node:path";
import {suite, assert} from "./harness.mjs";
import {ROOT} from "../lib/sources.mjs";
import {DEICIDE} from "../../module/config.mjs";
import {evaluate, variables} from "../../module/core/expression.mjs";

const tables = JSON.parse(readFileSync(join(ROOT, "fixtures", "system-tables.json"), "utf8"));

suite("config matches system-tables.json", test => {
  test("grades", () => assert.deepEqual(DEICIDE.grades, tables.grades));
  test("growth tenths", () => assert.deepEqual(DEICIDE.growthTenths, tables.growthTenths));
  test("tier growth totals", () => {
    for ( const [tier, total] of Object.entries(tables.tierGrowthTotal) ) {
      assert.equal(DEICIDE.tierGrowthTenths[tier], Math.round(total * 10));
    }
  });
  test("people and personal growth", () => {
    assert.equal(DEICIDE.peopleGrowthTenths, tables.peopleGrowthTotal * 10);
    assert.equal(DEICIDE.personalGrowthTenths, tables.personalGrowthTotal * 10);
    assert.equal(DEICIDE.personalGrowthMaxPerStat, tables.personalGrowthMaxPerStat * 10);
  });
  test("caps", () => assert.deepEqual(DEICIDE.caps, Object.fromEntries(Object.entries(tables.caps).map(([k, v]) => [Number(k), v]))));
  test("promotion bonus", () => assert.deepEqual(DEICIDE.promotionBonus, Object.fromEntries(Object.entries(tables.promotionBonus).map(([k, v]) => [Number(k), v]))));
  test("rank CP", () => assert.deepEqual(DEICIDE.rankCp, tables.rankCp));
  test("rank proficiency", () => {
    const normalize = table => Object.fromEntries(Object.entries(table).map(([k, v]) => [Number(k), v]));
    assert.deepEqual(DEICIDE.rankProficiency.primary, normalize(tables.rankProficiency.primary));
    assert.deepEqual(DEICIDE.rankProficiency.secondary, normalize(tables.rankProficiency.secondary));
  });
  test("pacing", () => {
    assert.deepEqual(DEICIDE.pacing.defaults, tables.pacing.defaults);
    assert.deepEqual(DEICIDE.tierGates, Object.fromEntries(Object.entries(tables.pacing.tierGates).map(([k, v]) => [Number(k), v])));
    assert.equal(evaluate(DEICIDE.pacing.formula, {L: 30, S: 45}), evaluate(tables.pacing.formula, {L: 30, S: 45}));
  });
  test("delay", () => {
    assert.equal(DEICIDE.delay.min, tables.delay.min);
    assert.deepEqual(DEICIDE.delay.weights, tables.delay.weights);
    assert.equal(evaluate(DEICIDE.formulas.delay, {weight: 8, spd: 10}), evaluate(tables.delay.formula, {weight: 8, spd: 10}));
  });
  test("hit, crit, channel, matter, command radius formulas agree", () => {
    const scope = {skl: 11, weaponAcc: 10, targetSpd: 7, terrainAvoid: 20, weaponCrit: 5, mag: 13, res: 9, str: 15, cmd: 12};
    assert.equal(evaluate(DEICIDE.formulas.hit, scope), evaluate(tables.hit, scope));
    assert.equal(evaluate(DEICIDE.formulas.crit, scope), evaluate(tables.crit, scope));
    assert.equal(evaluate(DEICIDE.formulas.channel, scope), evaluate(tables.channel, scope));
    assert.equal(evaluate(DEICIDE.formulas.matterCap, scope), evaluate(tables.matterCap, scope));
    assert.equal(evaluate(DEICIDE.formulas.commandRadius, scope), evaluate(tables.commandRadius, scope));
    assert.equal(DEICIDE.damage.critMultiplier, tables.critMultiplier);
    assert.equal(DEICIDE.war.doubling.spdGap, tables.doubling.spdGap);
    assert.equal(DEICIDE.war.doubling.maxWeight, tables.doubling.maxWeight);
    assert.equal(DEICIDE.overcast.burnPerPoint, tables.overcast.burnPerPoint);
    assert.equal(DEICIDE.overcast.floorPerPoint, tables.overcast.floor);
  });
  test("company formulas", () => {
    const scope = {quality: 3, strength: 72, avoid: 10, spd: 9, inRadius: 1};
    for ( const key of ["def", "res", "atkVsCharacter", "atkVsCompany", "hit"] ) {
      assert.equal(evaluate(DEICIDE.company.formulas[key], scope), evaluate(tables.company[key], scope), key);
    }
    assert.equal(DEICIDE.company.moraleBelow, tables.company.moraleBelow);
    assert.equal(DEICIDE.company.veterancy.promoteAt, tables.company.veterancyPromote);
  });
  test("benchmarks", () => assert.deepEqual(DEICIDE.benchmarks, tables.benchmarks));
  test("weapon generator", () => {
    assert.deepEqual(DEICIDE.weaponGenerator.lines, tables.weaponGenerator.lines);
    assert.deepEqual(DEICIDE.weaponGenerator.tiers, tables.weaponGenerator.tiers);
    assert.deepEqual(DEICIDE.weaponGenerator.prefixes, tables.weaponGenerator.prefixes);
    assert.equal(DEICIDE.weaponGenerator.price, tables.weaponGenerator.price);
    assert.deepEqual(DEICIDE.weaponGenerator.forge, tables.weaponGenerator.forge);
  });
  test("every formula string parses and names only known variables", () => {
    const known = new Set([...DEICIDE.attributeIds, "level", "classHp", "bonus", "weight", "weaponAcc", "targetSpd",
      "terrainAvoid", "weaponCrit", "L", "S", "pp", "fastestEnemySpd", "quality", "strength", "avoid", "inRadius", "N",
      ...Object.keys(DEICIDE.nationTracks), "roll", "track", "casterMag"]);
    const formulas = [
      ...Object.values(DEICIDE.formulas), ...Object.values(DEICIDE.company.formulas),
      ...Object.values(DEICIDE.nationFormulas), ...Object.values(DEICIDE.enemyFormulas),
      ...Object.values(DEICIDE.economy.income).filter(v => typeof v === "string"), DEICIDE.pacing.formula,
      DEICIDE.weaponGenerator.price, DEICIDE.collapse.terrainBarrierFormula, DEICIDE.stolenSlots.cancelFormula,
      DEICIDE.statuses.warded.breakFormula
    ];
    for ( const formula of formulas ) {
      for ( const name of variables(formula) ) assert.ok(known.has(name), `unknown variable "${name}" in "${formula}"`);
    }
  });
});
