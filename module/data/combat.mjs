import {DEICIDE} from "../config.mjs";
import {fields, versionField} from "./fields.mjs";

export class WarCombatData extends foundry.abstract.TypeDataModel {
  static LOCALIZATION_PREFIXES = ["DEICIDE.CombatWar"];

  static defineSchema() {
    return {
      schemaVersion: versionField(1),
      phase: new fields.StringField({required: true, choices: DEICIDE.war.phases, initial: DEICIDE.war.phases[0]}),
      doctrineQueue: new fields.ArrayField(new fields.ObjectField()),
      victory: new fields.SchemaField({
        type: new fields.StringField({required: true, blank: true, initial: ""}),
        rounds: new fields.NumberField({required: true, nullable: true, integer: true, min: 1, initial: null}),
        note: new fields.StringField({required: true, blank: true, initial: ""})
      }),
      log: new fields.ArrayField(new fields.ObjectField())
    };
  }
}

export class DungeonCombatData extends foundry.abstract.TypeDataModel {
  static LOCALIZATION_PREFIXES = ["DEICIDE.CombatDungeon"];

  static defineSchema() {
    const pool = () => new fields.SchemaField({
      front: new fields.NumberField({required: true, integer: true, min: 0, initial: 0}),
      back: new fields.NumberField({required: true, integer: true, min: 0, initial: 0})
    });
    return {
      schemaVersion: versionField(1),
      tick: new fields.NumberField({required: true, integer: true, min: 0, initial: 0}),
      surprise: new fields.StringField({required: true, choices: ["none", "party", "enemy"], initial: "none"}),
      arena: new fields.BooleanField({initial: false}),
      reactionsUsed: new fields.ObjectField(),
      barriers: new fields.SchemaField({party: pool(), enemy: pool()}),
      log: new fields.ArrayField(new fields.ObjectField())
    };
  }
}

export class UnitCombatantData extends foundry.abstract.TypeDataModel {
  static LOCALIZATION_PREFIXES = ["DEICIDE.Combatant"];

  static defineSchema() {
    return {
      schemaVersion: versionField(1),
      side: new fields.StringField({required: true, choices: ["party", "enemy"], initial: "party"}),
      nextTick: new fields.NumberField({required: true, integer: true, min: 0, initial: 0}),
      weightLast: new fields.NumberField({required: true, nullable: true, integer: true, min: 0, initial: null}),
      delayLast: new fields.NumberField({required: true, nullable: true, integer: true, min: 0, initial: null}),
      acted: new fields.BooleanField({initial: false}),
      guardNext: new fields.BooleanField({initial: false}),
      reactionUsed: new fields.BooleanField({initial: false}),
      row: new fields.StringField({required: true, choices: DEICIDE.dungeon.rows, initial: "front"}),
      tilesMoved: new fields.NumberField({required: true, integer: true, min: 0, initial: 0}),
      wardedTaken: new fields.NumberField({required: true, integer: true, min: 0, initial: 0}),
      fled: new fields.BooleanField({initial: false})
    };
  }
}

export class StatusEffectData extends foundry.data.ActiveEffectTypeDataModel {
  static LOCALIZATION_PREFIXES = ["DEICIDE.StatusEffect"];

  static defineSchema() {
    return {
      ...super.defineSchema(),
      statusId: new fields.StringField({required: true, blank: true, initial: ""}),
      stackRule: new fields.StringField({required: true, choices: ["refresh"], initial: "refresh"}),
      pool: new fields.NumberField({required: true, nullable: true, integer: true, min: 0, initial: null}),
      absorbed: new fields.NumberField({required: true, integer: true, min: 0, initial: 0}),
      element: new fields.StringField({required: true, nullable: true, blank: false, initial: null}),
      sourceUuid: new fields.StringField({required: true, nullable: true, blank: false, initial: null}),
      row: new fields.StringField({required: true, nullable: true, blank: false, initial: null}),
      description: new fields.HTMLField({required: true, blank: true, initial: ""})
    };
  }
}

export class ActionMessageData extends foundry.abstract.TypeDataModel {
  static LOCALIZATION_PREFIXES = ["DEICIDE.ActionMessage"];

  static defineSchema() {
    return {
      schemaVersion: versionField(1),
      kind: new fields.StringField({required: true, blank: true, initial: "attack"}),
      actorUuid: new fields.StringField({required: true, blank: true, initial: ""}),
      abilityId: new fields.StringField({required: true, blank: true, initial: ""}),
      mode: new fields.StringField({required: true, blank: true, initial: "war"}),
      targets: new fields.ArrayField(new fields.ObjectField()),
      result: new fields.ObjectField(),
      costs: new fields.ObjectField(),
      applied: new fields.ArrayField(new fields.StringField({required: true, blank: false}))
    };
  }
}

export class ScenarioPageData extends foundry.abstract.TypeDataModel {
  static LOCALIZATION_PREFIXES = ["DEICIDE.Scenario"];

  static defineSchema() {
    return {
      schemaVersion: versionField(1),
      kind: new fields.StringField({required: true, choices: ["war", "dungeon"], initial: "war"}),
      warMonth: new fields.NumberField({required: true, integer: true, min: 1, max: 12, initial: 1}),
      difficulty: new fields.StringField({required: true, choices: Object.keys(DEICIDE.difficulty), initial: "standard"}),
      card: new fields.ObjectField(),
      payout: new fields.SchemaField({
        tracks: new fields.ObjectField(),
        drops: new fields.ArrayField(new fields.StringField({required: true, blank: false})),
        dust: new fields.NumberField({required: true, integer: true, min: 0, initial: 0}),
        applied: new fields.BooleanField({initial: false})
      }),
      description: new fields.HTMLField({required: true, blank: true, initial: ""})
    };
  }
}
