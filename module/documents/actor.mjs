import {DEICIDE, SYSTEM_ID} from "../config.mjs";
import {createCharacter, issuedKit} from "../rules/creation.mjs";
import {
  applyLevel, applyPromotion, applyRankBonus, assignFlex, classCaps, cpForRank, rankForCp, trainedAttributes
} from "../rules/growth.mjs";
import {xpToNext} from "../rules/pacing.mjs";

export class DeicideActor extends foundry.documents.Actor {

  get derived() {
    return this.system.derived ?? {};
  }

  get profile() {
    return this.system.profile ?? null;
  }

  get lookup() {
    const overrides = this.items.filter(item => ["class", "origin", "ability"].includes(item.type))
      .map(item => ({identifier: item.system.identifier, type: item.type, system: item.system}));
    return game.deicide.catalog.lookup(overrides);
  }

  static getDefaultArtwork(actorData) {
    const icons = {
      character: "icons/svg/mystery-man.svg", company: "icons/svg/tower.svg",
      monster: "icons/svg/skull.svg", nation: "icons/svg/castle.svg"
    };
    const img = icons[actorData?.type] ?? super.getDefaultArtwork(actorData).img;
    return {img, texture: {src: img}};
  }

  async _preCreate(data, options, user) {
    const allowed = await super._preCreate(data, options, user);
    if ( allowed === false ) return false;
    const prototypeToken = {};
    if ( data.type === "character" ) Object.assign(prototypeToken, {actorLink: true, disposition: CONST.TOKEN_DISPOSITIONS.FRIENDLY, displayBars: CONST.TOKEN_DISPLAY_MODES.OWNER_HOVER});
    if ( data.type === "company" ) Object.assign(prototypeToken, {actorLink: true, displayBars: CONST.TOKEN_DISPLAY_MODES.ALWAYS});
    if ( data.type === "monster" ) Object.assign(prototypeToken, {actorLink: false, disposition: CONST.TOKEN_DISPOSITIONS.HOSTILE, displayBars: CONST.TOKEN_DISPLAY_MODES.OWNER_HOVER});
    if ( Object.keys(prototypeToken).length ) this.updateSource({prototypeToken});
  }

  static async createCharacter(inputs, {name = "New Character", kit = null, actorData = {}} = {}) {
    const lookup = game.deicide.catalog.lookup();
    const {system, errors} = createCharacter(inputs, lookup);
    if ( errors.length ) throw new Error(errors.join(" "));
    const baseClass = lookup("class", inputs.baseClass);
    const actor = await this.create({name, type: "character", system, ...actorData});
    const chosenKit = kit ?? {...issuedKit(baseClass), belt: []};
    await actor.grantKit(chosenKit);
    await actor.update({"system.hp.value": actor.system.hp.max, "system.channel.value": actor.system.channel.max, "system.matter.value": actor.system.matter.max});
    return actor;
  }

  async grantKit(kit) {
    const catalog = game.deicide.catalog;
    const data = [];
    const add = (type, id, extra = {}) => {
      if ( !id ) return;
      const entry = catalog.get(type, id);
      if ( !entry ) { ui.notifications?.warn(`Unknown ${type} "${id}"`); return; }
      data.push({name: entry.name, type: entry.type, img: entry.img, system: {...entry.system, ...extra}});
    };
    add("weapon", kit.weapon, {equipped: true});
    add("offhand", kit.offhand, {equipped: true});
    add("armor", kit.armor, {equipped: true});
    for ( const id of kit.accessories ?? [] ) add("accessory", id, {equipped: true});
    for ( const id of kit.belt ?? [] ) add("consumable", id, {onBelt: true});
    if ( data.length ) await this.createEmbeddedDocuments("Item", data);
  }

  get activeClassData() {
    return this.lookup("class", this.system.activeClass) ?? null;
  }

