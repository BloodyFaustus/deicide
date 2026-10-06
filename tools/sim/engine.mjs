import {DEICIDE} from "../../module/config.mjs";
import {seededRng, d100, rollUnder} from "../../module/core/random.mjs";
import {test} from "../../module/core/predicate.mjs";
import {fromSource} from "../../module/core/modifiers.mjs";
import {critChance, damage, describeAction, healAmount, hitChance, payChannel, soulPrice, strikeCount, absorb, opposedChance} from "../../module/rules/resolve.mjs";
import {resolveEffects} from "../../module/rules/effects.mjs";
import {eligibleReactions, orderReactions} from "../../module/rules/reactions.mjs";
import {tickStatus} from "../../module/rules/statuses.mjs";
import {dungeonProfile} from "../../module/rules/collapse.mjs";
import {activeBonds, bondsOf} from "../../module/rules/bonds.mjs";
import {companyHit, companyDamage} from "../../module/rules/company.mjs";
import {profileOf, rederive} from "./world.mjs";

export class Sim {

  constructor({seed = 1, mode = "war"} = {}) {
    this.rng = seededRng(seed);
    this.mode = mode;
    this.engine = mode;
    this.actors = [];
    this.log = [];
    this.metrics = {cards: 0, reactions: {}, dualStrikes: 0, downed: 0, damageBy: {}, anomalies: 0, kills: []};
    this.round = 1;
    this.phase = "lathander";
  }

  add(actor) {
    actor.sim = this;
    this.actors.push(actor);
    this.metrics.damageBy[actor.id] = 0;
    return actor;
  }

  alive(side = null) {
    return this.actors.filter(a => !a.downed && !a.routed && (!side || a.side === side));
  }

  roll() { return d100(this.rng); }

  applyStatus(actor, statusId, {turns, pool = null, modifiers = null, flags = null, expires = null} = {}) {
    const table = DEICIDE.statuses[statusId];
    if ( !table || actor.downed ) return;
    if ( actor.derived?.immunities?.includes(statusId) ) return;
    const duration = turns ?? table.duration?.turns ?? null;
    const existing = actor.statuses.get(statusId);
    const entry = {
      statusId, duration, pool: pool ?? existing?.pool ?? null, absorbed: existing?.absorbed ?? 0,
      modifiers: [...(table.modifiers ?? []), ...(modifiers ?? [])].map(m => ({...m, source: `status.${statusId}`})),
      flags: {...(table.flags ?? {}), ...(flags ?? {})}, expires
    };
    actor.statuses.set(statusId, entry);
    if ( actor.kind === "character" ) rederive(actor, this.mode);
  }

  removeStatus(actor, statusId) {
    if ( statusId === "all" ) actor.statuses.clear();
    else actor.statuses.delete(statusId);
    if ( actor.kind === "character" ) rederive(actor, this.mode);
  }

  tickStatuses(actor, event) {
    let burn = 0;
    for ( const [statusId, entry] of [...actor.statuses] ) {
      const result = tickStatus({statusId, duration: entry.duration, expires: entry.expires}, event);
      if ( result.burn ) { burn += result.burn; this.damage(actor, result.burn, {tag: "burn"}); }
      if ( result.ended ) actor.statuses.delete(statusId);
      else entry.duration = result.remaining;
    }
    if ( actor.kind === "character" && actor.statuses.size ) rederive(actor, this.mode);
    return burn;
  }

  damage(actor, amount, {source = null, tag = null} = {}) {
    if ( amount <= 0 || actor.downed ) return 0;
    let remaining = amount;
    const barrier = actor.statuses.get("barrier");
    if ( barrier?.pool ) {
      const result = absorb(remaining, barrier.pool);
      remaining = result.toHp;
      if ( result.broken ) actor.statuses.delete("barrier");
      else barrier.pool = result.pool;
    }
    if ( actor.kind === "company" ) {
      actor.strength = Math.max(actor.strength - remaining, 0);
      if ( actor.strength <= 0 ) { actor.routed = true; actor.downed = true; this.metrics.kills.push({id: actor.id, by: source?.id ?? null, kind: "rout"}); }
    }
    else {
      actor.hp = Math.max(actor.hp - remaining, 0);
      if ( actor.hp <= 0 ) {
        actor.downed = true;
        if ( (actor.kind === "character") && (actor.side === "party") ) this.metrics.downed++;
        this.metrics.kills.push({id: actor.id, by: source?.id ?? null, kind: actor.kind});
      }
    }
    if ( source ) this.metrics.damageBy[source.id] = (this.metrics.damageBy[source.id] ?? 0) + remaining;
    return remaining;
  }

