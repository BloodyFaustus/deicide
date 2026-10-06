import {rmSync, existsSync} from "node:fs";
import {join} from "node:path";
import {DEICIDE} from "../module/config.mjs";
import {
  accessoryProfile, armorProfile, generatedOffhandSpecs, generatedWeaponSpecs, offhandId, offhandProfile,
  titleFromId, weaponId, weaponProfile
} from "../module/rules/economy.mjs";
import {PACKS_SRC, stableId, writeSource} from "./lib/sources.mjs";
import {namedItems} from "./content/named.mjs";

const ICONS = {
  weapon: "icons/svg/sword.svg", armor: "icons/svg/shield.svg", offhand: "icons/svg/shield.svg",
  accessory: "icons/svg/item-bag.svg", consumable: "icons/svg/chest.svg", supply: "icons/svg/chest.svg",
  named: "icons/svg/holy-shield.svg"
};

function document(type, identifier, name, system, img) {
  return {
    _id: stableId(type, identifier), name, type, img,
    system: {...system, identifier}, effects: [], folder: null, sort: 0, ownership: {default: 0},
    flags: {deicide: {generated: true}}
  };
}

function clean(folder) {
  const dir = join(PACKS_SRC, folder);
  if ( existsSync(dir) ) rmSync(dir, {recursive: true, force: true});
}

const counts = {};
function emit(folder, doc) {
  writeSource(folder, doc, {force: true});
  counts[folder] = (counts[folder] ?? 0) + 1;
}

clean("weapons");
for ( const spec of generatedWeaponSpecs() ) {
  const profile = weaponProfile(spec);
  const description = profile.caster
    ? `<p>${titleFromId(spec.line)}. ${profile.spellBonus || profile.alchemyBonus ? `Bonus +${profile.spellBonus || profile.alchemyBonus}` : ""}${profile.channel ? `, Channel +${profile.channel}` : ""}${profile.matter ? `, Matter +${profile.matter}` : ""}, Accuracy +${profile.acc}. ${profile.gate} to wield.</p>`
    : `<p>Might ${profile.might}, Accuracy +${profile.acc}, Crit ${profile.crit}, Range ${profile.range[0]}${profile.range[1] !== profile.range[0] ? ` to ${profile.range[1]}` : ""}, Weight ${profile.weight}. ${profile.gate} to wield.</p>`;
  emit("weapons", document("weapon", profile.identifier, profile.name, {
    line: spec.line, tier: spec.tier, prefix: spec.prefix, forge: 0, element: null,
    description, equipped: false, quantity: 1
  }, ICONS.weapon));
}

clean("armor");
for ( const id of Object.keys(DEICIDE.armor) ) {
  const profile = armorProfile(id);
  const parts = [`DEF +${profile.def}`, `RES +${profile.res}`];
  if ( profile.avoid ) parts.push(`Avoid +${profile.avoid}`);
  if ( profile.hp ) parts.push(`HP +${profile.hp}`);
  parts.push(`Burden ${profile.burden}`);
  emit("armor", document("armor", id, profile.name, {
    description: `<p>${parts.join(", ")}.${profile.requires ? ` Needs Armor ${Object.values(profile.requires)[0]}.` : ""}</p>`,
    equipped: false
  }, ICONS.armor));
}
for ( const {line, tier} of generatedOffhandSpecs() ) {
  const profile = offhandProfile(line, tier);
  const parts = Object.entries(profile).filter(([key, value]) => typeof value === "number" && !["price"].includes(key))
    .map(([key, value]) => `${key} ${value > 0 ? "+" : ""}${value}`);
  emit("armor", document("offhand", offhandId(line, tier), profile.name, {
    line, tier, description: `<p>${parts.join(", ")}.</p>`, equipped: false
  }, ICONS.offhand));
}

