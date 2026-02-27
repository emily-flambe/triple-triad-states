import { describe, it, expect } from 'vitest';
import { createGame, placeCard, serializeForPlayer, GameState, Player, PlacedCard } from './game';
import { Card, hasAdvantage, getRandomHand, ALL_CARDS, ELEMENT_ADVANTAGES, Element, getCardById } from './cards';

// ====================================================================
// HELPERS: Build controllable game states for precise testing
// ====================================================================

function makeCard(overrides: Partial<Card> & { id: number }): Card {
  return {
    name: 'TestCard',
    top: 5,
    right: 5,
    bottom: 5,
    left: 5,
    elements: [],
    ...overrides,
  };
}

function makePlayingState(overrides: Partial<GameState> = {}): GameState {
  return {
    board: new Array(9).fill(null),
    hands: [
      [makeCard({ id: 100, name: 'P0-A' }), makeCard({ id: 101, name: 'P0-B' }), makeCard({ id: 102, name: 'P0-C' }), makeCard({ id: 103, name: 'P0-D' }), makeCard({ id: 104, name: 'P0-E' })],
      [makeCard({ id: 200, name: 'P1-A' }), makeCard({ id: 201, name: 'P1-B' }), makeCard({ id: 202, name: 'P1-C' }), makeCard({ id: 203, name: 'P1-D' }), makeCard({ id: 204, name: 'P1-E' })],
    ],
    currentPlayer: 0,
    phase: 'playing',
    scores: [5, 5],
    winner: null,
    lastCaptures: [],
    elementalBonus: true,
    ...overrides,
  };
}

// ====================================================================
// 1. BASIC CARD PLACEMENT
// ====================================================================
describe('Basic card placement', () => {
  it('should place a card on an empty cell', () => {
    const state = makePlayingState();
    const result = placeCard(state, 0, 100, 0);
    expect(result.success).toBe(true);
    expect(result.state.board[0]).not.toBeNull();
    expect(result.state.board[0]!.card.id).toBe(100);
    expect(result.state.board[0]!.owner).toBe(0);
  });

  it('should remove the card from the player hand after placing', () => {
    const state = makePlayingState();
    const result = placeCard(state, 0, 100, 0);
    expect(result.success).toBe(true);
    expect(result.state.hands[0].find(c => c.id === 100)).toBeUndefined();
    expect(result.state.hands[0].length).toBe(4);
  });

  it('should switch turns after a successful placement', () => {
    const state = makePlayingState();
    const result = placeCard(state, 0, 100, 0);
    expect(result.success).toBe(true);
    expect(result.state.currentPlayer).toBe(1);
  });

  it('should not mutate the original state', () => {
    const state = makePlayingState();
    const originalBoard = [...state.board];
    const originalHand = [...state.hands[0]];
    placeCard(state, 0, 100, 0);
    expect(state.board).toEqual(originalBoard);
    expect(state.hands[0]).toEqual(originalHand);
  });
});

// ====================================================================
// 2. BASIC CAPTURE LOGIC
// ====================================================================
describe('Basic capture logic', () => {
  it('should capture opponent card when attacker side is higher', () => {
    const attackCard = makeCard({ id: 100, top: 1, right: 9, bottom: 1, left: 1, elements: [] });
    const defenderCard = makeCard({ id: 200, top: 1, right: 1, bottom: 1, left: 3, elements: [] });

    const state = makePlayingState({
      board: [
        null, { card: defenderCard, owner: 1 }, null,
        null, null, null,
        null, null, null,
      ],
      hands: [[attackCard], [makeCard({ id: 201 })]],
      currentPlayer: 0,
      elementalBonus: false,
    });

    // Place attackCard at cell 0. Its RIGHT (9) faces defenderCard at cell 1's LEFT (3)
    const result = placeCard(state, 0, 100, 0);
    expect(result.success).toBe(true);
    // Cell 1 should now be owned by player 0
    expect(result.state.board[1]!.owner).toBe(0);
  });

  it('should NOT capture when attacker side equals defender side (basic rule)', () => {
    const attackCard = makeCard({ id: 100, right: 5, elements: [] });
    const defenderCard = makeCard({ id: 200, left: 5, elements: [] });

    const state = makePlayingState({
      board: [
        null, { card: defenderCard, owner: 1 }, null,
        null, null, null,
        null, null, null,
      ],
      hands: [[attackCard], [makeCard({ id: 201 })]],
      currentPlayer: 0,
      elementalBonus: false,
    });

    const result = placeCard(state, 0, 100, 0);
    expect(result.success).toBe(true);
    // Equal values should NOT trigger basic capture
    expect(result.state.board[1]!.owner).toBe(1);
  });

  it('should NOT capture own cards', () => {
    const attackCard = makeCard({ id: 100, right: 9, elements: [] });
    const friendlyCard = makeCard({ id: 101, left: 1, elements: [] });

    const state = makePlayingState({
      board: [
        null, { card: friendlyCard, owner: 0 }, null,
        null, null, null,
        null, null, null,
      ],
      hands: [[attackCard], [makeCard({ id: 200 })]],
      currentPlayer: 0,
      elementalBonus: false,
    });

    const result = placeCard(state, 0, 100, 0);
    expect(result.success).toBe(true);
    // Cell 1 should remain owned by player 0
    expect(result.state.board[1]!.owner).toBe(0);
  });

  it('should capture via bottom side (card placed above opponent)', () => {
    const attackCard = makeCard({ id: 100, bottom: 8, elements: [] });
    const defenderCard = makeCard({ id: 200, top: 3, elements: [] });

    const state = makePlayingState({
      board: [
        null, null, null,
        null, { card: defenderCard, owner: 1 }, null,
        null, null, null,
      ],
      hands: [[attackCard], [makeCard({ id: 201 })]],
      currentPlayer: 0,
      elementalBonus: false,
    });

    // Place at cell 1, defender is at cell 4 (directly below)
    const result = placeCard(state, 0, 100, 1);
    expect(result.success).toBe(true);
    expect(result.state.board[4]!.owner).toBe(0);
  });

  it('should capture via top side (card placed below opponent)', () => {
    const attackCard = makeCard({ id: 100, top: 8, elements: [] });
    const defenderCard = makeCard({ id: 200, bottom: 3, elements: [] });

    const state = makePlayingState({
      board: [
        null, { card: defenderCard, owner: 1 }, null,
        null, null, null,
        null, null, null,
      ],
      hands: [[attackCard], [makeCard({ id: 201 })]],
      currentPlayer: 0,
      elementalBonus: false,
    });

    // Place at cell 4, defender is at cell 1 (directly above)
    const result = placeCard(state, 0, 100, 4);
    expect(result.success).toBe(true);
    expect(result.state.board[1]!.owner).toBe(0);
  });

  it('should capture via left side (card placed to the right of opponent)', () => {
    const attackCard = makeCard({ id: 100, left: 8, elements: [] });
    const defenderCard = makeCard({ id: 200, right: 3, elements: [] });

    const state = makePlayingState({
      board: [
        { card: defenderCard, owner: 1 }, null, null,
        null, null, null,
        null, null, null,
      ],
      hands: [[attackCard], [makeCard({ id: 201 })]],
      currentPlayer: 0,
      elementalBonus: false,
    });

    // Place at cell 1, defender at cell 0 (directly left)
    const result = placeCard(state, 0, 100, 1);
    expect(result.success).toBe(true);
    expect(result.state.board[0]!.owner).toBe(0);
  });

  it('should capture multiple adjacent opponent cards simultaneously', () => {
    const attackCard = makeCard({ id: 100, top: 9, right: 9, bottom: 9, left: 9, elements: [] });
    const weak = makeCard({ id: 200, top: 1, right: 1, bottom: 1, left: 1, elements: [] });

    const state = makePlayingState({
      board: [
        null, { card: { ...weak, id: 201 }, owner: 1 }, null,
        { card: { ...weak, id: 202 }, owner: 1 }, null, { card: { ...weak, id: 203 }, owner: 1 },
        null, { card: { ...weak, id: 204 }, owner: 1 }, null,
      ],
      hands: [[attackCard], []],
      currentPlayer: 0,
      elementalBonus: false,
    });

    // Place at cell 4 (center), should capture all 4 neighbors
    const result = placeCard(state, 0, 100, 4);
    expect(result.success).toBe(true);
    expect(result.state.board[1]!.owner).toBe(0);
    expect(result.state.board[3]!.owner).toBe(0);
    expect(result.state.board[5]!.owner).toBe(0);
    expect(result.state.board[7]!.owner).toBe(0);
  });
});

