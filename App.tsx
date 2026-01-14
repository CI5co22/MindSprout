
import React, { useState, useEffect, useMemo } from 'react';
import { dbInstance } from './db';
import { Flashcard, Deck, Difficulty, Stats, CardType, StudyMode } from './types';
import { calculateNextReview } from './srs';
import { Button } from './components/Button';
import { FlashcardItem } from './components/FlashcardItem';
import { Modal } from './components/Modal';

const Icons = {
  Home: () => <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  Library: () => <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="m16 6 4 14M12 6v14M8 8v12M4 4v16"/></svg>,
  Stats: () => <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  Settings: () => <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
  Trash: () => <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>,
  Edit: () => <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  Swap: () => <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M7 16V4m0 0L3 8m4-4l4 4m6-4v12m0 0l4-4m-4 4l-4-4"/></svg>
};

const DEFAULT_SESSION_LIMIT = 20;

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'home' | 'library' | 'stats' | 'settings'>('home');
  const [decks, setDecks] = useState<Deck[]>([]);
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [studySession, setStudySession] = useState<Flashcard[]>([]);
  const [isStudying, setIsStudying] = useState(false);
  const [sessionMode, setSessionMode] = useState<StudyMode>('reveal');
  const [sessionStartCount, setSessionStartCount] = useState(0);
  const [sessionDoneCount, setSessionDoneCount] = useState(0);

  const [modalOpen, setModalOpen] = useState<'none' | 'card' | 'deck' | 'session_start' | 'deck_settings'>('none');
  const [selectedDeckId, setSelectedDeckId] = useState<string>('');
  
  const [cardType, setCardType] = useState<CardType>('normal');
  const [cardFront, setCardFront] = useState('');
  const [cardBack, setCardBack] = useState('');
  const [clozeStep, setClozeStep] = useState<'write' | 'select'>('write');
  const [selectedWords, setSelectedWords] = useState<number[]>([]);
  const [newDeckName, setNewDeckName] = useState('');
  const [newDeckColor, setNewDeckColor] = useState('bg-indigo-500');

  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      await dbInstance.init();
      const loadedDecks = await dbInstance.getAll<Deck>('decks');
      const loadedCards = await dbInstance.getAll<Flashcard>('flashcards');
      setDecks(loadedDecks);
      setCards(loadedCards);
      if (loadedDecks.length > 0) setSelectedDeckId(loadedDecks[0].id);
      setIsLoading(false);
    };
    init();
  }, []);

  const stats: Stats = useMemo(() => {
    const now = Date.now();
    return {
      total: cards.length,
      due: cards.filter(c => c.nextReview <= now).length,
      new: cards.filter(c => c.repetition === 0).length,
      learning: cards.filter(c => c.repetition > 0 && c.repetition < 4).length,
      mastered: cards.filter(c => c.interval > 21).length
    };
  }, [cards]);

  const selectedDeckCards = useMemo(() => {
    const now = Date.now();
    const deckCards = cards.filter(c => c.deckId === selectedDeckId);
    return {
      all: deckCards,
      due: deckCards.filter(c => c.nextReview <= now).sort((a, b) => a.nextReview - b.nextReview),
      new: deckCards.filter(c => c.repetition === 0),
    };
  }, [cards, selectedDeckId]);

  const handleStartSession = (mode: StudyMode) => {
    const deck = decks.find(d => d.id === selectedDeckId);
    const limit = deck?.settings?.sessionLimit || DEFAULT_SESSION_LIMIT;
    const sessionCards = [...selectedDeckCards.due, ...selectedDeckCards.new].slice(0, limit);
    
    if (sessionCards.length > 0) {
      setSessionMode(mode);
      setStudySession(sessionCards);
      setSessionStartCount(sessionCards.length);
      setSessionDoneCount(0);
      setIsStudying(true);
      setModalOpen('none');
    }
  };

  const handleSwapInputs = () => {
    const temp = cardFront;
    setCardFront(cardBack);
    setCardBack(temp);
  };

  const handleAnswer = async (difficulty: Difficulty) => {
    const currentCard = studySession[0];
    const updatedCard = calculateNextReview(currentCard, difficulty);
    await dbInstance.put('flashcards', updatedCard);
    setCards(prev => prev.map(c => c.id === updatedCard.id ? updatedCard : c));
    setStudySession(prev => prev.slice(1));
    setSessionDoneCount(prev => prev + 1);
  };

  const saveCard = async () => {
    if (!cardFront || !selectedDeckId) return;
    let finalQuestion = cardFront;
    let finalAnswer = cardBack;

    if (cardType === 'cloze') {
      const tokens = cardFront.split(/\s+/);
      const processedTokens = tokens.map((t, i) => selectedWords.includes(i) ? `{{${t}}}` : t);
      finalQuestion = processedTokens.join(' ');
      finalAnswer = tokens.filter((_, i) => selectedWords.includes(i)).join(', ');
    }

    const card: Flashcard = {
      id: Math.random().toString(36).substr(2, 9),
      deckId: selectedDeckId,
      type: cardType,
      question: finalQuestion,
      answer: finalAnswer,
      nextReview: Date.now(),
      lastReview: 0,
      interval: 0,
      repetition: 0,
      easiness: 2.5,
      history: [],
      createdAt: Date.now()
    };
    await dbInstance.put('flashcards', card);
    setCards(prev => [...prev, card]);
    setCardFront(''); setCardBack(''); setSelectedWords([]); setClozeStep('write'); setModalOpen('none');
  };

  const createDeck = async () => {
    if (!newDeckName) return;
    const d: Deck = {
      id: Math.random().toString(36).substr(2, 9),
      name: newDeckName,
      color: newDeckColor,
      createdAt: Date.now(),
      settings: { sessionLimit: DEFAULT_SESSION_LIMIT }
    };
    await dbInstance.put('decks', d);
    setDecks(prev => [...prev, d]);
    setSelectedDeckId(d.id);
    setNewDeckName('');
    setModalOpen('none');
  };

  const deleteDeck = async (id: string) => {
    if (!confirm("¿Borrar mazo y todas sus tarjetas?")) return;
    await dbInstance.delete('decks', id);
    const related = cards.filter(c => c.deckId === id);
    for (const c of related) await dbInstance.delete('flashcards', c.id);
    setDecks(prev => prev.filter(d => d.id !== id));
    setCards(prev => prev.filter(c => c.deckId !== id));
    setModalOpen('none');
  };

  if (isLoading) return <div className="h-screen flex items-center justify-center bg-white"><div className="animate-pulse text-indigo-500 font-black text-xl tracking-tighter">MindSprout</div></div>;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col safe-area-bottom">
      
      {!isStudying && (
        <header className="px-6 pt-12 pb-6 glass-panel sticky top-0 z-10 border-b border-slate-100 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight">MindSprout</h1>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{activeTab === 'home' ? 'Tu Progreso' : activeTab}</p>
          </div>
          <button onClick={() => setModalOpen('card')} className="bg-indigo-600 w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-lg active:scale-90 transition-transform">
            <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"></path></svg>
          </button>
        </header>
      )}

      <main className="flex-1 overflow-y-auto px-4 py-6 mb-24">
        {isStudying ? (
          <div className="animate-in fade-in duration-300">
            {studySession.length === 0 ? (
              <div className="flex flex-col items-center py-20 text-center px-6">
                <div className="w-24 h-24 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-8 text-4xl animate-bounce">🌱</div>
                <h2 className="text-3xl font-black text-slate-800 tracking-tight">¡Sesión Completa!</h2>
                <p className="text-slate-500 mt-4 font-medium">Has repasado {sessionDoneCount} tarjetas hoy.</p>
                <Button onClick={() => setIsStudying(false)} className="mt-8 w-full max-w-xs py-5">Volver al Inicio</Button>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex justify-between items-center px-4">
                  <button onClick={() => setIsStudying(false)} className="text-slate-400 font-bold text-sm">Salir</button>
                  <div className="flex-1 mx-6 h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-500 transition-all duration-700" style={{ width: `${(sessionDoneCount / sessionStartCount) * 100}%` }} />
                  </div>
                  <span className="text-xs font-black text-indigo-600">{studySession.length}</span>
                </div>
                <FlashcardItem card={studySession[0]} sessionMode={sessionMode} onAnswer={handleAnswer} />
              </div>
            )}
          </div>
        ) : (
          <>
            {activeTab === 'home' && (
              <div className="space-y-8 animate-in fade-in duration-500">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-6 bg-indigo-600 rounded-[2.5rem] text-white shadow-xl shadow-indigo-100">
                    <span className="text-5xl font-black block tabular-nums">{stats.due}</span>
                    <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Hoy</span>
                  </div>
                  <div className="p-6 bg-white rounded-[2.5rem] border border-slate-100 shadow-sm">
                    <span className="text-5xl font-black block text-slate-800 tabular-nums">{stats.new}</span>
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Nuevas</span>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-center px-2">
                    <h3 className="text-lg font-black text-slate-800 tracking-tight">Tus Mazos</h3>
                    <button onClick={() => setModalOpen('deck')} className="text-indigo-600 text-xs font-black uppercase tracking-widest">+ Nuevo Mazo</button>
                  </div>
                  {decks.length === 0 ? (
                    <div className="text-center py-12 px-6 bg-white rounded-[2.5rem] border-2 border-dashed border-slate-200 text-slate-400 font-bold">
                      Aún no tienes mazos. Crea uno para empezar.
                    </div>
                  ) : decks.map(deck => {
                    const dueCount = cards.filter(c => c.deckId === deck.id && c.nextReview <= Date.now()).length;
                    return (
                      <div key={deck.id} className="p-5 bg-white rounded-[2.5rem] border border-slate-100 shadow-sm flex items-center gap-4 active:scale-[0.98] transition-all cursor-pointer" onClick={() => { setSelectedDeckId(deck.id); setModalOpen('session_start'); }}>
                        <div className={`w-12 h-12 rounded-2xl ${deck.color} flex items-center justify-center text-white font-black`}>{deck.name[0]}</div>
                        <div className="flex-1 overflow-hidden">
                          <h4 className="font-bold text-slate-800 text-lg truncate">{deck.name}</h4>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{cards.filter(c => c.deckId === deck.id).length} Tarjetas</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {dueCount > 0 && <div className="bg-rose-500 text-white text-[10px] font-black px-2 py-1 rounded-lg shadow-lg shadow-rose-200">{dueCount} DUE</div>}
                          <button onClick={(e) => { e.stopPropagation(); setSelectedDeckId(deck.id); setModalOpen('deck_settings'); }} className="p-2 text-slate-300 hover:text-indigo-500"><Icons.Edit /></button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {activeTab === 'library' && (
              <div className="space-y-6">
                <h2 className="text-2xl font-black text-slate-800 tracking-tight">Biblioteca</h2>
                {cards.length === 0 ? (
                   <div className="py-20 text-center opacity-40 font-bold">Sin tarjetas.</div>
                ) : cards.map(card => (
                  <div key={card.id} className="p-5 bg-white rounded-3xl border border-slate-100 flex flex-col gap-2 shadow-sm">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[10px] font-black bg-indigo-50 text-indigo-500 px-2 py-0.5 rounded-md uppercase">{card.type}</span>
                      <button onClick={() => dbInstance.delete('flashcards', card.id).then(() => setCards(prev => prev.filter(c => c.id !== card.id)))} className="text-rose-400 text-xs font-bold uppercase">Borrar</button>
                    </div>
                    <p className="font-bold text-slate-800">{card.type === 'cloze' ? card.question.replace(/\{\{(.*?)\}\}/g, '$1') : card.question}</p>
                    <p className="text-slate-400 text-sm font-medium">{card.type === 'cloze' ? 'Texto Oculto' : card.answer}</p>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'stats' && (
              <div className="space-y-8 animate-in zoom-in duration-300">
                <h2 className="text-2xl font-black text-slate-800 tracking-tight">Métricas Globales</h2>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm text-center">
                    <p className="text-4xl font-black text-emerald-500 tabular-nums">{stats.mastered}</p>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Sólidas</p>
                  </div>
                  <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm text-center">
                    <p className="text-4xl font-black text-amber-500 tabular-nums">{stats.learning}</p>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">En Crecimiento</p>
                  </div>
                </div>
                <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
                   <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-4">Total Tarjetas</p>
                   <p className="text-5xl font-black text-slate-800">{stats.total}</p>
                </div>
              </div>
            )}

            {activeTab === 'settings' && (
              <div className="space-y-8">
                <h2 className="text-2xl font-black text-slate-800 tracking-tight">Configuración</h2>
                <div className="bg-white p-8 rounded-[3rem] space-y-4 border border-slate-100">
                  <Button onClick={() => Notification.requestPermission()} variant="secondary" className="w-full">Probar Notificaciones</Button>
                  <p className="text-[10px] text-slate-400 text-center font-black uppercase opacity-40">MindSprout 4.2.0 • UX Refinada</p>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {!isStudying && (
        <nav className="fixed bottom-0 left-0 right-0 glass-panel border-t border-slate-100 flex justify-around py-4 pb-10 px-6 z-20">
          <button onClick={() => setActiveTab('home')} className={`flex flex-col items-center gap-1 ${activeTab === 'home' ? 'text-indigo-600' : 'text-slate-300'}`}><Icons.Home /><span className="text-[9px] font-black uppercase tracking-tighter">Inicio</span></button>
          <button onClick={() => setActiveTab('library')} className={`flex flex-col items-center gap-1 ${activeTab === 'library' ? 'text-indigo-600' : 'text-slate-300'}`}><Icons.Library /><span className="text-[9px] font-black uppercase tracking-tighter">Biblio</span></button>
          <button onClick={() => setActiveTab('stats')} className={`flex flex-col items-center gap-1 ${activeTab === 'stats' ? 'text-indigo-600' : 'text-slate-300'}`}><Icons.Stats /><span className="text-[9px] font-black uppercase tracking-tighter">Stats</span></button>
          <button onClick={() => setActiveTab('settings')} className={`flex flex-col items-center gap-1 ${activeTab === 'settings' ? 'text-indigo-600' : 'text-slate-300'}`}><Icons.Settings /><span className="text-[9px] font-black uppercase tracking-tighter">Ajustes</span></button>
        </nav>
      )}

      {/* MODAL: START SESSION */}
      <Modal isOpen={modalOpen === 'session_start'} onClose={() => setModalOpen('none')} title="Preparar Sesión">
        <div className="space-y-6 mt-4">
          <div className="p-6 bg-slate-50 rounded-[2rem] text-center">
            <p className="text-slate-500 font-bold text-sm">
              Tarjetas disponibles: {selectedDeckCards.due.length + selectedDeckCards.new.length}
            </p>
          </div>

          {(selectedDeckCards.due.length + selectedDeckCards.new.length) > 0 ? (
            <div className="grid gap-3">
              <button onClick={() => handleStartSession('reveal')} className="p-6 bg-white rounded-[2rem] border-2 border-slate-100 hover:border-indigo-500 text-left transition-all group">
                <h4 className="font-black text-slate-800 text-lg group-hover:text-indigo-600">Modo Solo Ver</h4>
                <p className="text-xs text-slate-400 font-medium">Evalúa tu respuesta mentalmente.</p>
              </button>
              <button onClick={() => handleStartSession('type')} className="p-6 bg-white rounded-[2rem] border-2 border-slate-100 hover:border-indigo-500 text-left transition-all group">
                <h4 className="font-black text-slate-800 text-lg group-hover:text-indigo-600">Modo Escribir</h4>
                <p className="text-xs text-slate-400 font-medium">Validación estricta con teclado.</p>
              </button>
            </div>
          ) : (
            <div className="p-8 text-center space-y-4 animate-in zoom-in duration-300">
               <div className="text-4xl">🎉</div>
               <h4 className="font-black text-slate-800 text-lg">¡Todo al día!</h4>
               <p className="text-sm text-slate-500 font-medium leading-relaxed">No tienes tarjetas para repasar en este mazo ahora mismo.</p>
               <Button onClick={() => setModalOpen('card')} variant="secondary" className="w-full">Añadir Tarjetas</Button>
            </div>
          )}
        </div>
      </Modal>

      {/* MODAL: CARD FORM */}
      <Modal isOpen={modalOpen === 'card'} onClose={() => { setModalOpen('none'); setClozeStep('write'); setSelectedWords([]); }} title="Nueva Flashcard">
        {decks.length === 0 ? (
          <div className="p-8 text-center space-y-6 animate-in zoom-in duration-300">
             <div className="w-20 h-20 bg-indigo-50 text-indigo-500 rounded-full flex items-center justify-center mx-auto text-3xl font-black">!</div>
             <p className="text-slate-600 font-bold leading-relaxed">Primero necesitas crear un mazo para guardar tus tarjetas.</p>
             <Button onClick={() => setModalOpen('deck')} className="w-full py-4">Crear mi primer Mazo</Button>
          </div>
        ) : (
          <div className="space-y-6 mt-4">
            <div className="flex bg-slate-100 p-1 rounded-2xl">
              <button onClick={() => { setCardType('normal'); setClozeStep('write'); }} className={`flex-1 py-2 text-xs font-black rounded-xl transition-all ${cardType === 'normal' ? 'bg-white shadow text-indigo-600' : 'text-slate-400'}`}>NORMAL</button>
              <button onClick={() => { setCardType('cloze'); setClozeStep('write'); }} className={`flex-1 py-2 text-xs font-black rounded-xl transition-all ${cardType === 'cloze' ? 'bg-white shadow text-indigo-600' : 'text-slate-400'}`}>OCULTAR TEXTO</button>
            </div>
            
            {cardType === 'normal' ? (
              <div className="space-y-4 animate-in slide-in-from-right-4 relative">
                <div className="space-y-1">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Frente</label>
                   <textarea placeholder="Ej: ¿Capital de España?" className="w-full p-5 rounded-[2rem] bg-slate-50 border-none min-h-[100px] font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500" value={cardFront} onChange={e => setCardFront(e.target.value)}/>
                </div>
                
                <div className="flex justify-center -my-3 z-10 relative">
                  <button onClick={handleSwapInputs} className="bg-white p-3 rounded-full shadow-lg border border-slate-100 text-indigo-500 active:scale-90 active:rotate-180 transition-all">
                    <Icons.Swap />
                  </button>
                </div>

                <div className="space-y-1">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Reverso</label>
                   <textarea placeholder="Ej: Madrid" className="w-full p-5 rounded-[2rem] bg-slate-50 border-none min-h-[100px] font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500" value={cardBack} onChange={e => setCardBack(e.target.value)}/>
                </div>
              </div>
            ) : (
              <div className="space-y-4 animate-in slide-in-from-left-4">
                 {clozeStep === 'write' ? (
                   <div className="space-y-4">
                     <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 text-center block">Escribe la frase completa</label>
                       <textarea placeholder="La capital de Francia es París." className="w-full p-5 rounded-[2rem] bg-slate-50 border-none min-h-[120px] font-bold text-slate-800" value={cardFront} onChange={e => setCardFront(e.target.value)}/>
                     </div>
                     <Button variant="secondary" onClick={() => setClozeStep('select')} className="w-full py-4" disabled={!cardFront.trim()}>Seleccionar palabras a ocultar</Button>
                   </div>
                 ) : (
                   <div className="space-y-5">
                      <div className="p-4 bg-indigo-50 rounded-2xl">
                         <p className="text-xs font-bold text-indigo-600 text-center">Toca las palabras que quieres que sean huecos (____)</p>
                      </div>
                      <div className="flex flex-wrap gap-2 p-6 bg-slate-50 rounded-[2rem] border border-slate-100 min-h-[100px]">
                        {cardFront.split(/\s+/).map((word, idx) => (
                          <button 
                            key={idx} 
                            onClick={() => setSelectedWords(prev => prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx])} 
                            className={`px-3 py-1.5 rounded-xl text-sm font-bold transition-all shadow-sm ${selectedWords.includes(idx) ? 'bg-indigo-600 text-white scale-110' : 'bg-white text-slate-600 active:scale-95'}`}
                          >
                            {word}
                          </button>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <Button variant="ghost" onClick={() => setClozeStep('write')} className="flex-1">Atrás</Button>
                        <Button onClick={saveCard} className="flex-[2]" disabled={selectedWords.length === 0}>Crear Tarjeta</Button>
                      </div>
                   </div>
                 )}
              </div>
            )}

            {(cardType === 'normal' || (cardType === 'cloze' && clozeStep === 'write')) && (
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 text-center block">Mazo de destino</label>
                <select className="w-full p-4 rounded-3xl bg-slate-50 border-none font-black text-slate-600 appearance-none text-center focus:ring-2 focus:ring-indigo-500 shadow-sm" value={selectedDeckId} onChange={e => setSelectedDeckId(e.target.value)}>
                  {decks.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
            )}
            
            {cardType === 'normal' && (
              <Button onClick={saveCard} className="w-full py-5 text-lg rounded-[2rem] shadow-xl shadow-indigo-100" disabled={!cardFront || !cardBack}>
                Guardar Tarjeta
              </Button>
            )}
          </div>
        )}
      </Modal>

      {/* MODAL: NEW DECK */}
      <Modal isOpen={modalOpen === 'deck'} onClose={() => setModalOpen('none')} title="Nuevo Mazo">
        <div className="space-y-6 mt-4">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Nombre del Mazo</label>
            <input placeholder="Ej: Inglés Médico" className="w-full p-6 rounded-[2rem] bg-slate-50 border-none text-xl font-black text-slate-800" value={newDeckName} onChange={e => setNewDeckName(e.target.value)}/>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Color distintivo</label>
            <div className="grid grid-cols-5 gap-3">
               {['bg-indigo-500', 'bg-rose-500', 'bg-amber-500', 'bg-emerald-500', 'bg-slate-800'].map(color => (
                  <button key={color} onClick={() => setNewDeckColor(color)} className={`aspect-square rounded-2xl ${color} transition-all ${newDeckColor === color ? 'ring-4 ring-indigo-200 scale-110 shadow-lg' : 'opacity-40 scale-90'}`}></button>
               ))}
            </div>
          </div>
          <Button onClick={createDeck} className="w-full py-5 text-lg rounded-[2rem] shadow-xl shadow-indigo-100" disabled={!newDeckName}>Crear Mazo</Button>
        </div>
      </Modal>

      {/* MODAL: DECK SETTINGS */}
      <Modal isOpen={modalOpen === 'deck_settings'} onClose={() => setModalOpen('none')} title="Gestionar Mazo">
        <div className="mt-4 space-y-4">
           <p className="text-slate-500 font-medium text-center text-sm">¿Deseas eliminar este mazo? Esta acción es irreversible y borrará todas las tarjetas dentro.</p>
           <Button variant="danger" onClick={() => deleteDeck(selectedDeckId)} className="w-full py-4 rounded-[1.5rem]">Eliminar para siempre</Button>
        </div>
      </Modal>

    </div>
  );
};

export default App;
