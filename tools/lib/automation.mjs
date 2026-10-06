export function clausesOf(text) {
  return String(text ?? "").split(/,\s*|\.\s+/).map(clause => clause.trim().replace(/\.$/, "")).filter(Boolean);
}

const has = {
  attack: s => Boolean(s.attack),
  heal: s => Boolean(s.heal),
  weight: s => typeof s.weight === "number",
  channel: s => (s.cost?.channel ?? 0) > 0,
  matter: s => (s.cost?.matter ?? 0) > 0,
  hp: s => (s.cost?.hp ?? 0) > 0,
  dust: s => (s.cost?.dust ?? 0) > 0,
  soulPrice: s => (s.cost?.soulPrice ?? 0) > 0,
  range: s => Array.isArray(s.war?.range) || (s.attack?.range !== undefined && s.attack?.range !== null),
  area: s => Boolean(s.war?.area) && (s.war.area.shape !== "single"),
  movement: s => Boolean(s.war?.movement) || effectsOf(s).some(kind => kind === "move"),
  statuses: s => (s.statuses?.length ?? 0) > 0 || effectsOf(s).some(kind => ["applyStatus", "removeStatus"].includes(kind)),
  usage: s => Boolean(s.usage?.limit),
  modifiers: s => (s.modifiers?.length ?? 0) > 0 || (s.stance?.modifiers?.length ?? 0) > 0,
  bonuses: s => (s.attack?.bonuses?.length ?? 0) > 0 || (s.modifiers?.some(m => m.when) ?? false) || Boolean(s.attack?.effectiveVs) || Boolean(s.attack?.multiplierVs),
  roll: s => Boolean(s.roll?.formula) || Boolean(s.reaction?.roll),
  reaction: s => Boolean(s.reaction?.trigger) && (effectsOf(s).length > 0 || (s.modifiers?.length ?? 0) > 0 || Boolean(s.attack) || Boolean(s.heal) || (s.statuses?.length ?? 0) > 0),
  command: s => Boolean(s.command?.target) && ((s.command.effects?.length ?? 0) > 0),
  stance: s => Boolean(s.stance) && (((s.stance.modifiers?.length ?? 0) > 0) || ((s.stance.effects?.length ?? 0) > 0)),
  effects: s => effectsOf(s).length > 0,
  effectKind: kind => s => effectsOf(s).includes(kind),
  anyEffectKind: kinds => s => effectsOf(s).some(kind => kinds.includes(kind)),
  crit: s => (s.attack?.crit ?? 0) !== 0 || (s.modifiers?.some(m => m.key === "crit" || m.key === "critMultiplier") ?? false),
  strikes: s => (s.attack?.strikes ?? 1) > 1,
  ignoreDef: s => (s.attack?.ignoreDef ?? 0) > 0 || Boolean(s.attack?.ignoreAvoid) || Boolean(s.attack?.ignoreTerrainAvoid) || Boolean(s.attack?.ignoreDivineResistance) || Boolean(s.attack?.ignoreWarded),
  perTile: s => Boolean(s.attack?.perTile),
  terrain: s => Boolean(s.war?.terrain) || effectsOf(s).some(kind => kind === "terrain"),
  dungeon: s => Boolean(s.dungeon)
};

function effectsOf(system) {
  const list = [...(system.effects ?? []), ...(system.stance?.effects ?? []), ...(system.command?.effects ?? [])];
  return list.map(effect => effect.kind);
}