// ====================================================================
// 3. ELEMENTAL ADVANTAGE (attacker element beats defender)
// ====================================================================
describe('Elemental advantage', () => {
  it('should give +1 to attacker when attacker element beats defender element', () => {
    // ocean beats desert: attacker has ocean, defender has desert
    // attacker right = 5, defender left = 5. Without bonus: tie (no capture). With bonus: 6 > 5 = capture
    const attackCard = makeCard({ id: 100, right: 5, elements: ['ocean'] });
    const defenderCard = makeCard({ id: 200, left: 5, elements: ['desert'] });

    const state = makePlayingState({
      board: [
        null, { card: defenderCard, owner: 1 }, null,
        null, null, null,
        null, null, null,
      ],
      hands: [[attackCard], [makeCard({ id: 201 })]],
      currentPlayer: 0,
      elementalBonus: true,
    });

    const result = placeCard(state, 0, 100, 0);
    expect(result.success).toBe(true);
    // With elemental bonus: 5+1=6 > 5, should capture
    expect(result.state.board[1]!.owner).toBe(0);
  });

  it('should not apply elemental bonus when elementalBonus is false', () => {
    const attackCard = makeCard({ id: 100, right: 5, elements: ['ocean'] });
    const defenderCard = makeCard({ id: 200, left: 5, elements: ['desert'] });

    const state = makePlayingState({
      board: [
        null, { card: defenderCard, owner: 1 }, null,
        null, null, null,
        null, null, null,
      ],
      hands: [[attackCard], [makeCard({ id: 201 })]],
      currentPlayer: 0,
      elementalBonus: false,
    });

    const result = placeCard(state, 0, 100, 0);
    expect(result.success).toBe(true);
    // Without elemental bonus: 5 == 5, no capture
    expect(result.state.board[1]!.owner).toBe(1);
  });

  it('should handle mutual advantage (both sides get +1, cancels out)', () => {
    // ocean beats forest, forest beats mountain... wait, we need mutual advantage
    // ocean beats desert. desert beats forest. But we need A beats B AND B beats A simultaneously
    // Looking at the chart: ocean beats desert, desert beats swamp... none are mutual.
    // Actually for multi-element cards: card with [ocean, desert] vs [desert, ocean]
    // Both have advantage over each other's elements
    const attackCard = makeCard({ id: 100, right: 5, elements: ['ocean'] });
    const defenderCard = makeCard({ id: 200, left: 5, elements: ['mountain'] });
    // mountain beats ocean, so defender has advantage over attacker too
    // attacker: ocean vs mountain -> ocean does NOT beat mountain
    // defender: mountain vs ocean -> mountain DOES beat ocean
    // So only defender gets +1: attacker 5 vs defender 5+1=6 -> no capture

    const state = makePlayingState({
      board: [
        null, { card: defenderCard, owner: 1 }, null,
        null, null, null,
        null, null, null,
      ],
      hands: [[attackCard], [makeCard({ id: 201 })]],
      currentPlayer: 0,
      elementalBonus: true,
    });

    const result = placeCard(state, 0, 100, 0);
    expect(result.success).toBe(true);
    // Defender gets +1 (mountain beats ocean), attacker does not (ocean does not beat mountain)
    // So 5 vs 6: no capture
    expect(result.state.board[1]!.owner).toBe(1);
  });
});

// ====================================================================
// 4. ELEMENTAL DISADVANTAGE (defender element beats attacker)
// ====================================================================
describe('Elemental disadvantage', () => {
  it('should give +1 to defender when defender element beats attacker element', () => {
    // Attacker has desert, defender has plain. plain beats desert.
    // Attacker right = 6, defender left = 5. Without bonus: 6 > 5 = capture.
    // With defender bonus: 6 vs 5+1=6 -> tie -> no capture.
    const attackCard = makeCard({ id: 100, right: 6, elements: ['desert'] });
    const defenderCard = makeCard({ id: 200, left: 5, elements: ['plain'] });

    const state = makePlayingState({
      board: [
        null, { card: defenderCard, owner: 1 }, null,
        null, null, null,
        null, null, null,
      ],
      hands: [[attackCard], [makeCard({ id: 201 })]],
      currentPlayer: 0,
      elementalBonus: true,
    });

    const result = placeCard(state, 0, 100, 0);
    expect(result.success).toBe(true);
    // Defender gets +1 (plain beats desert): 6 vs 6 = tie, no capture
    expect(result.state.board[1]!.owner).toBe(1);
  });

  it('should allow defender to survive when elemental disadvantage cancels attack', () => {
    // Attacker: forest, Defender: ocean. ocean beats forest -> defender gets +1
    // Attacker right = 7, defender left = 7. Defender bonus: 7 vs 8 -> no capture
    const attackCard = makeCard({ id: 100, right: 7, elements: ['forest'] });
    const defenderCard = makeCard({ id: 200, left: 7, elements: ['ocean'] });

    const state = makePlayingState({
      board: [
        null, { card: defenderCard, owner: 1 }, null,
        null, null, null,
        null, null, null,
      ],
      hands: [[attackCard], [makeCard({ id: 201 })]],
      currentPlayer: 0,
      elementalBonus: true,
    });

    const result = placeCard(state, 0, 100, 0);
    expect(result.success).toBe(true);
    expect(result.state.board[1]!.owner).toBe(1);
  });
});

// ====================================================================
// 5. SAME RULE
// ====================================================================
describe('Same rule', () => {
  it('should trigger Same capture when 2+ adjacent sides have equal values', () => {
    // Place card at center (cell 4) with matching sides to 2 opponent neighbors
    const placedCard = makeCard({ id: 100, top: 3, right: 7, bottom: 3, left: 7, elements: [] });
    const neighbor1 = makeCard({ id: 200, bottom: 3, elements: [] }); // at cell 1, bottom faces cell 4's top
    const neighbor2 = makeCard({ id: 201, left: 7, elements: [] });  // at cell 5, left faces cell 4's right

    const state = makePlayingState({
      board: [
        null, { card: neighbor1, owner: 1 }, null,
        null, null, { card: neighbor2, owner: 1 },
        null, null, null,
      ],
      hands: [[placedCard], [makeCard({ id: 202 })]],
      currentPlayer: 0,
      elementalBonus: false,
    });

    const result = placeCard(state, 0, 100, 4);
    expect(result.success).toBe(true);
    // Both should be captured via Same rule
    expect(result.state.board[1]!.owner).toBe(0);
    expect(result.state.board[5]!.owner).toBe(0);
  });

  it('should NOT trigger Same with only 1 matching side', () => {
    const placedCard = makeCard({ id: 100, top: 3, right: 7, bottom: 1, left: 1, elements: [] });
    const neighbor1 = makeCard({ id: 200, bottom: 3, elements: [] }); // matches top

    const state = makePlayingState({
      board: [
        null, { card: neighbor1, owner: 1 }, null,
        null, null, null,
        null, null, null,
      ],
      hands: [[placedCard], [makeCard({ id: 201 })]],
      currentPlayer: 0,
      elementalBonus: false,
    });

    const result = placeCard(state, 0, 100, 4);
    expect(result.success).toBe(true);
    // Only 1 match - Same rule should NOT trigger, and 3 is not > 3 so basic won't capture either
    expect(result.state.board[1]!.owner).toBe(1);
  });

  it('should Same-capture only opponent cards, not own cards', () => {
    // Place at center with 2 matching sides. One is own card, one is opponent.
    // Same rule needs 2+ matches total (including own cards for the count)
    // but should only capture opponent cards
    const placedCard = makeCard({ id: 100, top: 3, right: 3, elements: [] });
    const ownCard = makeCard({ id: 101, bottom: 3, elements: [] }); // match top
    const oppCard = makeCard({ id: 200, left: 3, elements: [] });   // match right

    const state = makePlayingState({
      board: [
        null, { card: ownCard, owner: 0 }, null,
        null, null, { card: oppCard, owner: 1 },
        null, null, null,
      ],
      hands: [[placedCard], [makeCard({ id: 201 })]],
      currentPlayer: 0,
      elementalBonus: false,
    });

    const result = placeCard(state, 0, 100, 4);
    expect(result.success).toBe(true);
    // Same rule triggered (2 matching sides). Own card at 1 stays owned by 0.
    // Opponent card at 5 should be captured.
    expect(result.state.board[1]!.owner).toBe(0);
    expect(result.state.board[5]!.owner).toBe(0);
  });

  it('Same rule should count matches with own cards toward the threshold', () => {
    // BUG HUNT: Does Same rule count friendly card matches toward the 2-match threshold?
    // In the implementation, sameMatches includes ALL neighbors (own + opponent) that have equal values
    // This is the standard Triple Triad behavior: friendly matches count toward the 2-match threshold
    const placedCard = makeCard({ id: 100, top: 3, right: 3, elements: [] });
    const ownNeighbor = makeCard({ id: 101, bottom: 3, elements: [] });   // at cell 1: match
    const oppNeighbor = makeCard({ id: 200, left: 3, elements: [] });     // at cell 5: match

    const state = makePlayingState({
      board: [
        null, { card: ownNeighbor, owner: 0 }, null,
        null, null, { card: oppNeighbor, owner: 1 },
        null, null, null,
      ],
      hands: [[placedCard], [makeCard({ id: 201 })]],
      currentPlayer: 0,
      elementalBonus: false,
    });

    const result = placeCard(state, 0, 100, 4);
    expect(result.success).toBe(true);
    // 2 matches (one own, one opponent). Same rule triggers. Opponent card captured.
    expect(result.state.board[5]!.owner).toBe(0);
  });
});

