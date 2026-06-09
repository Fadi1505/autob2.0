import type { WebSocket } from 'ws';
import type { SectId, CombatBuild } from '../src/game/types';
import type {
  ClientMsg,
  ServerMsg,
  GameStateView,
  PlayerView,
  Phase,
  CombatStartMsg,
  MatchupView,
} from '../src/shared/protocol';
import { ARENA_W, ARENA_H, MAX_COMBAT_SECONDS } from '../src/shared/protocol';
import { HERO_ORDER } from '../src/game/data/heroes';
import { getCard, rollShop } from '../src/game/data/cards';
import { buildGladiator, computeSectPoints, playerLevel } from '../src/game/build';
import { BattleSim, FIXED_DT } from '../src/game/sim/BattleSim';
import { makeRng, randomSeed } from '../src/game/sim/rng';
import { botName, pick, randomSect, HERO_SECTS } from './bots';

const TARGET_PLAYERS = 8;
const START_HP = 50;
const DRAFT_SECONDS = 20;
const SHOP_SECONDS = 30;
const SHOP_SIZE = 5;
const REROLL_COST = 2;
const STARTING_GOLD = 0;

interface Player {
  id: string;
  name: string;
  isBot: boolean;
  connected: boolean;
  ws: WebSocket | null;
  alive: boolean;
  hp: number;
  gold: number;
  streak: number;
  heroId: string | null;
  ownedCardIds: string[];
  draftOptions: string[];
  draftRerolled: boolean;
  shopOffers: string[];
  ready: boolean;
  lastResult: 'win' | 'loss' | 'bye' | null;
  targetSect: SectId | null;
}

interface MatchResult {
  aId: string;
  bId: string | null; // null => ghost opponent
  ghostName?: string;
  buildA: CombatBuild;
  buildB: CombatBuild;
  seed: number;
  winnerIsA: boolean;
  durationMs: number;
}

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickN<T>(arr: T[], n: number): T[] {
  return shuffle(arr).slice(0, n);
}