  heal(actor, amount) {
    if ( actor.kind === "company" ) actor.strength = Math.min(actor.strength + amount, 100);
    else actor.hp = Math.min(actor.hp + amount, actor.hpMax);
  }

  distance(a, b) {
    if ( this.engine === "dungeon" ) return (a.row === b.row) ? 1 : 2;
    return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
  }

  unitOf(actor) {
    return {id: actor.id, actorId: actor.id, side: actor.side, x: actor.x, y: actor.y, row: actor.row, bonds: actor.bonds ?? [], kind: actor.kind, defeated: Boolean(actor.downed)};
  }

  bondPairs() {
    return activeBonds(this.alive().filter(a => a.kind === "character").map(a => this.unitOf(a)), this.engine);
  }

  refreshBonds(actor) {
    if ( actor.kind !== "character" ) return;
    const mine = bondsOf(actor.id, this.bondPairs());
    actor.extraModifiers = mine.modifiers;
    actor.bondRank = mine.rank;
  }

  reactors(exclude) {
    const pairs = this.bondPairs();
    return this.alive().filter(a => (a.id !== exclude.id) && (a.kind !== "company")).map(a => ({
      id: a.id, side: a.side, x: a.x, y: a.y, row: a.row, profile: profileOf(a), tilesMoved: a.tilesMoved ?? 0,
      reactions: (a.reactions ?? (a.moves ?? []).filter(m => m.type === "reaction")).map(data => ({id: data.identifier, name: data.name, data})),
      used: Boolean(a.reactionUsed), usedThisRound: a.reactionsThisRound ?? {},
      bonds: pairs.filter(p => (p.a === a.id) || (p.b === a.id)).map(p => ({partnerId: p.a === a.id ? p.b : p.a, rank: p.rank.id})),
      actor: a
    }));
  }

  runReactions(state, phase) {
    const attacker = state.attacker;
    const event = {
      phase, engine: this.engine, round: this.round,
      attacker: {id: attacker.id, side: attacker.side, x: attacker.x, y: attacker.y, row: attacker.row, profile: profileOf(attacker), tilesMoved: attacker.tilesMoved ?? 0, mounted: Boolean(attacker.derived?.classTypes?.includes("mounted"))},
      action: state.action,
      targets: state.targets.map(t => ({id: t.id, side: t.side, x: t.x, y: t.y, row: t.row, profile: profileOf(t), hit: state.results.get(t.id)?.anyHit ?? false, damage: state.results.get(t.id)?.total ?? 0, downed: (state.results.get(t.id)?.total ?? 0) >= (t.kind === "company" ? t.strength : t.hp), lethal: (state.results.get(t.id)?.total ?? 0) >= (t.kind === "company" ? t.strength : t.hp)}))
    };
    const reactors = this.reactors(attacker);
    const prompts = eligibleReactions({event, reactors});
    const accepted = [];
    for ( const prompt of prompts ) {
      const best = [...prompt.options].sort((a, b) => a.priority - b.priority)[0];
      if ( best ) accepted.push({reactorId: prompt.reactorId, abilityId: best.abilityId, priority: best.priority, order: 0, option: best});
    }
    for ( const entry of orderReactions(accepted) ) {
      const reactor = reactors.find(r => r.id === entry.reactorId)?.actor;
      if ( !reactor ) continue;
      this.resolveReaction(state, reactor, entry, phase);
      if ( state.cancelled ) break;
    }
  }

