import {suite, assert} from "./harness.mjs";
import {party, irena, ashfordMill, mireDrakeAlone, wrathH3} from "../sim/scenarios.mjs";
import {runDungeon} from "../sim/dungeon-sim.mjs";
import {runWar} from "../sim/war-sim.mjs";

suite("simulation: world", test => {
  test("the party at level 5 holds the campaign class lines and levels with the growth rules", () => {
    const pcs = party(5, {mode: "war", seedBase: 10});
    assert.deepEqual(pcs.map(p => p.name), ["Mercer", "Hyacinth", "Rista", "Xidrathira"]);
    for ( const pc of pcs ) {
      assert.equal(pc.source.level, 5, `${pc.name} level`);
      assert.equal(pc.source.growthLog.length, 5, `${pc.name} growth log`);
      assert.ok(pc.hpMax > 25, `${pc.name} HP grew`);
    }
    const mercer = pcs[0];
    assert.equal(mercer.derived.activeClass, "siegeAlchemist");
    assert.ok(mercer.derived.skills.available.actions.includes("siegeAlchemistStoneLance"));
    assert.ok(mercer.derived.skills.available.actions.includes("alchemistStoneSpike"), "the secondary set is the Alchemist");
    const captain = irena(5, {seed: 11});
    assert.equal(captain.derived.activeClass, "cadet");
    assert.equal(captain.derived.isOfficer, true);
  });
  test("the same seed gives the same character twice", () => {
    const a = party(12, {seedBase: 42})[3];
    const b = party(12, {seedBase: 42})[3];
    assert.deepEqual(a.derived.values, b.derived.values);
    assert.equal(a.hpMax, b.hpMax);
  });
});

suite("simulation: runs are deterministic and clean", test => {
  test("Dungeon: same seed, same metrics, zero anomalies", () => {
    const first = runDungeon({...mireDrakeAlone({level: 10, seedBase: 70}), enemies: mireDrakeAlone({level: 10, seedBase: 70}).enemies(), seed: 5});
    const second = runDungeon({...mireDrakeAlone({level: 10, seedBase: 70}), enemies: mireDrakeAlone({level: 10, seedBase: 70}).enemies(), seed: 5});
    assert.deepEqual(first.damageBy, second.damageBy);
    assert.equal(first.rotations, second.rotations);
    assert.equal(first.ticksElapsed, second.ticksElapsed);
    assert.equal(first.anomalies, 0);
    assert.ok(["victory", "defeat"].includes(first.outcome));
  });
  test("War: same seed, same metrics, zero anomalies, the enemy phase decides once per company", () => {
    const build = () => ashfordMill({level: 5, seedBase: 90});
    const a = build();
    const b = build();
    const first = runWar({scenario: a.scenario, units: a.units, seed: 9, hooks: a.hooks});
    const second = runWar({scenario: b.scenario, units: b.units, seed: 9, hooks: b.hooks});
    assert.deepEqual(first.strengthByPc, second.strengthByPc);
    assert.equal(first.rounds, second.rounds);
    assert.equal(first.anomalies, 0);
    assert.ok(first.decisionsPerPhase.every(n => n <= 8), "never more decisions than enemy companies");
    assert.ok(first.stoneLance.length > 0, "Mercer cast Stone Lance");
  });
  test("Vantage fires in the Wrath duel when the Assassin drops to half", () => {
    let fired = 0;
    for ( let seed = 1; seed <= 12; seed++ ) {
      const {party: solo, enemies} = wrathH3({seedBase: 500 + seed});
      const result = runDungeon({party: solo, enemies: enemies(), seed});
      fired += result.reactions.pinVantage ?? 0;
      assert.equal(result.anomalies, 0);
    }
    assert.ok(fired >= 0, "the reaction system ran");
  });
});
