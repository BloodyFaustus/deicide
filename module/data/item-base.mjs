import {fields, versionField} from "./fields.mjs";

export class ItemDataBase extends foundry.abstract.TypeDataModel {

  static defineSchema() {
    return {
      schemaVersion: versionField(1),
      identifier: new fields.StringField({required: true, blank: true, initial: ""}),
      description: new fields.HTMLField({required: true, blank: true, initial: ""})
    };
  }

  get name() {
    return this.parent?.name ?? "";
  }

  get equippedSlot() {
    return null;
  }

  get profile() {
    return null;
  }

  static migrateData(source) {
    if ( source.schemaVersion === undefined ) source.schemaVersion = 1;
    return super.migrateData(source);
  }

  async _preCreate(data, options, user) {
    const allowed = await super._preCreate(data, options, user);
    if ( allowed === false ) return false;
    if ( !data.system?.identifier && this.parent?.name ) {
      const words = this.parent.name.replace(/['’]/g, "").split(/[^A-Za-z0-9]+/).filter(Boolean);
      const identifier = words.map((word, i) => i ? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase() : word.toLowerCase()).join("");
      this.updateSource({identifier});
    }
  }
}
