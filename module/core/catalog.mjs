export class Catalog {

  #layers = new Map();

  #order = [];

  #listeners = new Set();

  #version = 0;

  static LAYERS = Object.freeze({builtin: 0, module: 10, compendium: 20, world: 30});

  get version() {
    return this.#version;
  }

  #changed() {
    this.#version++;
    for ( const listener of this.#listeners ) listener();
  }

  onChange(listener) {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  layer(name, priority) {
    let layer = this.#layers.get(name);
    if ( !layer ) {
      layer = {priority: priority ?? Catalog.LAYERS[name] ?? Catalog.LAYERS.module, types: new Map()};
      this.#layers.set(name, layer);
      this.#order = Array.from(this.#layers.entries())
        .sort((a, b) => b[1].priority - a[1].priority)
        .map(([layerName]) => layerName);
    }
    return layer;
  }

  load(layerName, entries, {replace = false} = {}) {
    const layer = this.layer(layerName);
    if ( replace ) layer.types.clear();
    for ( const entry of entries ?? [] ) {
      const identifier = entry?.identifier ?? entry?.system?.identifier;
      if ( !identifier || !entry.type ) continue;
      let byId = layer.types.get(entry.type);
      if ( !byId ) layer.types.set(entry.type, byId = new Map());
      byId.set(identifier, {...entry, identifier, layer: layerName});
    }
    this.#changed();
  }

  remove(layerName, type, identifier) {
    if ( this.#layers.get(layerName)?.types.get(type)?.delete(identifier) ) this.#changed();
  }

  clear(layerName) {
    const layer = this.#layers.get(layerName);
    if ( !layer ) return;
    layer.types.clear();
    this.#changed();
  }

  get(type, identifier) {
    if ( !identifier ) return null;
    for ( const name of this.#order ) {
      const entry = this.#layers.get(name).types.get(type)?.get(identifier);
      if ( entry ) return entry;
    }
    return null;
  }

  system(type, identifier) {
    return this.get(type, identifier)?.system ?? null;
  }

  has(type, identifier) {
    return this.get(type, identifier) !== null;
  }

  all(type, filter) {
    const merged = new Map();
    for ( const name of [...this.#order].reverse() ) {
      for ( const [identifier, entry] of this.#layers.get(name).types.get(type) ?? [] ) merged.set(identifier, entry);
    }
    let entries = Array.from(merged.values());
    if ( filter ) entries = entries.filter(filter);
    return entries.sort((a, b) => String(a.name).localeCompare(String(b.name)));
  }

  types() {
    const types = new Set();
    for ( const layer of this.#layers.values() ) {
      for ( const [type, byId] of layer.types ) if ( byId.size ) types.add(type);
    }
    return Array.from(types);
  }

  counts() {
    return Object.fromEntries(this.types().map(type => [type, this.all(type).length]));
  }

  lookup(overrides = []) {
    if ( !overrides.length ) return (type, identifier) => this.system(type, identifier);
    const local = new Map();
    for ( const entry of overrides ) {
      const identifier = entry?.identifier ?? entry?.system?.identifier;
      if ( identifier ) local.set(`${entry.type}:${identifier}`, entry.system);
    }
    return (type, identifier) => local.get(`${type}:${identifier}`) ?? this.system(type, identifier);
  }
}
