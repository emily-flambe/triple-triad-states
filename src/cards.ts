// US State Triple Triad Cards
// Each card has: name, top/right/bottom/left values (1-10), and 1-2 elements

export type Element = 'ocean' | 'mountain' | 'desert' | 'plain' | 'swamp' | 'forest';

export interface Card {
  id: number;
  name: string;
  top: number;
  right: number;
  bottom: number;
  left: number;
  elements: Element[];
}

// Elemental advantage chart
// Each element beats 2 others, loses to 2 others
// Ocean > Desert, Forest
// Mountain > Ocean, Plain
// Desert > Swamp, Forest
// Plain > Desert, Swamp
// Forest > Mountain, Plain
// Swamp > Ocean, Mountain
export const ELEMENT_ADVANTAGES: Record<Element, Element[]> = {
  ocean: ['desert', 'forest'],
  mountain: ['ocean', 'plain'],
  desert: ['swamp', 'forest'],
  plain: ['desert', 'swamp'],
  forest: ['mountain', 'plain'],
  swamp: ['ocean', 'mountain'],
};

export function hasAdvantage(attacker: Element[], defender: Element[]): boolean {
  for (const atk of attacker) {
    for (const def of defender) {
      if (ELEMENT_ADVANTAGES[atk].includes(def)) return true;
    }
  }
  return false;
}

// All 50 US state cards
// Elements assigned based on real geography
// Stats balanced: most cards total 16-22, with a few powerhouses
export const ALL_CARDS: Card[] = [
  { id: 1,  name: 'Alabama',        top: 4, right: 6, bottom: 5, left: 3, elements: ['forest', 'plain'] },
  { id: 2,  name: 'Alaska',         top: 8, right: 5, bottom: 3, left: 7, elements: ['mountain', 'ocean'] },
  { id: 3,  name: 'Arizona',        top: 6, right: 4, bottom: 7, left: 5, elements: ['desert', 'mountain'] },
  { id: 4,  name: 'Arkansas',       top: 5, right: 3, bottom: 6, left: 4, elements: ['forest', 'swamp'] },
  { id: 5,  name: 'California',     top: 7, right: 8, bottom: 6, left: 5, elements: ['ocean', 'mountain'] },
  { id: 6,  name: 'Colorado',       top: 6, right: 5, bottom: 4, left: 7, elements: ['mountain', 'plain'] },
  { id: 7,  name: 'Connecticut',    top: 4, right: 5, bottom: 3, left: 4, elements: ['ocean', 'forest'] },
  { id: 8,  name: 'Delaware',       top: 3, right: 4, bottom: 3, left: 3, elements: ['ocean', 'swamp'] },
  { id: 9,  name: 'Florida',        top: 6, right: 7, bottom: 5, left: 4, elements: ['ocean', 'swamp'] },
  { id: 10, name: 'Georgia',        top: 5, right: 6, bottom: 4, left: 5, elements: ['forest', 'ocean'] },
  { id: 11, name: 'Hawaii',         top: 5, right: 4, bottom: 6, left: 5, elements: ['ocean', 'forest'] },
  { id: 12, name: 'Idaho',          top: 5, right: 3, bottom: 4, left: 6, elements: ['mountain', 'forest'] },
  { id: 13, name: 'Illinois',       top: 5, right: 6, bottom: 4, left: 5, elements: ['plain', 'forest'] },
  { id: 14, name: 'Indiana',        top: 4, right: 5, bottom: 4, left: 4, elements: ['plain', 'forest'] },
  { id: 15, name: 'Iowa',           top: 4, right: 5, bottom: 3, left: 5, elements: ['plain', 'forest'] },
  { id: 16, name: 'Kansas',         top: 3, right: 5, bottom: 4, left: 6, elements: ['plain', 'desert'] },
  { id: 17, name: 'Kentucky',       top: 5, right: 4, bottom: 5, left: 4, elements: ['forest', 'mountain'] },
  { id: 18, name: 'Louisiana',      top: 5, right: 6, bottom: 7, left: 3, elements: ['swamp', 'ocean'] },
  { id: 19, name: 'Maine',          top: 5, right: 3, bottom: 4, left: 6, elements: ['ocean', 'forest'] },
  { id: 20, name: 'Maryland',       top: 4, right: 5, bottom: 3, left: 5, elements: ['ocean', 'forest'] },
  { id: 21, name: 'Massachusetts',  top: 5, right: 6, bottom: 4, left: 4, elements: ['ocean', 'forest'] },
  { id: 22, name: 'Michigan',       top: 5, right: 5, bottom: 4, left: 5, elements: ['forest', 'ocean'] },
  { id: 23, name: 'Minnesota',      top: 5, right: 4, bottom: 5, left: 5, elements: ['forest', 'plain'] },
  { id: 24, name: 'Mississippi',    top: 4, right: 3, bottom: 6, left: 4, elements: ['swamp', 'forest'] },
  { id: 25, name: 'Missouri',       top: 5, right: 4, bottom: 5, left: 5, elements: ['plain', 'forest'] },
  { id: 26, name: 'Montana',        top: 6, right: 4, bottom: 3, left: 7, elements: ['mountain', 'plain'] },
  { id: 27, name: 'Nebraska',       top: 3, right: 4, bottom: 4, left: 6, elements: ['plain', 'desert'] },
  { id: 28, name: 'Nevada',         top: 5, right: 6, bottom: 4, left: 3, elements: ['desert', 'mountain'] },
  { id: 29, name: 'New Hampshire',  top: 5, right: 3, bottom: 4, left: 6, elements: ['mountain', 'forest'] },
  { id: 30, name: 'New Jersey',     top: 4, right: 5, bottom: 4, left: 4, elements: ['ocean', 'swamp'] },
  { id: 31, name: 'New Mexico',     top: 5, right: 4, bottom: 6, left: 5, elements: ['desert', 'mountain'] },
  { id: 32, name: 'New York',       top: 6, right: 7, bottom: 5, left: 4, elements: ['ocean', 'mountain'] },
  { id: 33, name: 'North Carolina', top: 5, right: 6, bottom: 5, left: 4, elements: ['ocean', 'mountain'] },
  { id: 34, name: 'North Dakota',   top: 3, right: 4, bottom: 3, left: 5, elements: ['plain'] },
  { id: 35, name: 'Ohio',           top: 5, right: 5, bottom: 4, left: 4, elements: ['plain', 'forest'] },
  { id: 36, name: 'Oklahoma',       top: 4, right: 5, bottom: 5, left: 4, elements: ['plain', 'desert'] },
  { id: 37, name: 'Oregon',         top: 6, right: 4, bottom: 5, left: 6, elements: ['ocean', 'forest'] },
  { id: 38, name: 'Pennsylvania',   top: 5, right: 5, bottom: 5, left: 5, elements: ['mountain', 'forest'] },
  { id: 39, name: 'Rhode Island',   top: 3, right: 4, bottom: 3, left: 3, elements: ['ocean'] },
  { id: 40, name: 'South Carolina', top: 4, right: 5, bottom: 5, left: 3, elements: ['ocean', 'swamp'] },
  { id: 41, name: 'South Dakota',   top: 4, right: 3, bottom: 4, left: 5, elements: ['plain', 'mountain'] },
  { id: 42, name: 'Tennessee',      top: 5, right: 5, bottom: 5, left: 4, elements: ['mountain', 'forest'] },
  { id: 43, name: 'Texas',          top: 7, right: 6, bottom: 8, left: 5, elements: ['desert', 'plain'] },
  { id: 44, name: 'Utah',           top: 6, right: 5, bottom: 4, left: 6, elements: ['desert', 'mountain'] },
  { id: 45, name: 'Vermont',        top: 4, right: 3, bottom: 4, left: 5, elements: ['mountain', 'forest'] },
  { id: 46, name: 'Virginia',       top: 5, right: 6, bottom: 4, left: 5, elements: ['ocean', 'mountain'] },
  { id: 47, name: 'Washington',     top: 6, right: 5, bottom: 5, left: 6, elements: ['ocean', 'mountain'] },
  { id: 48, name: 'West Virginia',  top: 4, right: 3, bottom: 5, left: 5, elements: ['mountain', 'forest'] },
  { id: 49, name: 'Wisconsin',      top: 4, right: 5, bottom: 4, left: 4, elements: ['forest', 'plain'] },
  { id: 50, name: 'Wyoming',        top: 5, right: 3, bottom: 3, left: 7, elements: ['mountain', 'plain'] },
];

