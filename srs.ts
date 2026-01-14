
import { Flashcard, Difficulty } from './types';

/**
 * SM-2 Algorithm Implementation
 * q (Quality): 
 * 3: Very Easy (Optimal response)
 * 2: Easy (Correct response after hesitation)
 * 1: Hard (Correct response with serious difficulty)
 * 0: Very Hard (Incorrect response)
 */
export function calculateNextReview(card: Flashcard, difficulty: Difficulty): Flashcard {
  let q: number;
  switch (difficulty) {
    case 'very-easy': q = 3; break;
    case 'easy': q = 2; break;
    case 'hard': q = 1; break;
    case 'very-hard': q = 0; break;
    default: q = 1;
  }

  let { repetition, interval, easiness } = card;

  if (q >= 2) { // Correct responses
    if (repetition === 0) {
      interval = 1;
    } else if (repetition === 1) {
      interval = 4;
    } else {
      interval = Math.round(interval * easiness);
    }
    repetition += 1;
  } else { // Incorrect or "very hard" responses
    repetition = 0;
    interval = 1;
  }

  // Adjust easiness factor (EF)
  // EF' = EF + (0.1 - (3-q) * (0.08 + (3-q) * 0.02))
  // For q=3: EF += 0.1
  // For q=0: EF -= 0.5 (capped at 1.3)
  easiness = easiness + (0.1 - (3 - q) * (0.08 + (3 - q) * 0.02));
  if (easiness < 1.3) easiness = 1.3;

  const now = Date.now();
  const nextReview = now + interval * 24 * 60 * 60 * 1000;

  return {
    ...card,
    repetition,
    interval,
    easiness,
    lastReview: now,
    nextReview,
    history: [
      ...card.history,
      { date: now, difficulty, interval }
    ]
  };
}
