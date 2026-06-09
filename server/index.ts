import express from 'express';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { WebSocketServer } from 'ws';
import { GameManager } from './game';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, '..', 'dist');

const app = express();
app.use(express.static(distDir));
// SPA fallback (serve index.html for any non-asset route)
app.use((_req, res) => {
  res.sendFile(path.join(distDir, 'index.html'));
});

const server = createServer(app);
const wss = new WebSocketServer({ server });
const manager = new GameManager();

wss.on('connection', (ws) => manager.handleConnection(ws));

const PORT = Number(process.env.PORT) || 8787;
server.listen(PORT, () => {
  console.log(`Auto Gladiators server listening on http://localhost:${PORT}`);
});
