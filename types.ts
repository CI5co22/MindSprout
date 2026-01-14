
export type Difficulty = 'very-hard' | 'hard' | 'easy' | 'very-easy';
export type CardType = 'normal' | 'cloze';
export type StudyMode = 'reveal' | 'type';

export interface Flashcard {
  id: string;
  deckId: string;
  type: CardType;
  question: string;
  answer: string;
  nextReview: number;
  lastReview: number;
  interval: number;
  repetition: number;
  easiness: number;
  history: ReviewHistory[];
  createdAt: number;
}

export interface ReviewHistory {
  date: number;
  difficulty: Difficulty;
  interval: number;
}

export interface Deck {
  id: string;
  name: string;
  color: string;
  description?: string;
  createdAt: number;
  settings?: {
    sessionLimit: number;
  };
}

export interface Stats {
  total: number;
  due: number;
  new: number;
  learning: number;
  mastered: number;
}
