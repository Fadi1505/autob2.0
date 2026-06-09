// Maps each hero to a CC0 KayKit Adventurers glTF model + which clips to use.
// All five KayKit character GLBs share the same 76-clip animation set, so we
// only need to vary the model file and the attack/cast clip per hero.
//
// Assets: KayKit Character Pack: Adventurers (CC0, no attribution required).
// Files live in /public/models and are served at /models/<file>.

export type LogicalAnim = 'idle' | 'run' | 'attack' | 'cast' | 'hit' | 'death';

export interface HeroModel {
  file: string;
  anims: Record<LogicalAnim, string>;
  /**
   * KayKit characters ship with all weapon/shield meshes rigged to the hand
   * bones. We hide every held item by default and only show the node names
   * listed here, so each hero wields the right loadout (correctly hand-placed
   * and animated for free).
   */
  show?: string[];
}

/** Held-item meshes hidden unless a hero's `show` list keeps them visible. */
export const HELD_ITEM_RE = /sword|axe|wand|staff|shield|knife|crossbow|spellbook|mug|throwable|offhand/i;

const KNIGHT = '/models/Knight.glb';
const BARBARIAN = '/models/Barbarian.glb';
const MAGE = '/models/Mage.glb';
const ROGUE = '/models/Rogue.glb';
const ROGUE_HOODED = '/models/Rogue_Hooded.glb';

// Shared clip names that exist in every KayKit character GLB.
const SHARED = {
  idle: 'Idle',
  run: 'Running_A',
  hit: 'Hit_A',
  death: 'Death_A',
};

const ATTACK = {
  melee1h: '1H_Melee_Attack_Slice_Diagonal',
  melee2h: '2H_Melee_Attack_Chop',
  spin: '2H_Melee_Attack_Spinning',
  dual: 'Dualwield_Melee_Attack_Slice',
  ranged: '1H_Ranged_Shoot',
  cast: 'Spellcast_Shoot',
};

const CAST = 'Spellcasting';

function model(file: string, attack: string, opts: { cast?: string; show?: string[] } = {}): HeroModel {
  return {
    file,
    anims: { ...SHARED, attack, cast: opts.cast ?? CAST },
    show: opts.show,
  };
}

// Per-hero mapping (covers the full roster from data/heroes.ts).
const MODELS: Record<string, HeroModel> = {
  // casters -> Mage (staff/wand + spellbook)
  pyromancer: model(MAGE, ATTACK.cast, { show: ['2H_Staff'] }),
  stormcaller: model(MAGE, ATTACK.cast, { show: ['2H_Staff'] }),
  frostbinder: model(MAGE, ATTACK.cast, { show: ['1H_Wand', 'Spellbook'] }),
  warlock: model(MAGE, ATTACK.cast, { show: ['1H_Wand', 'Spellbook'] }),
  shaman: model(MAGE, ATTACK.cast, { show: ['2H_Staff'] }),
  venomancer: model(ROGUE_HOODED, ATTACK.cast, { show: ['Knife'] }),

  // melee bruisers
  berserker: model(BARBARIAN, ATTACK.spin, { show: ['2H_Axe'] }),
  guardian: model(KNIGHT, ATTACK.melee1h, { show: ['1H_Sword', 'Round_Shield'] }),
  templar: model(KNIGHT, ATTACK.melee1h, { show: ['1H_Sword', 'Round_Shield'] }),
  reaper: model(ROGUE_HOODED, ATTACK.melee1h, { show: ['Knife'] }),
  duelist: model(ROGUE, ATTACK.dual, { show: ['Knife', 'Knife_Offhand'] }),
  marksman: model(ROGUE, ATTACK.ranged, { show: ['1H_Crossbow'] }),

  // passive tanks
  sentinel: model(KNIGHT, ATTACK.melee1h, { show: ['1H_Sword', 'Round_Shield'] }),
  ironhide: model(BARBARIAN, ATTACK.melee2h, { show: ['1H_Axe', 'Barbarian_Round_Shield'] }),
};

const DEFAULT_MODEL = model(KNIGHT, ATTACK.melee1h, { show: ['1H_Sword'] });

export function getHeroModel(heroId: string): HeroModel {
  return MODELS[heroId] ?? DEFAULT_MODEL;
}

/** Unique model files (for preloading / caching). */
export const ALL_MODEL_FILES: string[] = Array.from(
  new Set([KNIGHT, BARBARIAN, MAGE, ROGUE, ROGUE_HOODED]),
);

/** Target on-screen height (world units) every model is auto-scaled to. */
export const TARGET_HEIGHT = 3.2;
