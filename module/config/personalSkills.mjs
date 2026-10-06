const skill = (id, name, type, summary, data = {}) => ({
  id, name, type, summary,
  modifiers: data.modifiers ?? [],
  effects: data.effects ?? [],
  reaction: data.reaction ?? null,
  coverage: data.coverage ?? [],
  attack: data.attack ?? null,
  war: data.war ?? null,
  dungeon: data.dungeon ?? null,
  statuses: data.statuses ?? [],
  weight: data.weight ?? null,
  usage: data.usage ?? {limit: null, per: null, used: 0}
});

export const named = {
  hardLine: skill("personalHardLine", "Hard Line", "support", "Hold the Line also grants Avoid +5 to companies in radius this phase",
    {modifiers: [{key: "avoid", value: 5, when: {status: "formed"}}], coverage: ["Avoid \\+5"]}),
  oldGuard: skill("personalOldGuard", "Old Guard", "support", "companies in radius ignore the first rout check of the battle",
    {effects: [{kind: "flag", key: "ignoreFirstMorale", value: true, target: "companiesInRadius"}], coverage: ["ignore the first rout"]}),
  publicTrust: skill("personalPublicTrust", "Public Trust", "support", "Standing losses from Marks and Divine Attention are halved while she is Sworn",
    {effects: [{kind: "flag", key: "standingLossHalved", value: true}], coverage: ["Standing losses"]}),
  tracker: skill("personalTracker", "Tracker", "support", "Ambush fires at range 4",
    {modifiers: [{key: "reaction.range", value: 1, when: {ability: "rangerAmbush"}}], coverage: ["Ambush"]}),
  lamplighter: skill("personalLamplighter", "Lamplighter", "support", "a row behind a Barrier also gains Avoid +5",
    {modifiers: [{key: "avoid", value: 5, when: {behindBarrier: true}}], coverage: ["Avoid \\+5"]}),
  dockhand: skill("personalDockhand", "Dockhand", "support", "Resupply costs half",
    {effects: [{kind: "flag", key: "resupplyHalf", value: true}], coverage: ["Resupply"]}),
  huntersPatience: skill("personalHuntersPatience", "Hunter's Patience", "support", "Off Map works from any edge on round 1",
    {effects: [{kind: "flag", key: "offMapAnyEdge", value: true}], coverage: ["Off Map"]})
};

