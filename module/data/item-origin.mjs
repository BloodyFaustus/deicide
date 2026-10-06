import {fields, modifierArray} from "./fields.mjs";
import {ItemDataBase} from "./item-base.mjs";

export const ORIGIN_KINDS = ["people", "background", "talent"];

export class OriginData extends ItemDataBase {

  static LOCALIZATION_PREFIXES = ["DEICIDE.Origin"];

  static defineSchema() {
    const object = () => new fields.ObjectField();
    const nullable = () => new fields.ObjectField({required: true, nullable: true, initial: null});
    return {
      ...super.defineSchema(),
      kind: new fields.StringField({required: true, choices: ORIGIN_KINDS, initial: "people"}),
      text: new fields.StringField({required: true, blank: true, initial: ""}),
      story: new fields.BooleanField({initial: false}),
      flags: object(),
      modifiers: modifierArray(),
      proficiencies: object(),

      growth: object(),
      subtypes: object(),
      classGrowthLocks: object(),

      points: object(),
      grants: object(),

      choices: new fields.ArrayField(new fields.StringField({required: true, blank: false})),
      start: nullable(),
      caps: nullable(),
      hpPerLevel: new fields.NumberField({required: true, integer: true, min: 0, initial: 0}),
      flex: nullable(),
      proficiency: nullable(),
      wild: new fields.BooleanField({initial: false})
    };
  }
}