  resolveReaction(state, reactor, entry, phase) {
    const {option} = entry;
    const counts = reactor.reactionsThisRound ?? (reactor.reactionsThisRound = {});
    counts[entry.abilityId] = (counts[entry.abilityId] ?? 0) + 1;
    if ( entry.abilityId !== "dualStrike" ) reactor.reactionUsed = true;
    this.metrics.reactions[entry.abilityId] = (this.metrics.reactions[entry.abilityId] ?? 0) + 1;
    if ( entry.abilityId === "dualStrike" ) {
      const target = state.targets[0];
      if ( target ) {
        this.metrics.dualStrikes++;
        const sub = this.strike({attacker: reactor, target, ability: null, context: {mightBonus: DEICIDE.bonds.dualStrikeMight}});
        this.damage(target, sub.total, {source: reactor});
      }
      return;
    }
    const data = (reactor.reactions ?? reactor.moves ?? []).find(r => r.identifier === entry.abilityId);
    if ( !data ) return;
    const block = data.reaction ?? {};
    if ( block.cost?.channel ) {
      const paid = payChannel({cost: block.cost.channel, channel: reactor.channel ?? 0});
      reactor.channel = paid.channel;
      if ( paid.burn ) this.damage(reactor, paid.burn, {tag: "burn"});
    }
    if ( block.cost?.matter ) reactor.matter = Math.max((reactor.matter ?? 0) - block.cost.matter, 0);
    if ( (option.roll !== null) && (option.roll !== undefined) ) {
      if ( !rollUnder(this.roll(), option.roll) ) return;
    }
    const mods = fromSource(data.modifiers ?? [], data.identifier, data.name);
    if ( mods.length ) (state.targetModifiers[reactor.id] ??= []).push(...mods);
    const target = state.targets[0];
    const ctx = {
      actor: {id: reactor.id, profile: profileOf(reactor)}, attacker: {id: state.attacker.id, profile: profileOf(state.attacker)},
      targets: state.targets.map(t => ({id: t.id, profile: profileOf(t), hit: true, crit: false})), engine: this.engine, mode: this.mode, action: state.action,
      damage: state.results.get(reactor.id)?.total ?? state.results.get(target?.id)?.total ?? 0,
      scope: {casterMag: profileOf(state.attacker).attributes?.mag ?? 0}, situation: {trigger: option.trigger, distance: this.distance(reactor, state.attacker), selfTilesMoved: reactor.tilesMoved ?? 0},
      sourceId: data.identifier
    };
    for ( const outcome of resolveEffects(data.effects ?? [], ctx) ) {
      switch ( outcome.type ) {
        case "cancel":
          if ( outcome.effect?.when && !test(outcome.effect.when, {...ctx.situation, action: state.action, engine: this.engine}) ) break;
          state.cancelled = {by: reactor.id, ability: data.identifier};
          break;
        case "strikeFirst": {
          const sub = this.strike({attacker: reactor, target: state.attacker, ability: null, context: {}});
          this.damage(state.attacker, sub.total, {source: reactor});
          if ( state.attacker.downed ) state.cancelled = {by: reactor.id, ability: data.identifier, what: "attackerDowned"};
          break;
        }
        case "redirect":
          if ( outcome.to === "self" ) state.targets = [reactor];
          else if ( outcome.to === "attacker" ) state.targets = [state.attacker];
          break;
        case "absorb":
          for ( const id of outcome.targets ) state.absorbs[id] = (state.absorbs[id] ?? 0) + outcome.amount;
          break;
        case "counter": {
          const ability = outcome.abilityId ? (reactor.abilities ?? []).find(a => a.identifier === outcome.abilityId) ?? null : null;
          const sub = this.strike({attacker: reactor, target: state.attacker, ability, context: {mightBonus: outcome.might ?? 0}});
          this.damage(state.attacker, sub.total, {source: reactor});
          break;
        }
        case "survive":
          for ( const id of outcome.targets ) state.survivors.add(id);
          break;
        default:
          this.applyOutcome(outcome, reactor, state);
          break;
      }
    }
    if ( (phase === "after") && mods.length ) this.recompute(state, reactor);
  }

  targetProfile(state, target) {
    const base = profileOf(target);
    const extra = state.targetModifiers[target.id] ?? [];
    if ( !extra.length ) return base;
    const profile = {...base, modifiers: [...(base.modifiers ?? []), ...extra], defense: {...base.defense}};
    const sum = key => extra.filter(m => (m.key === key) && ((m.op ?? "add") === "add")).reduce((s, m) => s + Number(m.value), 0);
    profile.defense.def += sum("defense.def");
    profile.defense.res += sum("defense.res");
    profile.defense.avoid += sum("avoid");
    return profile;
  }