for ( const id of Object.keys(DEICIDE.accessories) ) {
  const profile = accessoryProfile(id);
  const parts = [];
  if ( profile.attribute ) parts.push(`one attribute +${profile.attribute}${profile.secondAttribute ? `, a second +${profile.secondAttribute}` : ""}`);
  for ( const [key, label] of [["avoid", "Avoid"], ["move", "Move"], ["hp", "HP"], ["def", "DEF"], ["channel", "Channel"], ["matter", "Matter cap"], ["harvest", "Harvest"], ["acc", "Accuracy"], ["crit", "Crit"], ["commandRadius", "command radius"], ["companyMorale", "companies morale"]] ) {
    if ( profile[key] ) parts.push(`${label} ${profile[key] > 0 ? "+" : ""}${profile[key]}`);
  }
  if ( profile.overcastBurn ) parts.push("Overcast Burn minus 1 per point (floor 1)");
  if ( profile.immune.length ) parts.push(`immune to ${profile.immune.join(", ")}`);
  if ( profile.skillRanks ) parts.push(`one Rank ${profile.skillRanks.join(" or ")} skill from any class`);
  emit("accessories", document("accessory", id, profile.name, {
    key: id, choices: {attribute: null, secondAttribute: null, skill: null},
    description: `<p>${parts.join(", ")}. ${profile.price} Dust.</p>`, equipped: false
  }, ICONS.accessory));
}

clean("consumables");
for ( const [id, row] of Object.entries(DEICIDE.consumables) ) {
  const name = DEICIDE.consumableNames[id] ?? titleFromId(id);
  emit("consumables", document("consumable", id, name, {
    key: id, kind: "belt", quantity: 1,
    description: `<p>${describeEffect(row.effect)}${row.price !== null ? ` ${row.price} Dust.` : " Not sold."}</p>`
  }, ICONS.consumable));
}
for ( const [id, row] of Object.entries(DEICIDE.supplies) ) {
  emit("consumables", document("consumable", id, titleFromId(id), {
    key: id, kind: "supply", quantity: 1,
    description: `<p>${describeEffect(row.effect)} ${row.price} Dust.</p>`
  }, ICONS.supply));
}

function describeEffect(effect = {}) {
  const parts = [];
  if ( effect.heal ) parts.push(`heal ${effect.heal}`);
  if ( effect.removeStatuses ) parts.push(`remove ${effect.removeStatuses} status`);
  if ( effect.channel ) parts.push(`restore ${effect.channel} Channel`);
  if ( effect.burn ) parts.push(`${effect.burn} Burn`);
  if ( effect.removeStatus ) parts.push(`remove ${effect.removeStatus.join(", ")}`);
  if ( effect.removeBurnTicks ) parts.push("remove Burn ticks");
  if ( effect.row ) parts.push(`${effect.row} row ${effect.avoid ? `Avoid +${effect.avoid}` : `Accuracy ${effect.acc}`} for ${effect.turns} turns`);
  if ( effect.attack ) parts.push(`${effect.attack.element} M${effect.attack.might} one row, thrower's SKL`);
  if ( effect.matter ) parts.push(`Matter +${effect.matter}`);
  if ( effect.applyStatus ) parts.push(`${effect.applyStatus} on one ally`);
  if ( effect.companiesPassMorale ) parts.push("War only, companies in radius pass morale");
  if ( effect.revivePercent ) parts.push(`revive a Downed ally at ${effect.revivePercent} percent`);
  if ( effect.manaHero ) parts.push("catalyst for alchemists, Saturation +5 and 1 Mark for mana heroes, poison for anyone else (10 Burn, Manaburn +5)");
  if ( effect.companyStrength ) parts.push(`one company Strength +${effect.companyStrength}`);
  if ( effect.ammo ) parts.push(`ammunition: ${effect.ammo}`);
  if ( effect.terrain ) parts.push(`one ${effect.terrain.from} tile becomes ${effect.terrain.to}`);
  if ( effect.barrier ) parts.push(`Barrier ${effect.barrier} on a tile`);
  if ( effect.remount ) parts.push("a dismounted character regains its mount in an Arena");
  const text = parts.join(", ");
  return text ? `${text.charAt(0).toUpperCase()}${text.slice(1)}.` : "";
}

clean("named");
for ( const item of namedItems ) {
  emit("named", document("named", item.id, item.name, {
    fills: item.slot, base: item.base, stats: item.stats, modifiers: item.modifiers,
    special: item.special ?? "", drawback: item.drawback, pp: item.pp, hook: item.hook,
    description: `<p>${item.text}</p><p>Drawback: ${item.drawback.text}</p>`, equipped: false
  }, ICONS.named));
}

console.log(Object.entries(counts).map(([folder, count]) => `${folder} ${count}`).join(", "));
