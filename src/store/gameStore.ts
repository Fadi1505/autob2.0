import { create } from 'zustand';
import type { ClientMsg, ServerMsg, GameStateView, CombatStartMsg } from '../shared/protocol';

function wsUrl(): string {
  if (import.meta.env.DEV) return 'ws://localhost:8787';
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${location.host}`;
}

interface GameState {
  ws: WebSocket | null;
  connected: boolean;
  joining: boolean;
  youId: string | null;
  roomCode: string | null;
  view: GameStateView | null;
  combat: CombatStartMsg | null;
  combatNonce: number;
  error: string | null;

  connect: (name: string, room?: string) => void;
  leave: () => void;
  start: () => void;
  pickHero: (heroId: string) => void;
  rerollDraft: () => void;
  buyCard: (cardId: string) => void;
  rerollShop: () => void;
  ready: () => void;
  rematch: () => void;
  clearError: () => void;
}

export const useGame = create<GameState>((set, get) => {
  function send(msg: ClientMsg) {
    const ws = get().ws;
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  }

  return {
    ws: null,
    connected: false,
    joining: false,
    youId: null,
    roomCode: null,
    view: null,
    combat: null,
    combatNonce: 0,
    error: null,

    connect: (name, room) => {
      const existing = get().ws;
      if (existing) existing.close();
      set({ joining: true, error: null });
      const ws = new WebSocket(wsUrl());
      ws.onopen = () => {
        set({ connected: true });
        ws.send(JSON.stringify({ t: 'join', name, room } satisfies ClientMsg));
      };
      ws.onclose = () => set({ connected: false, joining: false });
      ws.onerror = () => set({ error: 'Connection failed', joining: false });
      ws.onmessage = (ev) => {
        let msg: ServerMsg;
        try {
          msg = JSON.parse(ev.data as string) as ServerMsg;
        } catch {
          return;
        }
        switch (msg.t) {
          case 'joined':
            set({ youId: msg.youId, roomCode: msg.roomCode, joining: false });
            break;
          case 'state':
            set({ view: msg.state });
            break;
          case 'combatStart':
            set((s) => ({ combat: msg.match, combatNonce: s.combatNonce + 1 }));
            break;
          case 'error':
            set({ error: msg.message, joining: false });
            break;
        }
      };
      set({ ws });
    },

    leave: () => {
      get().ws?.close();
      set({ ws: null, connected: false, view: null, combat: null, youId: null, roomCode: null });
    },

    start: () => send({ t: 'start' }),
    pickHero: (heroId) => send({ t: 'pickHero', heroId }),
    rerollDraft: () => send({ t: 'rerollDraft' }),
    buyCard: (cardId) => send({ t: 'buyCard', cardId }),
    rerollShop: () => send({ t: 'rerollShop' }),
    ready: () => send({ t: 'ready' }),
    rematch: () => send({ t: 'rematch' }),
    clearError: () => set({ error: null }),
  };
});