  strike({attacker, target, ability, context = {}, targetProfile = null}) {
    const weapon = attacker.weapon ?? null;
    const params = {attacker: profileOf(attacker), target: targetProfile ?? profileOf(target), weapon, ability, mode: this.mode, context: {...context, bondRank: attacker.bondRank ?? null}};
    const hit = hitChance(params);
    const crit = critChance(params);
    const result = damage(params);
    const count = strikeCount(params);
    const strikes = [];
    let total = 0;
    for ( let i = 0; i < count; i++ ) {
      const autoHit = Boolean(ability?.attack?.autoHit) || Boolean(context.autoHit);
      const hitRoll = autoHit ? null : this.roll();
      const didHit = autoHit || rollUnder(hitRoll, hit.chance);
      let didCrit = false;
      if ( didHit ) {
        if ( crit.chance >= 100 ) didCrit = true;
        else if ( crit.chance > 0 ) didCrit = rollUnder(this.roll(), crit.chance);
      }
      const dealt = didHit ? (didCrit ? result.critTotal : result.total) : 0;
      total += dealt;
      strikes.push({hit: didHit, crit: didCrit, damage: dealt});
    }
    return {hit, crit, result, strikes, total, anyHit: strikes.some(s => s.hit), anyCrit: strikes.some(s => s.crit)};
  }

  recompute(state, target) {
    const entry = state.results.get(target.id);
    if ( !entry ) return;
    const profile = this.targetProfile(state, target);
    const result = damage({attacker: profileOf(state.attacker), target: profile, weapon: state.attacker.weapon ?? null, ability: state.ability, mode: this.mode, context: state.context});
    let total = 0;
    for ( const strike of entry.strikes ) {
      strike.damage = strike.hit ? (strike.crit ? result.critTotal : result.total) : 0;
      total += strike.damage;
    }
    entry.total = total;
    entry.result = result;
  }

