import {suite, assert} from "./harness.mjs";
import {facingAngle, facingFromMove, frontOffsets, inFront, isFlank} from "../../module/rules/facing.mjs";

suite("facing: moves and front tiles", test => {
  test("the last move step sets the facing, clockwise from north", () => {
    assert.equal(facingFromMove(0, -3), 0);
    assert.equal(facingFromMove(2, -2), 1);
    assert.equal(facingFromMove(4, 0), 2);
    assert.equal(facingFromMove(0, 2), 4);
    assert.equal(facingFromMove(-1, 0), 6);
    assert.equal(facingFromMove(0, 0, 5), 5, "no movement keeps the facing");
    assert.equal(facingFromMove(5, 1), 2, "a shallow diagonal reads as the main axis");
    assert.equal(facingAngle(2), 90);
  });
  test("three front tiles, everything else flanks", () => {
    const front = frontOffsets(0);
    assert.deepEqual(front.map(v => `${v.dx},${v.dy}`), ["-1,-1", "0,-1", "1,-1"]);
    const target = {x: 5, y: 5, facing: 0};
    assert.equal(isFlank({x: 5, y: 4}, target), false, "straight ahead");
    assert.equal(isFlank({x: 6, y: 4}, target), false, "front diagonal");
    assert.equal(isFlank({x: 6, y: 5}, target), true, "the side");
    assert.equal(isFlank({x: 5, y: 6}, target), true, "behind");
    assert.equal(isFlank({x: 5, y: 1}, target), false, "at range, still ahead");
    assert.equal(inFront({x: 0, y: 0}, 4, {x: 0, y: 0}), false, "own tile is never in front");
    const west = {x: 5, y: 5, facing: 6};
    assert.equal(isFlank({x: 4, y: 6}, west), false);
    assert.equal(isFlank({x: 6, y: 6}, west), true);
  });
});
