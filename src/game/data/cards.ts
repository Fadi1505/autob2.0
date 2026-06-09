import type { CardDef, Rarity, SectId } from '../types';
import { SECTS, SECT_ORDER } from './sects';
import { getAbility } from './abilities';

const COST: Record<Rarity, number> = { common: 3, rare: 6, epic: 9 };

function card(
  id: string,
  name: string,
  sect: SectId,
  rarity: Rarity,
  points: number,
  grantedAbility?: string,
): CardDef {
  let description = `+${points} ${SECTS[sect].name}`;
  if (grantedAbility) {
    const a = getAbility(grantedAbility);
    if (a) description += ` · grants ${a.name}`;
  }
  return { id, name, sect, rarity, cost: COST[rarity], points, grantedAbility, description };
}

const list: CardDef[] = [];

// Generic stat cards: one common (1 pt) and one rare (2 pt) per sect.
for (const sectId of SECT_ORDER) {
  const name = SECTS[sectId].name;
  list.push(card(`${sectId}_t`, `${name} Training`, sectId, 'common', 1));
  list.push(card(`${sectId}_m`, `${name} Mastery`, sectId, 'rare', 2));
}

// Ability-granting cards (tie to thematically relevant sects).
// Original six.
list.push(card('tome_fireball', 'Tome: Fireball', 'magic', 'rare', 1, 'fireball'));
list.push(card('tome_frost_nova', 'Tome: Frost Nova', 'frost', 'epic', 2, 'frost_nova'));
list.push(card('tome_whirlwind', 'Tome: Whirlwind', 'attack', 'epic', 2, 'whirlwind'));
list.push(card('rune_bloodlust', 'Rune: Bloodlust', 'attack', 'rare', 1, 'bloodlust'));
list.push(card('rune_thorns', 'Rune: Thorns', 'ward', 'rare', 1, 'thorns'));
list.push(card('rune_regen', 'Rune: Regeneration', 'regen', 'rare', 1, 'regeneration'));

// Stormcaller
list.push(card('tome_chain_lightning', 'Tome: Chain Lightning', 'magic', 'epic', 2, 'chain_lightning'));
list.push(card('rune_static_field', 'Rune: Static Field', 'ultimate', 'rare', 1, 'static_field'));
// Reaper
list.push(card('rune_life_siphon', 'Rune: Life Siphon', 'attack', 'rare', 1, 'reaper_passive'));
list.push(card('tome_shadow_bolt', 'Tome: Shadow Bolt', 'magic', 'epic', 2, 'reaper_ult'));
// Guardian
list.push(card('sigil_divine_shield', 'Sigil: Divine Shield', 'regen', 'rare', 1, 'guardian_passive'));
list.push(card('tome_holy_smash', 'Tome: Holy Smash', 'attack', 'epic', 2, 'guardian_ult'));
// Venomancer
list.push(card('rune_venom_strike', 'Rune: Venom Strike', 'attack', 'epic', 2, 'venomancer_passive'));
list.push(card('tome_plague_cloud', 'Tome: Plague Cloud', 'ultimate', 'epic', 2, 'venomancer_ult'));
// Templar
list.push(card('rune_sacred_strike', 'Rune: Sacred Strike', 'healing', 'rare', 1, 'templar_passive'));
list.push(card('tome_divine_nova', 'Tome: Divine Nova', 'magic', 'epic', 2, 'templar_ult'));
// Frostbinder
list.push(card('sigil_ice_armor', 'Sigil: Ice Armor', 'frost', 'rare', 1, 'frostbinder_passive'));
list.push(card('tome_ice_lance', 'Tome: Ice Lance', 'frost', 'epic', 2, 'frostbinder_ult'));
// Warlock
list.push(card('rune_mana_leech', 'Rune: Mana Leech', 'ultimate', 'rare', 1, 'warlock_passive'));
list.push(card('tome_soul_rend', 'Tome: Soul Rend', 'magic', 'epic', 2, 'warlock_ult'));
// Duelist
list.push(card('rune_flurry', 'Rune: Flurry', 'fury', 'rare', 1, 'duelist_passive'));
list.push(card('rune_blade_dance', 'Rune: Blade Dance', 'attack', 'epic', 2, 'duelist_ult'));
// Shaman
list.push(card('sigil_healing_totem', 'Sigil: Healing Totem', 'healing', 'rare', 1, 'shaman_passive'));
list.push(card('tome_spirit_storm', 'Tome: Spirit Storm', 'magic', 'epic', 2, 'shaman_ult'));
// Marksman
list.push(card('rune_piercing_shot', 'Rune: Piercing Shot', 'critical', 'rare', 1, 'marksman_passive'));
list.push(card('rune_volley', 'Rune: Volley', 'attack', 'epic', 2, 'marksman_ult'));
// Ironhide
list.push(card('sigil_fortify', 'Sigil: Fortify', 'shield', 'rare', 1, 'fortify'));
list.push(card('sigil_retaliate', 'Sigil: Retaliate', 'ward', 'rare', 1, 'retaliate'));

export const CARDS: CardDef[] = list;

export const CARDS_BY_ID: Record<string, CardDef> = Object.fromEntries(
  CARDS.map((c) => [c.id, c] as const),
);

export function getCard(id: string): CardDef | undefined {
  return CARDS_BY_ID[id];
}

export function rollShop(rng: () => number, count: number, level: number): string[] {
  // Higher player level unlocks rares/epics.
  const weighted: string[] = [];
  for (const c of CARDS) {
    let w = 0;
    if (c.rarity === 'common') w = 6;
    else if (c.rarity === 'rare') w = level >= 3 ? 3 : 1;
    else w = level >= 6 ? 2 : 0; // epic
    for (let i = 0; i < w; i++) weighted.push(c.id);
  }
  const offers: string[] = [];
  let guard = 0;
  while (offers.length < count && guard < 400) {
    guard++;
    const pick = weighted[Math.floor(rng() * weighted.length)];
    if (pick && !offers.includes(pick)) offers.push(pick);
  }
  return offers;
}
