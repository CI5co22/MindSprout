
import { Flashcard, Difficulty, StudyStrategy } from './types';

/**
 * SM-2 Algorithm Implementation with Exam Mode support
 */
export function calculateNextReview(
  card: Flashcard, 
  difficulty: Difficulty, 
  strategy: StudyStrategy = 'standard',
  duration: number = 0
): Flashcard {
  let q: number;
  switch (difficulty) {
    case 'very-easy': q = 3; break;
    case 'easy': q = 2; break;
    case 'hard': q = 1; break;
    case 'very-hard': q = 0; break;
    default: q = 1;
  }

  let { repetition, interval, easiness } = card;
  const isExam = strategy === 'exam';

  if (q >= 2) { // Correct responses
    if (repetition === 0) {
      interval = 1;
    } else if (repetition === 1) {
      interval = isExam ? 2 : 4;
    } else if (repetition === 2 && isExam) {
      interval = 4;
    } else {
      const multiplier = isExam ? Math.min(easiness, 1.6) : easiness;
      interval = Math.round(interval * multiplier);
    }
    repetition += 1;
  } else { // Incorrect or "very hard" responses
    repetition = 0;
    interval = 1;
  }

  easiness = easiness + (0.1 - (3 - q) * (0.08 + (3 - q) * 0.02));
  if (easiness < 1.3) easiness = 1.3;
  
  if (isExam && easiness > 1.8) easiness = 1.8;

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
      { date: now, difficulty, interval, duration }
    ]
  };
}
