// Headless bot-lobby smoke test: confirms the deterministic sim still resolves
// duels and an 8-player lobby converges to a single winner (no hangs).
import { BattleSim, FIXED_DT } from '../src/game/sim/BattleSim';
import { MAX_COMBAT_SECONDS } from '../src/shared/protocol';
import { makeRng, randomSeed } from '../src/game/sim/rng';
import { buildGladiator } from '../src/game/build';
import { HERO_ORDER } from '../src/game/data/heroes';
import { CARDS } from '../src/game/data/cards';
import type { CombatBuild } from '../src/game/types';

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

interface Bot {
  id: number;
  heroId: string;
  cards: string[];
  hp: number;
  alive: boolean;
}

function runDuel(a: CombatBuild, b: CombatBuild): 'a' | 'b' | 'draw' {
  const sim = new BattleSim(900, 520, makeRng(randomSeed()));
  sim.setupDuel(a, b);
  let t = 0;
  const cap = MAX_COMBAT_SECONDS + 2;
  let iterations = 0;
  while (!sim.ended && t < cap) {
    sim.tick(FIXED_DT);
    t += FIXED_DT;
    if (++iterations > 100000) throw new Error('Sim did not terminate (possible hang)');
  }
  if (!sim.ended || sim.winner === null) return 'draw';
  return sim.winner === 'player' ? 'a' : 'b';
}

function runLobby(): { winner: number | null; rounds: number } {
  const bots: Bot[] = [];
  for (let i = 0; i < 8; i++) {
    bots.push({ id: i, heroId: pick(HERO_ORDER), cards: [], hp: 100, alive: true });
  }
  let round = 0;
  while (bots.filter((b) => b.alive).length > 1 && round < 40) {
    round++;
    // each bot buys 1-2 random cards
    for (const b of bots) {
      if (!b.alive) continue;
      const n = 1 + Math.floor(Math.random() * 2);
      for (let i = 0; i < n; i++) b.cards.push(pick(CARDS).id);
    }
    // pair alive bots
    const alive = bots.filter((b) => b.alive).sort(() => Math.random() - 0.5);
    const loss = 4 + round * 2;
    for (let i = 0; i + 1 < alive.length; i += 2) {
      const x = alive[i];
      const y = alive[i + 1];
      const bx = buildGladiator(x.heroId, x.cards)!;
      const by = buildGladiator(y.heroId, y.cards)!;
      const r = runDuel(bx, by);
      if (r === 'a') y.hp -= loss;
      else if (r === 'b') x.hp -= loss;
      else { x.hp -= Math.floor(loss / 2); y.hp -= Math.floor(loss / 2); }
    }
    for (const b of bots) if (b.alive && b.hp <= 0) b.alive = false;
  }
  const survivors = bots.filter((b) => b.alive);
  return { winner: survivors.length === 1 ? survivors[0].id : null, rounds: round };
}

let wins = 0;
let draws = 0;
const LOBBIES = 12;
for (let i = 0; i < LOBBIES; i++) {
  const { winner, rounds } = runLobby();
  if (winner !== null) wins++;
  else draws++;
  console.log(`lobby ${i + 1}: winner=${winner ?? 'NONE'} after ${rounds} rounds`);
}
console.log(`\n${wins}/${LOBBIES} lobbies reached a single winner (${draws} stalemates).`);
if (wins === 0) {
  console.error('FAIL: no lobby converged to a winner');
  process.exit(1);
}
console.log('SMOKE OK');