export const CLAUSE_RULES = [
  [/\bM\d+\b/i, s => has.attack(s)],
  [/^heal\b|\bheal(s|ing)? \d|\bheal (MAG|SKL)/i, s => has.heal(s) || has.effectKind("heal")(s)],
  [/\bW\d+\b/i, s => has.weight(s)],
  [/\bWeight \d+\b/i, s => has.weight(s)],

  [/\b(sword|axe|lance|bow|gun|tome|relic|gauntlet)\b( at \w+ or better)?$/i, s => Boolean(s.art)],
  [/\bat (iron|steel|silver|royal|named) or better\b/i, s => Boolean(s.art)],
  [/\bAccuracy \+\d+/i, s => (s.attack?.hit ?? 0) !== 0],
  [/\bSpell Might \+\d+/i, s => (s.art?.spellMight ?? 0) > 0],
  [/\b0 Channel\b/i, s => s.cost?.channel === 0 && Boolean(s.art)],
  [/heal becomes a row heal/i, s => (s.art?.rowHealFraction ?? 0) > 0],
  [/next transmutation costs 0 Matter/i, s => s.art?.nextMatterCost === 0],
  [/target DEF -\d+ for \d+ turns/i, s => Boolean(s.art?.targetDef) || Boolean(s.attack?.targetDef)],
  [/\bcannot\b|\bimmune\b|\bimmunity\b|\bno penalty\b|\bignoring\b/i, s => has.anyEffectKind(["flag", "applyStatus"])(s) || has.modifiers(s)],
  [/\b(Channel|HP|Might|Move|Avoid|Hit|DEF|RES) \+(MAG|SKL|STR|DEF|RES|SPD|CMD)\b/i, s => has.modifiers(s)],
  [/Harvest yields \d/i, s => has.modifiers(s)],
  [/trains at primary pace/i, s => has.modifiers(s)],
  [/take the hit|take it\b|\btakes? it\b/i, s => has.anyEffectKind(["redirect", "flag"])(s) || has.modifiers(s)],
  [/\b\d+ Ch\b/, s => has.channel(s)],
  [/\b\d+ Mt\b/, s => has.matter(s) || (s.cost?.matter === 0 && has.effects(s))],
  [/\bSP \d+/, s => has.soulPrice(s)],
  [/costs? \d+ HP|\d+ HP\b/i, s => has.hp(s) || has.modifiers(s)],
  [/\b\d+ Dust\b/i, s => has.dust(s) || has.effectKind("pool")(s)],
  [/\brange \d+( to \d+)?/i, s => has.range(s) || has.modifiers(s)],
  [/\b(blast|line|radius) \d+|\ball enemies\b|\bone row\b|\bthe row\b/i, s => has.area(s) || has.effects(s) || has.dungeon(s)],
  [/\bMove 0\b/i, s => has.statuses(s) || has.effects(s) || has.modifiers(s)],
  [/Divine Attention \+\d/i, s => has.effectKind("pool")(s)],
  [/\b(push|pull|teleport|retreat|swap row|row swap|force row swap|move \d|carry|Canto|reposition|move through)\b/i, s => has.movement(s) || has.effectKind("move")(s) || has.dungeon(s)],
  [/\b(Pinned|Stagger|Poison|Silenced|Warded|Marked|Thrall|Burn ticks|Crystalline|Downed|statuses?)\b/i, s => has.statuses(s) || has.effects(s)],
  [/once per (encounter|battle|round|session|campaign|dungeon|target)/i, s => has.usage(s) || has.reaction(s) || has.effects(s)],
  [/d100 under/i, s => has.roll(s)],
  [/\bcrit\b/i, s => has.crit(s) || has.attack(s) || has.command(s)],
  [/\btwice\b/i, s => has.strikes(s) || has.command(s) || has.effects(s)],
  [/\bignores?\b/i, s => has.ignoreDef(s) || has.modifiers(s) || has.effects(s) || has.attack(s)],
  [/per (tile|2 tiles)|max \+\d+/i, s => has.perTile(s)],
  [/\+\d+ (Might )?vs\b|x2 vs|x1\.5 vs|Officer tag/i, s => has.bonuses(s) || has.command(s)],
  [/\btakes? (MAG|SKL|STR|\d+)/i, s => has.anyEffectKind(["damage", "absorb"])(s)],
  [/\bMove 0\b/i, s => has.statuses(s) || has.effects(s) || has.modifiers(s)],
  [/\b(Fortifications|Weapons|Dust|Soldiers|Officers|Navy|Legitimacy|Intelligence|Magical|Allies) (track )?\+\d/i, s => has.effectKind("nationTrack")(s)],
  [/\b(DEF|RES|STR|MAG|SKL|SPD|CMD|Hit|Avoid|Might|Channel|Move|Delay|HP|Matter capacity|command radius|crit multiplier|range|Quality|Strength) (\+|minus |x)\d/i, s => has.modifiers(s) || has.effects(s) || has.command(s) || has.attack(s)],
  [/\bcompan(y|ies)\b|\bships?\b/i, s => has.command(s) || has.effects(s) || has.bonuses(s)],
  [/\bsummon\b|\bcompany Strength\b/i, s => has.effectKind("summon")(s)],
  [/\bWall\b|\bBarrier\b|\bFort\b|\btile\b|\bplague zone\b|\bbecomes Road\b/i, s => has.terrain(s) || has.anyEffectKind(["cancel", "applyStatus", "terrain"])(s) || has.dungeon(s)],
  [/\bcancel/i, s => has.effectKind("cancel")(s)],
  [/\bstrike first\b|\bfree attack\b|\bshoot back\b|\bcounter\b|\bfree volley\b|\bresolves against\b/i, s => has.anyEffectKind(["strikeFirst", "damage", "counter", "redirect"])(s) || has.attack(s)],
  [/\breveal\b|\bsee HP\b|\blearn\b|\bshown\b|\bline of sight\b/i, s => has.effectKind("reveal")(s)],
  [/\btrack \+\d/i, s => has.effectKind("nationTrack")(s)],
  [/Standing \+\d|Standing minus \d/i, s => has.effectKind("standing")(s)],
  [/\bacts? again\b|\bact twice\b|\brefunds?\b|\bfree action\b/i, s => has.anyEffectKind(["grantAction", "refundAction"])(s)],
  [/\bsteal|\bstores? it\b|\bslots?\b/i, s => has.effectKind("pool")(s) || has.modifiers(s)],
  [/\babsorb/i, s => has.anyEffectKind(["applyStatus", "damage", "absorb", "terrain"])(s) || has.modifiers(s) || has.dungeon(s)],
  [/\bremove\b|\bdestroy/i, s => has.anyEffectKind(["removeStatus", "cancel", "terrain", "flag"])(s)],
  [/\bsurvive\b|\bstays at 1 HP\b|\bthey live\b|\brevive\b/i, s => has.anyEffectKind(["heal", "flag"])(s)],
  [/\bretroactive\b/i, () => true],
  [/\bdamage halved\b|\breduced by\b|\breduces damage\b|\bdamage against you halved\b|take it\b|\btakes? it\b|\bx0\.75\b/i, s => has.modifiers(s) || has.anyEffectKind(["flag", "damage", "heal"])(s)],
  [/\bheals? (you|self)\b|\bhealed\b|\brestores? \d/i, s => has.anyEffectKind(["heal", "pool"])(s)],
  [/\bgain \d|\bgains? \d/i, s => has.anyEffectKind(["pool", "flag"])(s)]
];

export function gradeAutomation(system) {
  const clauses = clausesOf(system.summary);
  const coverage = (system.coverage ?? []).map(pattern => new RegExp(pattern, "i"));
  const covered = [];
  const uncovered = [];
  clauses.forEach((clause, index) => {
    let ok = coverage.some(pattern => pattern.test(clause));

    if ( !ok && (index === 0) && (system.type === "reaction") && has.reaction(system) ) ok = true;
    if ( !ok ) {
      const rule = CLAUSE_RULES.find(([pattern]) => pattern.test(clause));
      ok = rule ? rule[1](system) : false;
    }
    (ok ? covered : uncovered).push(clause);
  });
  const skeleton = has.attack(system) || has.heal(system) || has.modifiers(system) || has.effects(system)
    || has.stance(system) || has.command(system) || has.reaction(system) || has.statuses(system) || has.movement(system)
    || has.terrain(system) || Boolean(system.art);
  let automation = "manual";
  if ( clauses.length && (uncovered.length === 0) && skeleton ) automation = "full";
  else if ( skeleton && covered.length ) automation = "partial";
  return {automation, clauses, covered, uncovered};
}
