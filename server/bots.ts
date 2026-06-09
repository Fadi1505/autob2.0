import { SECT_ORDER } from '../src/game/data/sects';
import type { SectId } from '../src/game/types';

const BOT_NAMES = [
  'Ares', 'Kratos', 'Helga', 'Vex', 'Rurik', 'Mara', 'Doom', 'Cinder',
  'Wraith', 'Onyx', 'Surge', 'Brawn', 'Hex', 'Talon', 'Frost', 'Gore',
];

export function botName(i: number): string {
  return 'Bot ' + (BOT_NAMES[i % BOT_NAMES.length] ?? 'X' + i);
}

export function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function randomSect(): SectId {
  return pick(SECT_ORDER);
}

// Each hero's [primary, secondary] sect, used by bots to draft and shop with synergy.
export const HERO_SECTS: Record<string, [SectId, SectId]> = {
  pyromancer: ['magic', 'ultimate'],
  berserker: ['attack', 'fury'],
  sentinel: ['ward', 'regen'],
  stormcaller: ['magic', 'ultimate'],
  reaper: ['attack', 'magic'],
  guardian: ['health', 'shield'],
  venomancer: ['attack', 'evasion'],
  templar: ['healing', 'magic'],
  frostbinder: ['magic', 'frost'],
  warlock: ['magic', 'ultimate'],
  duelist: ['attack', 'fury'],
  shaman: ['healing', 'regen'],
  marksman: ['attack', 'critical'],
  ironhide: ['health', 'shield'],
  archer: ['attack', 'critical'],
};
