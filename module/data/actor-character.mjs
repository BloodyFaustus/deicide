import {DEICIDE} from "../config.mjs";
import {deriveCharacter} from "../rules/derive.mjs";
import {attributeSchema, fields, poolSchema, versionField} from "./fields.mjs";
import {sceneMode} from "../hooks/scene-mode.mjs";

export const CHARACTER_SCHEMA_VERSION = 1;

export class CharacterData extends foundry.abstract.TypeDataModel {

  static LOCALIZATION_PREFIXES = ["DEICIDE.Character"];

  static defineSchema() {
    const attrChoices = DEICIDE.attributeIds;
    return {
      schemaVersion: versionField(CHARACTER_SCHEMA_VERSION),
      level: new fields.NumberField({required: true, integer: true, min: 1, initial: 1}),
      xp: new fields.NumberField({required: true, integer: true, min: 0, initial: 0}),

      attributes: attributeSchema(DEICIDE.attributeBase),
      growthTenths: attributeSchema(0),
      growthLog: new fields.ArrayField(new fields.ObjectField()),
      promotionBonuses: new fields.ArrayField(new fields.ObjectField()),
      rankBonuses: new fields.ArrayField(new fields.ObjectField()),
      adaptations: new fields.ArrayField(new fields.StringField({required: true, choices: attrChoices})),

      hp: poolSchema(0),
      channel: poolSchema(0),
      matter: poolSchema(0),

      manaburn: new fields.NumberField({required: true, nullable: true, integer: true, min: 0, max: 100, initial: 0}),
      saturation: new fields.NumberField({required: true, nullable: true, integer: true, min: 0, max: 100, initial: null}),
      marks: new fields.NumberField({required: true, integer: true, min: 0, initial: 0}),
      divineAttention: new fields.NumberField({required: true, integer: true, min: 0, initial: 0}),
      static: new fields.NumberField({required: true, integer: true, min: 0, initial: 0}),
      stolen: new fields.ArrayField(new fields.ObjectField()),

      people: new fields.StringField({required: true, blank: true, initial: ""}),
      peopleSubtype: new fields.StringField({required: true, blank: true, initial: ""}),
      background: new fields.StringField({required: true, blank: true, initial: ""}),
      talent: new fields.SchemaField({
        id: new fields.StringField({required: true, nullable: true, blank: false, initial: null}),
        stat: new fields.StringField({required: true, nullable: true, blank: false, initial: null}),
        penaltyStat: new fields.StringField({required: true, nullable: true, blank: false, initial: null}),
        proficiency: new fields.StringField({required: true, nullable: true, blank: false, initial: null}),
        placement: new fields.ObjectField()
      }),
      personalGrowth: attributeSchema(0),

      classes: new fields.ArrayField(new fields.SchemaField({
        id: new fields.StringField({required: true, blank: false}),
        rank: new fields.NumberField({required: true, integer: true, min: 1, max: DEICIDE.maxRank, initial: 1}),
        cp: new fields.NumberField({required: true, integer: true, min: 0, initial: 0}),
        choices: new fields.ObjectField()
      })),
      activeClass: new fields.StringField({required: true, blank: true, initial: ""}),
      loadout: new fields.SchemaField({
        secondary: new fields.StringField({required: true, nullable: true, blank: false, initial: null}),
        reaction: new fields.StringField({required: true, nullable: true, blank: false, initial: null}),
        supports: new fields.ArrayField(new fields.StringField({required: true, blank: false})),
        stance: new fields.StringField({required: true, nullable: true, blank: false, initial: null})
      }),
      storyGates: new fields.ArrayField(new fields.StringField({required: true, blank: false})),

      standingFaction: new fields.TypedObjectField(new fields.NumberField({required: true, integer: true, min: 0, max: 100, initial: 0})),
      standingPersonal: new fields.TypedObjectField(new fields.NumberField({required: true, integer: true, min: 0, max: 100, initial: 0})),
      recruit: new fields.SchemaField({
        profile: new fields.StringField({required: true, blank: true, initial: ""}),
        ownerId: new fields.StringField({required: true, nullable: true, blank: false, initial: null}),
        status: new fields.StringField({required: true, blank: true, initial: ""}),
        personalSkillId: new fields.StringField({required: true, blank: true, initial: ""}),
        story: new fields.BooleanField({initial: false}),
        gmRun: new fields.BooleanField({initial: false})
      }),
      bonds: new fields.ArrayField(new fields.SchemaField({
        actorId: new fields.StringField({required: true, blank: false}),
        points: new fields.NumberField({required: true, integer: true, min: 0, initial: 0}),
        skill: new fields.StringField({required: true, blank: true, initial: ""}),
        broken: new fields.BooleanField({initial: false})
      })),
      debt: new fields.NumberField({required: true, integer: true, min: 0, initial: 0}),
      dust: new fields.NumberField({required: true, integer: true, min: 0, initial: 0}),

      facing: new fields.NumberField({required: true, integer: true, min: 0, max: 7, initial: 0}),
      row: new fields.StringField({required: true, choices: DEICIDE.dungeon.rows, initial: "front"}),
      attuned: new fields.StringField({required: true, nullable: true, blank: false, initial: null}),

      notes: new fields.HTMLField({required: true, blank: true, initial: ""})
    };
  }

