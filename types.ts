
export type Difficulty = 'very-hard' | 'hard' | 'easy' | 'very-easy';
export type CardType = 'normal' | 'cloze';
export type StudyMode = 'reveal' | 'type';
export type StudyStrategy = 'standard' | 'exam';

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
  duration: number; // Tiempo en milisegundos invertido en la tarjeta
}

export interface Deck {
  id: string;
  name: string;
  color: string;
  description?: string;
  createdAt: number;
  settings?: {
    sessionLimit: number;
    strategy: StudyStrategy;
  };
}

export interface Stats {
  total: number;
  due: number;
  new: number;
  learning: number;
  mastered: number;
  retentionRate: number;
  avgTimePerCard: number;
  leeches: Flashcard[];
  workload: { day: string; count: number }[];
  maturity: {
    seeds: number;
    sprouts: number;
    trees: number;
    forest: number;
  };
}
