import type { HeroDef, HeroCategory, Stats } from '../types';

function mk(
  id: string,
  name: string,
  category: HeroCategory,
  color: string,
  baseStats: Stats,
  abilityIds: string[],
  playable: boolean,
  description: string,
): HeroDef {
  return { id, name, category, color, baseStats, abilityIds, playable, description };
}

const list: HeroDef[] = [
  // --- 3 fully-wired playable heroes (one per category) -------------------
  mk(
    'pyromancer',
    'Pyromancer',
    'caster',
    '#f2723b',
    { maxHp: 240, maxMana: 100, attackDamage: 14, attackSpeed: 0.9, manaRegen: 14, moveSpeed: 95, attackRange: 220 },
    ['fireball', 'frost_nova'],
    true,
    'A glass-cannon caster. Channels mana into two spells that auto-fire the moment the mana is there.',
  ),
  mk(
    'berserker',
    'Berserker',
    'standard',
    '#d6354a',
    { maxHp: 420, maxMana: 100, attackDamage: 22, attackSpeed: 1.2, manaRegen: 9, moveSpeed: 120, attackRange: 60 },
    ['bloodlust', 'whirlwind'],
    true,
    'A melee bruiser whose attacks proc lifesteal bonus damage, unleashing Whirlwind when mana fills.',
  ),
  mk(
    'sentinel',
    'Sentinel',
    'passive',
    '#5a8fd6',
    { maxHp: 560, maxMana: 0, attackDamage: 16, attackSpeed: 0.8, manaRegen: 0, moveSpeed: 95, attackRange: 60 },
    ['thorns', 'regeneration'],
    true,
    'An unkillable wall with no active casts at all - it just reflects damage and regenerates endlessly.',
  ),

  // --- 1 more caster ------------------------------------------------------
  mk(
    'stormcaller',
    'Stormcaller',
    'caster',
    '#5a9bf2',
    { maxHp: 230, maxMana: 110, attackDamage: 13, attackSpeed: 0.9, manaRegen: 15, moveSpeed: 95, attackRange: 220 },
    ['chain_lightning', 'static_field'],
    true,
    'A storm caster who chains lightning between foes while a static aura grinds them down.',
  ),
];

// --- 9 standard heroes (distinct stats reflecting each role) --------------
const STANDARD_HEROES: Record<string, { name: string; color: string; stats: Stats; description: string }> = {
  reaper: {
    name: 'Reaper',
    color: '#6b4a8a',
    stats: { maxHp: 360, maxMana: 100, attackDamage: 20, attackSpeed: 1.1, manaRegen: 10, moveSpeed: 110, attackRange: 65 },
    description: 'A fast life-draining skirmisher who heals from every cut and finishes with Shadow Bolt.',
  },
  guardian: {
    name: 'Guardian',
    color: '#c9a23b',
    stats: { maxHp: 500, maxMana: 100, attackDamage: 16, attackSpeed: 0.85, manaRegen: 8, moveSpeed: 90, attackRange: 60 },
    description: 'A holy bulwark that heals when struck and smashes clustered foes with Holy Smash.',
  },
  venomancer: {
    name: 'Venomancer',
    color: '#5fae57',
    stats: { maxHp: 350, maxMana: 100, attackDamage: 17, attackSpeed: 0.95, manaRegen: 11, moveSpeed: 100, attackRange: 70 },
    description: 'A poisoner whose strikes fester over time, culminating in a deadly Plague Cloud.',
  },
  templar: {
    name: 'Templar',
    color: '#d8c66a',
    stats: { maxHp: 430, maxMana: 100, attackDamage: 17, attackSpeed: 0.9, manaRegen: 10, moveSpeed: 95, attackRange: 65 },
    description: 'A radiant zealot who heals on attack and erupts with a damaging, self-healing Divine Nova.',
  },
  frostbinder: {
    name: 'Frostbinder',
    color: '#6fc8e0',
    stats: { maxHp: 250, maxMana: 110, attackDamage: 13, attackSpeed: 0.85, manaRegen: 14, moveSpeed: 90, attackRange: 200 },
    description: 'A frost mage who chills attackers and impales targets with a long-slowing Ice Lance.',
  },
  warlock: {
    name: 'Warlock',
    color: '#7a4d9c',
    stats: { maxHp: 280, maxMana: 120, attackDamage: 14, attackSpeed: 0.85, manaRegen: 13, moveSpeed: 90, attackRange: 210 },
    description: 'A dark caster who leeches mana and rends souls, healing from the carnage.',
  },
  duelist: {
    name: 'Duelist',
    color: '#d6694a',
    stats: { maxHp: 370, maxMana: 90, attackDamage: 21, attackSpeed: 1.3, manaRegen: 9, moveSpeed: 120, attackRange: 60 },
    description: 'A nimble blade-dancer who chains extra strikes and explodes into a flurry of hits.',
  },
  shaman: {
    name: 'Shaman',
    color: '#4fae8a',
    stats: { maxHp: 410, maxMana: 100, attackDamage: 16, attackSpeed: 0.9, manaRegen: 12, moveSpeed: 95, attackRange: 80 },
    description: 'A sustain bruiser kept alive by a totem who calls a damaging, self-healing Spirit Storm.',
  },
  marksman: {
    name: 'Marksman',
    color: '#b0a050',
    stats: { maxHp: 320, maxMana: 100, attackDamage: 20, attackSpeed: 0.95, manaRegen: 10, moveSpeed: 100, attackRange: 240 },
    description: 'A ranged sharpshooter who pierces armour and unloads a multi-shot Volley.',
  },
};

for (const [hid, info] of Object.entries(STANDARD_HEROES)) {
  list.push(
    mk(hid, info.name, 'standard', info.color, info.stats, [`${hid}_passive`, `${hid}_ult`], true, info.description),
  );
}

// --- 1 passive-only tank --------------------------------------------------
list.push(
  mk(
    'ironhide',
    'Ironhide',
    'passive',
    '#8a7d6b',
    { maxHp: 600, maxMana: 0, attackDamage: 15, attackSpeed: 0.8, manaRegen: 0, moveSpeed: 85, attackRange: 60 },
    ['fortify', 'retaliate'],
    true,
    'An immovable tank that periodically fortifies and punishes attackers with Retaliate.',
  ),
);

// --- Meshy AI archer (custom 3D model) ------------------------------------
list.push(
  mk(
    'archer',
    'Forest Archer',
    'standard',
    '#6fae4f',
    { maxHp: 330, maxMana: 100, attackDamage: 21, attackSpeed: 1, manaRegen: 10, moveSpeed: 105, attackRange: 250 },
    ['marksman_passive', 'marksman_ult'],
    true,
    'A long-range bowman who pierces armour with every shot and looses a devastating Volley.',
  ),
);

export const HEROES: Record<string, HeroDef> = Object.fromEntries(
  list.map((h) => [h.id, h] as const),
);

export const HERO_ORDER: string[] = list.map((h) => h.id);

export function getHero(id: string): HeroDef | undefined {
  return HEROES[id];
}
