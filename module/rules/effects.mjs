import {DEICIDE} from "../config.mjs";
import {evaluate} from "../core/expression.mjs";
import {Registry} from "../core/registry.mjs";
import {test} from "../core/predicate.mjs";

export const effectKinds = new Registry("effectKinds", {
  validate: (id, kind) => {
    if ( typeof kind?.apply !== "function" ) throw new TypeError(`Effect kind "${id}" needs an apply function`);
    return kind;
  }
});

export function amountOf(value, ctx, extra = {}) {
  if ( typeof value === "number" ) return value;
  if ( value === undefined || value === null ) return 0;
  const scope = {...(ctx.actor?.profile?.attributes ?? {}), ...(ctx.scope ?? {}), ...extra};
  return Math.floor(evaluate(String(value), scope));
}

export function resolveTargets(target, ctx) {
  const declared = (ctx.targets ?? []).map(entry => entry.id);
  const groups = ctx.groups ?? {};
  switch ( target ) {
    case "self": return ctx.actor?.id ? [ctx.actor.id] : [];
    case "attacker": return ctx.attacker?.id ? [ctx.attacker.id] : [];
    case "target":
    case "ally": return declared;
    case "row": return groups.row ?? declared;
    case "radius": return groups.radius ?? declared;
    case "alliesInRadius": return groups.alliesInRadius ?? groups.allies ?? [];
    case "allies": return groups.allies ?? [];
    case "enemies": return groups.enemies ?? declared;
    case "companies": return groups.companies ?? declared;
    default: return declared;
  }
}

function defenseForTag(tag) {
  if ( !tag ) return "def";
  if ( tag === "truth" ) return "none";
  if ( DEICIDE.elements[tag] ) return "res";
  if ( ["reason", "faith", "void", "spell", "magical"].includes(tag) ) return "res";
  return "def";
}

function targetProfile(ctx, id) {
  if ( ctx.actor?.id === id ) return ctx.actor.profile;
  if ( ctx.attacker?.id === id ) return ctx.attacker.profile;
  const entry = (ctx.targets ?? []).find(target => target.id === id);
  if ( entry ) return entry.profile;
  return ctx.profiles?.[id] ?? null;
}

function chancePasses(effect, ctx, id) {
  const chance = effect.chance ?? "always";
  if ( chance === "always" ) return true;
  const entry = (ctx.targets ?? []).find(target => target.id === id);
  if ( chance === "onHit" ) return Boolean(entry?.hit ?? ctx.hit ?? ctx.targets?.some(target => target.hit));
  if ( chance === "onCrit" ) return Boolean(entry?.crit ?? ctx.crit ?? ctx.targets?.some(target => target.crit));
  return true;
}

const describeTarget = target => target ? ` on ${target}` : "";

