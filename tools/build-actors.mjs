import {rmSync, existsSync} from "node:fs";
import {join} from "node:path";
import {DEICIDE} from "../module/config.mjs";
import {PACKS_SRC, pascalId, stableId, writeSource} from "./lib/sources.mjs";
import {monsters, companies, scenarios} from "./content/actors.mjs";
import {gradeAutomation} from "./lib/automation.mjs";

function clean(folder) {
  const dir = join(PACKS_SRC, folder);
  if ( existsSync(dir) ) rmSync(dir, {recursive: true, force: true});
}

const counts = {};
function emit(folder, doc) {
  writeSource(folder, doc, {force: true});
  counts[folder] = (counts[folder] ?? 0) + 1;
}

const AREA = {
  single: {shape: "single", size: 1}, row: {shape: "blast", size: 1}, all: {shape: "blast", size: 2},
  column: {shape: "line", size: 2}, self: {shape: "self", size: 0}
};

function moveItem(monsterId, mv) {
  const id = `${monsterId}${pascalId(mv.name)}`;
  const lineMatch = /^line (\d+)$/.exec(mv.area ?? "");
  const area = lineMatch ? {shape: "line", size: Number(lineMatch[1])} : (AREA[mv.area] ?? AREA.single);
  const isAttack = typeof mv.might === "number";
  const element = mv.direct ? "truth" : (mv.element ?? null);
  const defense = mv.direct ? "none" : (mv.defense ?? "def");
  const dungeonTarget = {single: "single", row: "row", all: "all", column: "column", self: "self"}[lineMatch ? "column" : (mv.area ?? "single")];
  const text = [isAttack ? `M${mv.might} ${mv.area ?? "single"}` : null, mv.note].filter(Boolean).join(". ");
  const system = {
      identifier: id,
      type: "action",
      source: {kind: "monster", id: monsterId, rank: null},
      description: `<p>${text}.</p>`,
      summary: text,
      tags: element ? [element] : [],
      direct: Boolean(mv.direct),
      trigger: "",
      usage: {limit: null, per: null, used: 0},
      cost: {channel: 0, matter: 0, hp: 0, dust: 0, soulPrice: 0},
      weight: null,
      attack: isAttack ? {
        basis: "flat", source: "none", defense, might: mv.might, element, hit: 0, crit: 0, weaponLines: [],
        strikes: 1, ignoreDef: 0, bonuses: [], ignoreAvoid: Boolean(mv.ignoreAvoid), perTile: mv.perTile ?? null
      } : null,
      heal: null,
      war: {range: mv.range ?? (isAttack ? [1, 1] : [0, 0]), area, target: mv.area === "self" ? "self" : "enemy", movement: null, terrain: false},
      dungeon: {target: dungeonTarget, note: mv.note ?? ""},
      statuses: (mv.statuses ?? []).map(status => ({target: "target", onCrit: false, ...status})),
      modifiers: [],
      roll: null,
      art: null,
      effects: mv.effects ?? [],
      reaction: mv.reaction ?? null,
      command: null,
      stance: null,
      coverage: mv.coverage ?? [],
      automation: "manual"
  };
  system.type = mv.reaction ? "reaction" : "action";
  system.automation = gradeAutomation(system).automation;
  return {
    _id: stableId("ability", id),
    name: mv.name,
    type: "ability",
    img: isAttack ? "icons/svg/sword.svg" : "icons/svg/aura.svg",
    system,
    effects: [], folder: null, sort: 0, ownership: {default: 0}, flags: {deicide: {generated: true}}
  };
}

clean("monsters");
for ( const monster of monsters ) {
  const tags = [...monster.tags, ...(monster.classTypes ?? [])];
  emit("monsters", {
    _id: stableId("monster", monster.id),
    name: monster.name,
    type: "monster",
    img: "icons/svg/skull.svg",
    system: {
      identifier: monster.id,
      level: monster.level,
      hp: {value: monster.hp, max: monster.hp},
      def: monster.def, res: monster.res, spd: monster.spd, mag: monster.mag ?? 0, skl: monster.skl ?? 0,
      delay: monster.delay ?? {mode: "spd", value: 30},
      hitBase: null,
      tags,
      boss: Boolean(monster.boss),
      divineBeing: Boolean(monster.divineBeing),
      weakness: monster.weakness ?? null,
      resistance: monster.resistance ?? null,
      immunities: monster.immunities ?? [],
      phaseBreaks: (monster.phaseBreaks ?? []).map(entry => ({...entry, triggered: false})),
      yield: {saturation: 0, dust: 0, drops: [], divineAttention: 0, ...(monster.yield ?? {})},
      row: "front",
      description: `<p>${monster.description ?? ""}</p>`,
      notes: ""
    },
    prototypeToken: {name: monster.name, disposition: -1, actorLink: false, texture: {src: "icons/svg/skull.svg"}},
    items: monster.moves.map(mv => moveItem(monster.id, mv)),
    effects: [],
    folder: null, sort: 0, ownership: {default: 0},
    flags: {deicide: {generated: true, startingStatuses: monster.statuses ?? []}}
  });
}

clean("companies");
for ( const company of companies ) {
  emit("companies", {
    _id: stableId("company", company.id),
    name: company.name,
    type: "company",
    img: company.type === "ship" ? "icons/svg/anchor.svg" : "icons/svg/tower.svg",
    system: {
      identifier: company.id,
      strength: company.strength, quality: company.quality, type: company.type,
      shipClass: company.shipClass ?? null, side: "lathander", doctrine: null, screenOfficerId: null,
      veterancy: 0, veterancyQuality: 0, owner: null, banner: "", named: false, routed: false, acted: false, facing: 0,
      notes: ""
    },
    prototypeToken: {name: company.name, actorLink: true, displayBars: 50, bar1: {attribute: "hp"}, texture: {src: company.type === "ship" ? "icons/svg/anchor.svg" : "icons/svg/tower.svg"}},
    items: [], effects: [], folder: null, sort: 0, ownership: {default: 0}, flags: {deicide: {generated: true}}
  });
}

clean("scenarios");
for ( const scenario of scenarios ) {
  const entryId = stableId("journal", scenario.id);
  emit("scenarios", {
    _id: entryId,
    name: scenario.name,
    pages: [
      {
        _id: stableId("page.card", scenario.id),
        name: `${scenario.kind === "war" ? "War scenario" : "Dungeon expedition"} card`,
        type: "scenario",
        title: {show: true, level: 1},
        system: {
          identifier: scenario.id, kind: scenario.kind, warMonth: scenario.warMonth, difficulty: scenario.difficulty,
          card: scenario.card, payout: {...scenario.payout, applied: false}, description: scenario.text
        },
        sort: 100000, ownership: {default: -1}, flags: {}
      },
      {
        _id: stableId("page.text", scenario.id),
        name: "Briefing",
        type: "text",
        title: {show: true, level: 1},
        text: {format: 1, content: scenario.text},
        sort: 200000, ownership: {default: -1}, flags: {}
      }
    ],
    folder: null, sort: 0, ownership: {default: 0}, flags: {deicide: {generated: true}}
  });
}

console.log(Object.entries(counts).map(([folder, count]) => `${folder} ${count}`).join(", "));
