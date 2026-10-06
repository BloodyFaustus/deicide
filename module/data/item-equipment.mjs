import {DEICIDE} from "../config.mjs";
import {
  accessoryProfile, armorProfile, offhandProfile, sellPrice, titleFromId, weaponProfile
} from "../rules/economy.mjs";
import {fields, modifierArray} from "./fields.mjs";
import {ItemDataBase} from "./item-base.mjs";

const pascal = text => text.charAt(0).toUpperCase() + text.slice(1);

export function artsFor(line, tier) {
  const order = DEICIDE.tierOrder;
  const tierIndex = order.indexOf(tier);
  const ids = [];
  for ( const [artId, art] of Object.entries(DEICIDE.arts) ) {
    if ( !art.lines.includes(line) ) continue;
    if ( order.indexOf(art.minTier) > tierIndex ) continue;
    ids.push(`art${pascal(artId)}`);
  }
  return ids;
}

class EquipmentBase extends ItemDataBase {
  static defineSchema() {
    return {
      ...super.defineSchema(),
      equipped: new fields.BooleanField({initial: false})
    };
  }

  get equippedSlot() {
    return this.equipped ? this.slot : null;
  }

  get slot() {
    return null;
  }
}

export class WeaponData extends EquipmentBase {
  static LOCALIZATION_PREFIXES = ["DEICIDE.Weapon"];

  static defineSchema() {
    const generator = DEICIDE.weaponGenerator;
    return {
      ...super.defineSchema(),
      line: new fields.StringField({required: true, choices: Object.keys(generator.lines), initial: "sword"}),
      tier: new fields.StringField({required: true, choices: Object.keys(generator.tiers), initial: "iron"}),
      prefix: new fields.StringField({required: true, nullable: true, blank: false, choices: Object.keys(generator.prefixes), initial: null}),
      forge: new fields.NumberField({required: true, integer: true, min: 0, max: generator.forge.maxLevel, initial: 0}),
      element: new fields.StringField({required: true, nullable: true, blank: false, initial: null}),
      asSidearm: new fields.BooleanField({initial: false}),
      quantity: new fields.NumberField({required: true, integer: true, min: 0, initial: 1})
    };
  }

  get slot() {
    return this.asSidearm ? "offhand" : "weapon";
  }

  prepareDerivedData() {
    let profile;
    try {
      profile = weaponProfile({line: this.line, tier: this.tier, prefix: this.prefix, forge: this.forge, element: this.element});
    }
    catch ( error ) {
      profile = {...weaponProfile({line: this.line, tier: this.tier}), invalid: error.message};
    }
    profile.arts = artsFor(this.line, this.tier);
    profile.sellPrice = sellPrice(profile.price);
    profile.identifier = this.identifier || profile.identifier;
    profile.name = this.parent?.name ?? profile.name;
    this.derived = profile;
  }

  get profile() {
    return this.derived;
  }
}

export class ArmorData extends EquipmentBase {
  static LOCALIZATION_PREFIXES = ["DEICIDE.Armor"];

  get slot() {
    return "armor";
  }

  prepareDerivedData() {
    const id = (this.identifier in DEICIDE.armor) ? this.identifier : "ironLight";
    const profile = armorProfile(id);
    profile.sellPrice = sellPrice(profile.price);
    profile.name = this.parent?.name ?? profile.name;
    profile.known = this.identifier in DEICIDE.armor;
    this.derived = profile;
  }

  get profile() {
    return this.derived;
  }
}

export class OffhandData extends EquipmentBase {
  static LOCALIZATION_PREFIXES = ["DEICIDE.Offhand"];

  static defineSchema() {
    return {
      ...super.defineSchema(),
      line: new fields.StringField({required: true, choices: Object.keys(DEICIDE.offhand), initial: "buckler"}),
      tier: new fields.StringField({required: true, choices: Object.keys(DEICIDE.weaponGenerator.tiers), initial: "iron"})
    };
  }

  get slot() {
    return "offhand";
  }

  prepareDerivedData() {
    let profile;
    try { profile = offhandProfile(this.line, this.tier); }
    catch ( error ) { profile = {...offhandProfile(this.line, "iron"), invalid: error.message}; }
    profile.sellPrice = sellPrice(profile.price);
    profile.name = this.parent?.name ?? profile.name;
    this.derived = profile;
  }

  get profile() {
    return this.derived;
  }
}

export class AccessoryData extends EquipmentBase {
  static LOCALIZATION_PREFIXES = ["DEICIDE.Accessory"];