export const pools = {
  soldier: [
    skill("personalShieldBrother", "Shield Brother", "support", "an adjacent ally gains DEF +1", {modifiers: [{key: "defense.def", value: 1, target: "adjacentAllies"}], coverage: ["DEF \\+1"]}),
    skill("personalLongMarch", "Long March", "support", "Move +1 on roads", {modifiers: [{key: "move", value: 1, when: {terrain: "road"}}], coverage: ["Move \\+1"]}),
    skill("personalIronStomach", "Iron Stomach", "support", "immune to Poison", {modifiers: [{key: "immune", value: "poison"}], coverage: ["immune"]})
  ],
  scout: [
    skill("personalFarSight", "Far Sight", "support", "reveals one more tile of fog each turn", {effects: [{kind: "reveal", radius: 1}], coverage: ["reveals"]}),
    skill("personalLightStep", "Light Step", "support", "Avoid +5 after moving 3 or more tiles", {modifiers: [{key: "avoid", value: 5, when: {tilesMovedThisTurn: 3}}], coverage: ["Avoid \\+5"]}),
    skill("personalSteadyHand", "Steady Hand", "support", "Hit +5 with bows", {modifiers: [{key: "hit", value: 5, when: {weaponLine: "bow"}}], coverage: ["Hit \\+5"]})
  ],
  adept: [
    skill("personalBookworm", "Bookworm", "support", "Channel +2", {modifiers: [{key: "channel.max", value: 2}], coverage: ["Channel \\+2"]}),
    skill("personalColdFocus", "Cold Focus", "support", "frost spells Might +1", {modifiers: [{key: "might", value: 1, when: {elementTag: "frost"}}], coverage: ["Might \\+1"]}),
    skill("personalQuickStudy", "Quick Study", "support", "Reason trains at primary pace", {modifiers: [{key: "proficiency.pace.reason", value: 1}], coverage: ["trains at primary pace"]})
  ],
  acolyte: [
    skill("personalKindHands", "Kind Hands", "support", "heals +2", {modifiers: [{key: "heal", value: 2}], coverage: ["heals \\+2"]}),
    skill("personalVigil", "Vigil", "support", "RES +1 at night", {modifiers: [{key: "defense.res", value: 1, when: {night: true}}], coverage: ["RES \\+1"]}),
    skill("personalLastRites", "Last Rites", "support", "a Downed ally adjacent to you keeps 1 HP once per battle", {effects: [{kind: "survive", target: "adjacentAlly", hp: 1, once: "battle"}], coverage: ["keeps 1 HP"]})
  ],
  rogue: [
    skill("personalPickpocket", "Pickpocket", "support", "the party gains 2 Dust after each battle you survive", {effects: [{kind: "standing", dust: 2, when: "battleEnd"}], coverage: ["2 Dust"]}),
    skill("personalBackAlley", "Back Alley", "support", "Crit +5 from the flank", {modifiers: [{key: "crit", value: 5, when: {fromFlank: true}}], coverage: ["Crit \\+5"]}),
    skill("personalSoftFeet", "Soft Feet", "support", "ignores difficult terrain cost on the first tile", {modifiers: [{key: "move", value: 1, when: {terrain: "difficult"}}], coverage: ["terrain"]})
  ],
  cadet: [
    skill("personalDrillVoice", "Drill Voice", "support", "command radius +1 in the first round", {modifiers: [{key: "commandRadius", value: 1, when: {round: 1}}], coverage: ["command radius \\+1"]}),
    skill("personalBannerPride", "Banner Pride", "support", "companies in radius morale +5", {modifiers: [{key: "company.morale", value: 5, target: "companiesInRadius"}], coverage: ["morale \\+5"]}),
    skill("personalFamilyName", "Family Name", "support", "Crown Standing +5 on recruitment", {effects: [{kind: "standing", faction: "crown", delta: 5, once: true}], coverage: ["Standing \\+5"]})
  ],
  mariner: [
    skill("personalSeaLegs", "Sea Legs", "support", "no Avoid penalty on a deck", {modifiers: [{key: "avoid", value: 5, when: {mode: "naval"}}], coverage: ["deck"]}),
    skill("personalKnotwork", "Knotwork", "support", "boarding actions Weight minus 2", {modifiers: [{key: "weight", value: -2, when: {mode: "naval"}}], coverage: ["Weight minus 2"]}),
    skill("personalSaltBlood", "Salt Blood", "support", "immune to Water", {modifiers: [{key: "immune", value: "water"}], coverage: ["immune"]})
  ],
  rider: [
    skill("personalHorseWhisper", "Horse Whisper", "support", "Canto +1 tile", {modifiers: [{key: "canto", value: 1}], coverage: ["Canto"]}),
    skill("personalCourierBlood", "Courier Blood", "support", "Move +1 on plains", {modifiers: [{key: "move", value: 1, when: {terrain: "plain"}}], coverage: ["Move \\+1"]}),
    skill("personalLanceDrill", "Lance Drill", "support", "Hit +5 on a charge", {modifiers: [{key: "hit", value: 5, when: {charge: true}}], coverage: ["Hit \\+5"]})
  ],
  alchemist: [
    skill("personalScrapHoarder", "Scrap Hoarder", "support", "Matter cap +2", {modifiers: [{key: "matter.max", value: 2}], coverage: ["Matter cap \\+2"]}),
    skill("personalFieldKit", "Field Kit", "support", "Harvest yields +1 on metal", {modifiers: [{key: "harvest.yield", value: 1, when: {surface: "metal"}}], coverage: ["Harvest"]}),
    skill("personalSteadyCircle", "Steady Circle", "support", "the first transmutation each battle costs 1 less Matter", {effects: [{kind: "refundAction", pool: "matter", amount: 1, once: "battle"}], coverage: ["1 less Matter"]})
  ]
};

export const byId = Object.fromEntries([...Object.values(named), ...Object.values(pools).flat()].map(entry => [entry.id, entry]));
