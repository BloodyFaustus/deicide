import {DEICIDE} from "../config.mjs";

export const FACING_VECTORS = [
  {dx: 0, dy: -1}, {dx: 1, dy: -1}, {dx: 1, dy: 0}, {dx: 1, dy: 1},
  {dx: 0, dy: 1}, {dx: -1, dy: 1}, {dx: -1, dy: 0}, {dx: -1, dy: -1}
];

const sign = value => (value > 0) ? 1 : ((value < 0) ? -1 : 0);

export function facingFromMove(dx, dy, current = 0) {
  const sx = sign(dx);
  const sy = sign(dy);
  if ( !sx && !sy ) return current;

  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  const vx = (ax * 2 < ay) ? 0 : sx;
  const vy = (ay * 2 < ax) ? 0 : sy;
  return FACING_VECTORS.findIndex(v => (v.dx === vx) && (v.dy === vy));
}

export function frontOffsets(facing) {
  const count = DEICIDE.war.frontTiles;
  const half = Math.floor(count / 2);
  const out = [];
  for ( let i = -half; i <= half; i++ ) out.push(FACING_VECTORS[(((facing + i) % 8) + 8) % 8]);
  return out;
}

export function inFront(from, facing, to) {
  const dx = sign(to.x - from.x);
  const dy = sign(to.y - from.y);
  if ( !dx && !dy ) return false;
  return frontOffsets(facing).some(v => (v.dx === dx) && (v.dy === dy));
}

export function isFlank(attacker, target) {
  return !inFront(target, target.facing ?? 0, attacker);
}

export function facingAngle(facing) {
  return (((facing % 8) + 8) % 8) * 45;
}
