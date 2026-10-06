import {DEICIDE} from "../config.mjs";
import {dungeonProfile} from "../rules/collapse.mjs";
import {fields, modifierArray} from "./fields.mjs";
import {ItemDataBase} from "./item-base.mjs";

export class AbilityData extends ItemDataBase {

  static LOCALIZATION_PREFIXES = ["DEICIDE.Ability"];

  static defineSchema() {
    return {
      ...super.defineSchema(),
      type: new fields.StringField({required: true, choices: Object.keys(DEICIDE.skillTypes), initial: "action"}),
      source: new fields.SchemaField({
        kind: new fields.StringField({required: true, blank: true, initial: ""}),
        id: new fields.StringField({required: true, blank: true, initial: ""}),
        rank: new fields.NumberField({required: true, nullable: true, integer: true, initial: null})
      }),
      summary: new fields.StringField({required: true, blank: true, initial: ""}),
      tags: new fields.ArrayField(new fields.StringField({required: true, blank: false})),
      direct: new fields.BooleanField({initial: false}),
      trigger: new fields.StringField({required: true, blank: true, initial: ""}),
      usage: new fields.SchemaField({
        limit: new fields.NumberField({required: true, nullable: true, integer: true, min: 1, initial: null}),
        per: new fields.StringField({required: true, nullable: true, blank: false, initial: null}),
        used: new fields.NumberField({required: true, integer: true, min: 0, initial: 0})
      }),
      cost: new fields.SchemaField({
        channel: new fields.NumberField({required: true, integer: true, min: 0, initial: 0}),
        matter: new fields.NumberField({required: true, integer: true, min: 0, initial: 0}),
        hp: new fields.NumberField({required: true, integer: true, min: 0, initial: 0}),
        dust: new fields.NumberField({required: true, integer: true, min: 0, initial: 0}),
        soulPrice: new fields.NumberField({required: true, integer: true, min: 0, initial: 0})
      }),
      weight: new fields.NumberField({required: true, nullable: true, integer: true, min: 0, initial: null}),
      attack: new fields.ObjectField({required: true, nullable: true, initial: null}),
      heal: new fields.ObjectField({required: true, nullable: true, initial: null}),
      war: new fields.ObjectField({required: true, nullable: true, initial: null}),
      dungeon: new fields.ObjectField({required: true, nullable: true, initial: null}),
      statuses: new fields.ArrayField(new fields.ObjectField()),
      modifiers: modifierArray(),
      roll: new fields.ObjectField({required: true, nullable: true, initial: null}),
      art: new fields.ObjectField({required: true, nullable: true, initial: null}),

      effects: new fields.ArrayField(new fields.ObjectField()),
      reaction: new fields.ObjectField({required: true, nullable: true, initial: null}),
      command: new fields.ObjectField({required: true, nullable: true, initial: null}),
      stance: new fields.ObjectField({required: true, nullable: true, initial: null}),

      coverage: new fields.ArrayField(new fields.StringField({required: true, blank: false})),
      automation: new fields.StringField({required: true, choices: ["full", "partial", "manual"], initial: "manual"})
    };
  }

  prepareDerivedData() {
    const typeConfig = DEICIDE.skillTypes[this.type];
    this.derived = {
      engines: typeConfig?.engines ?? [],
      passive: Boolean(typeConfig?.passive),
      dungeonProfile: dungeonProfile(this),
      isAttack: Boolean(this.attack),
      isHeal: Boolean(this.heal),
      weightValue: this.weight ?? DEICIDE.delay.defaultWeight
    };
  }

  usableIn(engine, {arena = false} = {}) {
    if ( !this.derived.engines.includes(engine) ) return false;
    if ( engine === "dungeon" ) {
      const profile = this.derived.dungeonProfile;
      if ( profile.available === false ) return false;
      if ( profile.requiresArena && !arena ) return false;
    }
    return true;
  }
}
