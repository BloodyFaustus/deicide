export function seededRng(seed) {
  let state = (typeof seed === "string") ? hashString(seed) : (seed >>> 0);
  return function next() {
    state = (state + 0x6D2B79F5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(text) {
  let hash = 0x811C9DC5;
  for ( let i = 0; i < text.length; i++ ) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function d100(rng = Math.random) {
  return Math.floor(rng() * 100) + 1;
}

export function rollUnder(roll, threshold) {
  return roll <= Math.min(Math.max(threshold, 0), 100);
}

export function weightedPick(table, rng = Math.random) {
  const pairs = Array.isArray(table) ? table : Object.entries(table);
  const total = pairs.reduce((sum, [, weight]) => sum + Math.max(weight, 0), 0);
  if ( total <= 0 ) return undefined;
  let roll = rng() * total;
  for ( const [value, weight] of pairs ) {
    roll -= Math.max(weight, 0);
    if ( roll < 0 ) return value;
  }
  return pairs.at(-1)[0];
}

export function pick(list, rng = Math.random) {
  return list[Math.floor(rng() * list.length)];
}
