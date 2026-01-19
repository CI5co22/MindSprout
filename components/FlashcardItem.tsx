
import React, { useState, useEffect, useRef } from 'react';
import { Flashcard, Difficulty, StudyMode } from '../types';
import { Button } from './Button';

interface FlashcardItemProps {
  card: Flashcard;
  sessionMode: StudyMode;
  onAnswer: (difficulty: Difficulty, duration: number) => void;
}

export const FlashcardItem: React.FC<FlashcardItemProps> = ({ card, sessionMode, onAnswer }) => {
  const [isRevealed, setIsRevealed] = useState(false);
  const [typedAnswer, setTypedAnswer] = useState('');
  const startTimeRef = useRef<number>(Date.now());
  
  const effectiveMode: StudyMode = card.type === 'cloze' ? 'type' : sessionMode;

  useEffect(() => {
    setIsRevealed(false);
    setTypedAnswer('');
    startTimeRef.current = Date.now();
  }, [card.id]);

  const handleReveal = () => {
    setIsRevealed(true);
  };

  const handleAnswerClick = (difficulty: Difficulty) => {
    const duration = Date.now() - startTimeRef.current;
    onAnswer(difficulty, duration);
  };

  const normalize = (s: string) => s.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g,"");
  
  const getExpectedAnswers = (text: string) => {
    const matches = text.matchAll(/\{\{(.*?)\}\}/g);
    return Array.from(matches).map(m => m[1]);
  };

  const expectedAnswers = getExpectedAnswers(card.question);
  const isCorrect = expectedAnswers.some(ans => normalize(typedAnswer).includes(normalize(ans))) || 
                    normalize(typedAnswer) === normalize(expectedAnswers.join(" "));

  const renderClozeQuestion = (text: string) => {
    return text.replace(/\{\{(.*?)\}\}/g, '____');
  };

  return (
    <div className="w-full max-w-lg mx-auto p-4 flex flex-col items-center gap-6">
      <div className="w-full min-h-[260px] p-8 glass-panel rounded-[2.5rem] flex flex-col items-center justify-center text-center shadow-xl border border-white/40">
        <span className="text-[10px] font-black tracking-widest text-indigo-500 uppercase mb-4 bg-indigo-50 px-3 py-1 rounded-full">
          {card.type === 'cloze' ? 'Completar Texto' : 'Frente'}
        </span>
        <h2 className="text-2xl font-bold text-slate-800 leading-snug">
          {card.type === 'cloze' ? renderClozeQuestion(card.question) : card.question}
        </h2>
      </div>

      {effectiveMode === 'type' && !isRevealed && (
        <div className="w-full animate-in fade-in slide-in-from-bottom-2">
          <input
            type="text"
            value={typedAnswer}
            autoFocus
            onChange={(e) => setTypedAnswer(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleReveal()}
            placeholder="Escribe la palabra faltante..."
            className="w-full p-5 rounded-3xl border-2 border-slate-100 focus:border-indigo-500 focus:ring-0 bg-white shadow-sm transition-all text-center text-lg font-bold"
          />
        </div>
      )}

      {!isRevealed ? (
        <Button 
          onClick={handleReveal}
          className="w-full py-5 text-xl rounded-[2rem] shadow-indigo-100"
        >
          {effectiveMode === 'type' ? 'Verificar' : 'Mostrar Reverso'}
        </Button>
      ) : (
        <>
          <div className={`w-full p-8 rounded-[2.5rem] border-2 flex flex-col items-center justify-center text-center shadow-lg animate-in zoom-in duration-300 ${
            effectiveMode === 'type' 
              ? (isCorrect ? 'bg-emerald-50 border-emerald-100' : 'bg-rose-50 border-rose-100')
              : 'bg-white border-transparent'
          }`}>
            <span className="text-[10px] font-black tracking-widest text-slate-400 uppercase mb-4">Reverso</span>
            <p className="text-2xl font-black text-slate-800">
              {card.type === 'cloze' ? card.question.replace(/\{\{(.*?)\}\}/g, (match, p1) => p1) : card.answer}
            </p>
            {effectiveMode === 'type' && (
              <div className={`mt-4 px-4 py-2 rounded-xl text-sm font-bold ${isCorrect ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'}`}>
                {isCorrect ? '¡Correcto!' : `Respuesta: ${expectedAnswers.join(", ")}`}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 w-full animate-in fade-in slide-in-from-bottom-4">
            <button onClick={() => handleAnswerClick('very-hard')} className="p-4 rounded-2xl border-2 border-rose-100 text-rose-600 bg-rose-50/30 font-bold hover:bg-rose-50 transition-colors">Muy Difícil</button>
            <button onClick={() => handleAnswerClick('hard')} className="p-4 rounded-2xl border-2 border-orange-100 text-orange-600 bg-orange-50/30 font-bold hover:bg-orange-50 transition-colors">Difícil</button>
            <button onClick={() => handleAnswerClick('easy')} className="p-4 rounded-2xl border-2 border-emerald-100 text-emerald-600 bg-emerald-50/30 font-bold hover:bg-emerald-50 transition-colors">Fácil</button>
            <button onClick={() => handleAnswerClick('very-easy')} className="p-4 rounded-2xl border-2 border-indigo-100 text-indigo-600 bg-indigo-50/30 font-bold hover:bg-indigo-50 transition-colors">Muy Fácil</button>
          </div>
        </>
      )}
    </div>
  );
};