  useAbility({actor, ability = null, targets = [], context = {}, policy = {}}) {
    this.metrics.cards++;
    this.refreshBonds(actor);
    const state = {attacker: actor, ability, targets: [...targets], context: {...context}, results: new Map(), targetModifiers: {}, absorbs: {}, survivors: new Set(), cancelled: null, costs: {}};
    const weapon = actor.weapon ?? null;
    const action = describeAction(ability, weapon);
    state.action = {...action, tags: Array.from(action.tags), type: ability?.type ?? "action", area: ability?.war?.area ?? {shape: "single", size: 1}, range: ability?.war?.range ?? weapon?.range ?? [1, 1]};

    if ( ability && (actor.kind === "character") ) {
      const cost = ability.cost ?? {};
      if ( cost.channel ) {
        const extra = policy.overcast ?? 0;
        const paid = payChannel({cost: cost.channel + extra, channel: actor.channel, burnPerPoint: actor.derived.overcastBurnPerPoint});
        actor.channel = paid.channel;
        state.costs.channel = paid;
        if ( paid.overcast ) {
          actor.overcastPoints = (actor.overcastPoints ?? 0) + paid.overcast;
          if ( actor.derived.flags?.overcastMight ) state.context.overcastMight = paid.overcast * actor.derived.flags.overcastMight;
        }
        if ( paid.burn ) { actor.burn = (actor.burn ?? 0) + paid.burn; this.damage(actor, paid.burn, {tag: "burn"}); }
      }
      if ( cost.matter ) {
        if ( actor.matter < cost.matter ) return {cancelled: {what: "noMatter"}, results: state.results, costs: state.costs};
        actor.matter -= cost.matter;
      }
      if ( cost.hp ) this.damage(actor, cost.hp, {tag: "cost"});
      if ( cost.soulPrice ) {
        const multiplier = actor.derived.modifiers.find(m => m.key === "soulPrice.multiplier")?.value ?? 1;
        const price = soulPrice({price: cost.soulPrice, payer: actor.derived.soulPricePayer, catalyst: policy.catalyst ?? null, multiplier});
        if ( price.hp ) { actor.soulPriceHp = (actor.soulPriceHp ?? 0) + price.hp; this.damage(actor, price.hp, {tag: "soulPrice"}); }
        if ( price.channel ) actor.channel = Math.max(actor.channel - price.channel, 0);
        state.context.catalyst = price.catalyst;
      }
      if ( actor.downed ) return {cancelled: {what: "selfDowned"}, results: state.results, costs: state.costs};
    }
    const isAttack = ability ? Boolean(ability.attack) : Boolean(weapon && !weapon.caster);
    const isHeal = Boolean(ability?.heal);
    if ( isAttack && state.targets.length ) this.runReactions(state, "before");
    if ( state.cancelled ) return {cancelled: state.cancelled, results: state.results, costs: state.costs};

    for ( const target of state.targets ) {
      if ( isHeal ) {
        const amount = healAmount({formula: ability.heal.formula, healer: profileOf(actor), weapon: weapon?.healBonus ? weapon : null}).total;
        state.results.set(target.id, {heal: amount, strikes: [], total: 0});
        continue;
      }
      if ( isAttack ) {
        const strike = this.strike({attacker: actor, target, ability, context: state.context, targetProfile: this.targetProfile(state, target)});
        state.results.set(target.id, strike);
      }
    }
    if ( isAttack && state.targets.length ) this.runReactions(state, "after");

    for ( const target of state.targets ) {
      const entry = state.results.get(target.id);
      if ( !entry ) continue;
      if ( entry.heal ) { this.heal(target, entry.heal); continue; }
      let total = entry.total;
      const absorbed = state.absorbs[target.id] ?? 0;
      if ( absorbed ) total = Math.max(total - absorbed, 0);
      if ( state.survivors.has(target.id) && (total >= (target.hp ?? target.strength)) ) total = Math.max((target.hp ?? target.strength) - 1, 0);
      if ( total ) this.damage(target, total, {source: actor});
      if ( entry.anyHit ) {
        for ( const status of ability?.statuses ?? [] ) {
          if ( status.onCrit && !entry.anyCrit ) continue;
          this.applyStatus(status.target === "self" ? actor : target, status.id, {turns: status.turns ?? undefined});
        }
      }
    }
    if ( !state.targets.length ) {
      for ( const status of (ability?.statuses ?? []).filter(s => s.target === "self") ) this.applyStatus(actor, status.id, {turns: status.turns ?? undefined});
    }

    const effects = [...(ability?.effects ?? []), ...((ability?.type === "command") ? (ability.command?.effects ?? []) : [])];
    for ( const id of actor.derived?.skills?.active ?? [] ) {
      const data = (actor.abilities ?? []).find(a => a.identifier === id);
      for ( const effect of data?.effects ?? [] ) if ( effect.trigger === "ownAttack" && isAttack ) effects.push(effect);
    }
    if ( effects.length ) {
      const damageTotal = Array.from(state.results.values()).reduce((s, e) => s + (e.total ?? 0), 0);
      const ctx = {
        actor: {id: actor.id, profile: profileOf(actor)}, engine: this.engine, mode: this.mode, action: state.action,
        targets: state.targets.map(t => ({id: t.id, profile: profileOf(t), hit: state.results.get(t.id)?.anyHit ?? true, crit: state.results.get(t.id)?.anyCrit ?? false, damage: state.results.get(t.id)?.total ?? 0})),
        groups: this.groupsFor(actor, state.targets), damage: damageTotal, scope: {damage: damageTotal, saturation: actor.source?.saturation ?? 0},
        situation: {...state.context}, sourceId: ability?.identifier ?? "attack"
      };
      for ( const outcome of resolveEffects(effects, ctx) ) this.applyOutcome(outcome, actor, state);
    }
    if ( ability?.identifier ) actor.firedThisEncounter?.add(ability.identifier);
    return {cancelled: null, results: state.results, costs: state.costs};
  }

  groupsFor(actor, targets) {
    const allies = this.alive(actor.side).filter(a => a.id !== actor.id);
    const enemies = this.alive().filter(a => a.side !== actor.side);
    const row = targets[0] ? this.alive(targets[0].side).filter(a => a.row === targets[0].row).map(a => a.id) : [];
    return {
      allies: allies.map(a => a.id), enemies: enemies.map(a => a.id),
      alliesInRadius: allies.filter(a => this.distance(a, actor) <= (actor.derived?.commandRadius ?? 1)).map(a => a.id),
      companies: allies.filter(a => (a.kind === "company") && (this.distance(a, actor) <= (actor.derived?.commandRadius ?? 0))).map(a => a.id),
      row, radius: targets.length ? targets.map(t => t.id) : enemies.filter(a => this.distance(a, actor) <= 1).map(a => a.id)
    };
  }

  byId(id) { return this.actors.find(a => a.id === id) ?? null; }

