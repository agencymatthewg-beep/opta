/**
 * Famous player profiles for style comparison.
 *
 * Each profile represents a legendary player's play style
 * based on historical analysis of their games.
 */

import type { FamousPlayerProfile, PlayStyleMetrics, StyleArchetype } from './types';
import { calculateStyleSimilarity } from './types';

/**
 * Collection of famous player profiles.
 */
export const FAMOUS_PLAYERS: FamousPlayerProfile[] = [
  {
    name: 'Mikhail Tal',
    peakRating: 2705,
    era: '1960s',
    description: 'The Magician from Riga - known for breathtaking sacrifices and tactical brilliance',
    metrics: {
      aggression: 95,
      positional: 45,
      tactical: 98,
      endgame: 60,
      openingPreparation: 70,
      timePressure: 80,
    },
    signatureOpenings: ['Sicilian Najdorf', 'King\'s Indian Attack', 'Benoni'],
    archetype: 'attacker',
  },
  {
    name: 'Tigran Petrosian',
    peakRating: 2650,
    era: '1960s',
    description: 'Iron Tigran - the greatest defensive player, master of prophylaxis',
    metrics: {
      aggression: 25,
      positional: 95,
      tactical: 50,
      endgame: 85,
      openingPreparation: 80,
      timePressure: 70,
    },
    signatureOpenings: ['English Opening', 'Queen\'s Gambit Declined', 'Caro-Kann'],
    archetype: 'defender',
  },
  {
    name: 'Bobby Fischer',
    peakRating: 2785,
    era: '1970s',
    description: 'The greatest American player - deep preparation and perfect technique',
    metrics: {
      aggression: 70,
      positional: 85,
      tactical: 85,
      endgame: 95,
      openingPreparation: 95,
      timePressure: 75,
    },
    signatureOpenings: ['Sicilian Najdorf', 'King\'s Indian', 'Ruy Lopez'],
    archetype: 'universal',
  },
  {
    name: 'Garry Kasparov',
    peakRating: 2851,
    era: '1985-2005',
    description: 'The Beast - incredible preparation and aggressive dynamic play',
    metrics: {
      aggression: 88,
      positional: 80,
      tactical: 90,
      endgame: 80,
      openingPreparation: 98,
      timePressure: 85,
    },
    signatureOpenings: ['Sicilian Scheveningen', 'King\'s Indian', 'Grünfeld'],
    archetype: 'attacker',
  },
  {
    name: 'Anatoly Karpov',
    peakRating: 2780,
    era: '1975-1995',
    description: 'The Boa Constrictor - squeezes advantages from thin air with perfect technique',
    metrics: {
      aggression: 35,
      positional: 98,
      tactical: 65,
      endgame: 90,
      openingPreparation: 85,
      timePressure: 80,
    },
    signatureOpenings: ['Caro-Kann', 'Queen\'s Gambit', 'English Opening'],
    archetype: 'positional',
  },
  {
    name: 'Magnus Carlsen',
    peakRating: 2882,
    era: '2010-present',
    description: 'The Mozart of Chess - intuitive genius with incredible endgame technique',
    metrics: {
      aggression: 60,
      positional: 90,
      tactical: 80,
      endgame: 98,
      openingPreparation: 75,
      timePressure: 95,
    },
    signatureOpenings: ['London System', 'Catalan', 'Italian Game'],
    archetype: 'endgame-artist',
  },
  {
    name: 'Viswanathan Anand',
    peakRating: 2817,
    era: '1990-2020',
    description: 'Lightning Kid - rapid intuition and natural attacking instincts',
    metrics: {
      aggression: 72,
      positional: 70,
      tactical: 85,
      endgame: 75,
      openingPreparation: 90,
      timePressure: 98,
    },
    signatureOpenings: ['Sicilian Dragon', 'Semi-Slav', 'Petroff'],
    archetype: 'practical',
  },
  {
    name: 'Vladimir Kramnik',
    peakRating: 2817,
    era: '1995-2020',
    description: 'The Berlin Wall - deep strategic understanding and rock-solid defense',
    metrics: {
      aggression: 40,
      positional: 92,
      tactical: 70,
      endgame: 88,
      openingPreparation: 92,
      timePressure: 70,
    },
    signatureOpenings: ['Berlin Defense', 'Catalan', 'English Opening'],
    archetype: 'positional',
  },
  {
    name: 'Mikhail Botvinnik',
    peakRating: 2630,
    era: '1940-1960',
    description: 'The Patriarch - scientific approach and exceptional preparation',
    metrics: {
      aggression: 55,
      positional: 88,
      tactical: 70,
      endgame: 85,
      openingPreparation: 98,
      timePressure: 60,
    },
    signatureOpenings: ['French Defense', 'English Opening', 'Nimzo-Indian'],
    archetype: 'theoretician',
  },
  {
    name: 'Alexander Alekhine',
    peakRating: 2700,
    era: '1920-1940',
    description: 'The Russian Genius - ferocious attacks and sparkling combinations',
    metrics: {
      aggression: 90,
      positional: 70,
      tactical: 95,
      endgame: 75,
      openingPreparation: 80,
      timePressure: 70,
    },
    signatureOpenings: ['Alekhine Defense', 'French Defense', 'Queen\'s Gambit'],
    archetype: 'attacker',
  },
  {
    name: 'José Raúl Capablanca',
    peakRating: 2700,
    era: '1910-1930',
    description: 'The Chess Machine - pure natural talent with incredible intuition',
    metrics: {
      aggression: 50,
      positional: 85,
      tactical: 65,
      endgame: 98,
      openingPreparation: 45,
      timePressure: 90,
    },
    signatureOpenings: ['Queen\'s Gambit Declined', 'Ruy Lopez', 'Four Knights'],
    archetype: 'endgame-artist',
  },
  {
    name: 'Hikaru Nakamura',
    peakRating: 2816,
    era: '2010-present',
    description: 'The Speed King - insanely fast calculation and bullet chess dominance',
    metrics: {
      aggression: 78,
      positional: 65,
      tactical: 88,
      endgame: 75,
      openingPreparation: 80,
      timePressure: 99,
    },
    signatureOpenings: ['King\'s Indian', 'Sicilian Dragon', 'Anti-Berlin'],
    archetype: 'practical',
  },
  {
    name: 'Paul Morphy',
    peakRating: 2690,
    era: '1850s',
    description: 'The Pride and Sorrow of Chess - the original attacking genius',
    metrics: {
      aggression: 85,
      positional: 70,
      tactical: 90,
      endgame: 65,
      openingPreparation: 40,
      timePressure: 85,
    },
    signatureOpenings: ['King\'s Gambit', 'Italian Game', 'Philidor Defense'],
    archetype: 'attacker',
  },
  {
    name: 'Ding Liren',
    peakRating: 2816,
    era: '2020-present',
    description: 'The Wall - incredible resilience and defensive resources',
    metrics: {
      aggression: 45,
      positional: 88,
      tactical: 75,
      endgame: 85,
      openingPreparation: 85,
      timePressure: 70,
    },
    signatureOpenings: ['Catalan', 'Berlin Defense', 'Semi-Slav'],
    archetype: 'defender',
  },
  {
    name: 'Fabiano Caruana',
    peakRating: 2844,
    era: '2015-present',
    description: 'Fabi - meticulous preparation and incredible calculation',
    metrics: {
      aggression: 65,
      positional: 85,
      tactical: 88,
      endgame: 80,
      openingPreparation: 98,
      timePressure: 72,
    },
    signatureOpenings: ['Petroff Defense', 'Italian Game', 'English Opening'],
    archetype: 'theoretician',
  },
];