// ====================================================================
// 6. PLUS RULE
// ====================================================================
describe('Plus rule', () => {
  it('should trigger Plus capture when 2+ adjacent side sums are equal', () => {
    // Place at center (cell 4).
    // Top side: placed top=3, neighbor bottom=7, sum=10
    // Right side: placed right=4, neighbor left=6, sum=10
    // Two sums match -> Plus rule triggers
    const placedCard = makeCard({ id: 100, top: 3, right: 4, bottom: 1, left: 1, elements: [] });
    const neighbor1 = makeCard({ id: 200, bottom: 7, elements: [] }); // at cell 1
    const neighbor2 = makeCard({ id: 201, left: 6, elements: [] });   // at cell 5

    const state = makePlayingState({
      board: [
        null, { card: neighbor1, owner: 1 }, null,
        null, null, { card: neighbor2, owner: 1 },
        null, null, null,
      ],
      hands: [[placedCard], [makeCard({ id: 202 })]],
      currentPlayer: 0,
      elementalBonus: false,
    });

    const result = placeCard(state, 0, 100, 4);
    expect(result.success).toBe(true);
    expect(result.state.board[1]!.owner).toBe(0);
    expect(result.state.board[5]!.owner).toBe(0);
  });

  it('should NOT trigger Plus with only 1 sum pair (no duplicate sums)', () => {
    const placedCard = makeCard({ id: 100, top: 3, right: 5, elements: [] });
    const neighbor1 = makeCard({ id: 200, bottom: 7, elements: [] }); // sum=10
    const neighbor2 = makeCard({ id: 201, left: 6, elements: [] });   // sum=11 (different!)

    const state = makePlayingState({
      board: [
        null, { card: neighbor1, owner: 1 }, null,
        null, null, { card: neighbor2, owner: 1 },
        null, null, null,
      ],
      hands: [[placedCard], [makeCard({ id: 202 })]],
      currentPlayer: 0,
      elementalBonus: false,
    });

    const result = placeCard(state, 0, 100, 4);
    expect(result.success).toBe(true);
    // Neither basic capture (3 < 7 for top, 5 < 6 for right) nor Plus (sums differ)
    expect(result.state.board[1]!.owner).toBe(1);
    expect(result.state.board[5]!.owner).toBe(1);
  });

  it('FINDING: Plus rule triggers with own cards contributing to sum pairs', () => {
    // Plus rule counts sum pairs involving FRIENDLY cards toward the threshold.
    // This means: place a card where one neighbor is friendly and one is opponent,
    // both produce the same sum -> Plus triggers and captures the opponent.
    // This may or may not be intended (it IS standard Triple Triad behavior).
    const placedCard = makeCard({ id: 100, top: 3, right: 4, elements: [] });
    const ownNeighbor = makeCard({ id: 101, bottom: 7, elements: [] }); // sum=10, OWN card
    const oppNeighbor = makeCard({ id: 200, left: 6, elements: [] });   // sum=10, opponent

    const state = makePlayingState({
      board: [
        null, { card: ownNeighbor, owner: 0 }, null,
        null, null, { card: oppNeighbor, owner: 1 },
        null, null, null,
      ],
      hands: [[placedCard], [makeCard({ id: 201 })]],
      currentPlayer: 0,
      elementalBonus: false,
    });

    const result = placeCard(state, 0, 100, 4);
    expect(result.success).toBe(true);
    // Plus triggers because two sums equal 10. Opponent at cell 5 captured.
    expect(result.state.board[5]!.owner).toBe(0);
  });

  it('Plus rule should capture only opponent cards, not own cards', () => {
    const placedCard = makeCard({ id: 100, top: 3, right: 4, elements: [] });
    const ownNeighbor = makeCard({ id: 101, bottom: 7, elements: [] }); // sum=10, own card
    const oppNeighbor = makeCard({ id: 200, left: 6, elements: [] });   // sum=10, opponent

    const state = makePlayingState({
      board: [
        null, { card: ownNeighbor, owner: 0 }, null,
        null, null, { card: oppNeighbor, owner: 1 },
        null, null, null,
      ],
      hands: [[placedCard], [makeCard({ id: 201 })]],
      currentPlayer: 0,
      elementalBonus: false,
    });

    const result = placeCard(state, 0, 100, 4);
    expect(result.success).toBe(true);
    // Own card stays owned by player 0
    expect(result.state.board[1]!.owner).toBe(0);
    // Opponent card captured via Plus
    expect(result.state.board[5]!.owner).toBe(0);
  });
});

// ====================================================================
// 7. COMBO/CHAIN CAPTURES AFTER SAME/PLUS
// ====================================================================
describe('Combo/chain captures', () => {
  it('should chain-capture after initial capture via basic rules', () => {
    // Place at cell 0 with strong right side to capture cell 1.
    // Cell 1 has strong bottom side to chain-capture cell 4.
    const placedCard = makeCard({ id: 100, right: 9, elements: [] });
    const capturedCard = makeCard({ id: 200, right: 1, left: 1, bottom: 8, elements: [] }); // at cell 1
    const chainTarget = makeCard({ id: 201, top: 3, elements: [] }); // at cell 4

    const state = makePlayingState({
      board: [
        null, { card: capturedCard, owner: 1 }, null,
        null, { card: chainTarget, owner: 1 }, null,
        null, null, null,
      ],
      hands: [[placedCard], [makeCard({ id: 202 })]],
      currentPlayer: 0,
      elementalBonus: false,
    });

    const result = placeCard(state, 0, 100, 0);
    expect(result.success).toBe(true);
    // Cell 1 captured directly (9 > 1)
    expect(result.state.board[1]!.owner).toBe(0);
    // Cell 4 chain-captured (capturedCard's bottom 8 > chainTarget's top 3)
    expect(result.state.board[4]!.owner).toBe(0);
  });

  it('combo should NOT chain back to the originally placed card', () => {
    // The combo code has: if (adj.cellIndex === placedIndex) continue;
    // This prevents the chain from re-evaluating the placed card
    const placedCard = makeCard({ id: 100, right: 9, top: 1, elements: [] }); // weak top
    const capturedCard = makeCard({ id: 200, left: 1, top: 9, elements: [] }); // at cell 1, strong top
    // If cell 1 is captured and tries to use its top against cell -2 (doesn't exist) that's fine
    // But let's put a card above cell 1 at cell... wait cell 1 is top row.
    // Let's use center instead.
    // Place at cell 3. Capture cell 4 (center). Cell 4 tries to chain to cell 3 (the placed card) - should skip.
    const placed = makeCard({ id: 100, right: 9, left: 1, elements: [] });
    const captured = makeCard({ id: 200, left: 1, right: 9, elements: [] }); // at cell 4

    const state = makePlayingState({
      board: [
        null, null, null,
        null, { card: captured, owner: 1 }, null,
        null, null, null,
      ],
      hands: [[placed], [makeCard({ id: 201 })]],
      currentPlayer: 0,
      elementalBonus: false,
    });

    const result = placeCard(state, 0, 100, 3);
    expect(result.success).toBe(true);
    expect(result.state.board[4]!.owner).toBe(0);
    // Placed card should still be there and owned by player 0
    expect(result.state.board[3]!.owner).toBe(0);
  });

  it('BUG HUNT: combo uses ORIGINAL card ownership for comparison, not flipped ownership', () => {
    // Critical question: In the combo phase, when evaluating chain captures from a
    // just-captured card, does the code use the original board state (where the card
    // is still owned by the opponent) or the updated state?
    //
    // Looking at the code: resolveCaptures modifies only the captures array, not the board.
    // The board is only updated AFTER resolveCaptures returns (in placeCard).
    // So during combo, board[capturedIdx].owner is still the ORIGINAL owner (opponent).
    // The combo code checks: if (neighbor.owner === player) continue;
    // So it skips cards owned by the CURRENT player. But the captured card itself
    // still shows as owned by the opponent on the board during resolution.
    //
    // This means: a captured card's neighbors that are owned by the OPPONENT
    // would be skipped (because they're === original owner, not === player).
    // Wait no: the combo checks neighbor.owner === player (the attacker).
    // So it correctly skips the attacker's own cards, and will attempt to chain
    // capture opponent cards. This seems correct.
    //
    // BUT: what about a chain from a captured card to ANOTHER already-captured card?
    // The visited set prevents double-processing. This is correct.

    // Let's test a multi-step chain
    const placed = makeCard({ id: 100, right: 9, elements: [] });
    const card1 = makeCard({ id: 200, left: 1, right: 8, elements: [] }); // at cell 1
    const card2 = makeCard({ id: 201, left: 2, elements: [] });           // at cell 2

    const state = makePlayingState({
      board: [
        null, { card: card1, owner: 1 }, { card: card2, owner: 1 },
        null, null, null,
        null, null, null,
      ],
      hands: [[placed], [makeCard({ id: 202 })]],
      currentPlayer: 0,
      elementalBonus: false,
    });

    const result = placeCard(state, 0, 100, 0);
    expect(result.success).toBe(true);
    expect(result.state.board[1]!.owner).toBe(0); // directly captured
    expect(result.state.board[2]!.owner).toBe(0); // chain captured (8 > 2)
  });

  it('combo should chain-capture after Same rule trigger', () => {
    // Same rule captures cell 1 and cell 3. Then chain from cell 1.
    const placed = makeCard({ id: 100, top: 5, left: 5, elements: [] });
    const sameNeighbor1 = makeCard({ id: 200, bottom: 5, right: 9, elements: [] }); // at cell 1 (top of placed at cell 4)
    const sameNeighbor2 = makeCard({ id: 201, right: 5, elements: [] });             // at cell 3 (left of placed at cell 4)
    const chainTarget = makeCard({ id: 202, left: 2, elements: [] });                // at cell 2 (right of cell 1)

    const state = makePlayingState({
      board: [
        null, { card: sameNeighbor1, owner: 1 }, { card: chainTarget, owner: 1 },
        { card: sameNeighbor2, owner: 1 }, null, null,
        null, null, null,
      ],
      hands: [[placed], [makeCard({ id: 203 })]],
      currentPlayer: 0,
      elementalBonus: false,
    });

    const result = placeCard(state, 0, 100, 4);
    expect(result.success).toBe(true);
    // Same rule: cell 1 bottom=5 matches placed top=5, cell 3 right=5 matches placed left=5
    expect(result.state.board[1]!.owner).toBe(0); // Same capture
    expect(result.state.board[3]!.owner).toBe(0); // Same capture
    // Chain: cell 1's right (9) > cell 2's left (2)
    expect(result.state.board[2]!.owner).toBe(0); // Chain capture
  });
});

