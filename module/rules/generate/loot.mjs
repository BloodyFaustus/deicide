import {DEICIDE} from "../../config.mjs";
import {evaluate} from "../../core/expression.mjs";
import {d100, hashString, pick, rollUnder, seededRng, weightedPick} from "../../core/random.mjs";
import {award} from "../pacing.mjs";
import {parseWeaponId, prefixAllowed, titleFromId, weaponProfile} from "../economy.mjs";
import {dominantType} from "./npc.mjs";

const ROGUE_CLASSES = ["rogue", "assassin", "shadow", "saboteur", "spymaster"];

export function tierAbove(tier) {
  const order = DEICIDE.tierOrder.filter(id => id !== "named");
  const index = Math.max(order.indexOf(tier), 0);
  return order[Math.min(index + DEICIDE.generate.loot.bossTierAbove, order.length - 1)];
}

export function weaponItem({line, tier, prefix = null, forge = 0}) {
  const profile = weaponProfile({line, tier, prefix, forge});
  return {
    name: profile.name, type: "weapon", img: "icons/svg/sword.svg", price: profile.price,
    system: {identifier: profile.identifier, line, tier, prefix, forge, element: null, asSidearm: false, equipped: false, quantity: 1, description: ""}
  };
}

export function consumableItem(id, quantity = 1) {
  const row = DEICIDE.consumables[id];
  return {
    name: DEICIDE.consumableNames[id] ?? titleFromId(id), type: "consumable", img: "icons/svg/item-bag.svg", price: row?.price ?? null,
    system: {identifier: id, key: id, kind: "belt", quantity, onBelt: false, description: ""}
  };
}

export function generateLoot(input, lookup = () => null) {
  const seed = input.seed ?? 1;
  const rng = seededRng(typeof seed === "number" ? seed : hashString(String(seed)));
  const P = input.P ?? 1;
  const level = input.partyLevel ?? 1;
  const income = DEICIDE.economy.income;
  const out = {encounter: input.encounter, dust: 0, dustPerSheet: true, items: [], notes: [], rolls: {}, errors: []};

  switch ( input.encounter ) {
    case "standard": {
      out.dust = input.mode === "war" ? award(evaluate(income.warVictory, {level}), P) : 0;
      out.notes.push(input.mode === "war"
        ? `War victory income ${evaluate(income.warVictory, {level})} x P per sheet.`
        : "Standard enemies drop nothing. The killing company takes the Resupply value (10 Strength).");
      break;
    }
    case "boss": {
      out.dust = award(evaluate(income.boss, {level}), P);
      const tier = tierAbove(input.shopTier ?? "iron");
      const lines = (input.partyLines ?? []).filter(line => DEICIDE.martialLines.includes(line));
      const line = lines.length ? pick(lines, rng) : pick(DEICIDE.martialLines, rng);
      const rogueHeavy = (input.partyClasses ?? []).filter(id => ROGUE_CLASSES.includes(id)).length * 2 >= Math.max((input.partyClasses ?? []).length, 1) && (input.partyClasses ?? []).length > 0;
      const weights = {...DEICIDE.generate.loot.prefixWeights[rogueHeavy ? "rogueHeavy" : "default"]};
      const dominant = dominantType(input.partyTypes ?? []);
      const slayer = dominant ? DEICIDE.generate.slayerFor[dominant] : null;
      if ( slayer ) weights[slayer] = weights.slayer;
      delete weights.slayer;
      for ( const key of Object.keys(weights) ) if ( !prefixAllowed(key, line, tier) ) delete weights[key];
      const prefixRoll = d100(rng);
      out.rolls.prefix = prefixRoll;
      const prefix = (rollUnder(prefixRoll, 50) && Object.keys(weights).length) ? weightedPick(weights, rng) : null;
      out.items.push(weaponItem({line, tier, prefix}));
      out.notes.push(`Boss drop: one ${tier} item, one tier above ${input.shopTier ?? "iron"} shop access${prefix ? `, ${prefix} prefix` : ""}. Boss income ${evaluate(income.boss, {level})} x P per sheet.`);
      break;
    }
    case "officer": {
      out.dust = award(income.officerDefeated, P);
      const roll = d100(rng);
      out.rolls.weapon = roll;
      const dropped = rollUnder(roll, income.officerWeaponDropChance);
      if ( dropped && input.officerWeapon ) {
        const spec = typeof input.officerWeapon === "string" ? parseWeaponId(input.officerWeapon) : input.officerWeapon;
        if ( spec ) out.items.push(weaponItem(spec));
        else out.errors.push(`Unknown officer weapon "${input.officerWeapon}"`);
      }
      out.notes.push(`Officer defeated: d100 ${roll} ${dropped ? "at or under" : "over"} ${income.officerWeaponDropChance}, ${dropped ? "the weapon drops" : "no weapon"}. ${income.officerDefeated} Dust x P.`);
      break;
    }
    case "homunculus": {
      const monster = input.homunculusId ? lookup("monster", input.homunculusId) : null;
      if ( !monster ) { out.errors.push(`Unknown Homunculus "${input.homunculusId}"`); break; }
      const counts = new Map();
      for ( const id of monster.yield?.drops ?? [] ) counts.set(id, (counts.get(id) ?? 0) + 1);
      for ( const [id, quantity] of counts ) {
        if ( DEICIDE.consumables[id] ) out.items.push(consumableItem(id, quantity));
        else out.items.push({name: titleFromId(id), type: "named", img: "icons/svg/holy-shield.svg", system: {identifier: id}});
      }
      out.dust = monster.yield?.dust ?? 0;
      out.dustPerSheet = false;
      out.notes.push(`${monster.name ?? input.homunculusId} drops its catalysts${out.dust ? ` and ${out.dust} Dust` : ""}.`);
      break;
    }
    default:
      out.errors.push(`Unknown encounter kind "${input.encounter}"`);
  }
  return out;
}