/**
 * Find the most similar famous player to a given style profile.
 */
export function findMostSimilarPlayer(
  userMetrics: PlayStyleMetrics
): { player: FamousPlayerProfile; similarity: number } {
  let bestMatch = FAMOUS_PLAYERS[0];
  let highestSimilarity = 0;

  for (const player of FAMOUS_PLAYERS) {
    const similarity = calculateStyleSimilarity(userMetrics, player.metrics);
    if (similarity > highestSimilarity) {
      highestSimilarity = similarity;
      bestMatch = player;
    }
  }

  return { player: bestMatch, similarity: highestSimilarity };
}

/**
 * Get top N most similar players.
 */
export function getTopSimilarPlayers(
  userMetrics: PlayStyleMetrics,
  count: number = 3
): Array<{ player: FamousPlayerProfile; similarity: number }> {
  const scored = FAMOUS_PLAYERS.map((player) => ({
    player,
    similarity: calculateStyleSimilarity(userMetrics, player.metrics),
  }));

  return scored.sort((a, b) => b.similarity - a.similarity).slice(0, count);
}

/**
 * Get players by archetype.
 */
export function getPlayersByArchetype(archetype: StyleArchetype): FamousPlayerProfile[] {
  return FAMOUS_PLAYERS.filter((p) => p.archetype === archetype);
}

export default FAMOUS_PLAYERS;
