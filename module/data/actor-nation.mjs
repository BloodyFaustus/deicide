import {DEICIDE} from "../config.mjs";
import {nationValues} from "../rules/company.mjs";
import {displayMultiplier, pacingMultiplier} from "../rules/pacing.mjs";
import {tierGatesFor} from "../rules/proficiency.mjs";
import {fields, versionField} from "./fields.mjs";

function trackSchema(side) {
  const schema = {};
  for ( const [id, track] of Object.entries(DEICIDE.nationTracks) ) {
    schema[id] = new fields.NumberField({
      required: true, integer: true, min: DEICIDE.trackRange.min, max: DEICIDE.trackRange.max, initial: track[side]
    });
  }
  return new fields.SchemaField(schema);
}

export class NationData extends foundry.abstract.TypeDataModel {

  static LOCALIZATION_PREFIXES = ["DEICIDE.Nation"];

  static defineSchema() {
    return {
      schemaVersion: versionField(1),
      tracks: trackSchema("lathander"),
      offweissTracks: trackSchema("offweiss"),
      warMonth: new fields.NumberField({required: true, integer: true, min: 1, max: DEICIDE.warClock.months, initial: 1}),
      warWeek: new fields.NumberField({required: true, integer: true, min: 1, max: DEICIDE.warClock.weeksPerMonth, initial: 1}),
      dust: new fields.NumberField({required: true, integer: true, min: 0, initial: 0}),
      pacing: new fields.SchemaField({
        N: new fields.NumberField({required: true, integer: true, min: 1, initial: DEICIDE.pacing.defaults.N}),
        S: new fields.NumberField({required: true, integer: true, min: 1, initial: DEICIDE.pacing.defaults.S}),
        L: new fields.NumberField({required: true, integer: true, min: 1, initial: DEICIDE.pacing.defaults.L})
      }),
      deathRule: new fields.StringField({required: true, choices: Object.keys(DEICIDE.deathRules), initial: DEICIDE.defaultDeathRule}),
      ventures: new fields.ArrayField(new fields.SchemaField({
        id: new fields.StringField({required: true, blank: false, initial: () => foundry.utils.randomID()}),
        type: new fields.StringField({required: true, choices: Object.keys(DEICIDE.economy.ventures.types)}),
        startMonth: new fields.NumberField({required: true, integer: true, min: 1, initial: 1}),
        resolved: new fields.BooleanField({initial: false}),
        result: new fields.StringField({required: true, blank: true, initial: ""})
      })),
      debts: new fields.ArrayField(new fields.SchemaField({
        id: new fields.StringField({required: true, blank: false, initial: () => foundry.utils.randomID()}),
        creditor: new fields.StringField({required: true, blank: true, initial: "crown"}),
        amount: new fields.NumberField({required: true, integer: true, min: 0, initial: 0}),
        debtorId: new fields.StringField({required: true, nullable: true, blank: false, initial: null})
      })),
      fleet: new fields.SchemaField({
        sloop: new fields.NumberField({required: true, integer: true, min: 0, initial: DEICIDE.naval.lathanderFleet.sloop}),
        frigate: new fields.NumberField({required: true, integer: true, min: 0, initial: DEICIDE.naval.lathanderFleet.frigate}),
        shipOfTheLine: new fields.NumberField({required: true, integer: true, min: 0, initial: 0})
      }),
      log: new fields.ArrayField(new fields.SchemaField({
        month: new fields.NumberField({required: true, integer: true, min: 1, initial: 1}),
        text: new fields.StringField({required: true, blank: true, initial: ""}),
        changes: new fields.ObjectField()
      })),
      notes: new fields.HTMLField({required: true, blank: true, initial: ""})
    };
  }

  prepareDerivedData() {
    const dials = {S: this.pacing.S, L: this.pacing.L};
    const stage = DEICIDE.warClock.stages.find(entry => (this.warMonth >= entry.months[0]) && (this.warMonth <= entry.months[1]));
    this.derived = {
      P: pacingMultiplier(dials),
      displayP: displayMultiplier(dials),
      tierGates: tierGatesFor(this.pacing.L),
      values: nationValues(this.tracks),
      offweissValues: nationValues(this.offweissTracks),
      dustCollapse: DEICIDE.warClock.dustCollapseMonths.includes(this.warMonth) && (this.tracks.dust < DEICIDE.commissions.dustCollapseMinDustTrack),
      stage: stage?.id ?? null,
      unlocks: Object.fromEntries(Object.entries(DEICIDE.weaponsTrackUnlocks).map(([key, value]) => [key, this.tracks.weapons >= value]))
    };
  }
}
