import {DEICIDE} from "../config.mjs";
import {evaluate} from "../core/expression.mjs";
import {fields, versionField} from "./fields.mjs";

export class MonsterData extends foundry.abstract.TypeDataModel {

  static LOCALIZATION_PREFIXES = ["DEICIDE.Monster"];

  static defineSchema() {
    const elements = Object.keys(DEICIDE.elements);
    return {
      schemaVersion: versionField(1),
      identifier: new fields.StringField({required: true, blank: true, initial: ""}),
      level: new fields.NumberField({required: true, integer: true, min: 1, initial: 1}),
      hp: new fields.SchemaField({
        value: new fields.NumberField({required: true, integer: true, min: 0, initial: 20}),
        max: new fields.NumberField({required: true, integer: true, min: 1, initial: 20})
      }),
      def: new fields.NumberField({required: true, integer: true, min: 0, initial: 7}),
      res: new fields.NumberField({required: true, integer: true, min: 0, initial: 5}),
      spd: new fields.NumberField({required: true, integer: true, min: 0, initial: 10}),
      mag: new fields.NumberField({required: true, integer: true, min: 0, initial: 0}),
      skl: new fields.NumberField({required: true, integer: true, min: 0, initial: 0}),
      delay: new fields.SchemaField({
        mode: new fields.StringField({required: true, choices: ["spd", "fixed"], initial: "spd"}),
        value: new fields.NumberField({required: true, integer: true, min: 0, initial: 30})
      }),
      hitBase: new fields.NumberField({required: true, nullable: true, integer: true, initial: null}),
      tags: new fields.SetField(new fields.StringField({required: true, blank: false})),
      boss: new fields.BooleanField({initial: false}),
      divineBeing: new fields.BooleanField({initial: false}),
      weakness: new fields.StringField({required: true, nullable: true, blank: false, choices: elements, initial: null}),
      resistance: new fields.StringField({required: true, nullable: true, blank: false, choices: elements, initial: null}),
      immunities: new fields.SetField(new fields.StringField({required: true, blank: false})),
      phaseBreaks: new fields.ArrayField(new fields.SchemaField({
        percent: new fields.NumberField({required: true, integer: true, min: 1, max: 99, initial: 50}),
        note: new fields.StringField({required: true, blank: true, initial: ""}),
        triggered: new fields.BooleanField({initial: false})
      })),
      yield: new fields.SchemaField({
        saturation: new fields.NumberField({required: true, integer: true, min: 0, initial: 0}),
        dust: new fields.NumberField({required: true, integer: true, min: 0, initial: 0}),
        divineAttention: new fields.NumberField({required: true, integer: true, min: 0, initial: 0}),
        drops: new fields.ArrayField(new fields.StringField({required: true, blank: false}))
      }),
      row: new fields.StringField({required: true, choices: DEICIDE.dungeon.rows, initial: "front"}),
      description: new fields.HTMLField({required: true, blank: true, initial: ""}),
      notes: new fields.HTMLField({required: true, blank: true, initial: ""})
    };
  }

  prepareDerivedData() {
    const hit = this.hitBase ?? evaluate(DEICIDE.enemyFormulas.monsterHit, {level: this.level});
    const avoid = evaluate(DEICIDE.enemyFormulas.monsterAvoid, {spd: this.spd});
    const weakTo = [];
    for ( const tag of this.tags ) for ( const element of DEICIDE.monsterTags[tag]?.weakTo ?? [] ) weakTo.push(element);
    const fixedDelay = (this.delay.mode === "fixed") ? this.delay.value
      : (Array.from(this.tags).some(tag => DEICIDE.monsterTags[tag]?.fixedDelay) ? DEICIDE.monsterTags.homunculus.fixedDelay : null);
    this.derived = {
      hit, avoid, weakTo, fixedDelay,
      isBoss: this.boss || Array.from(this.tags).includes("boss"),
      noGuard: this.boss || Array.from(this.tags).some(tag => DEICIDE.monsterTags[tag]?.noGuard),
      phase: this.phaseBreaks.filter(entry => (this.hp.value / Math.max(this.hp.max, 1)) * 100 <= entry.percent).length,
      moves: (this.parent?.items ?? []).filter(item => item.type === "ability").map(item => item.id)
    };
  }

  get profile() {
    const d = this.derived;
    return {
      kind: "monster",
      name: this.parent?.name ?? "",
      level: this.level,
      attributes: {str: 0, mag: this.mag, skl: this.skl, spd: this.spd, def: this.def, res: this.res, cmd: 0},
      defense: {def: this.def, res: this.res, avoid: 0},
      hp: {value: this.hp.value, max: this.hp.max},
      classTypes: Array.from(this.tags).filter(tag => tag in DEICIDE.classTypes),
      tags: Array.from(this.tags),
      statuses: Array.from(this.parent?.statuses ?? []),
      affinities: [],
      weakness: this.weakness,
      resistance: this.resistance,
      weakTo: d.weakTo,
      immunities: Array.from(this.immunities),
      divineBeing: this.divineBeing || Array.from(this.tags).includes("divine"),
      modifiers: [],
      hitBase: d.hit
    };
  }
}