export class Room {
  code: string;
  players: Player[] = [];
  hostId: string | null = null;
  phase: Phase = 'lobby';
  round = 0;
  phaseEndsAt: number | null = null;
  winnerId: string | null = null;
  matchups: MatchupView[] = [];
  private results: MatchResult[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private seq = 0;
  private onEmpty: (code: string) => void;

  constructor(code: string, onEmpty: (code: string) => void) {
    this.code = code;
    this.onEmpty = onEmpty;
  }

  // --- connections --------------------------------------------------------

  addHuman(ws: WebSocket, name: string): Player {
    const id = 'p' + ++this.seq;
    const player: Player = {
      id,
      name: name || 'Player',
      isBot: false,
      connected: true,
      ws,
      alive: true,
      hp: START_HP,
      gold: STARTING_GOLD,
      streak: 0,
      heroId: null,
      ownedCardIds: [],
      draftOptions: [],
      draftRerolled: false,
      shopOffers: [],
      ready: false,
      lastResult: null,
      targetSect: null,
    };
    this.players.push(player);
    if (!this.hostId) this.hostId = id;
    this.send(player, { t: 'joined', youId: id, roomCode: this.code });
    this.broadcast();
    return player;
  }

  removeWs(ws: WebSocket): void {
    const p = this.players.find((x) => x.ws === ws);
    if (!p) return;
    p.connected = false;
    p.ws = null;
    if (this.phase === 'lobby') {
      this.players = this.players.filter((x) => x !== p);
      if (this.hostId === p.id) this.hostId = this.players.find((x) => !x.isBot)?.id ?? null;
    } else {
      // hand the gladiator over to the AI so the match continues
      p.isBot = true;
      if (this.hostId === p.id) this.hostId = this.players.find((x) => !x.isBot && x.connected)?.id ?? this.hostId;
    }
    if (this.players.filter((x) => !x.isBot && x.connected).length === 0) {
      this.cleanup();
      this.onEmpty(this.code);
      return;
    }
    this.broadcast();
  }

  handle(ws: WebSocket, msg: ClientMsg): void {
    const p = this.players.find((x) => x.ws === ws);
    if (!p) return;
    switch (msg.t) {
      case 'start':
        if (p.id === this.hostId && this.phase === 'lobby') this.startGame();
        break;
      case 'pickHero':
        if (this.phase === 'draft' && p.draftOptions.includes(msg.heroId)) {
          p.heroId = msg.heroId;
          this.maybeAdvanceDraft();
          this.broadcast();
        }
        break;
      case 'rerollDraft':
        if (this.phase === 'draft' && !p.draftRerolled) {
          p.draftRerolled = true;
          p.draftOptions = pickN(HERO_ORDER, 3);
          this.broadcast();
        }
        break;
      case 'buyCard':
        if (this.phase === 'shop') {
          this.buyCard(p, msg.cardId);
          this.broadcast();
        }
        break;
      case 'rerollShop':
        if (this.phase === 'shop' && p.gold >= REROLL_COST) {
          p.gold -= REROLL_COST;
          p.shopOffers = rollShop(Math.random, SHOP_SIZE, playerLevel(p.ownedCardIds.length));
          this.broadcast();
        }
        break;
      case 'ready':
        if (this.phase === 'shop') {
          p.ready = true;
          this.maybeAdvanceShop();
          this.broadcast();
        }
        break;
      case 'rematch':
        if (this.phase === 'finished' && p.id === this.hostId) this.resetToLobby();
        break;
      default:
        break;
    }
  }

  // --- phase flow ---------------------------------------------------------

  private startGame(): void {
    // bot-fill to 8
    let bi = 0;
    while (this.players.length < TARGET_PLAYERS) {
      const id = 'p' + ++this.seq;
      this.players.push({
        id,
        name: botName(bi++),
        isBot: true,
        connected: false,
        ws: null,
        alive: true,
        hp: START_HP,
        gold: STARTING_GOLD,
        streak: 0,
        heroId: null,
        ownedCardIds: [],
        draftOptions: [],
        draftRerolled: false,
        shopOffers: [],
        ready: false,
        lastResult: null,
        targetSect: randomSect(),
      });
    }
    this.round = 0;
    this.enterDraft();
  }

  private enterDraft(): void {
    this.phase = 'draft';
    for (const p of this.players) {
      p.heroId = null;
      p.draftOptions = pickN(HERO_ORDER, 3);
      p.draftRerolled = false;
      if (p.isBot) p.heroId = this.botDraftPick(p);
    }
    this.setTimer(DRAFT_SECONDS, () => this.finishDraft());
    this.broadcast();
  }

  private maybeAdvanceDraft(): void {
    if (this.players.every((p) => p.heroId)) this.finishDraft();
  }

  private finishDraft(): void {
    for (const p of this.players) if (!p.heroId) p.heroId = pick(p.draftOptions.length ? p.draftOptions : HERO_ORDER);
    this.round = 1;
    this.enterShop();
  }

  private enterShop(): void {
    this.phase = 'shop';
    for (const p of this.players) {
      if (!p.alive) continue;
      p.gold += this.income(p);
      p.shopOffers = rollShop(Math.random, SHOP_SIZE, playerLevel(p.ownedCardIds.length));
      p.ready = false;
    }
    // bots shop immediately
    for (const p of this.players) if (p.isBot && p.alive) this.botShop(p);
    // If no living human still needs to shop, fast-forward (spectators only).
    const anyHuman = this.players.some((p) => p.alive && !p.isBot && p.connected);
    this.setTimer(anyHuman ? SHOP_SECONDS : 2, () => this.enterCombat());
    this.broadcast();
  }

  private maybeAdvanceShop(): void {
    const humans = this.players.filter((p) => p.alive && !p.isBot && p.connected);
    if (humans.length > 0 && humans.every((p) => p.ready)) this.enterCombat();
  }

  private enterCombat(): void {
    this.phase = 'combat';
    const alive = shuffle(this.players.filter((p) => p.alive));
    this.results = [];
    const queue = alive.slice();
    while (queue.length >= 2) {
      const a = queue.shift() as Player;
      const b = queue.shift() as Player;
      this.results.push(this.runMatch(a, b, null));
    }
    if (queue.length === 1) {
      const a = queue.shift() as Player;
      const ghostSrc = pick(this.players.filter((p) => p.id !== a.id));
      this.results.push(this.runMatch(a, null, ghostSrc));
    }

    this.matchups = this.results.map((r) => ({ aId: r.aId, bId: r.bId ?? `ghost:${r.ghostName ?? '?'}` }));
    const maxDuration = this.results.reduce((m, r) => Math.max(m, r.durationMs), 3000) + 1200;
    this.phaseEndsAt = Date.now() + maxDuration;
    this.broadcast();
    this.sendCombatStarts();
    this.setTimer(maxDuration / 1000, () => this.resolveCombat());
  }

  private runMatch(a: Player, b: Player | null, ghostSrc: Player | null): MatchResult {
    const buildA = buildGladiator(a.heroId as string, a.ownedCardIds) as CombatBuild;
    let buildB: CombatBuild;
    let ghostName: string | undefined;
    if (b) {
      buildB = buildGladiator(b.heroId as string, b.ownedCardIds) as CombatBuild;
    } else {
      const src = ghostSrc as Player;
      buildB = buildGladiator(src.heroId as string, src.ownedCardIds) as CombatBuild;
      buildB = { ...buildB, name: `${src.name} (ghost)` };
      ghostName = buildB.name;
    }
    const seed = randomSeed();
    const sim = new BattleSim(ARENA_W, ARENA_H, makeRng(seed));
    sim.setupDuel(buildA, buildB);
    const result = sim.runToEnd(MAX_COMBAT_SECONDS);
    const winnerIsA = result.winner !== 'enemy'; // ties resolve to A
    const durationMs = Math.min(MAX_COMBAT_SECONDS, Math.max(3, result.ticks * FIXED_DT)) * 1000;
    return { aId: a.id, bId: b ? b.id : null, ghostName, buildA, buildB, seed, winnerIsA, durationMs };
  }

  private sendCombatStarts(): void {
    const byPlayer = new Map<string, MatchResult>();
    for (const r of this.results) {
      byPlayer.set(r.aId, r);
      if (r.bId) byPlayer.set(r.bId, r);
    }
    for (const p of this.players) {
      if (p.isBot || !p.ws) continue;
      let r = byPlayer.get(p.id);
      let spectating = false;
      let youCombatantId = 0;
      if (r) {
        youCombatantId = r.aId === p.id ? 1 : 2;
      } else {
        r = this.results[0];
        spectating = true;
      }
      if (!r) continue;
      const match: CombatStartMsg = {
        seed: r.seed,
        a: r.buildA,
        b: r.buildB,
        aId: r.aId,
        bId: r.bId ?? 'ghost',
        youCombatantId,
        durationMs: r.durationMs,
        spectating,
      };
      this.send(p, { t: 'combatStart', match });
    }
  }

  private resolveCombat(): void {
    for (const r of this.results) {
      const a = this.byId(r.aId);
      const b = r.bId ? this.byId(r.bId) : null;
      if (!a) continue;
      const dmg = this.lossDamage();
      if (r.winnerIsA) {
        a.streak = Math.max(1, a.streak + 1);
        a.lastResult = 'win';
        if (b) {
          b.streak = Math.min(-1, b.streak - 1);
          b.lastResult = 'loss';
          b.hp -= dmg;
        }
      } else {
        a.streak = Math.min(-1, a.streak - 1);
        a.lastResult = 'loss';
        a.hp -= dmg;
        if (b) {
          b.streak = Math.max(1, b.streak + 1);
          b.lastResult = 'win';
        }
      }
    }
    for (const p of this.players) {
      if (p.alive && p.hp <= 0) {
        p.hp = 0;
        p.alive = false;
      }
    }
    const alivePlayers = this.players.filter((p) => p.alive);
    if (alivePlayers.length <= 1) {
      this.phase = 'finished';
      this.winnerId = alivePlayers[0]?.id ?? null;
      this.phaseEndsAt = null;
      this.clearTimer();
      this.broadcast();
      return;
    }
    this.round++;
    this.enterShop();
  }

  private resetToLobby(): void {
    this.clearTimer();
    this.phase = 'lobby';
    this.round = 0;
    this.winnerId = null;
    this.matchups = [];
    this.results = [];
    this.phaseEndsAt = null;
    this.players = this.players.filter((p) => !p.isBot && p.connected);
    for (const p of this.players) {
      p.alive = true;
      p.hp = START_HP;
      p.gold = STARTING_GOLD;
      p.streak = 0;
      p.heroId = null;
      p.ownedCardIds = [];
      p.shopOffers = [];
      p.ready = false;
      p.lastResult = null;
    }
    if (!this.players.some((p) => p.id === this.hostId)) this.hostId = this.players[0]?.id ?? null;
    this.broadcast();
  }

  // --- economy / shop -----------------------------------------------------

  private income(p: Player): number {
    const base = 5;
    const interest = Math.min(5, Math.floor(p.gold / 10));
    let streakBonus = 0;
    if (p.streak > 1) streakBonus = Math.min(3, p.streak - 1);
    else if (p.streak < -1) streakBonus = Math.min(3, -p.streak - 1);
    return base + interest + streakBonus;
  }

  private lossDamage(): number {
    return 4 + this.round * 2;
  }

  private buyCard(p: Player, cardId: string): void {
    const card = getCard(cardId);
    if (!card || !p.shopOffers.includes(cardId) || p.gold < card.cost) return;
    p.gold -= card.cost;
    p.ownedCardIds.push(cardId);
    p.shopOffers = p.shopOffers.filter((id) => id !== cardId);
  }

  // Pick the draft option whose hero sects best match the bot's target sect.
  private botDraftPick(p: Player): string {
    const scored = p.draftOptions.map((hid) => {
      const [s1, s2] = HERO_SECTS[hid] ?? [randomSect(), randomSect()];
      return { hid, score: (s1 === p.targetSect ? 2 : 0) + (s2 === p.targetSect ? 1 : 0) };
    });
    const best = Math.max(...scored.map((s) => s.score));
    const candidates = scored.filter((s) => s.score === best).map((s) => s.hid);
    return pick(candidates.length ? candidates : p.draftOptions);
  }

  private botShop(p: Player): void {
    // Keep ~10 gold for interest; prefer the target sect or the hero's own sects,
    // else cheapest affordable.
    const heroSects = new Set(HERO_SECTS[p.heroId ?? ''] ?? []);
    let guard = 0;
    while (guard++ < 20) {
      const affordable = p.shopOffers
        .map((id) => getCard(id))
        .filter((c): c is NonNullable<typeof c> => !!c && p.gold - c.cost >= 8);
      if (affordable.length === 0) break;
      const preferred = affordable.filter((c) => c.sect === p.targetSect || heroSects.has(c.sect));
      const choice = (preferred.length ? preferred : affordable).sort((x, y) => x.cost - y.cost)[0];
      this.buyCard(p, choice.id);
    }
  }

  // --- state views --------------------------------------------------------

  private viewFor(viewer: Player): GameStateView {
    const players: PlayerView[] = this.players.map((p) => {
      const isYou = p.id === viewer.id;
      const view: PlayerView = {
        id: p.id,
        name: p.name,
        isBot: p.isBot,
        alive: p.alive,
        hp: p.hp,
        maxHp: START_HP,
        gold: isYou ? p.gold : 0,
        level: playerLevel(p.ownedCardIds.length),
        streak: p.streak,
        heroId: p.heroId,
        ready: p.ready,
        sectPoints: computeSectPoints(p.ownedCardIds),
        cardCount: p.ownedCardIds.length,
        lastResult: p.lastResult,
      };
      if (isYou) {
        view.draftOptions = p.draftOptions;
        view.shopOffers = p.shopOffers;
        view.ownedCardIds = p.ownedCardIds;
      }
      return view;
    });
    return {
      roomCode: this.code,
      phase: this.phase,
      round: this.round,
      youId: viewer.id,
      hostId: this.hostId ?? '',
      phaseEndsAt: this.phaseEndsAt,
      players,
      matchups: this.matchups,
      winnerId: this.winnerId,
      canStart: this.phase === 'lobby' && viewer.id === this.hostId,
    };
  }

  private broadcast(): void {
    for (const p of this.players) {
      if (!p.isBot && p.ws) this.send(p, { t: 'state', state: this.viewFor(p) });
    }
  }

  private send(p: Player, msg: ServerMsg): void {
    try {
      p.ws?.send(JSON.stringify(msg));
    } catch {
      /* ignore */
    }
  }

  private byId(id: string): Player | undefined {
    return this.players.find((p) => p.id === id);
  }

  private setTimer(seconds: number, fn: () => void): void {
    this.clearTimer();
    this.phaseEndsAt = Date.now() + seconds * 1000;
    this.timer = setTimeout(() => {
      try {
        fn();
      } catch (e) {
        console.error('[ERR] timer callback', e);
      }
    }, seconds * 1000);
  }

  private clearTimer(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  private cleanup(): void {
    this.clearTimer();
  }
}

// ---------------------------------------------------------------------------

function genCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 4; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export class GameManager {
  private rooms = new Map<string, Room>();
  private wsRoom = new Map<WebSocket, Room>();

  handleConnection(ws: WebSocket): void {
    ws.on('message', (data) => {
      let msg: ClientMsg;
      try {
        msg = JSON.parse(String(data)) as ClientMsg;
      } catch {
        return;
      }
      if (msg.t === 'join') {
        this.join(ws, msg.name, msg.room);
        return;
      }
      const room = this.wsRoom.get(ws);
      if (room) {
        try {
          room.handle(ws, msg);
        } catch (e) {
          console.error('[ERR] handle', msg.t, e);
        }
      }
    });
    ws.on('close', () => {
      const room = this.wsRoom.get(ws);
      if (room) room.removeWs(ws);
      this.wsRoom.delete(ws);
    });
    ws.on('error', () => {
      /* ignore */
    });
  }

  private join(ws: WebSocket, name: string, roomCode?: string): void {
    let room: Room | undefined;
    if (roomCode) {
      room = this.rooms.get(roomCode.toUpperCase());
      if (!room) {
        ws.send(JSON.stringify({ t: 'error', message: 'Room not found' }));
        return;
      }
      if (room.phase !== 'lobby') {
        ws.send(JSON.stringify({ t: 'error', message: 'That game already started' }));
        return;
      }
    } else {
      let code = genCode();
      while (this.rooms.has(code)) code = genCode();
      room = new Room(code, (c) => this.rooms.delete(c));
      this.rooms.set(code, room);
    }
    this.wsRoom.set(ws, room);
    room.addHuman(ws, name);
  }
}
