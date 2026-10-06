import {DEICIDE, SYSTEM_ID} from "./config.mjs";
import {Registry} from "./core/registry.mjs";
import {Pipeline} from "./core/pipeline.mjs";
import {Catalog} from "./core/catalog.mjs";
import * as expression from "./core/expression.mjs";
import * as predicate from "./core/predicate.mjs";
import * as modifiers from "./core/modifiers.mjs";
import * as random from "./core/random.mjs";
import * as grades from "./rules/grades.mjs";
import * as growth from "./rules/growth.mjs";
import * as proficiency from "./rules/proficiency.mjs";
import * as collapse from "./rules/collapse.mjs";
import * as resolve from "./rules/resolve.mjs";
import * as delay from "./rules/delay.mjs";
import * as company from "./rules/company.mjs";
import * as pacing from "./rules/pacing.mjs";
import * as economy from "./rules/economy.mjs";
import * as doctrine from "./rules/doctrine.mjs";
import * as derive from "./rules/derive.mjs";
import * as creation from "./rules/creation.mjs";
import * as effects from "./rules/effects.mjs";
import * as reactions from "./rules/reactions.mjs";
import * as bonds from "./rules/bonds.mjs";
import * as commands from "./rules/commands.mjs";
import * as facing from "./rules/facing.mjs";
import * as generateNpc from "./rules/generate/npc.mjs";
import * as generateArmy from "./rules/generate/army.mjs";
import * as generateLoot from "./rules/generate/loot.mjs";
import * as generateEncounter from "./rules/generate/encounter.mjs";
import {sceneEngine, sceneMode, setSceneMode} from "./hooks/scene-mode.mjs";

export function buildApi({catalog, documents = {}, apps = {}, version = "0.0.0"}) {
  return {
    id: SYSTEM_ID,
    version,
    config: DEICIDE,
    catalog,

    rules: {
      grades, growth, proficiency, collapse, resolve, delay, company, pacing, economy, doctrine, derive, creation, effects, reactions, bonds, commands, facing,
      generate: {npc: generateNpc, army: generateArmy, loot: generateLoot, encounter: generateEncounter}
    },

    core: {Registry, Pipeline, Catalog, expression, predicate, modifiers, random},

    registries: {
      conditions: predicate.conditions,
      prerequisiteKinds: proficiency.prerequisiteKinds,
      doctrineBehaviors: doctrine.doctrineBehaviors,
      effectKinds: effects.effectKinds
    },

    pipelines: {
      damage: resolve.damagePipeline,
      character: derive.characterPipeline
    },

    documents,
    apps,

    scene: {mode: sceneMode, engine: sceneEngine, setMode: setSceneMode},

    nation: {
      get actor() {
        return game.actors?.find(actor => actor.type === "nation") ?? null;
      },
      get levelCap() {
        return this.actor?.system.pacing.L ?? DEICIDE.pacing.defaults.L;
      },
      get dials() {
        const pacingDials = this.actor?.system.pacing;
        return pacingDials ? {N: pacingDials.N, S: pacingDials.S, L: pacingDials.L} : {...DEICIDE.pacing.defaults};
      },
      get tierGates() {
        return proficiency.tierGatesFor(this.levelCap);
      },
      get P() {
        return pacing.pacingMultiplier(this.dials);
      },
      get tracks() {
        return this.actor?.system.tracks ?? null;
      }
    }
  };
}
