import {DEICIDE} from "../../module/config.mjs";
import {
  accessoryProfile, armorProfile, offhandProfile, parseWeaponId, weaponProfile
} from "../../module/rules/economy.mjs";

const capitalize = text => text.charAt(0).toUpperCase() + text.slice(1);

export function parseOffhandId(id) {
  for ( const tier of Object.keys(DEICIDE.weaponGenerator.tiers) ) {
    if ( !id.startsWith(tier) ) continue;
    const rest = id.slice(tier.length);
    for ( const line of Object.keys(DEICIDE.offhand) ) {
      if ( rest === capitalize(line) ) return {tier, line};
    }
  }
  return null;
}

export function equipmentById(id, choices = {}) {
  const weapon = parseWeaponId(id);
  if ( weapon ) return {slot: "weapon", profile: weaponProfile(weapon)};
  const offhand = parseOffhandId(id);
  if ( offhand ) return {slot: "offhand", profile: offhandProfile(offhand.line, offhand.tier)};
  if ( DEICIDE.armor[id] ) return {slot: "armor", profile: armorProfile(id)};
  if ( DEICIDE.accessories[id] ) return {slot: "accessory", profile: accessoryProfile(id, choices)};
  return null;
}

export function equipmentFromKit(kit = {}) {
  const resolve = id => id ? equipmentById(id)?.profile ?? null : null;
  return {
    weapon: resolve(kit.weapon),
    offhand: resolve(kit.offhand),
    armor: resolve(kit.armor),
    accessories: (kit.accessories ?? []).map(entry => typeof entry === "string"
      ? equipmentById(entry)?.profile ?? null
      : equipmentById(entry.id, entry)?.profile ?? null).filter(Boolean),
    pin: null,
    belt: kit.belt ?? []
  };
}
