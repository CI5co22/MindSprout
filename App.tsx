
import React, { useState, useEffect, useMemo } from 'react';
import { dbInstance } from './db';
import { Flashcard, Deck, Difficulty, Stats, CardType, StudyMode } from './types';
import { calculateNextReview } from './srs';
import { Button } from './components/Button';
import { FlashcardItem } from './components/FlashcardItem';
import { Modal } from './components/Modal';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  Cell, PieChart, Pie, AreaChart, Area
} from 'recharts';
import { 
  Home, Library as LibraryIcon, BarChart2, Trash2, Edit2, 
  ArrowLeftRight, Plus, ChevronRight, AlertCircle, Info
} from 'lucide-react';

const COLORS = ['#6366f1', '#f43f5e', '#f59e0b', '#10b981', '#64748b'];
const DEFAULT_SESSION_LIMIT = 20;

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'home' | 'library' | 'stats'>('home');
  const [decks, setDecks] = useState<Deck[]>([]);
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [studySession, setStudySession] = useState<Flashcard[]>([]);
  const [isStudying, setIsStudying] = useState(false);
  const [sessionMode, setSessionMode] = useState<StudyMode>('reveal');
  const [sessionStartCount, setSessionStartCount] = useState(0);
  const [sessionDoneCount, setSessionDoneCount] = useState(0);

  const [modalOpen, setModalOpen] = useState<'none' | 'card' | 'deck' | 'session_start' | 'deck_settings'>('none');
  const [selectedDeckId, setSelectedDeckId] = useState<string>('');
  
  // Card Form State
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [cardType, setCardType] = useState<CardType>('normal');
  const [cardFront, setCardFront] = useState('');
  const [cardBack, setCardBack] = useState('');
  const [clozeStep, setClozeStep] = useState<'write' | 'select'>('write');
  const [selectedWords, setSelectedWords] = useState<number[]>([]);
  
  // Deck Form State
  const [newDeckName, setNewDeckName] = useState('');
  const [newDeckColor, setNewDeckColor] = useState('bg-indigo-500');

  // Library Filter
  const [libraryDeckFilter, setLibraryDeckFilter] = useState<string>('all');

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

  const chartData = useMemo(() => [
    { name: 'Nuevas', value: stats.new, color: '#6366f1' },
    { name: 'Aprendizaje', value: stats.learning, color: '#f59e0b' },
    { name: 'Due', value: stats.due, color: '#f43f5e' },
    { name: 'Mastered', value: stats.mastered, color: '#10b981' }
  ], [stats]);

  const filteredLibraryCards = useMemo(() => {
    if (libraryDeckFilter === 'all') return cards;
    return cards.filter(c => c.deckId === libraryDeckFilter);
  }, [cards, libraryDeckFilter]);

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

  const handleEditCard = (card: Flashcard) => {
    setEditingCardId(card.id);
    setCardType(card.type);
    setSelectedDeckId(card.deckId);
    
    if (card.type === 'normal') {
      setCardFront(card.question);
      setCardBack(card.answer);
    } else {
      setCardFront(card.question.replace(/\{\{(.*?)\}\}/g, '$1'));
      setClozeStep('write');
      setSelectedWords([]);
    }
    setModalOpen('card');
  };

  const saveCard = async () => {
    if (!cardFront || (!cardBack && cardType === 'normal') || !selectedDeckId) return;
    
    let finalQuestion = cardFront;
    let finalAnswer = cardBack;

    if (cardType === 'cloze') {
      const tokens = cardFront.split(/\s+/);
      const processedTokens = tokens.map((t, i) => selectedWords.includes(i) ? `{{${t}}}` : t);
      finalQuestion = processedTokens.join(' ');
      finalAnswer = tokens.filter((_, i) => selectedWords.includes(i)).join(', ');
    }

    const card: Flashcard = editingCardId 
      ? { ...cards.find(c => c.id === editingCardId)!, deckId: selectedDeckId, type: cardType, question: finalQuestion, answer: finalAnswer }
      : {
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
    if (editingCardId) {
      setCards(prev => prev.map(c => c.id === editingCardId ? card : c));
    } else {
      setCards(prev => [...prev, card]);
    }

    resetCardForm();
    setModalOpen('none');
  };

  const resetCardForm = () => {
    setEditingCardId(null);
    setCardFront('');
    setCardBack('');
    setSelectedWords([]);
    setClozeStep('write');
    setCardType('normal');
  };

  const saveDeck = async () => {
    if (!newDeckName) return;
    const isEdit = modalOpen === 'deck_settings';
    
    const d: Deck = isEdit 
      ? { ...decks.find(d => d.id === selectedDeckId)!, name: newDeckName, color: newDeckColor }
      : {
          id: Math.random().toString(36).substr(2, 9),
          name: newDeckName,
          color: newDeckColor,
          createdAt: Date.now(),
          settings: { sessionLimit: DEFAULT_SESSION_LIMIT }
        };

    await dbInstance.put('decks', d);
    if (isEdit) {
      setDecks(prev => prev.map(deck => deck.id === selectedDeckId ? d : deck));
    } else {
      setDecks(prev => [...prev, d]);
      setSelectedDeckId(d.id);
    }
    
    setNewDeckName('');
    setModalOpen('none');
  };

  const deleteDeck = async (id: string) => {
    const deckCardsCount = cards.filter(c => c.deckId === id).length;
    if (deckCardsCount > 0) return;
    
    if (!confirm("¿Seguro que quieres borrar este mazo?")) return;
    await dbInstance.delete('decks', id);
    setDecks(prev => prev.filter(d => d.id !== id));
    setModalOpen('none');
  };

  const deleteCard = async (id: string) => {
    if (!confirm("¿Borrar esta tarjeta permanentemente?")) return;
    await dbInstance.delete('flashcards', id);
    setCards(prev => prev.filter(c => c.id !== id));
  };

  if (isLoading) return <div className="h-screen flex items-center justify-center bg-white"><div className="animate-pulse text-indigo-500 font-black text-xl tracking-tighter">MindSprout</div></div>;

  const deckCardsCount = cards.filter(c => c.deckId === selectedDeckId).length;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col safe-area-bottom">
      
      {!isStudying && (
        <header className="px-6 pt-12 pb-6 glass-panel sticky top-0 z-10 border-b border-slate-100 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight leading-none">MindSprout</h1>
            <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mt-1">
              {activeTab === 'home' ? 'Tu Progreso' : activeTab === 'library' ? 'Biblioteca' : 'Estadísticas'}
            </p>
          </div>
          <button onClick={() => { resetCardForm(); setModalOpen('card'); }} className="bg-indigo-600 w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-lg active:scale-90 transition-transform">
            <Plus size={24} strokeWidth={3} />
          </button>
        </header>
      )}

      <main className="flex-1 overflow-y-auto px-4 py-6 mb-24">
        {isStudying ? (
          <div className="animate-in fade-in duration-300">
            {studySession.length === 0 ? (
              <div className="flex flex-col items-center py-20 text-center px-6">
                <div className="w-24 h-24 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-8 text-4xl animate-bounce shadow-xl shadow-emerald-50">🌱</div>
                <h2 className="text-3xl font-black text-slate-800 tracking-tight">¡Sesión Completa!</h2>
                <p className="text-slate-500 mt-4 font-medium">Has repasado {sessionDoneCount} tarjetas hoy.</p>
                <Button onClick={() => setIsStudying(false)} className="mt-10 w-full max-w-xs py-5">Volver al Inicio</Button>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex justify-between items-center px-4">
                  <button onClick={() => setIsStudying(false)} className="text-slate-400 font-bold text-sm">Salir</button>
                  <div className="flex-1 mx-6 h-2.5 bg-slate-200 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-500 transition-all duration-700 shadow-[0_0_10px_rgba(99,102,241,0.5)]" style={{ width: `${(sessionDoneCount / sessionStartCount) * 100}%` }} />
                  </div>
                  <span className="text-xs font-black text-indigo-600 tabular-nums">{studySession.length}</span>
                </div>
                <FlashcardItem card={studySession[0]} sessionMode={sessionMode} onAnswer={handleAnswer} />
              </div>
            )}
          </div>
        ) : (
          <>
            {activeTab === 'home' && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-6 bg-indigo-600 rounded-[2.5rem] text-white shadow-xl shadow-indigo-100">
                    <span className="text-5xl font-black block tabular-nums">{stats.due}</span>
                    <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Para hoy</span>
                  </div>
                  <div className="p-6 bg-white rounded-[2.5rem] border border-slate-100 shadow-sm">
                    <span className="text-5xl font-black block text-slate-800 tabular-nums">{stats.new}</span>
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Nuevas</span>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-center px-2">
                    <h3 className="text-lg font-black text-slate-800 tracking-tight">Mis Mazos</h3>
                    <button onClick={() => { setNewDeckName(''); setModalOpen('deck'); }} className="text-indigo-600 text-[10px] font-black uppercase tracking-widest bg-indigo-50 px-3 py-1.5 rounded-full">+ Nuevo Mazo</button>
                  </div>
                  {decks.length === 0 ? (
                    <div className="text-center py-16 px-6 bg-white rounded-[2.5rem] border-2 border-dashed border-slate-200 text-slate-400 font-bold">
                      Crea tu primer mazo para empezar tu aprendizaje.
                    </div>
                  ) : decks.map(deck => {
                    const deckTotal = cards.filter(c => c.deckId === deck.id).length;
                    const dueCount = cards.filter(c => c.deckId === deck.id && c.nextReview <= Date.now()).length;
                    return (
                      <div key={deck.id} className="p-5 bg-white rounded-[2.5rem] border border-slate-100 shadow-sm flex items-center gap-4 active:scale-[0.98] transition-all cursor-pointer hover:border-indigo-100" onClick={() => { setSelectedDeckId(deck.id); setModalOpen('session_start'); }}>
                        <div className={`w-12 h-12 rounded-2xl ${deck.color} flex items-center justify-center text-white font-black shadow-lg`}>{deck.name[0]}</div>
                        <div className="flex-1 overflow-hidden">
                          <h4 className="font-bold text-slate-800 text-lg truncate leading-tight">{deck.name}</h4>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{deckTotal} Tarjetas</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {dueCount > 0 && <div className="bg-rose-500 text-white text-[10px] font-black px-2.5 py-1 rounded-full shadow-lg shadow-rose-200">{dueCount}</div>}
                          <button onClick={(e) => { 
                            e.stopPropagation(); 
                            setSelectedDeckId(deck.id); 
                            setNewDeckName(deck.name);
                            setNewDeckColor(deck.color);
                            setModalOpen('deck_settings'); 
                          }} className="p-2 text-slate-300 hover:text-indigo-500 transition-colors">
                            <Edit2 size={18} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {activeTab === 'library' && (
              <div className="space-y-6 animate-in fade-in duration-500">
                <div className="flex justify-between items-center px-2">
                  <h2 className="text-2xl font-black text-slate-800 tracking-tight">Biblioteca</h2>
                  <select 
                    className="bg-white border border-slate-100 shadow-sm rounded-xl text-[10px] font-black p-2 text-slate-600 uppercase focus:ring-2 focus:ring-indigo-100 outline-none"
                    value={libraryDeckFilter}
                    onChange={(e) => setLibraryDeckFilter(e.target.value)}
                  >
                    <option value="all">TODOS</option>
                    {decks.map(d => <option key={d.id} value={d.id}>{d.name.toUpperCase()}</option>)}
                  </select>
                </div>
                
                {filteredLibraryCards.length === 0 ? (
                   <div className="py-24 text-center opacity-30 font-bold flex flex-col items-center gap-4">
                     <LibraryIcon size={48} strokeWidth={1} />
                     <p>Sin tarjetas en este mazo.</p>
                   </div>
                ) : (
                  <div className="grid gap-4">
                    {filteredLibraryCards.map(card => (
                      <div key={card.id} className="p-5 bg-white rounded-[2rem] border border-slate-100 flex flex-col gap-2 shadow-sm animate-in slide-in-from-bottom-2">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-[9px] font-black bg-indigo-50 text-indigo-500 px-2 py-0.5 rounded-md uppercase">{card.type}</span>
                          <div className="flex gap-4">
                            <button onClick={() => handleEditCard(card)} className="text-indigo-500 text-[10px] font-black uppercase flex items-center gap-1">
                              <Edit2 size={12} /> Editar
                            </button>
                            <button onClick={() => deleteCard(card.id)} className="text-rose-400 text-[10px] font-black uppercase flex items-center gap-1">
                              <Trash2 size={12} /> Borrar
                            </button>
                          </div>
                        </div>
                        <p className="font-bold text-slate-800 leading-snug">
                          {card.type === 'cloze' ? card.question.replace(/\{\{(.*?)\}\}/g, '$1') : card.question}
                        </p>
                        <p className="text-slate-400 text-xs font-medium">
                          {card.type === 'cloze' ? `Respuesta: ${card.answer}` : card.answer}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'stats' && (
              <div className="space-y-8 animate-in zoom-in duration-300">
                <h2 className="text-2xl font-black text-slate-800 tracking-tight">Rendimiento</h2>
                
                <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Estado Global</p>
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700, fill: '#94a3b8'}} />
                        <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700, fill: '#cbd5e1'}} />
                        <Tooltip 
                          contentStyle={{ borderRadius: '1.25rem', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '12px' }} 
                          cursor={{fill: '#f8fafc'}}
                        />
                        <Bar dataKey="value" radius={[8, 8, 0, 0]} barSize={45}>
                          {chartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm text-center">
                    <p className="text-4xl font-black text-emerald-500 tabular-nums">{stats.mastered}</p>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Sólidas</p>
                  </div>
                  <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm text-center">
                    <p className="text-4xl font-black text-amber-500 tabular-nums">{stats.learning}</p>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Aprendiendo</p>
                  </div>
                </div>

                <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm flex items-center justify-between">
                   <div className="space-y-1">
                      <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Total Tarjetas</p>
                      <p className="text-5xl font-black text-slate-800 leading-none">{stats.total}</p>
                   </div>
                   <div className="w-24 h-24 relative">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={chartData} dataKey="value" innerRadius={25} outerRadius={40} paddingAngle={5} stroke="none">
                          {chartData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-8 h-8 rounded-full bg-slate-50 border border-slate-100"></div>
                    </div>
                   </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {!isStudying && (
        <nav className="fixed bottom-0 left-0 right-0 glass-panel border-t border-slate-100 flex justify-around py-4 pb-10 px-6 z-20">
          <button onClick={() => setActiveTab('home')} className={`flex flex-col items-center gap-1.5 transition-all ${activeTab === 'home' ? 'text-indigo-600 scale-110' : 'text-slate-300'}`}><Home size={22} strokeWidth={activeTab === 'home' ? 2.5 : 2} /><span className="text-[9px] font-black uppercase tracking-tighter">Inicio</span></button>
          <button onClick={() => setActiveTab('library')} className={`flex flex-col items-center gap-1.5 transition-all ${activeTab === 'library' ? 'text-indigo-600 scale-110' : 'text-slate-300'}`}><LibraryIcon size={22} strokeWidth={activeTab === 'library' ? 2.5 : 2} /><span className="text-[9px] font-black uppercase tracking-tighter">Biblio</span></button>
          <button onClick={() => setActiveTab('stats')} className={`flex flex-col items-center gap-1.5 transition-all ${activeTab === 'stats' ? 'text-indigo-600 scale-110' : 'text-slate-300'}`}><BarChart2 size={22} strokeWidth={activeTab === 'stats' ? 2.5 : 2} /><span className="text-[9px] font-black uppercase tracking-tighter">Stats</span></button>
        </nav>
      )}

      {/* MODAL: START SESSION */}
      <Modal isOpen={modalOpen === 'session_start'} onClose={() => setModalOpen('none')} title="Preparar Sesión">
        <div className="space-y-6 mt-4">
          <div className="p-6 bg-slate-50 rounded-[2rem] text-center border border-slate-100">
            <p className="text-slate-400 font-black text-[10px] uppercase tracking-widest mb-1">Carga de hoy</p>
            <p className="text-2xl font-black text-slate-800 tabular-nums">
              {selectedDeckCards.due.length + selectedDeckCards.new.length} Tarjetas
            </p>
          </div>

          {(selectedDeckCards.due.length + selectedDeckCards.new.length) > 0 ? (
            <div className="grid gap-3">
              <button onClick={() => handleStartSession('reveal')} className="p-6 bg-white rounded-[2rem] border-2 border-slate-100 hover:border-indigo-500 hover:bg-indigo-50/20 text-left transition-all group flex justify-between items-center">
                <div>
                  <h4 className="font-black text-slate-800 text-lg group-hover:text-indigo-600 transition-colors">Modo Solo Ver</h4>
                  <p className="text-xs text-slate-400 font-medium">Evalúa tu respuesta mentalmente.</p>
                </div>
                <ChevronRight className="text-slate-200 group-hover:text-indigo-500 transition-colors" />
              </button>
              <button onClick={() => handleStartSession('type')} className="p-6 bg-white rounded-[2rem] border-2 border-slate-100 hover:border-indigo-500 hover:bg-indigo-50/20 text-left transition-all group flex justify-between items-center">
                <div>
                  <h4 className="font-black text-slate-800 text-lg group-hover:text-indigo-600 transition-colors">Modo Escribir</h4>
                  <p className="text-xs text-slate-400 font-medium">Validación estricta con teclado.</p>
                </div>
                <ChevronRight className="text-slate-200 group-hover:text-indigo-500 transition-colors" />
              </button>
            </div>
          ) : (
            <div className="p-10 text-center space-y-6 animate-in zoom-in duration-300">
               <div className="text-5xl drop-shadow-lg">🎉</div>
               <div className="space-y-2">
                 <h4 className="font-black text-slate-800 text-xl tracking-tight">¡Todo al día!</h4>
                 <p className="text-sm text-slate-500 font-medium leading-relaxed">Has completado todos los repasos disponibles por ahora.</p>
               </div>
               <Button onClick={() => setModalOpen('card')} variant="secondary" className="w-full py-4 text-sm font-black uppercase tracking-widest">Crear más tarjetas</Button>
            </div>
          )}
        </div>
      </Modal>

      {/* MODAL: CARD FORM */}
      <Modal isOpen={modalOpen === 'card'} onClose={() => { setModalOpen('none'); resetCardForm(); }} title={editingCardId ? "Editar Tarjeta" : "Nueva Tarjeta"}>
        {decks.length === 0 ? (
          <div className="p-10 text-center space-y-6 animate-in zoom-in duration-300">
             <div className="w-20 h-20 bg-indigo-50 text-indigo-500 rounded-full flex items-center justify-center mx-auto text-3xl font-black shadow-inner shadow-indigo-100">!</div>
             <p className="text-slate-600 font-bold leading-relaxed px-4">Necesitas crear un mazo antes de añadir contenido.</p>
             <Button onClick={() => setModalOpen('deck')} className="w-full py-5 text-sm uppercase tracking-widest font-black">Crear Mazo Ahora</Button>
          </div>
        ) : (
          <div className="space-y-6 mt-4">
            <div className="flex bg-slate-100 p-1 rounded-2xl">
              <button onClick={() => { setCardType('normal'); setClozeStep('write'); }} className={`flex-1 py-2 text-[10px] font-black rounded-xl transition-all ${cardType === 'normal' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400'}`}>ESTÁNDAR</button>
              <button onClick={() => { setCardType('cloze'); setClozeStep('write'); }} className={`flex-1 py-2 text-[10px] font-black rounded-xl transition-all ${cardType === 'cloze' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400'}`}>RELLENAR HUECO</button>
            </div>
            
            {cardType === 'normal' ? (
              <div className="space-y-4 animate-in slide-in-from-right-4 relative">
                <div className="space-y-1">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Anverso (Pregunta)</label>
                   <textarea placeholder="Ej: ¿Qué significa 'Ephemeral'?" className="w-full p-5 rounded-[2rem] bg-slate-50 border-2 border-transparent focus:border-indigo-100 outline-none min-h-[110px] font-bold text-slate-800 text-lg" value={cardFront} onChange={e => setCardFront(e.target.value)}/>
                </div>
                
                <div className="flex justify-center -my-4 z-10 relative">
                  <button onClick={handleSwapInputs} className="bg-white p-3.5 rounded-full shadow-lg border border-slate-100 text-indigo-500 active:scale-90 active:rotate-180 transition-all">
                    <ArrowLeftRight size={20} />
                  </button>
                </div>

                <div className="space-y-1">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Reverso (Respuesta)</label>
                   <textarea placeholder="Ej: Que dura poco tiempo." className="w-full p-5 rounded-[2rem] bg-slate-50 border-2 border-transparent focus:border-indigo-100 outline-none min-h-[110px] font-bold text-slate-800 text-lg" value={cardBack} onChange={e => setCardBack(e.target.value)}/>
                </div>
              </div>
            ) : (
              <div className="space-y-4 animate-in slide-in-from-left-4">
                 {clozeStep === 'write' ? (
                   <div className="space-y-4">
                     <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 text-center block">Texto Completo</label>
                       <textarea placeholder="París es la capital de Francia." className="w-full p-5 rounded-[2rem] bg-slate-50 border-2 border-transparent focus:border-indigo-100 outline-none min-h-[140px] font-bold text-slate-800 text-lg" value={cardFront} onChange={e => setCardFront(e.target.value)}/>
                     </div>
                     <Button variant="secondary" onClick={() => setClozeStep('select')} className="w-full py-4 text-xs font-black uppercase tracking-widest" disabled={!cardFront.trim()}>Elegir palabras a ocultar</Button>
                   </div>
                 ) : (
                   <div className="space-y-5">
                      <div className="p-4 bg-indigo-50 rounded-2xl flex items-center gap-3">
                         <Info size={18} className="text-indigo-400 shrink-0" />
                         <p className="text-[10px] font-bold text-indigo-600 leading-tight">Toca las palabras que quieres que se conviertan en huecos (____).</p>
                      </div>
                      <div className="flex flex-wrap gap-2.5 p-6 bg-slate-50 rounded-[2.5rem] border border-slate-100 min-h-[120px]">
                        {cardFront.split(/\s+/).map((word, idx) => (
                          <button 
                            key={idx} 
                            onClick={() => setSelectedWords(prev => prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx])} 
                            className={`px-3.5 py-2 rounded-xl text-sm font-bold transition-all shadow-sm ${selectedWords.includes(idx) ? 'bg-indigo-600 text-white scale-110 shadow-indigo-200' : 'bg-white text-slate-600 active:scale-95'}`}
                          >
                            {word}
                          </button>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <Button variant="ghost" onClick={() => setClozeStep('write')} className="flex-1 text-[10px] font-black uppercase">Volver</Button>
                        <Button onClick={saveCard} className="flex-[2] text-[10px] font-black uppercase tracking-widest" disabled={selectedWords.length === 0}>Guardar Tarjeta</Button>
                      </div>
                   </div>
                 )}
              </div>
            )}

            {(cardType === 'normal' || (cardType === 'cloze' && clozeStep === 'write')) && (
              <div className="space-y-2 pt-4 border-t border-slate-50">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 text-center block mb-1">Mazo de destino</label>
                <select className="w-full p-4 rounded-2xl bg-slate-50 border-none font-black text-slate-600 appearance-none text-center focus:ring-2 focus:ring-indigo-100 shadow-sm" value={selectedDeckId} onChange={e => setSelectedDeckId(e.target.value)}>
                  {decks.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
            )}
            
            {cardType === 'normal' && (
              <Button onClick={saveCard} className="w-full py-5 text-base font-black uppercase tracking-widest rounded-[2rem] shadow-xl shadow-indigo-100" disabled={!cardFront || !cardBack}>
                {editingCardId ? "Actualizar Tarjeta" : "Crear Flashcard"}
              </Button>
            )}
          </div>
        )}
      </Modal>

      {/* MODAL: NEW DECK */}
      <Modal isOpen={modalOpen === 'deck'} onClose={() => setModalOpen('none')} title="Nuevo Mazo">
        <div className="space-y-6 mt-4">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Título del Mazo</label>
            <input placeholder="Ej: Anatomía II" className="w-full p-6 rounded-[2rem] bg-slate-50 border-none text-xl font-black text-slate-800 focus:ring-2 focus:ring-indigo-100 outline-none" value={newDeckName} onChange={e => setNewDeckName(e.target.value)}/>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Esquema de Color</label>
            <div className="grid grid-cols-5 gap-3 pt-2">
               {['bg-indigo-500', 'bg-rose-500', 'bg-amber-500', 'bg-emerald-500', 'bg-slate-800'].map(color => (
                  <button key={color} onClick={() => setNewDeckColor(color)} className={`aspect-square rounded-2xl ${color} transition-all ${newDeckColor === color ? 'ring-4 ring-indigo-100 scale-110 shadow-lg' : 'opacity-40 scale-90'}`}></button>
               ))}
            </div>
          </div>
          <Button onClick={saveDeck} className="w-full py-5 text-base font-black uppercase tracking-widest rounded-[2rem] shadow-xl shadow-indigo-100 mt-4" disabled={!newDeckName}>Confirmar Mazo</Button>
        </div>
      </Modal>

      {/* MODAL: DECK SETTINGS */}
      <Modal isOpen={modalOpen === 'deck_settings'} onClose={() => setModalOpen('none')} title="Configurar Mazo">
        <div className="mt-4 space-y-6">
           <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Editar Nombre</label>
            <input className="w-full p-5 rounded-[1.5rem] bg-slate-50 border-none text-lg font-black text-slate-800 focus:ring-2 focus:ring-indigo-100 outline-none" value={newDeckName} onChange={e => setNewDeckName(e.target.value)}/>
          </div>
          
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Color</label>
            <div className="grid grid-cols-5 gap-3 pt-2">
               {['bg-indigo-500', 'bg-rose-500', 'bg-amber-500', 'bg-emerald-500', 'bg-slate-800'].map(color => (
                  <button key={color} onClick={() => setNewDeckColor(color)} className={`aspect-square rounded-2xl ${color} transition-all ${newDeckColor === color ? 'ring-4 ring-indigo-100 scale-110 shadow-lg' : 'opacity-40 scale-90'}`}></button>
               ))}
            </div>
          </div>

          <div className="flex flex-col gap-4 pt-6 border-t border-slate-100">
            <Button onClick={saveDeck} className="w-full py-4 text-sm font-black uppercase tracking-widest">Guardar Cambios</Button>
            
            {deckCardsCount > 0 ? (
              <div className="p-5 bg-rose-50 rounded-3xl flex gap-3 items-start border border-rose-100 animate-in shake duration-500">
                <AlertCircle className="text-rose-500 shrink-0" size={22} />
                <div className="space-y-1">
                  <p className="text-xs text-rose-800 font-black uppercase tracking-tight">Mazo con contenido</p>
                  <p className="text-[11px] text-rose-700 font-medium leading-relaxed">
                    No puedes borrar el mazo "{newDeckName}" porque aún tiene {deckCardsCount} tarjetas. Elimínalas en la biblioteca primero para poder borrar el mazo.
                  </p>
                </div>
              </div>
            ) : (
              <Button 
                variant="danger" 
                onClick={() => deleteDeck(selectedDeckId)} 
                className="w-full py-4 rounded-[1.5rem] text-sm font-black uppercase tracking-widest"
              >
                Borrar Mazo Vacío
              </Button>
            )}
          </div>
        </div>
      </Modal>

    </div>
  );
};

export default App;
