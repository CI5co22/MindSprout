
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { dbInstance } from './db';
import { Flashcard, Deck, Difficulty, Stats, CardType, StudyMode } from './types';
import { calculateNextReview } from './srs';
import { Button } from './components/Button';
import { FlashcardItem } from './components/FlashcardItem';
import { Modal } from './components/Modal';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  Cell, PieChart, Pie
} from 'recharts';
import { 
  Home, Library as LibraryIcon, BarChart2, Trash2, Edit2, 
  ArrowLeftRight, Plus, ChevronRight, AlertCircle, Info, Layout,
  Share2, Download, FilePlus2, ArrowRight
} from 'lucide-react';

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

  const [modalOpen, setModalOpen] = useState<'none' | 'card' | 'deck' | 'session_start' | 'deck_settings' | 'export_deck'>('none');
  const [selectedDeckId, setSelectedDeckId] = useState<string>('');
  const [deckToExport, setDeckToExport] = useState<Deck | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    { name: 'Sólidas', value: stats.mastered, color: '#10b981' }
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
    
    if (!window.confirm("¿Seguro que quieres borrar este mazo?")) return;
    await dbInstance.delete('decks', id);
    setDecks(prev => prev.filter(d => d.id !== id));
    setModalOpen('none');
  };

  const deleteCard = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    e.preventDefault();
    if (!window.confirm("¿Borrar esta tarjeta permanentemente?")) return;
    try {
      await dbInstance.delete('flashcards', id);
      setCards(prev => prev.filter(c => c.id !== id));
    } catch (err) {
      console.error("Error al borrar tarjeta:", err);
      alert("No se pudo borrar la tarjeta.");
    }
  };

  const handleExportDeckAction = () => {
    if (!deckToExport) return;
    const deckCards = cards.filter(c => c.deckId === deckToExport.id);
    const exportData = { version: 1, deck: deckToExport, cards: deckCards };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${deckToExport.name.replace(/\s+/g, '-').toLowerCase()}.sprout`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setModalOpen('none');
  };

  const handleImportFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        if (!data.deck || !Array.isArray(data.cards)) throw new Error("Formato inválido");
        const newDeckId = Math.random().toString(36).substr(2, 9);
        const newDeck: Deck = { ...data.deck, id: newDeckId, createdAt: Date.now() };
        await dbInstance.put('decks', newDeck);
        setDecks(prev => [...prev, newDeck]);
        const newCardsPromises = data.cards.map(async (card: Flashcard) => {
          const newCard: Flashcard = { ...card, id: Math.random().toString(36).substr(2, 9), deckId: newDeckId, nextReview: Date.now() };
          await dbInstance.put('flashcards', newCard);
          return newCard;
        });
        const newlyImportedCards = await Promise.all(newCardsPromises);
        setCards(prev => [...prev, ...newlyImportedCards]);
        alert(`Mazo "${newDeck.name}" importado con éxito.`);
      } catch (err) {
        alert("Error al importar el mazo.");
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  if (isLoading) return <div className="h-screen flex items-center justify-center bg-white"><div className="animate-pulse text-indigo-500 font-black text-xl tracking-tighter">MindSprout</div></div>;

  const deckCardsCountForSelected = cards.filter(c => c.deckId === selectedDeckId).length;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row safe-area-bottom overflow-hidden">
      <input type="file" ref={fileInputRef} className="hidden" accept=".sprout,.json" onChange={handleImportFile} />

      {/* SIDEBAR */}
      {!isStudying && (
        <aside className="hidden md:flex flex-col w-64 lg:w-72 h-screen glass-panel border-r border-slate-100 p-8 sticky top-0 shrink-0">
          <div className="mb-12"><h1 className="text-2xl font-black text-slate-800 tracking-tight leading-none">MindSprout</h1><p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mt-2">Spaced Repetition</p></div>
          <nav className="flex-1 space-y-2">
            <button onClick={() => setActiveTab('home')} className={`flex items-center gap-3 px-6 py-4 rounded-2xl transition-all w-full ${activeTab === 'home' ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-100 font-bold' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100/50'}`}><Home size={22} /><span className="text-sm font-bold tracking-tight">Inicio</span></button>
            <button onClick={() => setActiveTab('library')} className={`flex items-center gap-3 px-6 py-4 rounded-2xl transition-all w-full ${activeTab === 'library' ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-100 font-bold' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100/50'}`}><LibraryIcon size={22} /><span className="text-sm font-bold tracking-tight">Biblioteca</span></button>
            <button onClick={() => setActiveTab('stats')} className={`flex items-center gap-3 px-6 py-4 rounded-2xl transition-all w-full ${activeTab === 'stats' ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-100 font-bold' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100/50'}`}><BarChart2 size={22} /><span className="text-sm font-bold tracking-tight">Estadísticas</span></button>
          </nav>
          <div className="mt-auto pt-8 border-t border-slate-100">
            <button onClick={() => { resetCardForm(); setModalOpen('card'); }} className="w-full bg-slate-900 text-white p-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 hover:bg-black transition-colors shadow-lg active:scale-95"><Plus size={18} strokeWidth={3} />NUEVA TARJETA</button>
          </div>
        </aside>
      )}

      {/* MOBILE HEADER */}
      {!isStudying && (
        <header className="md:hidden px-6 pt-12 pb-6 glass-panel sticky top-0 z-10 border-b border-slate-100 flex justify-between items-center">
          <div><h1 className="text-2xl font-black text-slate-800 tracking-tight leading-none">MindSprout</h1><p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mt-1">{activeTab === 'home' ? 'Tu Progreso' : activeTab === 'library' ? 'Biblioteca' : 'Estadísticas'}</p></div>
          <button onClick={() => { resetCardForm(); setModalOpen('card'); }} className="bg-indigo-600 w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-lg active:scale-90 transition-transform"><Plus size={24} strokeWidth={3} /></button>
        </header>
      )}

      {/* MAIN CONTENT */}
      <main className={`flex-1 overflow-y-auto pb-24 md:pb-12 transition-all duration-300 ${isStudying ? 'pt-8' : 'pt-0 md:pt-16'}`}>
        <div className={`mx-auto px-4 md:px-8 lg:px-12 ${isStudying ? 'max-w-4xl' : 'max-w-7xl'}`}>
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
                <div className="space-y-8">
                  <div className="flex justify-between items-center px-4 max-w-lg mx-auto">
                    <button onClick={() => setIsStudying(false)} className="text-slate-400 font-black text-sm hover:text-rose-500 transition-colors">Salir</button>
                    <div className="flex-1 mx-6 h-3 bg-slate-200 rounded-full overflow-hidden shadow-inner"><div className="h-full bg-indigo-500 transition-all duration-700" style={{ width: `${(sessionDoneCount / sessionStartCount) * 100}%` }} /></div>
                    <span className="text-xs font-black text-indigo-600 tabular-nums bg-indigo-50 px-3 py-1 rounded-full">{studySession.length}</span>
                  </div>
                  <FlashcardItem card={studySession[0]} sessionMode={sessionMode} onAnswer={handleAnswer} />
                </div>
              )}
            </div>
          ) : (
            <>
              {activeTab === 'home' && (
                <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <section>
                    <h2 className="hidden md:block text-3xl font-black text-slate-800 tracking-tight mb-8">Panel de Control</h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
                      <div className="p-6 md:p-8 bg-indigo-600 rounded-[2.5rem] text-white shadow-xl shadow-indigo-100 flex flex-col justify-between min-h-[140px] md:min-h-[180px]"><span className="text-5xl md:text-6xl font-black block tabular-nums leading-none">{stats.due}</span><span className="text-[10px] md:text-xs font-black uppercase tracking-widest opacity-60">Para hoy</span></div>
                      <div className="p-6 md:p-8 bg-white rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col justify-between min-h-[140px] md:min-h-[180px]"><span className="text-5xl md:text-6xl font-black block text-slate-800 tabular-nums leading-none">{stats.new}</span><span className="text-[10px] md:text-xs font-black uppercase tracking-widest text-slate-400">Nuevas</span></div>
                      <div className="hidden md:flex p-8 bg-white rounded-[2.5rem] border border-slate-100 shadow-sm flex-col justify-between min-h-[180px]"><span className="text-6xl font-black block text-emerald-500 tabular-nums leading-none">{stats.mastered}</span><span className="text-xs font-black uppercase tracking-widest text-slate-400">Sólidas</span></div>
                      <div className="hidden md:flex p-8 bg-slate-900 rounded-[2.5rem] text-white shadow-xl flex-col justify-between min-h-[180px]"><span className="text-6xl font-black block tabular-nums leading-none">{stats.total}</span><span className="text-xs font-black uppercase tracking-widest opacity-40">Total</span></div>
                    </div>
                  </section>

                  <section className="space-y-6">
                    <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 px-2">
                      <h3 className="text-xl md:text-2xl font-black text-slate-800 tracking-tight">Mis Mazos</h3>
                      <div className="flex gap-2">
                        <button onClick={() => fileInputRef.current?.click()} className="text-indigo-600 text-[10px] font-black uppercase tracking-widest bg-indigo-50 hover:bg-indigo-100 px-4 py-2 rounded-full transition-colors flex items-center gap-2"><FilePlus2 size={14} /> Importar Mazo</button>
                        <button onClick={() => { setNewDeckName(''); setModalOpen('deck'); }} className="text-indigo-600 text-[10px] font-black uppercase tracking-widest bg-indigo-50 hover:bg-indigo-100 px-4 py-2 rounded-full transition-colors">+ Nuevo Mazo</button>
                      </div>
                    </div>
                    {decks.length === 0 ? (
                      <div className="text-center py-24 px-6 bg-white rounded-[2.5rem] border-2 border-dashed border-slate-200 text-slate-400 font-bold">Aún no tienes mazos. Crea uno para empezar.</div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                        {decks.map(deck => {
                          const deckTotal = cards.filter(c => c.deckId === deck.id).length;
                          const dueCount = cards.filter(c => c.deckId === deck.id && c.nextReview <= Date.now()).length;
                          return (
                            <div key={deck.id} className="p-6 bg-white rounded-[2.5rem] border border-slate-100 shadow-sm flex items-center gap-5 active:scale-[0.98] md:hover:scale-[1.02] transition-all cursor-pointer hover:border-indigo-100 group" onClick={() => { setSelectedDeckId(deck.id); setModalOpen('session_start'); }}>
                              <div className={`w-14 h-14 rounded-2xl ${deck.color} flex items-center justify-center text-white font-black text-xl shadow-lg group-hover:rotate-6 transition-transform shrink-0`}>{deck.name[0]}</div>
                              <div className="flex-1 overflow-hidden"><h4 className="font-bold text-slate-800 text-lg truncate leading-tight mb-1">{deck.name}</h4><div className="flex items-center gap-2"><span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter bg-slate-50 px-2 py-0.5 rounded-md">{deckTotal} Tarjetas</span></div></div>
                              <div className="flex items-center gap-1">
                                {dueCount > 0 && <div className="bg-rose-500 text-white text-[10px] font-black px-3 py-1 rounded-full shadow-lg shadow-rose-200 mr-2">{dueCount}</div>}
                                <button type="button" onClick={(e) => { e.stopPropagation(); setDeckToExport(deck); setModalOpen('export_deck'); }} className="p-3 text-slate-200 hover:text-emerald-500 transition-colors md:opacity-0 group-hover:opacity-100"><Share2 size={18} /></button>
                                <button type="button" onClick={(e) => { e.stopPropagation(); setSelectedDeckId(deck.id); setNewDeckName(deck.name); setNewDeckColor(deck.color); setModalOpen('deck_settings'); }} className="p-3 text-slate-200 hover:text-indigo-500 transition-colors md:opacity-0 group-hover:opacity-100"><Edit2 size={18} /></button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </section>
                </div>
              )}

              {activeTab === 'library' && (
                <div className="space-y-8 animate-in fade-in duration-500">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-2">
                    <h2 className="text-3xl font-black text-slate-800 tracking-tight">Biblioteca</h2>
                    <select className="bg-white border border-slate-100 shadow-sm rounded-xl text-[10px] md:text-xs font-black p-3 text-slate-600 uppercase focus:ring-2 focus:ring-indigo-100 outline-none min-w-[200px] cursor-pointer" value={libraryDeckFilter} onChange={(e) => setLibraryDeckFilter(e.target.value)}>
                      <option value="all">TODOS LOS MAZOS</option>{decks.map(d => <option key={d.id} value={d.id}>{d.name.toUpperCase()}</option>)}
                    </select>
                  </div>
                  {filteredLibraryCards.length === 0 ? (<div className="py-32 text-center opacity-30 font-bold flex flex-col items-center gap-4"><LibraryIcon size={64} strokeWidth={1} /><p className="text-xl">Sin tarjetas para mostrar.</p></div>) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
                      {filteredLibraryCards.map(card => (
                        <div key={card.id} className="p-6 bg-white rounded-[2.5rem] border border-slate-100 flex flex-col gap-3 shadow-sm animate-in slide-in-from-bottom-2 md:hover:shadow-md transition-shadow">
                          <div className="flex justify-between items-center mb-1"><span className="text-[10px] font-black bg-indigo-50 text-indigo-500 px-3 py-1 rounded-full uppercase tracking-tight">{card.type}</span><div className="flex gap-4">
                            <button type="button" onClick={() => handleEditCard(card)} className="text-indigo-500 text-[11px] font-black uppercase flex items-center gap-1.5 hover:scale-105 transition-transform p-1"><Edit2 size={14} /> Editar</button>
                            <button type="button" onClick={(e) => deleteCard(e, card.id)} className="text-rose-400 text-[11px] font-black uppercase flex items-center gap-1.5 hover:scale-105 transition-transform p-1"><Trash2 size={14} /> Borrar</button>
                          </div></div>
                          <p className="font-bold text-slate-800 text-lg leading-snug">{card.type === 'cloze' ? card.question.replace(/\{\{(.*?)\}\}/g, '$1') : card.question}</p>
                          <p className="text-slate-400 text-sm font-medium border-t border-slate-50 pt-3">{card.type === 'cloze' ? `Respuesta: ${card.answer}` : card.answer}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'stats' && (
                <div className="space-y-10 animate-in zoom-in duration-300">
                  <h2 className="text-3xl font-black text-slate-800 tracking-tight">Rendimiento</h2>
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm min-h-[400px]">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-8">Estado de Repaso</p>
                      <div className="h-full max-h-[300px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" /><XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 11, fontWeight: 700, fill: '#94a3b8'}} /><YAxis axisLine={false} tickLine={false} tick={{fontSize: 11, fontWeight: 700, fill: '#cbd5e1'}} /><Tooltip contentStyle={{ borderRadius: '1.5rem', border: 'none', boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.15)', padding: '16px' }} cursor={{fill: '#f8fafc'}} /><Bar dataKey="value" radius={[10, 10, 0, 0]} barSize={50}>{chartData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}</Bar></BarChart></ResponsiveContainer></div>
                    </div>
                    <div className="flex flex-col gap-6"><div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm flex-1 flex flex-col items-center justify-center text-center"><div className="w-32 h-32 relative mb-4"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={chartData} dataKey="value" innerRadius={40} outerRadius={60} paddingAngle={8} stroke="none">{chartData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}</Pie></PieChart></ResponsiveContainer><div className="absolute inset-0 flex items-center justify-center"><span className="text-2xl font-black text-slate-800">{stats.total}</span></div></div><p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Total Tarjetas</p></div><div className="grid grid-cols-2 gap-4"><div className="bg-emerald-500 p-6 rounded-[2.5rem] text-white text-center shadow-lg shadow-emerald-100"><p className="text-3xl font-black leading-none">{stats.mastered}</p><p className="text-[9px] font-black uppercase tracking-widest mt-1 opacity-60">Sólidas</p></div><div className="bg-amber-500 p-6 rounded-[2.5rem] text-white text-center shadow-lg shadow-amber-100"><p className="text-3xl font-black leading-none">{stats.learning}</p><p className="text-[9px] font-black uppercase tracking-widest mt-1 opacity-60">En Curso</p></div></div></div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* MOBILE NAV */}
      {!isStudying && (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 glass-panel border-t border-slate-100 flex justify-around py-4 pb-10 px-6 z-20"><button onClick={() => setActiveTab('home')} className={`flex flex-col items-center gap-1.5 transition-all ${activeTab === 'home' ? 'text-indigo-600 scale-110' : 'text-slate-300'}`}><Home size={22} /><span className="text-[9px] font-black uppercase tracking-tighter">Inicio</span></button><button onClick={() => setActiveTab('library')} className={`flex flex-col items-center gap-1.5 transition-all ${activeTab === 'library' ? 'text-indigo-600 scale-110' : 'text-slate-300'}`}><LibraryIcon size={22} /><span className="text-[9px] font-black uppercase tracking-tighter">Biblio</span></button><button onClick={() => setActiveTab('stats')} className={`flex flex-col items-center gap-1.5 transition-all ${activeTab === 'stats' ? 'text-indigo-600 scale-110' : 'text-slate-300'}`}><BarChart2 size={22} /><span className="text-[9px] font-black uppercase tracking-tighter">Stats</span></button></nav>
      )}

      {/* MODAL: EXPORT */}
      <Modal isOpen={modalOpen === 'export_deck'} onClose={() => setModalOpen('none')} title="Exportar Mazo"><div className="space-y-8 mt-6 text-center"><div className="mx-auto w-28 h-28 bg-emerald-50 rounded-[3rem] flex items-center justify-center text-emerald-500 shadow-xl shadow-emerald-50/50 border border-emerald-100"><Download size={48} strokeWidth={2} /></div><div className="space-y-3"><h4 className="text-2xl font-black text-slate-800 tracking-tight">Listo para descargar</h4><p className="text-slate-500 font-medium text-sm leading-relaxed max-w-[280px] mx-auto">Se generará un archivo <strong className="text-slate-800">.sprout</strong> con el mazo "{deckToExport?.name}" y sus tarjetas.</p></div><div className="space-y-3"><Button onClick={handleExportDeckAction} className="w-full py-6 text-base font-black uppercase tracking-widest rounded-full shadow-2xl shadow-emerald-100 flex items-center justify-center gap-3 bg-emerald-500 hover:bg-emerald-600"><Download size={20} strokeWidth={3} />Descargar Archivo</Button></div></div></Modal>

      {/* MODAL: COMPACT CARD FORM */}
      <Modal isOpen={modalOpen === 'card'} onClose={() => { setModalOpen('none'); resetCardForm(); }} title={editingCardId ? "Editar Tarjeta" : "Nueva Tarjeta"}>
        {decks.length === 0 ? (
          <div className="py-12 text-center space-y-8 animate-in zoom-in duration-300"><div className="mx-auto w-24 h-24 bg-indigo-50 rounded-[2.5rem] flex items-center justify-center text-indigo-500 shadow-xl shadow-indigo-50 border border-indigo-100/50"><Layout size={40} strokeWidth={2.5} /></div><div className="space-y-4"><h4 className="text-2xl font-black text-slate-800 tracking-tight">¡Crea tu primer mazo!</h4><p className="text-slate-400 font-medium text-sm max-w-[280px] mx-auto leading-relaxed">Necesitas un lugar donde guardar tus tarjetas.</p></div><Button onClick={() => setModalOpen('deck')} className="w-full py-6 text-base font-black uppercase tracking-widest rounded-full shadow-2xl shadow-indigo-100 flex items-center justify-center gap-3"><Plus size={20} strokeWidth={3} />Empezar ahora</Button></div>
        ) : (
          <div className="space-y-3 mt-1">
            <div className="flex bg-slate-100 p-1 rounded-xl scale-90 mx-auto w-fit mb-2">
              <button onClick={() => { setCardType('normal'); setClozeStep('write'); }} className={`px-5 py-1.5 text-[10px] font-black rounded-lg transition-all ${cardType === 'normal' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500'}`}>ESTÁNDAR</button>
              <button onClick={() => { setCardType('cloze'); setClozeStep('write'); }} className={`px-5 py-1.5 text-[10px] font-black rounded-lg transition-all ${cardType === 'cloze' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500'}`}>HUECOS</button>
            </div>
            {cardType === 'normal' ? (
              <div className="space-y-2 animate-in slide-in-from-right-2">
                <div className="relative group">
                  <textarea placeholder="Frente (Pregunta)" className="w-full p-4 rounded-xl bg-slate-50 border-2 border-transparent focus:border-indigo-100 outline-none min-h-[70px] font-bold text-slate-800 text-sm shadow-inner resize-none" value={cardFront} onChange={e => setCardFront(e.target.value)}/>
                  <button type="button" onClick={handleSwapInputs} className="absolute -bottom-2 right-4 bg-white p-1.5 rounded-full shadow-md border border-slate-100 text-indigo-500 active:scale-90 transition-all z-10"><ArrowLeftRight size={14} /></button>
                </div>
                <textarea placeholder="Reverso (Respuesta)" className="w-full p-4 rounded-xl bg-slate-50 border-2 border-transparent focus:border-indigo-100 outline-none min-h-[70px] font-bold text-slate-800 text-sm shadow-inner resize-none" value={cardBack} onChange={e => setCardBack(e.target.value)}/>
              </div>
            ) : (
              <div className="space-y-3 animate-in slide-in-from-left-2">
                {clozeStep === 'write' ? (
                  <><textarea placeholder="Escribe el texto completo aquí..." className="w-full p-4 rounded-xl bg-slate-50 border-2 border-transparent focus:border-indigo-100 outline-none min-h-[100px] font-bold text-slate-800 text-sm shadow-inner resize-none" value={cardFront} onChange={e => setCardFront(e.target.value)}/><Button variant="secondary" onClick={() => setClozeStep('select')} className="w-full py-2.5 text-[10px] font-black uppercase tracking-widest rounded-lg" disabled={!cardFront.trim()}>Seleccionar palabras</Button></>
                ) : (
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-1 p-3 bg-slate-50 rounded-xl border border-slate-100 min-h-[90px] shadow-inner">{cardFront.split(/\s+/).map((word, idx) => (<button key={idx} onClick={() => setSelectedWords(prev => prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx])} className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${selectedWords.includes(idx) ? 'bg-indigo-600 text-white shadow-indigo-100' : 'bg-white text-slate-600 shadow-sm'}`}>{word}</button>))}</div>
                    <div className="flex gap-2"><Button variant="ghost" onClick={() => setClozeStep('write')} className="flex-1 text-[10px] font-black uppercase">Volver</Button><Button onClick={saveCard} className="flex-[2] text-[10px] font-black uppercase rounded-lg" disabled={selectedWords.length === 0}>Finalizar</Button></div>
                  </div>
                )}
              </div>
            )}
            <div className="pt-2 flex items-center gap-3">
              <div className="flex-1"><select className="w-full p-2.5 rounded-xl bg-slate-100 border-none font-black text-slate-700 text-[10px] appearance-none cursor-pointer" value={selectedDeckId} onChange={e => setSelectedDeckId(e.target.value)}>{decks.map(d => <option key={d.id} value={d.id}>{d.name.toUpperCase()}</option>)}</select></div>
              <Button onClick={saveCard} className="flex-1 py-3 text-[11px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-indigo-100" disabled={!cardFront || (!cardBack && cardType === 'normal')}>{editingCardId ? "Guardar" : "Crear"}</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* MODAL: NEW DECK */}
      <Modal isOpen={modalOpen === 'deck'} onClose={() => setModalOpen('none')} title="Nuevo Mazo"><div className="space-y-8 mt-6"><div className="space-y-3"><label className="text-[11px] font-black text-slate-400 uppercase tracking-widest px-2">Nombre</label><input placeholder="Vocabulario..." className="w-full p-6 rounded-3xl bg-slate-50 border-none text-2xl font-black text-slate-800 focus:ring-2 focus:ring-indigo-100 outline-none shadow-inner" value={newDeckName} onChange={e => setNewDeckName(e.target.value)}/></div><div className="space-y-3"><label className="text-[11px] font-black text-slate-400 uppercase tracking-widest px-2">Color</label><div className="grid grid-cols-5 gap-4 pt-2">{['bg-indigo-500', 'bg-rose-500', 'bg-amber-500', 'bg-emerald-500', 'bg-slate-800'].map(color => (<button key={color} onClick={() => setNewDeckColor(color)} className={`aspect-square rounded-2xl ${color} transition-all ${newDeckColor === color ? 'ring-4 ring-indigo-200 scale-110 shadow-lg' : 'opacity-40 scale-90'}`}></button>))}</div></div><Button onClick={saveDeck} className="w-full py-6 text-base font-black uppercase tracking-widest rounded-full shadow-xl shadow-indigo-100 mt-4" disabled={!newDeckName}>Confirmar Mazo</Button></div></Modal>

      {/* MODAL: SETTINGS & DELETE FEEDBACK */}
      <Modal isOpen={modalOpen === 'deck_settings'} onClose={() => setModalOpen('none')} title="Configurar Mazo">
        <div className="mt-4 space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Editar Nombre</label>
            <input className="w-full p-4 rounded-2xl bg-slate-50 border-none text-lg font-black text-slate-800 focus:ring-2 focus:ring-indigo-100 outline-none shadow-inner" value={newDeckName} onChange={e => setNewDeckName(e.target.value)}/>
          </div>
          
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Color</label>
            <div className="grid grid-cols-5 gap-3 pt-1">
               {['bg-indigo-500', 'bg-rose-500', 'bg-amber-500', 'bg-emerald-500', 'bg-slate-800'].map(color => (
                  <button key={color} onClick={() => setNewDeckColor(color)} className={`aspect-square rounded-xl ${color} transition-all ${newDeckColor === color ? 'ring-4 ring-indigo-200 scale-110 shadow-md' : 'opacity-40 scale-90'}`}></button>
               ))}
            </div>
          </div>

          <div className="flex flex-col gap-3 pt-6 border-t border-slate-50">
            <Button onClick={saveDeck} className="w-full py-4 text-xs font-black uppercase tracking-widest rounded-2xl">Guardar Cambios</Button>
            
            {deckCardsCountForSelected > 0 ? (
              <div 
                onClick={() => { setModalOpen('none'); setLibraryDeckFilter(selectedDeckId); setActiveTab('library'); }}
                className="group p-5 bg-indigo-50 rounded-2xl border border-indigo-100 flex items-center justify-between cursor-pointer active:scale-95 transition-all hover:bg-indigo-100/50"
              >
                <div className="flex items-center gap-3">
                  <LibraryIcon className="text-indigo-500 shrink-0" size={20} />
                  <div className="space-y-0.5">
                    <p className="text-[10px] text-indigo-800 font-black uppercase tracking-tight">Mazo con {deckCardsCountForSelected} tarjetas</p>
                    <p className="text-[11px] text-indigo-600 font-bold leading-none">Vaciar biblioteca para borrar mazo</p>
                  </div>
                </div>
                <ArrowRight size={18} className="text-indigo-400 group-hover:translate-x-1 transition-transform" />
              </div>
            ) : (
              <Button 
                variant="danger" 
                onClick={() => deleteDeck(selectedDeckId)} 
                className="w-full py-4 rounded-2xl text-xs font-black uppercase tracking-widest"
              >
                Eliminar Mazo Vacío
              </Button>
            )}
          </div>
        </div>
      </Modal>

      {/* MODAL: SESSION START SELECTION */}
      <Modal isOpen={modalOpen === 'session_start'} onClose={() => setModalOpen('none')} title="Preparar Sesión">
        <div className="space-y-6 mt-4">
          <div className="p-8 bg-slate-50 rounded-[2.5rem] text-center border border-slate-100 shadow-inner">
            <p className="text-slate-400 font-black text-[11px] uppercase tracking-widest mb-2">Planificado para hoy</p>
            <p className="text-4xl font-black text-slate-800 tabular-nums">{selectedDeckCards.due.length + selectedDeckCards.new.length} <span className="text-lg text-slate-400 font-bold">Tarjetas</span></p>
          </div>
          {(selectedDeckCards.due.length + selectedDeckCards.new.length) > 0 ? (
            <div className="grid grid-cols-1 gap-4">
              <button onClick={() => handleStartSession('reveal')} className="p-7 bg-white rounded-[2.5rem] border-2 border-slate-100 hover:border-indigo-500 hover:bg-indigo-50/20 text-left transition-all group flex justify-between items-center shadow-sm">
                <div><h4 className="font-black text-slate-800 text-xl group-hover:text-indigo-600 transition-colors">Modo Revelar</h4><p className="text-sm text-slate-400 font-medium">Evalúa tu respuesta mentalmente.</p></div>
                <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-300 group-hover:bg-indigo-600 group-hover:text-white transition-all shrink-0"><ChevronRight size={24} /></div>
              </button>
              <button onClick={() => handleStartSession('type')} className="p-7 bg-white rounded-[2.5rem] border-2 border-slate-100 hover:border-indigo-500 hover:bg-indigo-50/20 text-left transition-all group flex justify-between items-center shadow-sm">
                <div><h4 className="font-black text-slate-800 text-xl group-hover:text-indigo-600 transition-colors">Modo Escritura</h4><p className="text-sm text-slate-400 font-medium">Validación estricta con teclado.</p></div>
                <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-300 group-hover:bg-indigo-600 group-hover:text-white transition-all shrink-0"><ChevronRight size={24} /></div>
              </button>
            </div>
          ) : (
            <div className="p-10 text-center space-y-6 animate-in zoom-in duration-300">
              <div className="text-6xl drop-shadow-xl">🎉</div>
              <div className="space-y-2"><h4 className="font-black text-slate-800 text-2xl tracking-tight">¡Todo al día!</h4><p className="text-slate-500 font-medium leading-relaxed">No tienes tarjetas pendientes de repasar en este mazo.</p></div>
              <Button onClick={() => setModalOpen('card')} variant="secondary" className="w-full py-4 text-sm font-black uppercase tracking-widest rounded-full">Añadir más contenido</Button>
            </div>
          )}
        </div>
      </Modal>

    </div>
  );
};

export default App;