  async levelUp({flex = null, rng = undefined} = {}) {
    const lookup = this.lookup;
    const classData = this.activeClassData;
    if ( !classData ) throw new Error("No active class");
    const people = lookup("origin", this.system.people);
    const talent = this.system.talent.id ? lookup("origin", this.system.talent.id) : null;
    const source = this.system.toObject();
    const result = applyLevel(source, classData, people, source.personalGrowth, talent, {flex, rng: rng ?? (() => CONFIG.Dice.randomUniform())});
    await this.update({
      "system.level": result.level,
      "system.growthTenths": result.growthTenths,
      "system.growthLog": result.growthLog
    });
    Hooks.callAll("deicide.levelUp", this, result.entry);
    return result.entry;
  }

  async awardXp(amount) {
    const cap = game.deicide.nation?.levelCap ?? DEICIDE.pacing.defaults.L;
    let xp = this.system.xp + amount;
    let gained = 0;
    while ( (this.system.level < cap) && (xp >= xpToNext(this.system.level)) ) {
      xp -= xpToNext(this.system.level);
      await this.levelUp();
      gained++;
    }
    await this.update({"system.xp": xp});
    return gained;
  }

  async awardCp(amount, {stat = null} = {}) {
    const classes = foundry.utils.deepClone(this.system.toObject().classes);
    const entry = classes.find(c => c.id === this.system.activeClass);
    if ( !entry ) throw new Error("No active class");
    const classData = this.activeClassData;
    const before = entry.rank;
    entry.cp += amount;
    const newRank = Math.max(entry.rank, rankForCp(entry.cp));
    let rankBonuses = this.system.toObject().rankBonuses;
    const caps = classCaps(classData, {
      talent: this.system.talent.id ? this.lookup("origin", this.system.talent.id) : null,
      talentChoice: this.system.talent, people: this.lookup("origin", this.system.people)
    });
    for ( let rank = before + 1; rank <= newRank; rank++ ) {
      rankBonuses = applyRankBonus({...this.system.toObject(), rankBonuses}, classData, rank, caps, stat);
    }
    entry.rank = newRank;
    await this.update({"system.classes": classes, "system.rankBonuses": rankBonuses});
    if ( newRank > before ) Hooks.callAll("deicide.rankUp", this, classData, newRank);
    return {rank: newRank, ranksGained: newRank - before};
  }

  async addClass(classId, {activate = true, choices = {}} = {}) {
    const classData = this.lookup("class", classId);
    if ( !classData ) throw new Error(`Unknown class "${classId}"`);
    const source = this.system.toObject();
    const classes = [...source.classes];
    if ( !classes.some(c => c.id === classId) ) classes.push({id: classId, rank: 1, cp: cpForRank(1), choices});
    const caps = classCaps(classData, {
      talent: source.talent.id ? this.lookup("origin", source.talent.id) : null, talentChoice: source.talent,
      people: this.lookup("origin", source.people)
    });
    const promotionBonuses = applyPromotion(source, classData, caps);
    const update = {"system.classes": classes, "system.promotionBonuses": promotionBonuses};
    if ( activate ) update["system.activeClass"] = classId;
    await this.update(update);
    Hooks.callAll("deicide.classAdded", this, classData);
  }

  async placeFlex(level, attr) {
    const caps = this.derived.caps;
    const log = assignFlex(this.system.toObject(), level, attr, caps);
    if ( !log ) return false;
    await this.update({"system.growthLog": log});
    return true;
  }

  get trainedAttributes() {
    return trainedAttributes(this.system);
  }

  async changePool(pool, delta) {
    if ( pool === "static" ) {
      const max = this.derived.static?.max ?? 0;
      return this.update({"system.static": Math.min(Math.max(this.system.static + delta, 0), max)});
    }
    const current = this.system[pool];
    if ( !current ) return this;
    const value = Math.min(Math.max(current.value + delta, 0), current.max ?? Infinity);
    return this.update({[`system.${pool}.value`]: value});
  }

  async applyDamage(amount) {
    if ( this.type === "company" ) {
      return this.update({"system.strength": Math.max(this.system.strength - amount, 0)});
    }
    return this.changePool("hp", -amount);
  }

  getRollData() {
    const data = super.getRollData();
    const derived = this.derived;
    if ( derived.values ) Object.assign(data, derived.values);
    return data;
  }
}

export {SYSTEM_ID};
