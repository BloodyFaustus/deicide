export const SNAPSHOT_PARTY_LEVEL = 10;

export const npcs = [
  {
    id: "petraSigrun",
    name: "Petra Sigrun",
    faction: "offweiss",
    role: "Imperial special operations commander, the party's recurring martial rival, possible defector",
    input: {
      level: 7, classLine: ["rogue", "assassin"], people: "foreignHuman", profile: "veteran", named: true,
      ranks: {rogue: 7, assassin: 5}, classAt: {assassin: 5}, personalSkill: "personalHuntersPatience", seed: "petraSigrun"
    },
    description: "Starts as Assassin (Rogue 7, Assassin 5) at party level +2 on first appearance, rebuilt at party level +2 on every appearance with one more Tier 3 step each time (Shadow, then Spellbreaker if the party has mages). Early Peak Talent. She escapes at 25 percent HP unless pinned by two adjacent characters. Recruitable in Act II at personal Standing 60 if Offweiss has burned her (Legitimacy of Offweiss below 5 on the Offweiss sheet). This snapshot is level 7 (party level 5 plus 2)."
  },
  {
    id: "ottmarKrieg",
    name: "Marshal Ottmar Krieg",
    faction: "offweiss",
    role: "Commander of the invasion, methodical, adapts",
    input: {level: 20, classLine: ["cadet", "captain", "warlord"], people: "foreignHuman", profile: "enemy", talent: "earlyPeak", named: true, seed: "ottmarKrieg"},
    description: "Warlord built at party level +4 for the invasion chain, Early Peak Talent, an antagonist (enemy profile, named budget). This snapshot is level 20. Krieg's Baton is not in the Named table yet: he carries a generated kit until V writes it."
  },
  {
    id: "emilKrauss",
    name: "Emil Krauss",
    faction: "offweiss",
    role: "Imperial magical researcher. Studies Mercer",
    input: {level: 14, classLine: ["adept", "battlemage", "magus"], people: "highElf", profile: "enemy", talent: "savant", named: true, seed: "emilKrauss"},
    description: "Battlemage then Magus line (Magus from level 16). Savant in Reason, an antagonist (enemy profile, named budget). The Krauss Engine is not in the Named table yet: he carries a generated kit until V writes it. This snapshot is level 14."
  },
  {
    id: "aliaCarrow",
    name: "Alia Carrow",
    faction: "lathander",
    role: "Senior priestess of the charitable faith, the most trusted public figure in Lathander",
    recruit: "Veteran Chaplain or Hierophant line, not a Prodigy",
    input: {level: 16, classLine: ["acolyte", "chaplain", "hierophant"], people: "manaborne", profile: "veteran", personalSkill: "personalPublicTrust", seed: "aliaCarrow"},
    description: "Temple Standing, Civilians Standing. She knows what Mercer is. Personal skill Public Trust: Standing losses from Marks and Divine Attention are halved while she is Sworn to the party."
  },
  {
    id: "irenaVos",
    name: "Captain Irena Vos",
    faction: "lathander",
    role: "Royal liaison assigned to Mercer's unit, becomes his adjutant. The most recurring NPC",
    recruit: "Standard Captain, Steady, starts Attached 40 by assignment",
    input: {level: 10, classLine: ["cadet", "captain"], people: "manaborne", profile: "standard", personalSkill: "personalHardLine", seed: "irenaVos", choices: {captain: {weapon: "lance"}}},
    status: "attached",
    standing: 40,
    description: "Personal skill Hard Line: Hold the Line also grants Avoid +5. Starts Attached at personal Standing 40 by assignment."
  },
  {
    id: "garrickFen",
    name: "Garrick Fen",
    faction: "lathander",
    role: "Commander of the Saltmarch Wardens, monster hunter",
    recruit: "Veteran Ranger",
    input: {level: 16, classLine: ["scout", "ranger"], people: "beastman", subtype: "canine", profile: "veteran", personalSkill: "personalTracker", seed: "garrickFen"},
    description: "Plague ecology, monster expeditions, Saturation sources. Personal skill Tracker: Ambush fires at range 4."
  },
  {
    id: "corvinHale",
    name: "General Corvin Hale",
    faction: "lathander",
    role: "Commander of the Royal Army, professional rival then partner, possible later opponent",
    recruit: "Veteran Warlord, Early Peak, joins Attached by rank not trust",
    input: {level: 16, classLine: ["cadet", "captain", "warlord"], people: "manaborne", profile: "veteran", personalSkill: "personalOldGuard", seed: "corvinHale", choices: {captain: {weapon: "sword"}, warlord: {weapon: "sword"}}},
    status: "attached",
    standing: 40,
    description: "Command anchor from the Officers track. Personal skill Old Guard: companies in radius ignore the first rout. Can turn against Mercer if Divine Attention passes 6."
  },
  {
    id: "ilwenAshcroft",
    name: "Ilwen Ashcroft",
    faction: "lathander",
    role: "Military engineer restoring the Breakwater Forts",
    recruit: "Specialist Transmuter (taught by Mercer) or Warden",
    input: {level: 10, classLine: ["alchemist", "transmuter"], people: "manaborne", profile: "specialist", personalSkill: "personalLamplighter", namedItems: ["breakwaterAegis"], seed: "ilwenAshcroft"},
    description: "Fortifications track. Personal skill Lamplighter: Barriers also give Avoid +5. First local expert excited by alchemy, the natural first Lesson of Equivalence student. Carries the Breakwater Aegis."
  },
  {
    id: "rookMaren",
    name: "Rook Maren",
    faction: "lathander",
    role: "Leader of the Blackwake smuggling network",
    recruit: "Veteran Shadow at Underworld Standing 60",
    input: {level: 16, classLine: ["rogue", "assassin", "shadow"], people: "manaborne", profile: "veteran", namedItems: ["theQuietPistol"], seed: "rookMaren"},
    description: "Contraband, forged papers, assassins. Carries The Quiet Pistol. Recruitable at Underworld Standing 60."
  }
];
