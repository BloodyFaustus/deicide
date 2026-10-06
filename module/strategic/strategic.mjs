import {DEICIDE} from "../config.mjs";
import {evaluate} from "../core/expression.mjs";
import {d100} from "../core/random.mjs";
import {encounterAwards} from "../rules/pacing.mjs";
import {formatCp} from "../rules/growth.mjs";

function logEntry(nation, text, changes = {}) {
  return [...nation.system.log.map(entry => entry.toObject?.() ?? entry), {month: nation.system.warMonth, text, changes}];
}

export async function applyScenarioPayout(page, {victory = true} = {}) {
  const nation = game.deicide.nation.actor;
  if ( !nation ) { ui.notifications.warn("No Nation actor exists."); return false; }
  const system = page.system;
  if ( system.payout.applied ) { ui.notifications.info("This card's payout is already applied."); return false; }
  const changes = victory ? {...system.payout.tracks} : {...DEICIDE.payouts.warDefeat};
  const lines = Object.entries(changes).map(([track, delta]) => `${game.i18n.localize(DEICIDE.nationTracks[track]?.label ?? track)} ${delta > 0 ? "+" : ""}${delta}`);
  if ( victory && system.payout.dust ) lines.push(`${system.payout.dust} Dust to the Nation reserve`);
  if ( victory && system.payout.drops.length ) lines.push(`drops: ${system.payout.drops.join(", ")}`);
  const ok = await foundry.applications.api.DialogV2.confirm({
    window: {title: `${page.parent?.name ?? page.name}: ${victory ? "payout" : "defeat"}`},
    content: `<p>Apply to ${nation.name}?</p><ul>${lines.map(line => `<li>${line}</li>`).join("")}</ul>`
  });
  if ( !ok ) return false;
  const update = {};
  for ( const [track, delta] of Object.entries(changes) ) {
    if ( !(track in DEICIDE.nationTracks) ) continue;
    update[`system.tracks.${track}`] = Math.min(Math.max(nation.system.tracks[track] + delta, DEICIDE.trackRange.min), DEICIDE.trackRange.max);
  }
  if ( victory && system.payout.dust ) update["system.dust"] = nation.system.dust + system.payout.dust;
  update["system.log"] = logEntry(nation, `${page.parent?.name ?? page.name}: ${victory ? "payout" : "defeat"}. ${lines.join(", ")}.`, changes);
  await nation.update(update);
  await page.update({"system.payout.applied": true});
  Hooks.callAll("deicide.payoutApplied", page, nation, changes);
  return true;
}

export async function resolveVentures(nation, {force = false} = {}) {
  const config = DEICIDE.economy.ventures;
  const ventures = nation.system.ventures.map(v => v.toObject?.() ?? v);
  let dust = nation.system.dust;
  const tracks = {...nation.system.tracks};
  const standing = {};
  let log = nation.system.log.map(entry => entry.toObject?.() ?? entry);
  let changed = false;
  for ( const venture of ventures ) {
    if ( venture.resolved ) continue;
    if ( !force && (nation.system.warMonth < venture.startMonth + config.months) ) continue;
    const type = config.types[venture.type];
    const roll = d100(() => CONFIG.Dice.randomUniform());
    const total = evaluate(config.rollFormula, {roll, track: tracks[type.track] ?? 0});
    const band = config.bands.find(entry => (entry.max === null) || (total <= entry.max));
    const outcome = type[band.result] ?? {};
    dust += outcome.dust ?? 0;
    for ( const [track, delta] of Object.entries(outcome.tracks ?? {}) ) tracks[track] = Math.min(Math.max(tracks[track] + delta, 0), 10);
    for ( const [faction, delta] of Object.entries(outcome.standing ?? {}) ) standing[faction] = (standing[faction] ?? 0) + delta;
    venture.resolved = true;
    venture.result = `d100 ${roll} + ${5 * (tracks[type.track] ?? 0)} = ${total}: ${band.result}${outcome.dust ? `, ${outcome.dust} Dust` : ""}${outcome.namedRumor ? ", a Named rumor" : ""}`;
    log = [...log, {month: nation.system.warMonth, text: `Venture ${venture.type}: ${venture.result}.`, changes: outcome.tracks ?? {}}];
    changed = true;
  }
  if ( !changed ) return 0;
  await nation.update({"system.ventures": ventures, "system.dust": dust, "system.tracks": tracks, "system.log": log});
  if ( Object.keys(standing).length ) {
    ui.notifications.warn(`Venture Standing changes to apply by hand: ${Object.entries(standing).map(([f, d]) => `${f} ${d}`).join(", ")}.`);
  }
  return ventures.filter(v => v.resolved).length;
}

export async function tickDebts(nation) {
  const perSession = DEICIDE.economy.debt.perSession;
  const debts = nation.system.debts.map(d => d.toObject?.() ?? d);
  const lines = [];
  for ( const debt of debts ) {
    if ( debt.amount <= 0 ) continue;
    const debtor = game.actors.get(debt.debtorId);
    const payment = Math.min(perSession, debt.amount, debtor?.system.dust ?? 0);
    if ( debtor && payment > 0 ) {
      await debtor.update({"system.dust": debtor.system.dust - payment, "system.debt": Math.max(debtor.system.debt - payment, 0)});
      debt.amount -= payment;
      lines.push(`${debtor.name} pays ${payment}`);
    }
    else if ( debtor ) lines.push(`${debtor.name} cannot pay`);
  }
  await nation.update({"system.debts": debts.filter(d => d.amount > 0), "system.log": logEntry(nation, `Debts: ${lines.join(", ") || "nothing due"}.`)});
}