  get equipment() {
    const actor = this.parent;
    const equipment = {weapon: null, offhand: null, armor: null, accessories: [], pin: null, belt: []};
    if ( !actor?.items ) return equipment;
    for ( const item of actor.items ) {
      const profile = item.system.profile;
      if ( !profile ) continue;
      const slot = item.system.equippedSlot;
      if ( !slot ) continue;
      if ( slot === "accessory" ) equipment.accessories.push(profile);
      else if ( slot === "belt" ) equipment.belt.push(profile);
      else equipment[slot] = profile;
    }
    return equipment;
  }

  get ownedAbilities() {
    return (this.parent?.items ?? []).filter(item => item.type === "ability").map(item => item.system.toObject());
  }

  prepareDerivedData() {
    const actor = this.parent;
    const api = game.deicide;
    const overrides = (actor?.items ?? []).filter(item => ["class", "origin", "ability"].includes(item.type))
      .map(item => ({identifier: item.system.identifier, type: item.type, system: item.system}));
    const lookup = api?.catalog ? api.catalog.lookup(overrides) : () => null;
    const mode = sceneMode();
    this.derived = deriveCharacter(this, {
      lookup,
      equipment: this.equipment,
      owned: this.ownedAbilities,
      context: {
        mode,
        arena: mode === "arena",
        statuses: Array.from(actor?.statuses ?? []),
        attuned: this.attuned,
        levelCap: api?.nation?.levelCap ?? DEICIDE.pacing.defaults.L,
        tierGates: api?.nation?.tierGates ?? null,
        classCatalog: api?.catalog?.all("class") ?? [],
        name: actor?.name ?? ""
      }
    });
    const d = this.derived;

    this.hp.max = d.hp.max;
    this.channel.max = d.channel?.max ?? 0;
    this.matter.max = d.matter?.max ?? 0;
    this.hp.value = Math.min(this.hp.value, this.hp.max);
    this.channel.value = Math.min(this.channel.value, this.channel.max);
    this.matter.value = Math.min(this.matter.value, this.matter.max);
  }

  get profile() {
    const profile = this.derived?.profile;
    if ( !profile ) return null;
    return {...profile, hp: {value: this.hp.value, max: this.hp.max}, name: this.parent?.name ?? profile.name};
  }

  static migrateData(source) {

    if ( source.schemaVersion === undefined ) source.schemaVersion = CHARACTER_SCHEMA_VERSION;
    return super.migrateData(source);
  }
}
