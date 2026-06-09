import type { AbilityDef, AbilityKind, Trigger } from '../types';

function mk(
  id: string,
  name: string,
  kind: AbilityKind,
  opts: Partial<AbilityDef> & { description?: string } = {},
): AbilityDef {
  return {
    id,
    name,
    kind,
    manaCost: opts.manaCost ?? 0,
    cooldown: opts.cooldown ?? 0,
    trigger: (opts.trigger ?? 'none') as Trigger,
    procChance: opts.procChance ?? 1,
    internalCooldown: opts.internalCooldown ?? 0,
    period: opts.period ?? 1,
    effectId: opts.effectId ?? '',
    params: opts.params ?? {},
    description: opts.description ?? '',
  };
}

const list: AbilityDef[] = [
  // --- Fully implemented (effectId resolved in sim/effects.ts) --------------
  mk('fireball', 'Fireball', 'active', {
    manaCost: 30,
    cooldown: 1.1,
    effectId: 'fireball',
    params: { damageMult: 2.4, speed: 320 },
    description: 'Hurls a bolt of fire at the current target.',
  }),
  mk('frost_nova', 'Frost Nova', 'active', {
    manaCost: 48,
    cooldown: 4,
    effectId: 'frost_nova',
    params: { damageMult: 1.4, radius: 120, slow: 0.5, slowDuration: 3 },
    description: 'Detonates frost nearby, damaging and slowing enemies.',
  }),
  mk('whirlwind', 'Whirlwind', 'ultimate', {
    manaCost: 60,
    cooldown: 6,
    effectId: 'whirlwind',
    params: { damageMult: 2.2, radius: 100 },
    description: 'Spins violently, hitting all nearby enemies hard.',
  }),
  mk('bloodlust', 'Bloodlust', 'passive', {
    trigger: 'onAttack',
    procChance: 0.35,
    effectId: 'bloodlust',
    params: { bonusMult: 1.6, lifesteal: 0.5 },
    description: 'Attacks may strike for bonus damage and heal the wielder.',
  }),
  mk('thorns', 'Thorns', 'passive', {
    trigger: 'onTakeDamage',
    procChance: 1,
    internalCooldown: 0.4,
    effectId: 'thorns',
    params: { reflect: 0.4 },
    description: 'Reflects a portion of incoming damage to the attacker.',
  }),
  mk('regeneration', 'Regeneration', 'passive', {
    trigger: 'periodic',
    period: 1,
    effectId: 'regeneration',
    params: { heal: 7 },
    description: 'Steadily regenerates health every second.',
  }),

  // --- Stormcaller ---------------------------------------------------------
  mk('chain_lightning', 'Chain Lightning', 'active', {
    manaCost: 40,
    cooldown: 1.5,
    effectId: 'chain_lightning',
    params: { damageMult: 1.8, radius: 130 },
    description: 'Arcs lightning through enemies near the target.',
  }),
  mk('static_field', 'Static Field', 'passive', {
    trigger: 'periodic',
    period: 2,
    effectId: 'static_field',
    params: { damageMult: 0.5, radius: 70 },
    description: 'A shock aura that periodically zaps the current target.',
  }),

  // --- Reaper --------------------------------------------------------------
  mk('reaper_passive', 'Life Siphon', 'passive', {
    trigger: 'onAttack',
    procChance: 0.4,
    effectId: 'lifedrain',
    params: { bonusMult: 1.3 },
    description: 'Attacks may drain extra life, healing the Reaper for the damage dealt.',
  }),
  mk('reaper_ult', 'Shadow Bolt', 'ultimate', {
    manaCost: 70,
    cooldown: 6,
    effectId: 'shadow_bolt',
    params: { damageMult: 2.8, speed: 300 },
    description: 'Hurls a bolt of dark energy for heavy single-target damage.',
  }),

  // --- Guardian ------------------------------------------------------------
  mk('guardian_passive', 'Divine Shield', 'passive', {
    trigger: 'onTakeDamage',
    procChance: 0.3,
    internalCooldown: 0.6,
    effectId: 'divine_shield',
    params: { heal: 20 },
    description: 'Taking damage may trigger a heal that scales with Regen.',
  }),
  mk('guardian_ult', 'Holy Smash', 'ultimate', {
    manaCost: 65,
    cooldown: 6,
    effectId: 'whirlwind',
    params: { damageMult: 1.8, radius: 90 },
    description: 'Slams the ground, damaging all nearby enemies.',
  }),

  // --- Venomancer ----------------------------------------------------------
  mk('venomancer_passive', 'Venom Strike', 'passive', {
    trigger: 'onAttack',
    procChance: 0.35,
    effectId: 'venom_strike',
    params: { poisonMult: 0.25, duration: 3, interval: 1 },
    description: 'Attacks may poison the target, dealing damage over time.',
  }),
  mk('venomancer_ult', 'Plague Cloud', 'ultimate', {
    manaCost: 60,
    cooldown: 6,
    effectId: 'plague_cloud',
    params: { radius: 140, poisonMult: 0.3, duration: 4, interval: 1 },
    description: 'Releases a cloud that poisons all nearby enemies.',
  }),

  // --- Templar -------------------------------------------------------------
  mk('templar_passive', 'Sacred Strike', 'passive', {
    trigger: 'onAttack',
    procChance: 0.3,
    effectId: 'sacred_strike',
    params: { healRatio: 0.5 },
    description: 'Attacks may bless the Templar, healing for a share of attack damage.',
  }),
  mk('templar_ult', 'Divine Nova', 'ultimate', {
    manaCost: 70,
    cooldown: 6,
    effectId: 'divine_nova',
    params: { damageMult: 1.4, radius: 100, healRatio: 0.5 },
    description: 'A burst of holy light that damages enemies and heals the caster.',
  }),

  // --- Frostbinder ---------------------------------------------------------
  mk('frostbinder_passive', 'Ice Armor', 'passive', {
    trigger: 'onTakeDamage',
    procChance: 0.4,
    internalCooldown: 0.6,
    effectId: 'ice_armor',
    params: { slow: 0.5, dur: 2.5 },
    description: 'Attackers may be chilled, slowing their movement and attacks.',
  }),
  mk('frostbinder_ult', 'Ice Lance', 'ultimate', {
    manaCost: 55,
    cooldown: 5,
    effectId: 'ice_lance',
    params: { damageMult: 2.2, slow: 0.65, dur: 4 },
    description: 'Impales the target for heavy damage and a long slow.',
  }),

  // --- Warlock -------------------------------------------------------------
  mk('warlock_passive', 'Mana Leech', 'passive', {
    trigger: 'periodic',
    period: 2.5,
    effectId: 'mana_leech',
    params: { drain: 15 },
    description: 'Periodically siphons mana from the current target.',
  }),
  mk('warlock_ult', 'Soul Rend', 'ultimate', {
    manaCost: 80,
    cooldown: 7,
    effectId: 'soul_rend',
    params: { damageMult: 2 },
    description: 'Tears at the target soul, healing the Warlock for the damage dealt.',
  }),

  // --- Duelist -------------------------------------------------------------
  mk('duelist_passive', 'Flurry', 'passive', {
    trigger: 'onAttack',
    procChance: 0.3,
    effectId: 'flurry',
    params: { mult: 0.6 },
    description: 'Attacks may chain into an immediate extra strike.',
  }),
  mk('duelist_ult', 'Blade Dance', 'ultimate', {
    manaCost: 65,
    cooldown: 6,
    effectId: 'blade_dance',
    params: { hits: 3 },
    description: 'Unleashes a flurry of blade strikes on the target.',
  }),

  // --- Shaman --------------------------------------------------------------
  mk('shaman_passive', 'Healing Totem', 'passive', {
    trigger: 'periodic',
    period: 1.5,
    effectId: 'regeneration',
    params: { heal: 18 },
    description: 'A totem that steadily restores the Shaman health.',
  }),
  mk('shaman_ult', 'Spirit Storm', 'ultimate', {
    manaCost: 75,
    cooldown: 6,
    effectId: 'spirit_storm',
    params: { damageMult: 1.6, radius: 120, healRatio: 0.4 },
    description: 'Summons a storm of spirits that damage enemies and heal the caster.',
  }),

  // --- Marksman ------------------------------------------------------------
  mk('marksman_passive', 'Piercing Shot', 'passive', {
    trigger: 'onAttack',
    procChance: 0.3,
    effectId: 'piercing_shot',
    params: { mult: 0.5 },
    description: 'Attacks may pierce armour, bypassing the target damage reduction.',
  }),
  mk('marksman_ult', 'Volley', 'ultimate', {
    manaCost: 60,
    cooldown: 6,
    effectId: 'volley',
    params: { shots: 3, damageMult: 1, speed: 340 },
    description: 'Fires a volley of projectiles at the target.',
  }),

  // --- Ironhide ------------------------------------------------------------
  mk('fortify', 'Fortify', 'passive', {
    trigger: 'periodic',
    period: 3,
    effectId: 'fortify',
    params: { dr: 12, dur: 2 },
    description: 'Periodically hardens, gaining flat damage reduction for a few seconds.',
  }),
  mk('retaliate', 'Retaliate', 'passive', {
    trigger: 'onTakeDamage',
    procChance: 0.3,
    internalCooldown: 0.5,
    effectId: 'retaliate',
    params: { reflect: 0.6 },
    description: 'Strikes back at attackers, reflecting damage and healing slightly.',
  }),
];

export const ABILITIES: Record<string, AbilityDef> = Object.fromEntries(
  list.map((a) => [a.id, a] as const),
);

export function getAbility(id: string): AbilityDef | undefined {
  return ABILITIES[id];
}
