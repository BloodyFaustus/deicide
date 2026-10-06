import {DEICIDE, SYSTEM_ID} from "../config.mjs";
import {fields} from "./fields.mjs";

export class TerrainBehaviorData extends foundry.data.regionBehaviors.RegionBehaviorType {
  static LOCALIZATION_PREFIXES = ["DEICIDE.Terrain", "BEHAVIOR.TYPES.base"];

  static defineSchema() {
    return {
      events: this._createEventsField({
        events: [CONST.REGION_EVENTS.TOKEN_ENTER, CONST.REGION_EVENTS.TOKEN_EXIT, CONST.REGION_EVENTS.TOKEN_ROUND_START],
        initial: [CONST.REGION_EVENTS.TOKEN_ENTER, CONST.REGION_EVENTS.TOKEN_EXIT, CONST.REGION_EVENTS.TOKEN_ROUND_START]
      }),
      terrain: new fields.StringField({required: true, choices: Object.keys(DEICIDE.terrain), initial: "plain"}),
      avoid: new fields.NumberField({required: true, nullable: true, integer: true, initial: null}),
      moveCost: new fields.NumberField({required: true, nullable: true, integer: true, min: 0, initial: null}),
      matter: new fields.BooleanField({required: true, nullable: true, initial: null}),
      plagueZone: new fields.BooleanField({initial: false}),
      elevation: new fields.NumberField({required: true, integer: true, min: 0, initial: 0})
    };
  }

  get table() {
    const base = DEICIDE.terrain[this.terrain] ?? DEICIDE.terrain.plain;
    return {
      id: this.terrain,
      avoid: this.avoid ?? base.avoid,
      cost: this.moveCost ?? base.cost,
      matter: this.matter ?? base.matter,
      burnPerRound: this.plagueZone ? DEICIDE.terrain.plague.burnPerRound : (base.burnPerRound ?? 0),
      highGround: Boolean(base.highGround) || (this.elevation >= 1),
      elevation: this.elevation
    };
  }

  async _handleRegionEvent(event) {
    const handler = game.deicide?.terrain;
    if ( !handler ) return;
    switch ( event.name ) {
      case CONST.REGION_EVENTS.TOKEN_ENTER: return handler.onEnter(event, this);
      case CONST.REGION_EVENTS.TOKEN_EXIT: return handler.onExit(event, this);
      case CONST.REGION_EVENTS.TOKEN_ROUND_START: return handler.onRoundStart(event, this);
    }
  }

  _getTerrainEffects(token, segment, options) {
    const cost = this.table.cost;
    if ( cost === null ) return [{name: "difficulty", difficulty: Infinity}];
    if ( cost === 1 ) return [];
    return [{name: "difficulty", difficulty: cost}];
  }
}

export {SYSTEM_ID};
