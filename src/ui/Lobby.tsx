import { useState } from 'react';
import { useGame } from '../store/gameStore';

export function Lobby() {
  const view = useGame((s) => s.view)!;
  const start = useGame((s) => s.start);
  const leave = useGame((s) => s.leave);
  const [copied, setCopied] = useState(false);

  const isHost = view.youId === view.hostId;
  const humans = view.players.filter((p) => !p.isBot);
  const link = `${location.origin}${location.pathname}?room=${view.roomCode}`;

  function copy() {
    navigator.clipboard?.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className="lobby">
      <div className="lobby-card">
        <h2>Lobby</h2>
        <div className="roomcode">
          Room code <strong>{view.roomCode}</strong>
        </div>
        <div className="share-row">
          <input readOnly value={link} onFocus={(e) => e.currentTarget.select()} />
          <button className="btn" onClick={copy}>{copied ? 'Copied!' : 'Copy link'}</button>
        </div>
        <p className="hint">Share the link or code with friends. Empty seats are filled with bots up to 8.</p>

        <div className="lobby-players">
          {humans.map((p) => (
            <div key={p.id} className="lobby-player">
              <span className="dot" />
              <span>{p.name}</span>
              {p.id === view.hostId && <span className="tag host">HOST</span>}
              {p.id === view.youId && <span className="tag you">YOU</span>}
            </div>
          ))}
          <div className="lobby-player muted">+ {Math.max(0, 8 - humans.length)} bot(s) on start</div>
        </div>

        {isHost ? (
          <button className="btn primary big" onClick={start}>Start game</button>
        ) : (
          <p className="waiting">Waiting for host to start…</p>
        )}
        <button className="btn ghost" onClick={leave}>Leave</button>
      </div>
    </div>
  );
}
