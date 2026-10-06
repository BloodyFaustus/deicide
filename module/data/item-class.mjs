import {DEICIDE} from "../config.mjs";
import {classCaps, classGrowthLine, promotionBonusFor} from "../rules/growth.mjs";
import {attributeSchema, fields} from "./fields.mjs";
import {ItemDataBase} from "./item-base.mjs";

const GROWTH_GRADES = Object.keys(DEICIDE.growthTenths);

export class ClassData extends ItemDataBase {

  static LOCALIZATION_PREFIXES = ["DEICIDE.Class"];

  static defineSchema() {
    const growth = {};
    for ( const attr of DEICIDE.attributeIds ) {
      growth[attr] = new fields.StringField({required: true, blank: true, initial: "", validate: value => (value === "") || GROWTH_GRADES.includes(value)});
    }
    return {
      ...super.defineSchema(),
      tier: new fields.NumberField({required: true, integer: true, min: 1, max: 4, initial: 1}),
      types: new fields.ArrayField(new fields.StringField({required: true, choices: Object.keys(DEICIDE.classTypes)})),
      growth: new fields.SchemaField(growth),
      hp: new fields.NumberField({required: true, integer: true, min: 0, initial: 3}),
      trains: new fields.SchemaField({
        primary: new fields.ArrayField(new fields.StringField({required: true, blank: false})),
        secondary: new fields.ArrayField(new fields.StringField({required: true, blank: false}))
      }),
      trainsText: new fields.StringField({required: true, blank: true, initial: ""}),
      startSpread: attributeSchema(0),
      prerequisites: new fields.ObjectField({required: true, nullable: true, initial: null}),
      prerequisiteText: new fields.StringField({required: true, blank: true, initial: ""}),
      storyGate: new fields.StringField({required: true, blank: true, initial: ""}),
      skills: new fields.ArrayField(new fields.SchemaField({
        rank: new fields.NumberField({required: true, integer: true, min: 1, max: 10, initial: 1}),
        id: new fields.StringField({required: true, blank: false}),
        mastery: new fields.BooleanField({initial: false})
      })),
      ladder: new fields.StringField({required: true, choices: Object.keys(DEICIDE.skillRanks), initial: "standard"}),
      move: new fields.NumberField({required: true, nullable: true, integer: true, min: 0, initial: null}),
      affinities: new fields.ArrayField(new fields.StringField({required: true, blank: false})),
      enemyOnly: new fields.BooleanField({initial: false}),
      layered: new fields.BooleanField({initial: false}),
      grantsFullTruth: new fields.BooleanField({initial: false}),
      grantsCap: new fields.StringField({required: true, blank: true, initial: ""}),
      choices: new fields.ArrayField(new fields.StringField({required: true, blank: false})),
      kit: new fields.SchemaField({
        weapon: new fields.StringField({required: true, blank: true, initial: ""}),
        offhand: new fields.StringField({required: true, blank: true, initial: ""}),
        armor: new fields.StringField({required: true, blank: true, initial: ""})
      })
    };
  }

  prepareDerivedData() {
    const growthLine = classGrowthLine(this);
    this.derived = {
      growthLine,
      growthTotalTenths: Object.values(growthLine).reduce((a, b) => a + b, 0),
      printedTenths: DEICIDE.attributeIds.reduce((sum, attr) => sum + (DEICIDE.growthTenths[this.growth[attr]] ?? 0), 0),
      tierTotalTenths: DEICIDE.tierGrowthTenths[this.tier] ?? 0,
      caps: classCaps(this),
      promotionBonus: promotionBonusFor(this),
      skillRanks: DEICIDE.skillRanks[this.ladder] ?? DEICIDE.skillRanks.standard,
      typeLabels: this.types.map(type => DEICIDE.classTypes[type]?.label ?? type)
    };
  }
}