effectKinds.registerAll({
  applyStatus: {
    defaultTarget: "target",
    apply(effect, ctx, targets) {
      const turns = effect.turns === "thisPhase" ? null : (effect.turns ?? DEICIDE.statuses[effect.statusId]?.duration?.turns ?? null);
      return [{
        type: "applyStatus", statusId: effect.statusId, turns,
        pool: effect.pool !== undefined ? amountOf(effect.pool, ctx) : null,
        params: effect.params ?? null, modifiers: effect.modifiers ?? null, flags: effect.flags ?? null, expires: effect.turns === "thisPhase" ? "phase" : (effect.expires ?? null),
        targets
      }];
    },
    describe: effect => `Apply ${effect.statusId}${describeTarget(effect.target)}${effect.turns ? ` for ${effect.turns} ${effect.turns === "thisPhase" ? "" : "turns"}`.replace(/\s+$/, "") : ""}`
  },

  removeStatus: {
    defaultTarget: "target",
    apply: (effect, ctx, targets) => [{type: "removeStatus", statusId: effect.statusId ?? "all", targets}],
    describe: effect => `Remove ${effect.statusId ?? "every status"}${describeTarget(effect.target)}`
  },

  damage: {
    defaultTarget: "target",
    apply(effect, ctx, targets) {
      const base = amountOf(effect.amount, ctx);
      let tag = effect.tag ?? null;
      if ( tag === "attunedElement" ) tag = ctx.actor?.profile?.attuned ?? ctx.attuned ?? null;
      const defenseId = effect.ignoresDefense ? "none" : (effect.defense ?? defenseForTag(tag));
      const entries = targets.map(id => {
        const profile = targetProfile(ctx, id);
        let defense = 0;
        if ( defenseId === "def" ) defense = profile?.defense?.def ?? profile?.attributes?.def ?? 0;
        else if ( defenseId === "res" ) defense = profile?.defense?.res ?? profile?.attributes?.res ?? 0;
        const amount = Math.max(base - defense, defenseId === "none" ? 0 : DEICIDE.damage.minimum);
        return {id, amount, defense};
      });
      return [{type: "damage", amount: base, tag, defenseId, ignoresDefense: Boolean(effect.ignoresDefense), entries, targets}];
    },
    describe: effect => `${effect.amount} ${effect.tag ?? "physical"} damage${describeTarget(effect.target)}${effect.ignoresDefense ? ", ignores defense" : ""}`
  },

  heal: {
    defaultTarget: "ally",
    apply(effect, ctx, targets) {
      const amount = amountOf(effect.amount, ctx);
      const value = effect.rowHalf ? Math.floor(amount / 2) : amount;
      return [{type: "heal", amount: value, targets}];
    },
    describe: effect => `Heal ${effect.amount}${describeTarget(effect.target)}${effect.rowHalf ? " (half to the row)" : ""}`
  },

  pool: {
    defaultTarget: "self",
    apply(effect, ctx, targets) {
      const delta = (effect.delta === "+ability") ? "+ability" : amountOf(effect.delta, ctx, {damage: ctx.damage ?? 0});
      return [{type: "pool", key: effect.key, delta, targets}];
    },
    describe: effect => `${effect.key} ${typeof effect.delta === "number" && effect.delta > 0 ? "+" : ""}${effect.delta}${describeTarget(effect.target)}`
  },

  move: {
    defaultTarget: "target",
    apply(effect, ctx, targets) {
      const engine = ctx.engine ?? "war";

      const mode = (engine === "dungeon") && ["push", "pull", "teleport"].includes(effect.mode) ? "swapRow" : effect.mode;
      return [{type: "move", mode, tiles: effect.tiles ?? 1, through: Boolean(effect.through), targets}];
    },
    describe: effect => `${effect.mode}${effect.tiles ? ` ${effect.tiles} tile${effect.tiles > 1 ? "s" : ""}` : ""}${describeTarget(effect.target)} (forced row swap in Dungeon Mode)`
  },

  terrain: {
    defaultTarget: "self",
    apply(effect, ctx) {
      if ( (ctx.engine ?? "war") === "dungeon" ) {
        const pool = amountOf(effect.barrier ?? DEICIDE.collapse.terrainBarrierFormula, ctx);
        return [{type: "barrier", pool, side: effect.side ?? "ally", row: effect.row ?? "front", targets: []}];
      }
      return [{type: "terrain", op: effect.op, tileType: effect.tileType ?? null, size: effect.size ?? 1, targets: []}];
    },
    describe: effect => `Terrain ${effect.op}${effect.tileType ? ` (${effect.tileType})` : ""} in War, a row Barrier in Dungeon`
  },

  summon: {
    defaultTarget: "self",
    apply: effect => [{type: "summon", companyType: effect.companyType, strength: effect.strength ?? 40, quality: effect.quality ?? 1, duration: effect.duration ?? "encounter", targets: []}],
    describe: effect => `Summon a ${effect.companyType} company, Strength ${effect.strength ?? 40}, Quality ${effect.quality ?? 1}`
  },

  grantAction: {
    defaultTarget: "self",
    apply: (effect, ctx, targets) => [{type: "grantAction", count: effect.count ?? 1, scope: effect.scope ?? "self", targets}],
    describe: effect => `${effect.count ?? 1} extra activation${(effect.count ?? 1) > 1 ? "s" : ""} (${effect.scope ?? "self"})`
  },

  cancel: {
    defaultTarget: "target",
    apply: effect => [{type: "cancel", what: effect.what ?? "triggeringAction", targets: []}],
    describe: effect => `Cancel ${effect.what ?? "the triggering action"}`
  },

  strikeFirst: {
    defaultTarget: "self",
    apply: () => [{type: "strikeFirst", targets: []}],
    describe: () => "Resolve your attack before the trigger"
  },

  reroll: {
    defaultTarget: "self",
    apply: effect => [{type: "reroll", which: effect.which ?? "any", count: effect.count ?? 1, targets: []}],
    describe: effect => `Reroll ${effect.which ?? "any"} ${effect.count ?? 1} time${(effect.count ?? 1) > 1 ? "s" : ""}`
  },

  reveal: {
    defaultTarget: "target",
    apply: (effect, ctx, targets) => [{type: "reveal", what: effect.what, radius: effect.radius ?? null, targets}],
    describe: effect => `Reveal ${effect.what}${effect.radius ? ` within ${effect.radius}` : ""}`
  },

  nationTrack: {
    defaultTarget: "self",
    apply: effect => [{type: "nationTrack", track: effect.track, delta: effect.delta ?? 1, once: Boolean(effect.once), targets: []}],
    describe: effect => `${effect.track} track ${effect.delta > 0 ? "+" : ""}${effect.delta}${effect.once ? ", once" : ""}`
  },

  standing: {
    defaultTarget: "self",
    apply: effect => [{type: "standing", faction: effect.faction, delta: effect.delta ?? 0, scope: effect.scope ?? "character", targets: []}],
    describe: effect => `${effect.faction} Standing ${effect.delta > 0 ? "+" : ""}${effect.delta}`
  },

  flag: {
    defaultTarget: "self",
    apply: (effect, ctx, targets) => [{type: "flag", key: effect.key, value: effect.value ?? true, duration: effect.duration ?? null, targets}],
    describe: effect => `Flag ${effect.key}${effect.duration ? ` (${effect.duration})` : ""}`
  },

  soulPriceCatalyst: {
    defaultTarget: "self",
    apply: () => [{type: "soulPriceCatalyst", targets: []}],
    describe: () => "A catalyst pays the Soul Price instead of HP"
  },

  aura: {
    defaultTarget: "allies",
    apply: (effect, ctx, targets) => [{type: "aura", radius: effect.radius ?? 1, modifiers: effect.modifiers ?? [], flags: effect.flags ?? null, targets}],
    describe: effect => `Aura within ${effect.radius ?? 1}: ${(effect.modifiers ?? []).map(m => `${m.key} ${m.value > 0 ? "+" : ""}${m.value}`).join(", ")}${effect.flags ? ` ${Object.keys(effect.flags).join(", ")}` : ""}`
  },

  absorb: {
    defaultTarget: "ally",
    apply: (effect, ctx, targets) => [{type: "absorb", amount: amountOf(effect.amount, ctx), targets}],
    describe: effect => `Absorb ${effect.amount} of the damage${describeTarget(effect.target)}`
  },

  counter: {
    defaultTarget: "attacker",
    apply: (effect, ctx) => [{type: "counter", abilityId: effect.abilityId ?? null, might: effect.might ?? 0, targets: ctx.attacker?.id ? [ctx.attacker.id] : []}],
    describe: effect => `Attack back${effect.abilityId ? ` with ${effect.abilityId}` : ""}${effect.might ? ` at Might ${effect.might > 0 ? "+" : ""}${effect.might}` : ""}`
  },

  survive: {
    defaultTarget: "self",
    apply: (effect, ctx, targets) => [{type: "survive", hp: effect.hp ?? 1, targets}],
    describe: effect => `Survive at ${effect.hp ?? 1} HP${describeTarget(effect.target)}`
  },

  revive: {
    defaultTarget: "ally",
    apply: (effect, ctx, targets) => [{type: "revive", fraction: effect.fraction ?? 0.25, targets}],
    describe: effect => `Revive at ${Math.round((effect.fraction ?? 0.25) * 100)} percent HP${describeTarget(effect.target)}`
  },

  extraStrike: {
    defaultTarget: "target",
    apply: (effect, ctx, targets) => [{type: "extraStrike", source: effect.source ?? "sidearm", might: effect.might ?? 0, targets}],
    describe: effect => `An extra ${effect.source ?? "sidearm"} strike at Might ${effect.might > 0 ? "+" : ""}${effect.might ?? 0}`
  },

  redirect: {
    defaultTarget: "self",
    apply: effect => [{type: "redirect", to: effect.to ?? "self", targets: []}],
    describe: effect => `The attack resolves against ${effect.to === "self" ? "you" : effect.to} instead`
  },

  refundAction: {
    defaultTarget: "self",
    apply(effect, ctx) {
      const conditions = String(effect.condition ?? "").split("|").map(word => word.trim()).filter(Boolean);
      const events = ctx.events ?? [];
      const granted = conditions.some(condition => events.includes(condition));
      return [{type: "refundAction", condition: effect.condition ?? "", granted, usesPerRound: effect.usesPerRound ?? null, targets: []}];
    },
    describe: effect => `Refund your action ${String(effect.condition ?? "").replace(/\|/g, " or ").replace(/on([A-Z])/g, (m, c) => `on ${c.toLowerCase()}`)}`
  }
});

