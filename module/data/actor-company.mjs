import {DEICIDE} from "../config.mjs";
import {companyStats} from "../rules/company.mjs";
import {qualityGrade} from "../rules/grades.mjs";
import {fields, versionField} from "./fields.mjs";

export class CompanyData extends foundry.abstract.TypeDataModel {

  static LOCALIZATION_PREFIXES = ["DEICIDE.Company"];

  static defineSchema() {
    return {
      schemaVersion: versionField(1),
      identifier: new fields.StringField({required: true, blank: true, initial: ""}),
      strength: new fields.NumberField({required: true, integer: true, min: 0, max: 100, initial: 100}),
      quality: new fields.NumberField({required: true, integer: true, min: 1, max: 5, initial: 1}),
      type: new fields.StringField({required: true, choices: Object.keys(DEICIDE.companyTypes), initial: "infantry"}),
      shipClass: new fields.StringField({required: true, nullable: true, blank: false, choices: Object.keys(DEICIDE.ships), initial: null}),
      side: new fields.StringField({required: true, choices: ["lathander", "enemy", "foreign"], initial: "lathander"}),
      doctrine: new fields.StringField({required: true, nullable: true, blank: false, choices: Object.keys(DEICIDE.doctrines), initial: null}),
      screenOfficerId: new fields.StringField({required: true, nullable: true, blank: false, initial: null}),
      veterancy: new fields.NumberField({required: true, integer: true, min: 0, max: 5, initial: 0}),
      veterancyQuality: new fields.NumberField({required: true, integer: true, min: 0, initial: 0}),
      owner: new fields.StringField({required: true, nullable: true, blank: false, initial: null}),
      banner: new fields.StringField({required: true, blank: true, initial: ""}),
      named: new fields.BooleanField({initial: false}),
      routed: new fields.BooleanField({initial: false}),
      acted: new fields.BooleanField({initial: false}),
      facing: new fields.NumberField({required: true, integer: true, min: 0, max: 7, initial: 0}),
      notes: new fields.HTMLField({required: true, blank: true, initial: ""})
    };
  }

  prepareDerivedData() {

    const orders = game.deicide?.statuses?.modifiers ? game.deicide.statuses.modifiers(this.parent) : {modifiers: [], flags: {}};
    const qualityBonus = orders.modifiers.filter(m => m.key === "quality" && !m.when).reduce((sum, m) => sum + Number(m.value), 0);
    const quality = Math.min(Math.max(this.quality + qualityBonus, 1), 5);
    const stats = companyStats({quality, strength: this.strength, type: this.type, shipClass: this.shipClass});
    const sum = key => orders.modifiers.filter(m => m.key === key && !m.when).reduce((total, m) => total + Number(m.value), 0);
    this.derived = {
      ...stats,
      effectiveQuality: quality,
      qualityGrade: qualityGrade(quality),
      typeLabel: DEICIDE.companyTypes[this.type]?.label ?? this.type,
      orders,
      def: stats.def + sum("defense.def"),
      move: (stats.move ?? 4) + sum("move"),
      strikes: 1 + sum("strikes"),
      hitBonus: sum("hit"),
      mightBonus: sum("might"),
      avoidBonus: sum("avoid"),
      flags: orders.flags
    };
    this.hp = {value: this.strength, max: 100};
  }

  get profile() {
    const d = this.derived;
    return {
      kind: "company",
      name: this.parent?.name ?? "",
      level: 0,
      attributes: {str: 0, mag: 0, skl: 0, spd: 0, def: d.def, res: d.res, cmd: 0},
      defense: {def: d.def, res: d.res, avoid: d.avoidBonus ?? 0},
      hp: {value: this.strength, max: 100},
      classTypes: [],
      tags: ["company", this.type],
      statuses: Array.from(this.parent?.statuses ?? []),
      affinities: [],
      immunities: [],
      modifiers: d.orders?.modifiers ?? [],
      hitBase: 70 + 5 * (d.effectiveQuality ?? this.quality)
    };
  }
}