  applyOutcome(outcome, source, state = null) {
    const targets = (outcome.targets ?? []).map(id => this.byId(id)).filter(Boolean);
    switch ( outcome.type ) {
      case "applyStatus":
        for ( const t of targets ) this.applyStatus(t, outcome.statusId, {turns: outcome.turns ?? undefined, pool: outcome.pool, modifiers: outcome.modifiers, flags: outcome.flags, expires: outcome.expires === "phase" ? {kind: "phase", round: this.round, phase: this.phase} : outcome.expires === "round" ? {kind: "round", round: this.round} : null});
        break;
      case "removeStatus":
        for ( const t of targets ) this.removeStatus(t, outcome.statusId);
        break;
      case "damage":
        for ( const entry of outcome.entries ?? [] ) { const t = this.byId(entry.id); if ( t ) this.damage(t, entry.amount, {source}); }
        break;
      case "heal":
        for ( const t of targets ) this.heal(t, outcome.amount);
        break;
      case "pool":
        for ( const t of targets ) {
          if ( typeof outcome.delta !== "number" ) continue;
          if ( outcome.key === "channel" ) t.channel = Math.min(Math.max((t.channel ?? 0) + outcome.delta, 0), t.channelMax ?? Infinity);
          else if ( outcome.key === "matter" ) t.matter = Math.min(Math.max((t.matter ?? 0) + outcome.delta, 0), t.matterMax ?? Infinity);
          else if ( outcome.key === "hp" ) this.heal(t, outcome.delta);
          else if ( outcome.key === "strength" ) t.strength = outcome.effect?.op === "set" ? outcome.delta : Math.min(Math.max(t.strength + outcome.delta, 0), 100);
        }
        break;
      case "move":
        for ( const t of targets ) {
          if ( (outcome.mode === "swapRow") && !(t.derived?.flags?.cannotSwapRow || t.derived?.flags?.immovable || t.derived?.immunities?.includes("rowSwap")) ) t.row = t.row === "front" ? "back" : "front";
          else if ( ["push", "pull"].includes(outcome.mode) && (this.engine === "war") && !(t.derived?.flags?.immovable) ) {
            const dx = Math.sign(t.x - source.x), dy = Math.sign(t.y - source.y);
            const sign = outcome.mode === "push" ? 1 : -1;
            t.x += sign * dx * (outcome.tiles ?? 1); t.y += sign * dy * (outcome.tiles ?? 1);
          }
        }
        break;
      case "barrier":
        if ( this.engine === "dungeon" ) {
          for ( const ally of this.alive(source.side).filter(a => a.row === (outcome.row ?? "front")) ) this.applyStatus(ally, "barrier", {pool: outcome.pool});
        }
        break;
      case "grantAction":
        for ( const t of targets ) { t.activations = (t.activations ?? 0) + (outcome.count ?? 1); t.acted = false; }
        break;
      case "refundAction":
        if ( outcome.granted ) { source.acted = false; source.refunded = (source.refunded ?? 0) + 1; }
        break;
      case "survive":
        for ( const t of targets ) if ( t.downed ) { t.downed = false; t.hp = outcome.hp ?? 1; }
        break;
      case "revive":
        for ( const t of targets ) if ( t.downed ) { t.downed = false; t.hp = Math.max(Math.floor(t.hpMax * (outcome.fraction ?? 0.25)), 1); }
        break;
      default:
        break;
    }
  }

  dungeonProfile(actor, ability) {
    return dungeonProfile(ability, {weapon: actor.weapon, mag: profileOf(actor).attributes?.mag ?? 0});
  }

  companyAttack(company, target, {charge = false} = {}) {
    this.metrics.cards++;
    const targetKind = target.kind === "company" ? "company" : "character";
    const profile = profileOf(target);
    const orders = Array.from(company.statuses.values()).flatMap(s => s.modifiers ?? []);
    const sum = key => orders.filter(m => (m.key === key) && !m.when).reduce((s, m) => s + Number(m.value), 0);
    const quality = Math.min(Math.max(company.quality + sum("quality"), 1), 5);
    const hit = companyHit({quality, targetSpd: profile.attributes?.spd ?? 0, targetAvoid: profile.defense?.avoid ?? 0, bonus: sum("hit")});
    const dmg = companyDamage({attacker: {...company, quality}, target: targetKind === "company" ? target : profile, targetKind, charge, mightBonus: sum("might")});
    const strikes = 1 + sum("strikes");
    let total = 0;
    for ( let i = 0; i < strikes; i++ ) if ( rollUnder(this.roll(), hit) ) total += dmg.total;
    if ( total ) this.damage(target, total, {source: company});
    return {hit, total, damage: dmg};
  }
}
