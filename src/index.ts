import { DurableObject } from 'cloudflare:workers';
import { GameState, createGame, placeCard, serializeForPlayer, Player } from './game';
import { generateBalancedHands, ALL_CARDS } from './cards';

interface Env {
  GAME_ROOM: DurableObjectNamespace<GameRoom>;
}

interface PlayerAttachment {
  player: Player;
  name: string;
}

export class GameRoom extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);

    // Auto-respond to ping without waking DO
    this.ctx.setWebSocketAutoResponse(
      new WebSocketRequestResponsePair('ping', 'pong')
    );

    // Initialize SQLite schema (idempotent)
    this.ctx.blockConcurrencyWhile(async () => {
      this.ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS game_state (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          state TEXT NOT NULL
        )
      `);
    });
  }

  private loadState(): GameState {
    const rows = this.ctx.storage.sql.exec(
      'SELECT state FROM game_state WHERE id = 1'
    ).toArray();
    if (rows.length === 0) return createGame();
    return JSON.parse(rows[0].state as string);
  }

  private saveState(state: GameState) {
    this.ctx.storage.sql.exec(
      'INSERT OR REPLACE INTO game_state (id, state) VALUES (1, ?)',
      JSON.stringify(state)
    );
  }

  private getSessions(): Map<WebSocket, PlayerAttachment> {
    const sessions = new Map<WebSocket, PlayerAttachment>();
    for (const ws of this.ctx.getWebSockets()) {
      const attachment = ws.deserializeAttachment() as PlayerAttachment | null;
      if (attachment) {
        sessions.set(ws, attachment);
      }
    }
    return sessions;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/ws') {
      if (request.headers.get('Upgrade') !== 'websocket') {
        return new Response('Expected WebSocket', { status: 426 });
      }

      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);

      const sessions = this.getSessions();
      const playerCount = sessions.size;

      if (playerCount >= 2) {
        this.ctx.acceptWebSocket(server);
        server.send(JSON.stringify({ type: 'error', message: 'Game is full' }));
        server.close(1000, 'Game is full');
        return new Response(null, { status: 101, webSocket: client });
      }

      // Determine which player slot is free
      const takenSlots = new Set<Player>();
      for (const [, att] of sessions) {
        takenSlots.add(att.player);
      }
      const playerIdx: Player = takenSlots.has(0) ? 1 : 0;

      const rawName = url.searchParams.get('name') || `Player ${playerIdx + 1}`;
      const playerName = rawName.slice(0, 20);

      // Accept with hibernation support
      this.ctx.acceptWebSocket(server);

      // Persist per-connection metadata through hibernation
      const attachment: PlayerAttachment = { player: playerIdx, name: playerName };
      server.serializeAttachment(attachment);

      // Build player names map
      const playerNames: Record<number, string> = {};
      for (const [, att] of sessions) {
        playerNames[att.player] = att.name;
      }
      playerNames[playerIdx] = playerName;

      server.send(JSON.stringify({
        type: 'joined',
        player: playerIdx,
        name: playerName,
        playerNames,
      }));

      // Notify other player
      for (const [ws] of sessions) {
        ws.send(JSON.stringify({
          type: 'opponent_joined',
          name: playerName,
          playerNames,
        }));
      }

      // If we now have 2 players, start the game
      if (sessions.size + 1 === 2) {
        this.startGame();
      }

      return new Response(null, { status: 101, webSocket: client });
    }

    if (url.pathname === '/cards') {
      return new Response(JSON.stringify(ALL_CARDS), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response('Not found', { status: 404 });
  }

  private startGame() {
    const [hand0, hand1] = generateBalancedHands();

    const state = createGame();
    state.hands = [hand0, hand1];
    state.scores = [hand0.length, hand1.length];
    state.phase = 'playing';
    state.currentPlayer = 0;

    this.saveState(state);
    this.broadcastState(state);
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    if (typeof message !== 'string') return;

    const attachment = ws.deserializeAttachment() as PlayerAttachment | null;
    if (!attachment) return;

    try {
      const data = JSON.parse(message);

      if (data.type === 'place_card') {
        const cardId = Number(data.cardId);
        const cellIndex = Number(data.cellIndex);
        if (!Number.isInteger(cardId) || !Number.isInteger(cellIndex)) {
          ws.send(JSON.stringify({ type: 'error', message: 'Invalid card or cell' }));
          return;
        }
        const state = this.loadState();
        const result = placeCard(state, attachment.player, cardId, cellIndex);
        if (result.success) {
          this.saveState(result.state);
          this.broadcastState(result.state);
        } else {
          ws.send(JSON.stringify({ type: 'error', message: result.error }));
        }
      }

      if (data.type === 'rematch') {
        const state = this.loadState();
        if (state.phase === 'finished') {
          this.startGame();
        }
      }

      if (data.type === 'get_state') {
        const state = this.loadState();
        ws.send(JSON.stringify({
          type: 'state',
          ...serializeForPlayer(state, attachment.player),
        }));
      }
    } catch {
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid message' }));
    }
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean) {
    try { ws.close(code, reason); } catch { /* already closed */ }

    const attachment = ws.deserializeAttachment() as PlayerAttachment | null;
    if (attachment) {
      // Notify remaining player
      for (const [otherWs, otherAtt] of this.getSessions()) {
        if (otherAtt.player !== attachment.player) {
          otherWs.send(JSON.stringify({ type: 'opponent_left' }));
        }
      }
      // Reset game state
      this.saveState(createGame());
    }
  }

  async webSocketError(ws: WebSocket, error: unknown) {
    ws.close(1011, 'WebSocket error');
  }

  private broadcastState(state: GameState) {
    for (const [ws, attachment] of this.getSessions()) {
      try {
        ws.send(JSON.stringify({
          type: 'state',
          ...serializeForPlayer(state, attachment.player),
        }));
      } catch {
        // Connection may have closed
      }
    }
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // API: route to game rooms
    if (url.pathname.startsWith('/api/room/')) {
      const parts = url.pathname.split('/');
      // /api/room/{roomId}/ws or /api/room/{roomId}/cards
      const roomId = parts[3];
      if (!roomId) {
        return new Response('Missing room ID', { status: 400 });
      }
      const id = env.GAME_ROOM.idFromName(roomId);
      const stub = env.GAME_ROOM.get(id);

      const remaining = parts.slice(4).join('/');
      const subPath = remaining ? '/' + remaining : '/ws';
      const newUrl = new URL(request.url);
      newUrl.pathname = subPath;
      return stub.fetch(new Request(newUrl.toString(), request));
    }

    if (url.pathname === '/api/cards') {
      return new Response(JSON.stringify(ALL_CARDS), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    // Static assets handled automatically by [assets] config
    return new Response('Not found', { status: 404 });
  },
};
