export class Pipeline {

  constructor(name, steps = []) {
    this.name = name;
    for ( const [id, fn] of steps ) this.add(id, fn);
  }

  #steps = [];

  get order() {
    return this.#steps.map(step => step.id);
  }

  has(id) {
    return this.#steps.some(step => step.id === id);
  }

  #indexOf(id) {
    const index = this.#steps.findIndex(step => step.id === id);
    if ( index < 0 ) throw new Error(`${this.name}: no step named "${id}"`);
    return index;
  }

  #assertNew(id, fn) {
    if ( typeof fn !== "function" ) throw new TypeError(`${this.name}: step "${id}" must be a function`);
    if ( this.has(id) ) throw new Error(`${this.name}: a step named "${id}" already exists`);
  }

  add(id, fn, {before, after} = {}) {
    this.#assertNew(id, fn);
    if ( before ) this.#steps.splice(this.#indexOf(before), 0, {id, fn});
    else if ( after ) this.#steps.splice(this.#indexOf(after) + 1, 0, {id, fn});
    else this.#steps.push({id, fn});
    return this;
  }

  replace(id, fn) {
    if ( typeof fn !== "function" ) throw new TypeError(`${this.name}: step "${id}" must be a function`);
    this.#steps[this.#indexOf(id)].fn = fn;
    return this;
  }

  remove(id) {
    this.#steps.splice(this.#indexOf(id), 1);
    return this;
  }

  run(context, ...args) {
    for ( const step of this.#steps ) {
      if ( step.fn(context, ...args) === false ) break;
    }
    return context;
  }

  async runAsync(context, ...args) {
    for ( const step of this.#steps ) {
      if ( (await step.fn(context, ...args)) === false ) break;
    }
    return context;
  }
}