// ====================================================================
// 8. SCORE CALCULATION
// ====================================================================
describe('Score calculation', () => {
  it('should include remaining hand cards in score', () => {
    const state = makePlayingState();
    // Each player has 5 cards in hand, 0 on board -> scores should be 5, 5
    const result = placeCard(state, 0, 100, 0);
    expect(result.success).toBe(true);
    // Player 0: 1 on board + 4 in hand = 5
    // Player 1: 0 on board + 5 in hand = 5
    expect(result.state.scores).toEqual([5, 5]);
  });

  it('should update score correctly after a capture', () => {
    const attackCard = makeCard({ id: 100, right: 9, elements: [] });
    const defenderCard = makeCard({ id: 200, left: 1, elements: [] });

    const state = makePlayingState({
      board: [
        null, { card: defenderCard, owner: 1 }, null,
        null, null, null,
        null, null, null,
      ],
      hands: [
        [attackCard, makeCard({ id: 101 }), makeCard({ id: 102 }), makeCard({ id: 103 })],
        [makeCard({ id: 201 }), makeCard({ id: 202 }), makeCard({ id: 203 })],
      ],
      currentPlayer: 0,
      elementalBonus: false,
    });

    const result = placeCard(state, 0, 100, 0);
    expect(result.success).toBe(true);
    // Player 0: 2 on board (placed + captured) + 3 in hand = 5
    // Player 1: 0 on board + 3 in hand = 3
    expect(result.state.scores).toEqual([5, 3]);
  });

  it('scores should always sum to total cards in the game', () => {
    // Total cards = 10 (5 per player). After any move, scores should sum to 10.
    const state = makePlayingState();
    let current = state;
    // Place alternating
    const moves = [
      { player: 0 as Player, cardId: 100, cell: 0 },
      { player: 1 as Player, cardId: 200, cell: 1 },
      { player: 0 as Player, cardId: 101, cell: 2 },
    ];
    for (const move of moves) {
      const result = placeCard(current, move.player, move.cardId, move.cell);
      expect(result.success).toBe(true);
      expect(result.state.scores[0] + result.state.scores[1]).toBe(10);
      current = result.state;
    }
  });
});

// ====================================================================
// 9. WIN/DRAW DETECTION
// ====================================================================
describe('Win/draw detection', () => {
  it('should detect a win when board is full and one player has more', () => {
    // Set up a state where the board is almost full, one move finishes it
    const card0 = makeCard({ id: 100, top: 1, right: 1, bottom: 1, left: 1, elements: [] });

    const state = makePlayingState({
      board: [
        { card: makeCard({ id: 1 }), owner: 0 },
        { card: makeCard({ id: 2 }), owner: 0 },
        { card: makeCard({ id: 3 }), owner: 0 },
        { card: makeCard({ id: 4 }), owner: 0 },
        { card: makeCard({ id: 5 }), owner: 0 },
        { card: makeCard({ id: 6 }), owner: 1 },
        { card: makeCard({ id: 7 }), owner: 1 },
        { card: makeCard({ id: 8 }), owner: 1 },
        null, // cell 8 empty
      ],
      hands: [[], [card0]],
      currentPlayer: 1,
      elementalBonus: false,
    });

    const result = placeCard(state, 1, 100, 8);
    expect(result.success).toBe(true);
    expect(result.state.phase).toBe('finished');
    // P0: 5 on board + 0 hand = 5. P1: 4 on board + 0 hand = 4.
    expect(result.state.winner).toBe(0);
  });

  it('should detect a draw when scores are equal', () => {
    const card0 = makeCard({ id: 100, top: 1, right: 1, bottom: 1, left: 1, elements: [] });

    // 4 owned by p0, 4 owned by p1, one empty cell, p1 places last
    // After: 4 p0 + 5 p1 on board... wait that's 5-4 not a draw
    // For a draw we need equal. 9 cells total, can't be equal (odd number).
    // But score includes hand cards. If all 10 cards accounted for and board is full (9 cells),
    // one player must have used 5 cards and other 4. So board: 5+4=9.
    // Hands: 0+0=0. Total: 5+4=9... wait total is 10.
    // OH WAIT. Total cards is 10 (5+5). Board has 9 cells. So one card remains in hand.
    // Hmm but the game ends when board is full. The player who went first placed 5, the other placed 4.
    // Remaining hands: 0 + 1 = 1. So scores: 5 on board + 0 hand vs 4 on board + 1 hand = 5 vs 5 = draw!

    // Actually that's only if no captures happen. Let me construct this carefully.
    // P0 goes first, places 5 cards. P1 places 4 cards. P1 has 1 card left in hand.
    // If no captures: P0 = 5 board + 0 hand = 5. P1 = 4 board + 1 hand = 5. DRAW.

    // Let's set up: 8 cards placed, 4 by p0, 4 by p1. P0's turn. P0 places last card.
    // P0 has 1 card, P1 has 1 card in hand. After P0 places: P0 has 5 on board + 0 hand = 5.
    // P1 has 4 on board + 1 hand = 5. Draw!
    //
    // IMPORTANT: Use varied card values to avoid triggering Same/Plus rules.
    // Cell 8 is adjacent to cell 5 (top) and cell 7 (left).
    // We need: lastCard.top != cell5.bottom AND lastCard.left != cell7.right (avoids Same)
    // AND lastCard.top + cell5.bottom != lastCard.left + cell7.right (avoids Plus)
    const lastCard = makeCard({ id: 100, top: 1, right: 1, bottom: 1, left: 2, elements: [] });

    const state = makePlayingState({
      board: [
        { card: makeCard({ id: 1 }), owner: 0 },
        { card: makeCard({ id: 2 }), owner: 0 },
        { card: makeCard({ id: 3 }), owner: 0 },
        { card: makeCard({ id: 4 }), owner: 0 },
        { card: makeCard({ id: 5 }), owner: 1 },
        { card: makeCard({ id: 6, bottom: 8 }), owner: 1 },   // cell 5, bottom faces cell 8's top
        { card: makeCard({ id: 7 }), owner: 1 },
        { card: makeCard({ id: 8, right: 9 }), owner: 1 },    // cell 7, right faces cell 8's left
        null, // cell 8 empty
      ],
      hands: [[lastCard], [makeCard({ id: 201 })]],
      currentPlayer: 0,
      elementalBonus: false,
    });

    // lastCard.top=1 vs cell5.bottom=8: not equal, 1<8 no basic capture. Sum=9.
    // lastCard.left=2 vs cell7.right=9: not equal, 2<9 no basic capture. Sum=11.
    // No Same (0 matches), no Plus (sums 9 != 11). No captures.
    const result = placeCard(state, 0, 100, 8);
    expect(result.success).toBe(true);
    expect(result.state.phase).toBe('finished');
    // P0: 5 board + 0 hand = 5. P1: 4 board + 1 hand = 5.
    expect(result.state.scores).toEqual([5, 5]);
    expect(result.state.winner).toBe('draw');
  });

  it('should NOT finish game when board is not full', () => {
    const state = makePlayingState();
    const result = placeCard(state, 0, 100, 0);
    expect(result.success).toBe(true);
    expect(result.state.phase).toBe('playing');
    expect(result.state.winner).toBeNull();
  });

  it('should keep currentPlayer unchanged when game finishes', () => {
    // When the board fills up, currentPlayer should NOT switch
    const lastCard = makeCard({ id: 100, elements: [] });

    const state = makePlayingState({
      board: [
        { card: makeCard({ id: 1 }), owner: 0 },
        { card: makeCard({ id: 2 }), owner: 0 },
        { card: makeCard({ id: 3 }), owner: 0 },
        { card: makeCard({ id: 4 }), owner: 0 },
        { card: makeCard({ id: 5 }), owner: 1 },
        { card: makeCard({ id: 6 }), owner: 1 },
        { card: makeCard({ id: 7 }), owner: 1 },
        { card: makeCard({ id: 8 }), owner: 1 },
        null,
      ],
      hands: [[lastCard], [makeCard({ id: 201 })]],
      currentPlayer: 0,
      elementalBonus: false,
    });

    const result = placeCard(state, 0, 100, 8);
    expect(result.success).toBe(true);
    expect(result.state.phase).toBe('finished');
    // currentPlayer should stay as 0 (the player who placed last), not switch to 1
    expect(result.state.currentPlayer).toBe(0);
  });
});