export function getCardById(id: number): Card | undefined {
  return ALL_CARDS.find(c => c.id === id);
}

export function getRandomHand(exclude: number[] = []): Card[] {
  const available = ALL_CARDS.filter(c => !exclude.includes(c.id));
  const hand: Card[] = [];
  while (hand.length < 5 && available.length > 0) {
    const idx = Math.floor(Math.random() * available.length);
    hand.push(available.splice(idx, 1)[0]);
  }
  return hand;
}

function randomStat(): number {
  return Math.floor(Math.random() * 10); // 0-9
}

function sumStats(cards: Card[]): number {
  return cards.reduce((s, c) => s + c.top + c.right + c.bottom + c.left, 0);
}

function assignRandomStats(card: Card): Card {
  return {
    ...card,
    top: randomStat(),
    right: randomStat(),
    bottom: randomStat(),
    left: randomStat(),
  };
}

/**
 * Deal 10 random cards split into 2 balanced hands of 5.
 * Both hands will have the same total stat points.
 * Stats are random 0-9, elements/names come from ALL_CARDS.
 */
export function generateBalancedHands(): [Card[], Card[]] {
  // Shuffle and pick 10
  const shuffled = [...ALL_CARDS].sort(() => Math.random() - 0.5);
  const picked = shuffled.slice(0, 10);

  // Assign random stats to hand 0
  const hand0 = picked.slice(0, 5).map(assignRandomStats);
  // Assign random stats to hand 1
  let hand1 = picked.slice(5, 10).map(assignRandomStats);

  const targetSum = sumStats(hand0);
  let currentSum = sumStats(hand1);

  // Adjust hand1 stats to match hand0's total
  const sides: ('top' | 'right' | 'bottom' | 'left')[] = ['top', 'right', 'bottom', 'left'];
  let iterations = 0;
  while (currentSum !== targetSum && iterations < 1000) {
    iterations++;
    const cardIdx = Math.floor(Math.random() * 5);
    const side = sides[Math.floor(Math.random() * 4)];
    if (currentSum < targetSum && hand1[cardIdx][side] < 9) {
      hand1[cardIdx] = { ...hand1[cardIdx], [side]: hand1[cardIdx][side] + 1 };
      currentSum++;
    } else if (currentSum > targetSum && hand1[cardIdx][side] > 0) {
      hand1[cardIdx] = { ...hand1[cardIdx], [side]: hand1[cardIdx][side] - 1 };
      currentSum--;
    }
  }

  return [hand0, hand1];
}