export function resolveEffects(effects, ctx = {}) {
  const outcomes = [];
  const situation = {
    ...(ctx.situation ?? {}), engine: ctx.engine ?? "war", mode: ctx.mode ?? ctx.engine ?? "war",
    subject: ctx.actor?.profile ?? null, target: ctx.targets?.[0]?.profile ?? null, action: ctx.action ?? null
  };
  for ( const effect of effects ?? [] ) {
    const kind = effectKinds.get(effect.kind);
    if ( !kind ) {
      outcomes.push({type: "unknown", kind: effect.kind, targets: []});
      continue;
    }
    if ( !test(effect.when, situation) ) continue;
    const targets = resolveTargets(effect.target ?? kind.defaultTarget ?? "target", ctx)
      .filter(id => chancePasses(effect, ctx, id));
    const needsTargets = !["self", undefined].includes(effect.target ?? kind.defaultTarget) && (kind.defaultTarget !== "self");
    if ( needsTargets && !targets.length && !["cancel", "strikeFirst", "terrain", "summon", "reroll", "nationTrack", "standing", "soulPriceCatalyst", "refundAction"].includes(effect.kind) ) continue;
    for ( const outcome of kind.apply(effect, ctx, targets) ) outcomes.push({...outcome, source: ctx.sourceId ?? null, effect});
  }
  return outcomes;
}

export function describeEffects(effects) {
  return (effects ?? []).map(effect => {
    const kind = effectKinds.get(effect.kind);
    const text = kind?.describe ? kind.describe(effect) : `${effect.kind}`;
    const when = effect.when ? ` when ${Object.entries(effect.when).map(([key, value]) => `${key} ${typeof value === "object" ? JSON.stringify(value) : value}`).join(", ")}` : "";
    const chance = effect.chance && (effect.chance !== "always") ? ` (${effect.chance})` : "";
    return `${text}${chance}${when}`;
  });
}
