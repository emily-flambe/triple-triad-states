import { Card, hasAdvantage } from './cards';

export type Player = 0 | 1;

export interface PlacedCard {
  card: Card;
  owner: Player;
}

export interface GameState {
  board: (PlacedCard | null)[]; // 9 cells, row-major (0-8)
  hands: [Card[], Card[]];     // hands for player 0 and 1
  currentPlayer: Player;
  phase: 'waiting' | 'playing' | 'finished';
  scores: [number, number];
  winner: Player | 'draw' | null;
  lastCaptures: number[];      // indices of last captured cells (for animation)
  elementalBonus: boolean;     // whether elemental advantage is active
}

// Adjacency: for each cell index, which neighbors and which side faces them
// Sides: 0=top, 1=right, 2=bottom, 3=left
interface Adjacency {
  cellIndex: number;
  mySide: 0 | 1 | 2 | 3;
  theirSide: 0 | 1 | 2 | 3;
}

function getAdjacencies(index: number): Adjacency[] {
  const row = Math.floor(index / 3);
  const col = index % 3;
  const adj: Adjacency[] = [];

  if (row > 0) adj.push({ cellIndex: index - 3, mySide: 0, theirSide: 2 }); // top neighbor
  if (col < 2) adj.push({ cellIndex: index + 1, mySide: 1, theirSide: 3 }); // right neighbor
  if (row < 2) adj.push({ cellIndex: index + 3, mySide: 2, theirSide: 0 }); // bottom neighbor
  if (col > 0) adj.push({ cellIndex: index - 1, mySide: 3, theirSide: 1 }); // left neighbor

  return adj;
}

function getSideValue(card: Card, side: 0 | 1 | 2 | 3): number {
  switch (side) {
    case 0: return card.top;
    case 1: return card.right;
    case 2: return card.bottom;
    case 3: return card.left;
  }
}

export function createGame(): GameState {
  return {
    board: new Array(9).fill(null),
    hands: [[], []],
    currentPlayer: 0,
    phase: 'waiting',
    scores: [0, 0], // recalculated on first move and in startGame
    winner: null,
    lastCaptures: [],
    elementalBonus: true,
  };
}

export function placeCard(state: GameState, player: Player, cardId: number, cellIndex: number): { success: boolean; state: GameState; error?: string } {
  if (state.phase !== 'playing') {
    return { success: false, state, error: 'Game is not in playing phase' };
  }
  if (state.currentPlayer !== player) {
    return { success: false, state, error: 'Not your turn' };
  }
  if (!Number.isInteger(cellIndex) || cellIndex < 0 || cellIndex > 8) {
    return { success: false, state, error: 'Invalid cell index' };
  }
  if (state.board[cellIndex] !== null) {
    return { success: false, state, error: 'Cell is already occupied' };
  }

  const handIndex = state.hands[player].findIndex(c => c.id === cardId);
  if (handIndex === -1) {
    return { success: false, state, error: 'Card not in hand' };
  }

  const card = state.hands[player][handIndex];

  // Place the card
  const newBoard = [...state.board];
  const newHands: [Card[], Card[]] = [
    [...state.hands[0]],
    [...state.hands[1]],
  ];
  newHands[player].splice(handIndex, 1);

  newBoard[cellIndex] = { card, owner: player };

  // Resolve captures
  const captures = resolveCaptures(newBoard, cellIndex, player, state.elementalBonus);

  // Apply captures
  for (const ci of captures) {
    const placed = newBoard[ci];
    if (placed) {
      newBoard[ci] = { ...placed, owner: player };
    }
  }

  // Calculate scores
  let p0Score = 0;
  let p1Score = 0;
  for (const cell of newBoard) {
    if (cell) {
      if (cell.owner === 0) p0Score++;
      else p1Score++;
    }
  }
  // Add remaining hand cards
  p0Score += newHands[0].length;
  p1Score += newHands[1].length;

  // Check if game is over (board full)
  const boardFull = newBoard.every(c => c !== null);
  let winner: Player | 'draw' | null = null;
  let phase: GameState['phase'] = state.phase;

  if (boardFull) {
    phase = 'finished';
    if (p0Score > p1Score) winner = 0;
    else if (p1Score > p0Score) winner = 1;
    else winner = 'draw';
  }

  const nextPlayer: Player = state.currentPlayer === 0 ? 1 : 0;

  return {
    success: true,
    state: {
      board: newBoard,
      hands: newHands,
      currentPlayer: boardFull ? state.currentPlayer : nextPlayer,
      phase,
      scores: [p0Score, p1Score],
      winner,
      lastCaptures: captures,
      elementalBonus: state.elementalBonus,
    },
  };
}

