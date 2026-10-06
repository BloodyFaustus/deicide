import {DEICIDE} from "../config.mjs";

const fields = foundry.data.fields;

export function attributeSchema(initial = 0, options = {}) {
  const schema = {};
  for ( const attr of DEICIDE.attributeIds ) {
    schema[attr] = new fields.NumberField({required: true, integer: true, min: 0, initial, ...options});
  }
  return new fields.SchemaField(schema);
}

export function poolSchema(initial = 0) {
  return new fields.SchemaField({
    value: new fields.NumberField({required: true, integer: true, min: 0, initial})
  });
}

export function choiceField(table, options = {}) {
  return new fields.StringField({required: true, blank: true, initial: "", ...options, validate: value => {
    if ( (value === "") || (value === null) ) return true;
    return value in table;
  }});
}

export function modifierArray() {
  return new fields.ArrayField(new fields.ObjectField());
}

export function versionField(current) {
  return new fields.NumberField({required: true, integer: true, min: 0, initial: current});
}

export {fields};
