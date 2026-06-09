import { useEffect, useState } from 'react';
import { useGame } from './store/gameStore';
import { audio } from './audio/AudioManager';
import { Tooltip } from './ui/Tooltip';
import { Home } from './ui/Home';
import { Lobby } from './ui/Lobby';
import { Draft } from './ui/Draft';
import { Shop } from './ui/Shop';
import { Combat } from './ui/Combat';
import { Winner } from './ui/Winner';
import { Standings } from './ui/Standings';

export default function App() {
  const view = useGame((s) => s.view);
  const error = useGame((s) => s.error);
  const clearError = useGame((s) => s.clearError);

  // Resume the audio context on the first user interaction (autoplay policy).
  useEffect(() => {
    const onGesture = () => audio.resume();
    window.addEventListener('pointerdown', onGesture, { once: true });
    return () => window.removeEventListener('pointerdown', onGesture);
  }, []);

  if (!view) return <Home />;

  const phase = view.phase;
  const withSidebar = phase === 'shop' || phase === 'combat';

  return (
    <div className="app">
      <div className="topbar">
        <div className="brand">
          AUTO GLADIATORS
          <small>8-player auto-battler</small>
        </div>
        <div className="run-stats">
          <Tooltip content="Share this room code so friends can join your match.">
            <div className="pill">Room {view.roomCode}</div>
          </Tooltip>
          <Tooltip content="Current round. Damage taken on a loss grows by 2 HP each round.">
            <div className="pill">Round {view.round}</div>
          </Tooltip>
          <Tooltip content="Gladiators still standing. Last one alive wins the lobby.">
            <div className="pill">{view.players.filter((p) => p.alive).length} alive</div>
          </Tooltip>
          <MuteButton />
        </div>
      </div>

      {error && (
        <div className="error-toast" onClick={clearError}>
          {error} <span className="x">×</span>
        </div>
      )}

      {phase === 'lobby' && <Lobby />}
      {phase === 'draft' && <Draft />}
      {phase === 'finished' && <Winner />}

      {withSidebar && (
        <div className="play-layout">
          <main className="play-main">
            {phase === 'shop' && <Shop />}
            {phase === 'combat' && <Combat />}
          </main>
          <Standings />
        </div>
      )}
    </div>
  );
}

function MuteButton() {
  const [muted, setMuted] = useState(() => audio.isMuted());
  useEffect(() => audio.subscribe(() => setMuted(audio.isMuted())), []);
  return (
    <Tooltip content={muted ? 'Sound off - click to unmute' : 'Sound on - click to mute'}>
      <button
        className="pill mute-btn"
        onClick={() => {
          audio.resume();
          audio.toggleMute();
        }}
        aria-label={muted ? 'Unmute' : 'Mute'}
      >
        {muted ? '🔇' : '🔊'}
      </button>
    </Tooltip>
  );
}