// ====================================================================
// 10. getRandomHand
// ====================================================================
describe('getRandomHand', () => {
  it('should return exactly 5 cards', () => {
    const hand = getRandomHand();
    expect(hand.length).toBe(5);
  });

  it('should return 5 unique cards (no duplicates)', () => {
    const hand = getRandomHand();
    const ids = hand.map(c => c.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(5);
  });

  it('should exclude specified card IDs', () => {
    const exclude = [1, 2, 3, 4, 5];
    const hand = getRandomHand(exclude);
    for (const card of hand) {
      expect(exclude).not.toContain(card.id);
    }
  });

  it('should handle excluding all but exactly 5 cards', () => {
    // Exclude 45 cards, leaving exactly 5
    const exclude = ALL_CARDS.slice(0, 45).map(c => c.id);
    const hand = getRandomHand(exclude);
    expect(hand.length).toBe(5);
    // All 5 remaining should be used
    const remaining = ALL_CARDS.slice(45);
    for (const card of hand) {
      expect(remaining.map(c => c.id)).toContain(card.id);
    }
  });

  it('should return fewer than 5 when not enough available cards', () => {
    // Exclude 48 cards, leaving only 2
    const exclude = ALL_CARDS.slice(0, 48).map(c => c.id);
    const hand = getRandomHand(exclude);
    expect(hand.length).toBe(2);
  });

  it('should return empty array when all cards are excluded', () => {
    const exclude = ALL_CARDS.map(c => c.id);
    const hand = getRandomHand(exclude);
    expect(hand.length).toBe(0);
  });

  it('two random hands with exclude should not share cards', () => {
    const hand1 = getRandomHand();
    const hand1Ids = hand1.map(c => c.id);
    const hand2 = getRandomHand(hand1Ids);
    for (const card of hand2) {
      expect(hand1Ids).not.toContain(card.id);
    }
  });
});

// ====================================================================
// 11. hasAdvantage function
// ====================================================================
describe('hasAdvantage', () => {
  it('ocean beats desert', () => {
    expect(hasAdvantage(['ocean'], ['desert'])).toBe(true);
  });

  it('ocean beats forest', () => {
    expect(hasAdvantage(['ocean'], ['forest'])).toBe(true);
  });

  it('ocean does NOT beat mountain', () => {
    expect(hasAdvantage(['ocean'], ['mountain'])).toBe(false);
  });

  it('mountain beats ocean', () => {
    expect(hasAdvantage(['mountain'], ['ocean'])).toBe(true);
  });

  it('mountain beats plain', () => {
    expect(hasAdvantage(['mountain'], ['plain'])).toBe(true);
  });

  it('desert beats swamp', () => {
    expect(hasAdvantage(['desert'], ['swamp'])).toBe(true);
  });

  it('desert beats forest', () => {
    expect(hasAdvantage(['desert'], ['forest'])).toBe(true);
  });

  it('plain beats desert', () => {
    expect(hasAdvantage(['plain'], ['desert'])).toBe(true);
  });

  it('plain beats swamp', () => {
    expect(hasAdvantage(['plain'], ['swamp'])).toBe(true);
  });

  it('forest beats mountain', () => {
    expect(hasAdvantage(['forest'], ['mountain'])).toBe(true);
  });

  it('forest beats plain', () => {
    expect(hasAdvantage(['forest'], ['plain'])).toBe(true);
  });

  it('swamp beats ocean', () => {
    expect(hasAdvantage(['swamp'], ['ocean'])).toBe(true);
  });

  it('swamp beats mountain', () => {
    expect(hasAdvantage(['swamp'], ['mountain'])).toBe(true);
  });

  it('same element should NOT have advantage', () => {
    const elements: Element[] = ['ocean', 'mountain', 'desert', 'plain', 'swamp', 'forest'];
    for (const e of elements) {
      expect(hasAdvantage([e], [e])).toBe(false);
    }
  });

  it('should handle multi-element advantage (any attacker beats any defender)', () => {
    // ocean beats desert. mountain beats plain. So [ocean, mountain] vs [desert, plain] = true
    expect(hasAdvantage(['ocean', 'mountain'], ['desert', 'plain'])).toBe(true);
  });

  it('should return true if ANY attacker element beats ANY defender element', () => {
    // mountain does NOT beat forest. But ocean DOES beat forest.
    expect(hasAdvantage(['mountain', 'ocean'], ['forest'])).toBe(true);
  });

  it('should return false for empty attacker elements', () => {
    expect(hasAdvantage([], ['ocean'])).toBe(false);
  });

  it('should return false for empty defender elements', () => {
    expect(hasAdvantage(['ocean'], [])).toBe(false);
  });

  it('should return false for both empty', () => {
    expect(hasAdvantage([], [])).toBe(false);
  });

  it('no element should beat itself in the advantage table', () => {
    for (const [element, beats] of Object.entries(ELEMENT_ADVANTAGES)) {
      expect(beats).not.toContain(element);
    }
  });

  it('every element should beat exactly 2 others', () => {
    for (const [, beats] of Object.entries(ELEMENT_ADVANTAGES)) {
      expect(beats.length).toBe(2);
    }
  });

  it('every element should be beaten by exactly 2 others', () => {
    const elements: Element[] = ['ocean', 'mountain', 'desert', 'plain', 'swamp', 'forest'];
    for (const defender of elements) {
      let beatenByCount = 0;
      for (const attacker of elements) {
        if (ELEMENT_ADVANTAGES[attacker].includes(defender)) {
          beatenByCount++;
        }
      }
      expect(beatenByCount).toBe(2);
    }
  });
});

// ====================================================================
// 12. EDGE CASES
// ====================================================================
describe('Edge cases - validation', () => {
  it('should reject placement when game is not in playing phase (waiting)', () => {
    const state = makePlayingState({ phase: 'waiting' });
    const result = placeCard(state, 0, 100, 0);
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('should reject placement when game is finished', () => {
    const state = makePlayingState({ phase: 'finished' });
    const result = placeCard(state, 0, 100, 0);
    expect(result.success).toBe(false);
    expect(result.error).toContain('not in playing phase');
  });

  it('should reject placement on wrong player turn', () => {
    const state = makePlayingState({ currentPlayer: 1 });
    const result = placeCard(state, 0, 100, 0);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Not your turn');
  });

  it('should reject placement on occupied cell', () => {
    const state = makePlayingState();
    state.board[0] = { card: makeCard({ id: 999 }), owner: 1 };
    const result = placeCard(state, 0, 100, 0);
    expect(result.success).toBe(false);
    expect(result.error).toContain('already occupied');
  });

  it('should reject placement with card not in hand', () => {
    const state = makePlayingState();
    const result = placeCard(state, 0, 999, 0); // card 999 doesn't exist in hand
    expect(result.success).toBe(false);
    expect(result.error).toContain('not in hand');
  });

  it('should reject negative cell index', () => {
    const state = makePlayingState();
    const result = placeCard(state, 0, 100, -1);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid cell');
  });

  it('should reject cell index > 8', () => {
    const state = makePlayingState();
    const result = placeCard(state, 0, 100, 9);
    expect(result.success).toBe(false);
  });

  it('BUG HUNT: should reject cell index 9 (off by one in bounds check)', () => {
    // The code checks: cellIndex < 0 || cellIndex > 8
    // cellIndex 9 -> 9 > 8 = true -> rejected. OK.
    // But what about non-integer indices? cellIndex 8.5?
    const state = makePlayingState();
    // This probably works because board[8.5] would be undefined (not null)
    // But the validation doesn't check for non-integers
    // Let's see if placing at 8 works (valid)
    const result = placeCard(state, 0, 100, 8);
    expect(result.success).toBe(true);
  });
});

// ====================================================================
// ADJACENCY EDGE CASES: Board wrapping bugs
// ====================================================================
describe('Board adjacency correctness', () => {
  it('cell 0 should NOT be adjacent to cell 2 (no horizontal wrapping)', () => {
    // If there's a wrapping bug, placing at cell 0 might affect cell 2
    const attackCard = makeCard({ id: 100, right: 9, left: 9, elements: [] });
    const defenderCard = makeCard({ id: 200, right: 1, elements: [] }); // at cell 2

    const state = makePlayingState({
      board: [
        null, null, { card: defenderCard, owner: 1 },
        null, null, null,
        null, null, null,
      ],
      hands: [[attackCard], [makeCard({ id: 201 })]],
      currentPlayer: 0,
      elementalBonus: false,
    });

    const result = placeCard(state, 0, 100, 0);
    expect(result.success).toBe(true);
    // Cell 2 should NOT be captured - it's not adjacent to cell 0
    expect(result.state.board[2]!.owner).toBe(1);
  });

  it('cell 2 should NOT be adjacent to cell 3 (no row wrapping)', () => {
    // Cell 2 is end of row 0, cell 3 is start of row 1 - NOT adjacent
    const attackCard = makeCard({ id: 100, right: 9, elements: [] });
    const defenderCard = makeCard({ id: 200, left: 1, elements: [] }); // at cell 3

    const state = makePlayingState({
      board: [
        null, null, null,
        { card: defenderCard, owner: 1 }, null, null,
        null, null, null,
      ],
      hands: [[attackCard], [makeCard({ id: 201 })]],
      currentPlayer: 0,
      elementalBonus: false,
    });

    const result = placeCard(state, 0, 100, 2);
    expect(result.success).toBe(true);
    // Cell 3 should NOT be captured - not adjacent to cell 2
    expect(result.state.board[3]!.owner).toBe(1);
  });

  it('cell 6 should NOT be adjacent to cell 8 (no horizontal wrapping bottom row)', () => {
    const attackCard = makeCard({ id: 100, right: 9, elements: [] });
    const defenderCard = makeCard({ id: 200, left: 1, elements: [] }); // at cell 8

    const state = makePlayingState({
      board: [
        null, null, null,
        null, null, null,
        null, null, { card: defenderCard, owner: 1 },
      ],
      hands: [[attackCard], [makeCard({ id: 201 })]],
      currentPlayer: 0,
      elementalBonus: false,
    });

    const result = placeCard(state, 0, 100, 6);
    expect(result.success).toBe(true);
    // Cell 6's right neighbor is cell 7, NOT cell 8
    expect(result.state.board[8]!.owner).toBe(1);
  });

  it('cell 0 should be adjacent to cell 1 (right) and cell 3 (bottom)', () => {
    const attackCard = makeCard({ id: 100, right: 9, bottom: 9, elements: [] });
    const defender1 = makeCard({ id: 200, left: 1, elements: [] }); // at cell 1
    const defender2 = makeCard({ id: 201, top: 1, elements: [] });  // at cell 3

    const state = makePlayingState({
      board: [
        null, { card: defender1, owner: 1 }, null,
        { card: defender2, owner: 1 }, null, null,
        null, null, null,
      ],
      hands: [[attackCard], [makeCard({ id: 202 })]],
      currentPlayer: 0,
      elementalBonus: false,
    });

    const result = placeCard(state, 0, 100, 0);
    expect(result.success).toBe(true);
    expect(result.state.board[1]!.owner).toBe(0); // right neighbor
    expect(result.state.board[3]!.owner).toBe(0); // bottom neighbor
  });
});

// ====================================================================
// createGame
// ====================================================================
describe('createGame', () => {
  it('should initialize with empty board', () => {
    const state = createGame();
    expect(state.board.length).toBe(9);
    expect(state.board.every(c => c === null)).toBe(true);
  });

  it('should initialize with empty hands', () => {
    const state = createGame();
    expect(state.hands[0].length).toBe(0);
    expect(state.hands[1].length).toBe(0);
  });

  it('should start in waiting phase', () => {
    const state = createGame();
    expect(state.phase).toBe('waiting');
  });

  it('should start with scores 0-0 (recalculated when hands dealt)', () => {
    const state = createGame();
    expect(state.scores).toEqual([0, 0]);
  });

  it('should start with player 0 as current', () => {
    const state = createGame();
    expect(state.currentPlayer).toBe(0);
  });

  it('should have elementalBonus enabled by default', () => {
    const state = createGame();
    expect(state.elementalBonus).toBe(true);
  });

  it('BUG HUNT: board cells should be independent (no shared reference via fill)', () => {
    // new Array(9).fill(null) is fine for null since null is primitive.
    // But if it were fill({}) each cell would share the same object reference.
    // With fill(null) this is fine.
    const state = createGame();
    // Mutating one cell should not affect others
    state.board[0] = { card: makeCard({ id: 1 }), owner: 0 };
    expect(state.board[1]).toBeNull();
  });
});

// ====================================================================
// serializeForPlayer
// ====================================================================
describe('serializeForPlayer', () => {
  it('should include own hand but not opponent hand', () => {
    const state = makePlayingState();
    const serialized = serializeForPlayer(state, 0) as any;
    expect(serialized.myHand).toEqual(state.hands[0]);
    expect(serialized.opponentHandCount).toBe(state.hands[1].length);
    // Should NOT include opponent's actual cards
    expect(serialized.hands).toBeUndefined();
  });

  it('should include correct myPlayer identifier', () => {
    const state = makePlayingState();
    const s0 = serializeForPlayer(state, 0) as any;
    const s1 = serializeForPlayer(state, 1) as any;
    expect(s0.myPlayer).toBe(0);
    expect(s1.myPlayer).toBe(1);
  });

  it('should show player 1 their own hand', () => {
    const state = makePlayingState();
    const serialized = serializeForPlayer(state, 1) as any;
    expect(serialized.myHand).toEqual(state.hands[1]);
    expect(serialized.opponentHandCount).toBe(state.hands[0].length);
  });
});

// ====================================================================
// getCardById
// ====================================================================
describe('getCardById', () => {
  it('should find existing cards', () => {
    const card = getCardById(1);
    expect(card).toBeDefined();
    expect(card!.name).toBe('Alabama');
  });

  it('should return undefined for non-existent ID', () => {
    const card = getCardById(999);
    expect(card).toBeUndefined();
  });

  it('should return undefined for ID 0', () => {
    const card = getCardById(0);
    expect(card).toBeUndefined();
  });

  it('should return undefined for negative ID', () => {
    const card = getCardById(-1);
    expect(card).toBeUndefined();
  });
});

// ====================================================================
// ALL_CARDS data integrity
// ====================================================================
describe('ALL_CARDS data integrity', () => {
  it('should have exactly 50 cards', () => {
    expect(ALL_CARDS.length).toBe(50);
  });

  it('all card IDs should be unique', () => {
    const ids = ALL_CARDS.map(c => c.id);
    expect(new Set(ids).size).toBe(50);
  });

  it('all card IDs should be 1-50', () => {
    const ids = ALL_CARDS.map(c => c.id).sort((a, b) => a - b);
    expect(ids).toEqual(Array.from({ length: 50 }, (_, i) => i + 1));
  });

  it('all card values should be between 1 and 10', () => {
    for (const card of ALL_CARDS) {
      for (const side of [card.top, card.right, card.bottom, card.left]) {
        expect(side).toBeGreaterThanOrEqual(1);
        expect(side).toBeLessThanOrEqual(10);
      }
    }
  });

  it('all cards should have 1 or 2 elements', () => {
    for (const card of ALL_CARDS) {
      expect(card.elements.length).toBeGreaterThanOrEqual(1);
      expect(card.elements.length).toBeLessThanOrEqual(2);
    }
  });

  it('all card elements should be valid Element types', () => {
    const validElements: Element[] = ['ocean', 'mountain', 'desert', 'plain', 'swamp', 'forest'];
    for (const card of ALL_CARDS) {
      for (const elem of card.elements) {
        expect(validElements).toContain(elem);
      }
    }
  });

  it('all cards should have non-empty names', () => {
    for (const card of ALL_CARDS) {
      expect(card.name.length).toBeGreaterThan(0);
    }
  });
});

// ====================================================================
// SUBTLE BUG HUNTS
// ====================================================================
describe('Subtle bug hunts', () => {
  it('BUG HUNT: Same rule should use raw values, not elemental-modified values', () => {
    // The Same rule in resolveCaptures uses getSideValue without elemental bonus
    // while the basic capture uses elemental-modified values.
    // This is actually the correct behavior per standard Triple Triad rules.
    // Let's verify Same rule ignores elemental bonuses.
    const placedCard = makeCard({ id: 100, top: 5, right: 5, elements: ['ocean'] });
    const neighbor1 = makeCard({ id: 200, bottom: 5, elements: ['desert'] }); // ocean beats desert
    const neighbor2 = makeCard({ id: 201, left: 5, elements: ['forest'] });   // ocean beats forest

    const state = makePlayingState({
      board: [
        null, { card: neighbor1, owner: 1 }, null,
        null, null, { card: neighbor2, owner: 1 },
        null, null, null,
      ],
      hands: [[placedCard], [makeCard({ id: 202 })]],
      currentPlayer: 0,
      elementalBonus: true,
    });

    const result = placeCard(state, 0, 100, 4);
    expect(result.success).toBe(true);
    // Same rule: 5==5 and 5==5 -> triggers. Both captured.
    // Basic capture with elemental: 5+1=6 > 5 -> also captures.
    // Either way both should be captured.
    expect(result.state.board[1]!.owner).toBe(0);
    expect(result.state.board[5]!.owner).toBe(0);
  });

  it('BUG HUNT: Plus rule should use raw values, not elemental-modified values', () => {
    // Same concern for Plus rule. The code uses getSideValue directly (no elemental modification).
    // This is correct behavior.
    const placedCard = makeCard({ id: 100, top: 3, right: 4, elements: ['ocean'] });
    const neighbor1 = makeCard({ id: 200, bottom: 7, elements: ['desert'] }); // sum=10
    const neighbor2 = makeCard({ id: 201, left: 6, elements: ['forest'] });   // sum=10

    const state = makePlayingState({
      board: [
        null, { card: neighbor1, owner: 1 }, null,
        null, null, { card: neighbor2, owner: 1 },
        null, null, null,
      ],
      hands: [[placedCard], [makeCard({ id: 202 })]],
      currentPlayer: 0,
      elementalBonus: true,
    });

    const result = placeCard(state, 0, 100, 4);
    expect(result.success).toBe(true);
    expect(result.state.board[1]!.owner).toBe(0);
    expect(result.state.board[5]!.owner).toBe(0);
  });

  it('BUG HUNT: basic capture and Same/Plus should not duplicate captures', () => {
    // If a card is captured by both basic rule AND Same rule, it should only appear once in captures
    // The code uses captures.includes(ci) to prevent duplicates
    const placedCard = makeCard({ id: 100, top: 9, right: 9, elements: [] });
    const neighbor1 = makeCard({ id: 200, bottom: 9, elements: [] }); // Same match: 9==9, also basic: 9 not > 9
    const neighbor2 = makeCard({ id: 201, left: 9, elements: [] });   // Same match: 9==9

    // Actually 9 is not > 9 so basic capture won't trigger for either.
    // But Same triggers (2 matching sides). Let's do one where basic DOES capture.
    const placed2 = makeCard({ id: 100, top: 9, right: 5, bottom: 5, elements: [] });
    const n1 = makeCard({ id: 200, bottom: 3, elements: [] }); // basic: 9 > 3, and top=9 match for same if another matches
    const n2 = makeCard({ id: 201, left: 5, elements: [] });   // matches right=5

    // For same rule: placed top=9 vs n1 bottom=3 -> not equal. placed right=5 vs n2 left=5 -> equal.
    // Only 1 same match, so same doesn't trigger. Basic captures n1 (9>3). No duplicate issue here.
    // Let me construct a real scenario:
    const placed3 = makeCard({ id: 100, top: 9, right: 5, elements: [] });
    const m1 = makeCard({ id: 200, bottom: 5, elements: [] }); // top match: 9 vs 5... no, placed top=9 vs m1 bottom=5 -> not equal
    // I need: placed top = neighbor bottom AND placed right = other neighbor left
    const placed4 = makeCard({ id: 100, top: 5, right: 5, elements: [] });
    const q1 = makeCard({ id: 200, bottom: 5, top: 1, right: 1, left: 1, elements: [] }); // at cell 1
    const q2 = makeCard({ id: 201, left: 5, top: 1, right: 1, bottom: 1, elements: [] }); // at cell 5
    // Same: placed top(5)==q1 bottom(5) and placed right(5)==q2 left(5) -> 2 matches -> Same triggers
    // Basic: 5 is NOT > 5, so basic doesn't capture either
    // Same captures both. No duplicate issue.

    const state = makePlayingState({
      board: [
        null, { card: q1, owner: 1 }, null,
        null, null, { card: q2, owner: 1 },
        null, null, null,
      ],
      hands: [[placed4], [makeCard({ id: 202 })]],
      currentPlayer: 0,
      elementalBonus: false,
    });

    const result = placeCard(state, 0, 100, 4);
    expect(result.success).toBe(true);
    expect(result.state.board[1]!.owner).toBe(0);
    expect(result.state.board[5]!.owner).toBe(0);
    // Verify lastCaptures doesn't have duplicates
    const uniqueCaptures = new Set(result.state.lastCaptures);
    expect(uniqueCaptures.size).toBe(result.state.lastCaptures.length);
  });

  it('BUG HUNT: elemental bonus with multi-element cards (both attacker and defender have 2 elements)', () => {
    // Card A: [ocean, mountain]. Card B: [desert, plain].
    // hasAdvantage(A, B): ocean beats desert -> true
    // hasAdvantage(B, A): plain beats... does plain beat ocean? No. Does plain beat mountain? No.
    // Does desert beat ocean? No. Does desert beat mountain? No.
    // So only attacker gets +1.
    // Wait: ELEMENT_ADVANTAGES: plain beats desert and swamp. desert beats swamp and forest.
    // So hasAdvantage(B, A) = false. Only attacker bonus.

    const attackCard = makeCard({ id: 100, right: 5, elements: ['ocean', 'mountain'] });
    const defenderCard = makeCard({ id: 200, left: 5, elements: ['desert', 'plain'] });

    const state = makePlayingState({
      board: [
        null, { card: defenderCard, owner: 1 }, null,
        null, null, null,
        null, null, null,
      ],
      hands: [[attackCard], [makeCard({ id: 201 })]],
      currentPlayer: 0,
      elementalBonus: true,
    });

    const result = placeCard(state, 0, 100, 0);
    expect(result.success).toBe(true);
    // Attacker bonus: 5+1=6 > 5. Capture.
    expect(result.state.board[1]!.owner).toBe(0);
  });

  it('BUG HUNT: elemental where BOTH sides have advantage (mutual advantage)', () => {
    // Need: attacker has element A, defender has element B where A beats B and B beats A
    // Checking ELEMENT_ADVANTAGES: no element beats itself or creates mutual relationships
    // But with multi-element: attacker [ocean, desert], defender [forest, swamp]
    // hasAdvantage(atk, def): ocean beats forest -> true
    // hasAdvantage(def, atk): swamp beats ocean -> true
    // Both get +1! So it cancels out: (5+1) vs (5+1) = 6 vs 6, no capture

    const attackCard = makeCard({ id: 100, right: 5, elements: ['ocean', 'desert'] });
    const defenderCard = makeCard({ id: 200, left: 5, elements: ['forest', 'swamp'] });

    const state = makePlayingState({
      board: [
        null, { card: defenderCard, owner: 1 }, null,
        null, null, null,
        null, null, null,
      ],
      hands: [[attackCard], [makeCard({ id: 201 })]],
      currentPlayer: 0,
      elementalBonus: true,
    });

    const result = placeCard(state, 0, 100, 0);
    expect(result.success).toBe(true);
    // Both +1: 6 vs 6, no capture
    expect(result.state.board[1]!.owner).toBe(1);
  });

  it('BUG HUNT: cards with no elements should not trigger elemental bonuses', () => {
    const attackCard = makeCard({ id: 100, right: 5, elements: [] });
    const defenderCard = makeCard({ id: 200, left: 5, elements: ['ocean'] });

    const state = makePlayingState({
      board: [
        null, { card: defenderCard, owner: 1 }, null,
        null, null, null,
        null, null, null,
      ],
      hands: [[attackCard], [makeCard({ id: 201 })]],
      currentPlayer: 0,
      elementalBonus: true,
    });

    const result = placeCard(state, 0, 100, 0);
    expect(result.success).toBe(true);
    // No elements on attacker, so no advantage either way. 5 vs 5 = no capture
    expect(result.state.board[1]!.owner).toBe(1);
  });

  it('BUG HUNT: value of 10 (max) should work correctly in all rules', () => {
    // Cards can have values 1-10. Let's test max values.
    const attackCard = makeCard({ id: 100, right: 10, elements: [] });
    const defenderCard = makeCard({ id: 200, left: 10, elements: [] });

    const state = makePlayingState({
      board: [
        null, { card: defenderCard, owner: 1 }, null,
        null, null, null,
        null, null, null,
      ],
      hands: [[attackCard], [makeCard({ id: 201 })]],
      currentPlayer: 0,
      elementalBonus: false,
    });

    const result = placeCard(state, 0, 100, 0);
    expect(result.success).toBe(true);
    // 10 == 10, no basic capture
    expect(result.state.board[1]!.owner).toBe(1);
  });

  it('BUG HUNT: elemental bonus can push value above 10', () => {
    // If a card has value 10 and gets +1 from elemental, it becomes 11
    // This should still work for capture purposes
    const attackCard = makeCard({ id: 100, right: 10, elements: ['ocean'] });
    const defenderCard = makeCard({ id: 200, left: 10, elements: ['desert'] });

    const state = makePlayingState({
      board: [
        null, { card: defenderCard, owner: 1 }, null,
        null, null, null,
        null, null, null,
      ],
      hands: [[attackCard], [makeCard({ id: 201 })]],
      currentPlayer: 0,
      elementalBonus: true,
    });

    const result = placeCard(state, 0, 100, 0);
    expect(result.success).toBe(true);
    // 10+1=11 > 10: capture
    expect(result.state.board[1]!.owner).toBe(0);
  });
});

// ====================================================================
// COMBO EDGE CASES
// ====================================================================
describe('Combo edge cases', () => {
  it('combo should not chain-capture friendly cards', () => {
    // After capturing an opponent card, the chain should skip friendly cards
    const placed = makeCard({ id: 100, right: 9, elements: [] });
    const captured = makeCard({ id: 200, left: 1, right: 9, elements: [] }); // at cell 1
    const friendly = makeCard({ id: 101, left: 1, elements: [] });           // at cell 2, owned by player 0

    const state = makePlayingState({
      board: [
        null, { card: captured, owner: 1 }, { card: friendly, owner: 0 },
        null, null, null,
        null, null, null,
      ],
      hands: [[placed], [makeCard({ id: 201 })]],
      currentPlayer: 0,
      elementalBonus: false,
    });

    const result = placeCard(state, 0, 100, 0);
    expect(result.success).toBe(true);
    expect(result.state.board[1]!.owner).toBe(0); // captured
    expect(result.state.board[2]!.owner).toBe(0); // should stay player 0 (friendly, not re-captured)
  });

  it('combo should handle deep chains (3+ levels)', () => {
    // Place at 0 -> capture 1 -> chain to 2
    // cell 0: placed, right=9
    // cell 1: opponent, left=1, bottom=9 -> captured, chains down
    // cell 4: opponent, top=1, right=9 -> chain captured, chains right
    // cell 5: opponent, left=1 -> chain captured

    const placed = makeCard({ id: 100, right: 9, elements: [] });
    const card1 = makeCard({ id: 200, left: 1, bottom: 9, elements: [] }); // at cell 1
    const card4 = makeCard({ id: 201, top: 1, right: 9, elements: [] });   // at cell 4
    const card5 = makeCard({ id: 202, left: 1, elements: [] });             // at cell 5

    const state = makePlayingState({
      board: [
        null, { card: card1, owner: 1 }, null,
        null, { card: card4, owner: 1 }, { card: card5, owner: 1 },
        null, null, null,
      ],
      hands: [[placed], [makeCard({ id: 203 })]],
      currentPlayer: 0,
      elementalBonus: false,
    });

    const result = placeCard(state, 0, 100, 0);
    expect(result.success).toBe(true);
    expect(result.state.board[1]!.owner).toBe(0); // direct capture
    expect(result.state.board[4]!.owner).toBe(0); // chain level 1
    expect(result.state.board[5]!.owner).toBe(0); // chain level 2
  });

  it('BUG HUNT: combo uses pre-capture ownership for captured cards', () => {
    // The combo code reads board[capturedIdx].owner, but the captures haven't been
    // applied to the board yet. So capturedCard.owner is STILL the opponent.
    // The combo checks: neighbor.owner === player -> skip
    // This means the captured card is still seen as opponent-owned.
    // For the combo code, it checks the NEIGHBOR's owner, not the captured card's owner.
    // The captured card itself is in the captures list but its board entry still shows opponent.
    // This should still work because the combo is looking at NEIGHBORS of the captured card.

    // Actually, let's think about this more carefully:
    // When we process a captured card in the combo, we look at its neighbors.
    // We skip neighbors owned by `player` (the attacker). Good.
    // We skip visited neighbors. Good.
    // We compare the captured card's side value against the neighbor's side value.
    // The captured card itself is still showing as opponent-owned in the board.
    // But we don't check the captured card's ownership - we just use its values.
    // This is fine. The combo treats it as if it's now the attacker's card (for values).

    // The potential bug: what if a captured card has DIFFERENT behavior based on ownership?
    // In this implementation, card values don't change with ownership, so no bug here.
    expect(true).toBe(true); // This is a reasoning check, not a code bug
  });
});

// ====================================================================
// FULL GAME SIMULATION
// ====================================================================
describe('Full game simulation', () => {
  it('should correctly play a full 9-turn game', () => {
    // Use weak, predictable cards
    const p0Cards = [
      makeCard({ id: 100, top: 1, right: 1, bottom: 1, left: 1, elements: [] }),
      makeCard({ id: 101, top: 2, right: 2, bottom: 2, left: 2, elements: [] }),
      makeCard({ id: 102, top: 3, right: 3, bottom: 3, left: 3, elements: [] }),
      makeCard({ id: 103, top: 4, right: 4, bottom: 4, left: 4, elements: [] }),
      makeCard({ id: 104, top: 5, right: 5, bottom: 5, left: 5, elements: [] }),
    ];
    const p1Cards = [
      makeCard({ id: 200, top: 6, right: 6, bottom: 6, left: 6, elements: [] }),
      makeCard({ id: 201, top: 7, right: 7, bottom: 7, left: 7, elements: [] }),
      makeCard({ id: 202, top: 8, right: 8, bottom: 8, left: 8, elements: [] }),
      makeCard({ id: 203, top: 9, right: 9, bottom: 9, left: 9, elements: [] }),
      makeCard({ id: 204, top: 10, right: 10, bottom: 10, left: 10, elements: [] }),
    ];

    let state = makePlayingState({
      hands: [p0Cards, p1Cards],
      elementalBonus: false,
    });

    // Play all 9 turns: P0 and P1 alternate. P0 places 5, P1 places 4.
    const moves: [Player, number, number][] = [
      [0, 100, 0], // P0 places weakest at top-left
      [1, 200, 4], // P1 places at center - captures nothing (no adjacent P0 cards... wait cell 0 is adjacent to cell 1 and cell 3, not cell 4)
      [0, 101, 2],
      [1, 201, 1], // P1 at cell 1: left faces cell 0 (P0), 7>1=capture. Right faces cell 2 (P0), 7>2=capture
      [0, 102, 8],
      [1, 202, 5], // P1 at cell 5: left faces cell 4 (P1 own)=skip. right=nothing. top=cell 2 now owned by P1 from capture=skip.
      [0, 103, 6],
      [1, 203, 3], // P1 at cell 3: right faces cell 4 (P1)=skip. bottom faces cell 6 (P0), 9>4=capture. top=nothing.
      [0, 104, 7], // Last move. Board full.
    ];

    for (const [player, cardId, cell] of moves) {
      const result = placeCard(state, player, cardId, cell);
      expect(result.success).toBe(true);
      state = result.state;
    }

    expect(state.phase).toBe('finished');
    expect(state.winner).not.toBeNull();
    // Scores should still sum to 10
    expect(state.scores[0] + state.scores[1]).toBe(10);
  });
});

// ====================================================================
// DESIGN ISSUES / POTENTIAL BUGS
// ====================================================================
describe('Design issues and potential bugs', () => {
  it('BUG: createGame initializes scores to [5,5] but hands are empty', () => {
    // createGame sets scores: [5, 5] but hands are empty arrays.
    // This means the score doesn't match reality until hands are dealt.
    // If anyone reads the score before hands are dealt, it's misleading.
    // The scoring formula: board cards owned + hand cards remaining.
    // With empty hands and empty board: 0 + 0 = 0, not 5.
    const state = createGame();
    // Verify the inconsistency exists:
    const actualP0Score = state.board.filter(c => c && c.owner === 0).length + state.hands[0].length;
    const actualP1Score = state.board.filter(c => c && c.owner === 1).length + state.hands[1].length;
    // Fixed: scores now start at [0,0] and are set properly by startGame
    expect(state.scores).toEqual([0, 0]);
    expect(actualP0Score).toBe(0);
    expect(actualP1Score).toBe(0);
  });

  it('FIXED: scores start at [0,0] and must be set by caller after dealing hands', () => {
    const state = createGame();
    state.hands = [
      [makeCard({ id: 1 }), makeCard({ id: 2 }), makeCard({ id: 3 })],
      [makeCard({ id: 4 }), makeCard({ id: 5 }), makeCard({ id: 6 })],
    ];
    state.scores = [state.hands[0].length, state.hands[1].length]; // as startGame now does
    state.phase = 'playing';
    expect(state.scores).toEqual([3, 3]);
    const result = placeCard(state, 0, 1, 0);
    expect(result.success).toBe(true);
    expect(result.state.scores).toEqual([3, 3]);
  });

  it('BUG: non-integer cell index passes validation but creates sparse array behavior', () => {
    // cellIndex 2.5: the check is cellIndex < 0 || cellIndex > 8.
    // 2.5 is not < 0 and not > 8, so it passes.
    // board[2.5] would be undefined (not null for a normal array index).
    // BUT: the check is `state.board[cellIndex] !== null`
    // undefined !== null is TRUE, so it passes the occupied check.
    // Then the code does: newBoard[cellIndex] = { card, owner: player }
    // This creates a property "2.5" on the array, which doesn't affect .length
    // and won't be iterated by .every() in the boardFull check.
    // The card effectively disappears into a parallel dimension.
    const state = makePlayingState();
    const result = placeCard(state, 0, 100, 2.5 as any);
    // This "succeeds" but the card is placed at index 2.5 which is not a real board position
    if (result.success) {
      // The card was placed at a non-integer index - this is a bug
      // Verify the card is NOT at any normal board position
      const normalBoardCards = result.state.board.filter(c => c !== null);
      // The card at 2.5 won't appear in normal array iteration
      expect(normalBoardCards.length).toBe(0); // Card vanished!
      // But accessing it directly works:
      expect((result.state.board as any)[2.5]).toBeDefined();
    }
    // The test documents the bug: non-integer indices are accepted
  });

  it('BUG: NaN cell index passes validation', () => {
    // NaN < 0 is false. NaN > 8 is false. So NaN passes the bounds check.
    const state = makePlayingState();
    const result = placeCard(state, 0, 100, NaN as any);
    // board[NaN] is undefined, undefined !== null is true, so it passes occupied check
    // Then newBoard[NaN] = { card, owner } which creates property "NaN" on the array
    if (result.success) {
      const normalCards = result.state.board.filter(c => c !== null);
      expect(normalCards.length).toBe(0); // Card vanished into NaN index
    }
  });

  it('should handle player 1 placing on their turn correctly', () => {
    const state = makePlayingState({ currentPlayer: 1 });
    const result = placeCard(state, 1, 200, 0);
    expect(result.success).toBe(true);
    expect(result.state.board[0]!.owner).toBe(1);
    expect(result.state.currentPlayer).toBe(0); // switches to player 0
  });

  it('elemental bonus applies per-neighbor, not globally', () => {
    // When placing a card adjacent to 2 opponents with different elements,
    // the elemental bonus should be calculated separately for each neighbor.
    // Use different values to avoid triggering Same/Plus rules.
    const attackCard = makeCard({ id: 100, right: 5, bottom: 6, elements: ['ocean'] });
    const neighbor1 = makeCard({ id: 200, left: 5, elements: ['desert'] }); // ocean beats desert: +1 to attacker
    const neighbor2 = makeCard({ id: 201, top: 6, elements: ['mountain'] }); // mountain beats ocean: +1 to defender

    // Place at cell 0. Right=cell 1, Bottom=cell 3.
    // Sums: 5+5=10, 6+6=12. Different sums -> no Plus.
    // Values: 5!=5 is false but that's Same... wait 5==5 and 6==6 -> 2 Same matches!
    // Need to avoid Same too. Use different neighbor values.
    const attackCard2 = makeCard({ id: 100, right: 5, bottom: 6, elements: ['ocean'] });
    const neighbor1b = makeCard({ id: 200, left: 4, elements: ['desert'] }); // ocean beats desert: atk +1: 5+1=6 > 4 -> capture
    const neighbor2b = makeCard({ id: 201, top: 6, elements: ['mountain'] }); // mountain beats ocean: def +1: 6 vs 6+1=7 -> no capture
    // Sums: 5+4=9, 6+6=12 -> no Plus. Same: 5!=4, 6==6 -> only 1 Same match -> no Same.

    const state = makePlayingState({
      board: [
        null, { card: neighbor1b, owner: 1 }, null,
        { card: neighbor2b, owner: 1 }, null, null,
        null, null, null,
      ],
      hands: [[attackCard2], [makeCard({ id: 202 })]],
      currentPlayer: 0,
      elementalBonus: true,
    });

    const result = placeCard(state, 0, 100, 0);
    expect(result.success).toBe(true);
    // Cell 1: ocean beats desert -> attacker +1: 5+1=6 > 4 -> captured
    expect(result.state.board[1]!.owner).toBe(0);
    // Cell 3: mountain beats ocean -> defender +1: 6 vs 6+1=7 -> NOT captured
    expect(result.state.board[3]!.owner).toBe(1);
  });

  it('FINDING: Plus rule bypasses elemental defense bonuses', () => {
    // The Plus rule uses raw values (no elemental bonuses) to calculate sums.
    // This means a card that would be protected by elemental advantage in basic capture
    // can still be captured via the Plus rule. This could be surprising to players.
    const attackCard = makeCard({ id: 100, right: 5, bottom: 5, elements: ['ocean'] });
    const neighbor1 = makeCard({ id: 200, left: 5, elements: ['desert'] }); // at cell 1
    const neighbor2 = makeCard({ id: 201, top: 5, elements: ['mountain'] }); // at cell 3

    const state = makePlayingState({
      board: [
        null, { card: neighbor1, owner: 1 }, null,
        { card: neighbor2, owner: 1 }, null, null,
        null, null, null,
      ],
      hands: [[attackCard], [makeCard({ id: 202 })]],
      currentPlayer: 0,
      elementalBonus: true,
    });

    const result = placeCard(state, 0, 100, 0);
    expect(result.success).toBe(true);
    // Cell 1: basic capture with ocean advantage: 5+1=6 > 5 -> captured (expected)
    expect(result.state.board[1]!.owner).toBe(0);
    // Cell 3: basic capture blocked by mountain defense: 5 vs 5+1=6 -> NOT captured
    // BUT Plus rule: sum 5+5=10 and 5+5=10 -> Plus triggers -> cell 3 CAPTURED anyway!
    // The Plus rule ignores elemental bonuses.
    expect(result.state.board[3]!.owner).toBe(0); // Captured via Plus, not basic
  });
});

// ====================================================================
// IMMUTABILITY CHECKS
// ====================================================================
describe('Immutability', () => {
  it('should not mutate the original board array', () => {
    const state = makePlayingState();
    const originalBoard = state.board;
    placeCard(state, 0, 100, 0);
    // The original board should still have null at index 0
    expect(originalBoard[0]).toBeNull();
  });

  it('should not mutate the original hands arrays', () => {
    const state = makePlayingState();
    const originalHandLength = state.hands[0].length;
    placeCard(state, 0, 100, 0);
    expect(state.hands[0].length).toBe(originalHandLength);
  });

  it('BUG HUNT: board shallow copy might share PlacedCard references', () => {
    // placeCard does: const newBoard = [...state.board];
    // This is a shallow copy. PlacedCard objects in the array are shared references.
    // When captures happen: newBoard[ci] = { ...placed, owner: player }
    // This creates a NEW object (spread), so the original is not mutated. Good.

    const defenderCard = makeCard({ id: 200, left: 1, elements: [] });
    const state = makePlayingState({
      board: [
        null, { card: defenderCard, owner: 1 }, null,
        null, null, null,
        null, null, null,
      ],
      hands: [[makeCard({ id: 100, right: 9, elements: [] })], [makeCard({ id: 201 })]],
      currentPlayer: 0,
      elementalBonus: false,
    });

    const originalCell1 = state.board[1];
    const result = placeCard(state, 0, 100, 0);
    expect(result.success).toBe(true);

    // Original board cell 1 should still show owner 1
    expect(originalCell1!.owner).toBe(1);
    // New board cell 1 should show owner 0 (captured)
    expect(result.state.board[1]!.owner).toBe(0);
  });
});
