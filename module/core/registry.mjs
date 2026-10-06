export class Registry {

  constructor(name, {validate} = {}) {
    this.name = name;
    this.#validate = validate;
  }

  #entries = new Map();

  #validate;

  #listeners = new Set();

  register(id, entry) {
    if ( (typeof id !== "string") || !id ) throw new TypeError(`${this.name}: an entry id must be a non empty string`);
    const stored = this.#validate ? this.#validate(id, entry) : entry;
    this.#entries.set(id, stored);
    for ( const listener of this.#listeners ) listener(id, stored);
    return stored;
  }

  registerAll(entries) {
    for ( const [id, entry] of Object.entries(entries) ) this.register(id, entry);
    return this;
  }

  unregister(id) {
    return this.#entries.delete(id);
  }

  get(id, {strict = false} = {}) {
    const entry = this.#entries.get(id);
    if ( (entry === undefined) && strict ) throw new Error(`${this.name}: no entry registered as "${id}"`);
    return entry;
  }

  has(id) {
    return this.#entries.has(id);
  }

  get size() {
    return this.#entries.size;
  }

  keys() {
    return this.#entries.keys();
  }

  values() {
    return this.#entries.values();
  }

  entries() {
    return this.#entries.entries();
  }

  [Symbol.iterator]() {
    return this.#entries.entries();
  }

  onRegister(listener) {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  toObject() {
    return Object.fromEntries(this.#entries);
  }
}
