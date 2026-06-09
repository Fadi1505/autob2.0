import type { CombatBuild } from '../game/types';

export type Phase = 'lobby' | 'draft' | 'shop' | 'combat' | 'finished';

export interface PlayerView {
  id: string;
  name: string;
  isBot: boolean;
  alive: boolean;
  hp: number;
  maxHp: number;
  gold: number;
  level: number;
  streak: number;
  heroId: string | null;
  ready: boolean;
  sectPoints: Record<string, number>;
  cardCount: number;
  // private fields: only populated for the receiving player
  draftOptions?: string[];
  shopOffers?: string[];
  ownedCardIds?: string[];
  lastResult?: 'win' | 'loss' | 'bye' | null;
}

export interface MatchupView {
  aId: string;
  bId: string;
}

export interface GameStateView {
  roomCode: string;
  phase: Phase;
  round: number;
  youId: string;
  hostId: string;
  phaseEndsAt: number | null;
  players: PlayerView[];
  matchups: MatchupView[];
  winnerId: string | null;
  canStart: boolean;
}

export interface CombatStartMsg {
  seed: number;
  a: CombatBuild;
  b: CombatBuild;
  aId: string;
  bId: string;
  youCombatantId: number; // 1 = build a, 2 = build b
  durationMs: number;
  spectating: boolean;
}

export type ClientMsg =
  | { t: 'join'; name: string; room?: string }
  | { t: 'start' }
  | { t: 'pickHero'; heroId: string }
  | { t: 'rerollDraft' }
  | { t: 'buyCard'; cardId: string }
  | { t: 'rerollShop' }
  | { t: 'ready' }
  | { t: 'rematch' };

export type ServerMsg =
  | { t: 'joined'; youId: string; roomCode: string }
  | { t: 'state'; state: GameStateView }
  | { t: 'combatStart'; match: CombatStartMsg }
  | { t: 'error'; message: string };

export const ARENA_W = 920;
export const ARENA_H = 520;
export const MAX_COMBAT_SECONDS = 12;