  static defineSchema() {
    return {
      ...super.defineSchema(),
      key: new fields.StringField({required: true, choices: Object.keys(DEICIDE.accessories), initial: "ironRing"}),
      choices: new fields.SchemaField({
        attribute: new fields.StringField({required: true, nullable: true, blank: false, initial: null}),
        secondAttribute: new fields.StringField({required: true, nullable: true, blank: false, initial: null}),
        skill: new fields.StringField({required: true, nullable: true, blank: false, initial: null})
      })
    };
  }

  get slot() {
    return "accessory";
  }

  prepareDerivedData() {
    const profile = accessoryProfile(this.key, this.choices);
    profile.skill = this.choices.skill;
    profile.sellPrice = sellPrice(profile.price);
    profile.name = this.parent?.name ?? profile.name;
    this.derived = profile;
  }

  get profile() {
    return this.derived;
  }
}

export class PinData extends EquipmentBase {
  static LOCALIZATION_PREFIXES = ["DEICIDE.Pin"];

  static defineSchema() {
    return {
      ...super.defineSchema(),
      ability: new fields.StringField({required: true, blank: true, initial: ""}),
      price: new fields.NumberField({required: true, integer: true, min: 0, initial: 45})
    };
  }

  get slot() {
    return "pin";
  }

  prepareDerivedData() {
    this.derived = {
      identifier: this.identifier, name: this.parent?.name ?? "", ability: this.ability, price: this.price,
      sellPrice: sellPrice(this.price), modifiers: []
    };
  }

  get profile() {
    return this.derived;
  }
}

export class ConsumableData extends ItemDataBase {
  static LOCALIZATION_PREFIXES = ["DEICIDE.Consumable"];

  static defineSchema() {
    return {
      ...super.defineSchema(),
      key: new fields.StringField({required: true, blank: true, initial: ""}),
      kind: new fields.StringField({required: true, choices: ["belt", "supply"], initial: "belt"}),
      quantity: new fields.NumberField({required: true, integer: true, min: 0, initial: 1}),
      onBelt: new fields.BooleanField({initial: false})
    };
  }

  get equippedSlot() {
    return (this.kind === "belt") && this.onBelt ? "belt" : null;
  }

  prepareDerivedData() {
    const row = (this.kind === "supply" ? DEICIDE.supplies : DEICIDE.consumables)[this.key] ?? null;
    this.derived = {
      identifier: this.identifier, name: this.parent?.name ?? titleFromId(this.key), key: this.key, kind: this.kind,
      effect: row?.effect ?? null, price: row?.price ?? null, catalyst: row?.catalyst ?? null,
      sellPrice: row?.price !== null && row?.price !== undefined ? sellPrice(row.price) : null,
      modifiers: []
    };
  }

  get profile() {
    return this.derived;
  }
}

export class NamedData extends EquipmentBase {
  static LOCALIZATION_PREFIXES = ["DEICIDE.Named"];

  static defineSchema() {
    return {
      ...super.defineSchema(),
      fills: new fields.StringField({required: true, choices: ["weapon", "offhand", "armor", "accessory"], initial: "weapon"}),
      base: new fields.SchemaField({
        line: new fields.StringField({required: true, blank: true, initial: ""}),
        tier: new fields.StringField({required: true, blank: true, initial: "royal"})
      }, {required: true, nullable: true, initial: null}),
      stats: new fields.ObjectField(),
      modifiers: modifierArray(),
      special: new fields.StringField({required: true, blank: true, initial: ""}),
      drawback: new fields.ObjectField(),
      pp: new fields.NumberField({required: true, integer: true, min: 0, initial: 32}),
      hook: new fields.StringField({required: true, blank: true, initial: ""})
    };
  }

  get slot() {
    return this.fills;
  }

  prepareDerivedData() {
    let profile = {identifier: this.identifier, line: null, tier: "named", might: 0, acc: 0, crit: 0, range: null, weight: null, modifiers: []};
    const base = this.base;
    if ( base?.line ) {
      if ( base.line in DEICIDE.weaponGenerator.lines ) profile = weaponProfile({line: base.line, tier: base.tier || "royal"});
      else if ( base.line in DEICIDE.offhand ) profile = offhandProfile(base.line, base.tier || "iron");
    }
    Object.assign(profile, this.stats);
    profile.identifier = this.identifier;
    profile.name = this.parent?.name ?? "";
    profile.named = true;
    profile.tier = "named";
    profile.gate = DEICIDE.weaponTierGates.named;
    profile.pp = this.pp;
    profile.price = null;
    profile.sellPrice = null;
    profile.modifiers = [...(profile.modifiers ?? []).filter(m => !["defense.def", "defense.res", "avoid", "move", "delay"].includes(m.key)), ...this.modifiers];
    profile.drawback = this.drawback;
    profile.arts = (base?.line in DEICIDE.weaponGenerator.lines) ? artsFor(base.line, "royal") : [];
    this.derived = profile;
  }

  get profile() {
    return this.derived;
  }
}