function resolveCaptures(board: (PlacedCard | null)[], placedIndex: number, player: Player, elementalBonus: boolean): number[] {
  const placed = board[placedIndex]!;
  const captures: number[] = [];
  const adjacencies = getAdjacencies(placedIndex);

  // Basic captures
  for (const adj of adjacencies) {
    const neighbor = board[adj.cellIndex];
    if (!neighbor || neighbor.owner === player) continue;

    let myValue = getSideValue(placed.card, adj.mySide);
    let theirValue = getSideValue(neighbor.card, adj.theirSide);

    // Elemental bonus: +1 if attacker has advantage, -1 if defender has advantage
    if (elementalBonus) {
      if (hasAdvantage(placed.card.elements, neighbor.card.elements)) {
        myValue += 1;
      }
      if (hasAdvantage(neighbor.card.elements, placed.card.elements)) {
        theirValue += 1;
      }
    }

    if (myValue > theirValue) {
      captures.push(adj.cellIndex);
    }
  }

  // Same rule: check if 2+ adjacent sides have equal values
  const sameMatches: number[] = [];
  for (const adj of adjacencies) {
    const neighbor = board[adj.cellIndex];
    if (!neighbor) continue;
    const myValue = getSideValue(placed.card, adj.mySide);
    const theirValue = getSideValue(neighbor.card, adj.theirSide);
    if (myValue === theirValue) {
      sameMatches.push(adj.cellIndex);
    }
  }
  if (sameMatches.length >= 2) {
    for (const ci of sameMatches) {
      const neighbor = board[ci];
      if (neighbor && neighbor.owner !== player && !captures.includes(ci)) {
        captures.push(ci);
      }
    }
  }

  // Plus rule: check if 2+ adjacent side sums are equal
  const plusSums: { sum: number; cellIndex: number }[] = [];
  for (const adj of adjacencies) {
    const neighbor = board[adj.cellIndex];
    if (!neighbor) continue;
    const myValue = getSideValue(placed.card, adj.mySide);
    const theirValue = getSideValue(neighbor.card, adj.theirSide);
    plusSums.push({ sum: myValue + theirValue, cellIndex: adj.cellIndex });
  }
  // Find sums that appear 2+ times
  const sumCounts = new Map<number, number[]>();
  for (const ps of plusSums) {
    const arr = sumCounts.get(ps.sum) || [];
    arr.push(ps.cellIndex);
    sumCounts.set(ps.sum, arr);
  }
  for (const [, cells] of sumCounts) {
    if (cells.length >= 2) {
      for (const ci of cells) {
        const neighbor = board[ci];
        if (neighbor && neighbor.owner !== player && !captures.includes(ci)) {
          captures.push(ci);
        }
      }
    }
  }

  // Combo: captured cards can chain-capture their own neighbors (basic only)
  if (captures.length > 0) {
    const comboQueue = [...captures];
    const visited = new Set(captures);
    while (comboQueue.length > 0) {
      const capturedIdx = comboQueue.shift()!;
      const capturedCard = board[capturedIdx];
      if (!capturedCard) continue;

      const comboAdj = getAdjacencies(capturedIdx);
      for (const adj of comboAdj) {
        if (adj.cellIndex === placedIndex) continue; // skip the placed card
        if (visited.has(adj.cellIndex)) continue;
        const neighbor = board[adj.cellIndex];
        if (!neighbor || neighbor.owner === player) continue;

        const myValue = getSideValue(capturedCard.card, adj.mySide);
        const theirValue = getSideValue(neighbor.card, adj.theirSide);
        if (myValue > theirValue) {
          captures.push(adj.cellIndex);
          visited.add(adj.cellIndex);
          comboQueue.push(adj.cellIndex);
        }
      }
    }
  }

  return captures;
}

// Serialize game state for sending to clients (hide opponent's hand)
export function serializeForPlayer(state: GameState, player: Player): object {
  const opponent: Player = player === 0 ? 1 : 0;
  return {
    board: state.board,
    myHand: state.hands[player],
    opponentHandCount: state.hands[opponent].length,
    currentPlayer: state.currentPlayer,
    phase: state.phase,
    scores: state.scores,
    winner: state.winner,
    lastCaptures: state.lastCaptures,
    elementalBonus: state.elementalBonus,
    myPlayer: player,
  };
}
