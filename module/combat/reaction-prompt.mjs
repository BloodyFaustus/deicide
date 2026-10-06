import {DEICIDE, SYSTEM_ID} from "../config.mjs";

export const REACTION_QUERY = "deicide.reactionPrompt";

const {HandlebarsApplicationMixin, ApplicationV2} = foundry.applications.api;

export class ReactionPrompt extends HandlebarsApplicationMixin(ApplicationV2) {

  static DEFAULT_OPTIONS = {
    id: "deicide-reaction-prompt-{id}",
    classes: ["deicide", "reaction-prompt"],
    window: {title: "DEICIDE.Reaction.PromptTitle", icon: "fa-solid fa-bolt", resizable: false},
    position: {width: 420},
    actions: {
      accept: ReactionPrompt.#onAccept,
      skip: ReactionPrompt.#onSkip,
      moveUp: ReactionPrompt.#onMoveUp,
      moveDown: ReactionPrompt.#onMoveDown
    }
  };

  static PARTS = {
    prompt: {template: "systems/deicide/templates/apps/reaction-prompt.hbs"}
  };

  constructor(prompt, {timeoutMs = DEICIDE.reactions.promptTimeoutMs, context = {}, ...options} = {}) {
    super(options);
    this.prompt = prompt;
    this.timeoutMs = timeoutMs;
    this.context = context;
    this.order = prompt.options.map(option => option.abilityId);
    this.selected = new Set();
  }

  #resolve = null;
  #timer = null;
  #deadline = 0;

  async ask() {
    return new Promise(resolve => {
      this.#resolve = resolve;
      this.#deadline = Date.now() + this.timeoutMs;
      this.render({force: true});
      this.#timer = setInterval(() => {
        const remaining = Math.max(0, Math.ceil((this.#deadline - Date.now()) / 1000));
        const el = this.element?.querySelector(".countdown");
        if ( el ) el.textContent = String(remaining);
        if ( remaining <= 0 ) this.#finish([]);
      }, 250);
    });
  }

  #finish(result) {
    if ( this.#timer ) clearInterval(this.#timer);
    this.#timer = null;
    const resolve = this.#resolve;
    this.#resolve = null;
    this.close();
    resolve?.(result);
  }

  async _prepareContext() {
    const options = this.order.map((abilityId, index) => {
      const option = this.prompt.options.find(entry => entry.abilityId === abilityId);
      return {...option, index, selected: this.selected.has(abilityId), first: index === 0, last: index === this.order.length - 1};
    });
    return {
      reactorName: this.prompt.reactorName,
      attackerName: this.context.attackerName ?? "",
      abilityName: this.context.abilityName ?? "",
      options,
      seconds: Math.max(0, Math.ceil((this.#deadline - Date.now()) / 1000)),
      multiple: options.length > 1
    };
  }

  _onRender(context, options) {
    super._onRender(context, options);
    for ( const box of this.element.querySelectorAll("input[type=checkbox][data-ability-id]") ) {
      box.addEventListener("change", () => {
        if ( box.checked ) this.selected.add(box.dataset.abilityId);
        else this.selected.delete(box.dataset.abilityId);
      });
    }
  }

  async close(options = {}) {
    if ( this.#resolve ) this.#finish([]);
    return super.close(options);
  }

  static #onAccept() {
    const accepted = this.order.filter(id => this.selected.has(id));
    this.#finish(accepted.length ? accepted : this.order.slice(0, 1));
  }

  static #onSkip() {
    this.#finish([]);
  }

  static #onMoveUp(event, target) {
    const id = target.closest("[data-ability-id]")?.dataset.abilityId;
    const index = this.order.indexOf(id);
    if ( index > 0 ) {
      [this.order[index - 1], this.order[index]] = [this.order[index], this.order[index - 1]];
      this.render();
    }
  }

  static #onMoveDown(event, target) {
    const id = target.closest("[data-ability-id]")?.dataset.abilityId;
    const index = this.order.indexOf(id);
    if ( (index >= 0) && (index < this.order.length - 1) ) {
      [this.order[index + 1], this.order[index]] = [this.order[index], this.order[index + 1]];
      this.render();
    }
  }
}

async function handleReactionQuery({prompt, timeoutMs, context}) {
  const app = new ReactionPrompt(prompt, {timeoutMs, context});
  const accepted = await app.ask();
  return {reactorId: prompt.reactorId, accepted};
}

export function registerReactionQueries() {
  CONFIG.queries[REACTION_QUERY] = handleReactionQuery;
}

export function owningUser(actor) {
  const players = game.users.filter(user => user.active && !user.isGM && actor?.testUserPermission(user, "OWNER"));
  return players[0] ?? game.users.activeGM ?? game.user;
}

export async function queryUser(user, name, data, {timeout} = {}) {
  if ( !user || user.isSelf ) return CONFIG.queries[name](data);
  return user.query(name, data, {timeout});
}

export async function promptReactions(prompts, {context = {}, timeoutMs = DEICIDE.reactions.promptTimeoutMs} = {}) {
  const autoNpc = game.settings.get(SYSTEM_ID, "autoReactions");
  const results = await Promise.all(prompts.map(async prompt => {
    const actor = prompt.actorUuid ? await fromUuid(prompt.actorUuid) : null;
    const hasPlayer = actor?.hasPlayerOwner ?? false;
    if ( !hasPlayer && autoNpc ) {

      const best = [...prompt.options].sort((a, b) => a.priority - b.priority)[0];
      return {reactorId: prompt.reactorId, accepted: best ? [best.abilityId] : [], auto: true};
    }
    const user = owningUser(actor);
    try {
      const answer = await queryUser(user, REACTION_QUERY, {prompt, timeoutMs, context}, {timeout: timeoutMs + 2000});
      return {reactorId: prompt.reactorId, accepted: answer?.accepted ?? []};
    }
    catch ( error ) {
      console.warn(`${SYSTEM_ID} | Reaction prompt failed for ${prompt.reactorName}: ${error.message}`);
      return {reactorId: prompt.reactorId, accepted: []};
    }
  }));
  return results;
}