export async function awardEncounter(actors, {kind, enemyTier = 1, difficulty = "standard"}) {
  const dials = game.deicide.nation.dials;
  const partyLevel = Math.max(...actors.filter(a => a.system.recruit?.story || !a.system.recruit?.profile).map(a => a.system.level), 1);
  const lines = [];
  for ( const actor of actors ) {
    if ( actor.type !== "character" ) continue;
    const awards = encounterAwards({kind, level: actor.system.level, enemyTier, difficulty, dials});
    const multiplier = game.deicide.rules.pacing.catchUpMultiplier(actor.system.level, partyLevel);
    const status = actor.system.recruit.status;
    const statusMultiplier = status === "attached" ? DEICIDE.xp.attachedMultiplier : 1;
    const xp = Math.round(awards.xp * multiplier * statusMultiplier);
    const cp100 = status === "attached" ? 0 : awards.cp100;
    await actor.update({"system.dust": actor.system.dust + awards.dust});
    const levels = xp ? await actor.awardXp(xp) : 0;
    if ( cp100 ) await actor.awardCp(cp100);
    lines.push(`${actor.name}: ${xp} XP${levels ? ` (+${levels} level${levels > 1 ? "s" : ""})` : ""}, ${formatCp(cp100)} CP, ${awards.dust} Dust`);
  }
  await ChatMessage.implementation.create({content: `<div class="deicide-card awards"><h3>Awards (${kind}, P ${game.deicide.nation.P.toFixed(2)})</h3><ul>${lines.map(l => `<li>${l}</li>`).join("")}</ul></div>`, speaker: {alias: "Deicide"}});
  return lines;
}

export function checkDeployment({sheets = 0, sworn = 0, companies = 0, mode = "war"}) {
  const nation = game.deicide.nation;
  const N = nation.dials.N;
  const tracks = nation.tracks ?? {};
  const warnings = [];
  const limits = {
    sheets: N,
    sworn: mode === "war" ? evaluate(DEICIDE.nationFormulas.swornSlotsWar, tracks) : DEICIDE.deployment.dungeon.swornSlots,
    companies: mode === "war" ? evaluate(DEICIDE.nationFormulas.companiesPerBattle, tracks) : 0,
    stage: mode === "war" ? null : game.deicide.rules.pacing.stageCapacity(N)
  };
  if ( sheets > limits.sheets ) warnings.push(`${sheets} sheets deployed, N is ${limits.sheets}.`);
  if ( sworn > limits.sworn ) warnings.push(`${sworn} Sworn deployed, the limit is ${limits.sworn}.`);
  if ( (mode === "war") && (companies > limits.companies) ) warnings.push(`${companies} companies, the limit is ${limits.companies}.`);
  if ( limits.stage && (sheets + sworn > limits.stage) ) warnings.push(`${sheets + sworn} on stage, the stage holds ${limits.stage}.`);
  return {ok: warnings.length === 0, warnings, limits};
}

export async function rest(actors, kind) {
  const table = DEICIDE.rest[kind];
  if ( !table ) throw new Error(`Unknown rest "${kind}"`);
  const lines = [];
  for ( const actor of actors ) {
    if ( actor.type !== "character" ) continue;
    const system = actor.system;
    const derived = actor.derived;
    const update = {};
    if ( table.hp !== null ) update["system.hp.value"] = Math.min(system.hp.max, system.hp.value + Math.floor(system.hp.max * table.hp));
    if ( (table.channel !== null) && !derived.noChannel ) update["system.channel.value"] = Math.min(system.channel.max, system.channel.value + Math.floor(system.channel.max * table.channel));
    if ( (table.matter !== null) && derived.matter ) update["system.matter.value"] = system.matter.max;
    if ( table.manaburn && derived.tracksManaburn && (system.manaburn !== null) ) {
      const flags = derived.flags ?? {};
      const recovery = flags.manaburnLongRest ?? Math.abs(table.manaburn);
      update["system.manaburn"] = Math.max(system.manaburn - recovery, 0);
    }
    await actor.update(update);

    for ( const effect of [...actor.effects] ) {
      if ( effect.type !== "status" ) continue;
      const id = effect.system.statusId;
      const clears = table.clears === "all" ? !(table.keeps ?? []).includes(id) : (table.clears ?? []).includes(id);
      if ( clears ) await effect.delete();
    }
    lines.push(actor.name);
  }
  const nation = game.deicide.nation.actor;
  if ( nation && table.warClockWeeks ) {
    let week = nation.system.warWeek + table.warClockWeeks;
    let month = nation.system.warMonth;
    while ( week > DEICIDE.warClock.weeksPerMonth ) { week -= DEICIDE.warClock.weeksPerMonth; month = Math.min(month + 1, DEICIDE.warClock.months); }
    const monthChanged = month !== nation.system.warMonth;
    await nation.update({"system.warWeek": week, "system.warMonth": month, "system.log": logEntry(nation, `${kind} rest: +${table.warClockWeeks} week${monthChanged ? `, month ${month} begins` : ""}.`)});
    if ( monthChanged ) await resolveVentures(nation);
  }
  await ChatMessage.implementation.create({content: `<div class="deicide-card rest"><h3>${kind} rest</h3><p>${lines.join(", ")}.${table.belt ? " Belts refilled by hand." : ""}</p></div>`, speaker: {alias: "Deicide"}});
}

export const strategic = {applyScenarioPayout, resolveVentures, tickDebts, awardEncounter, checkDeployment, rest};
