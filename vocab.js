import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, onSnapshot } from 'firebase/firestore';
import { Calendar, BookOpen, ChevronLeft, ChevronRight, CheckCircle2, XCircle, HelpCircle, Trophy, User, LogOut, Zap, RotateCcw, Gamepad2, Star, Loader2, BarChart3, AlertCircle } from 'lucide-react';

// --- Firebase Configuration ---
const firebaseConfig = JSON.parse(__firebase_config);
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'vocab-master-2026-v2';

// ข้อมูลคำศัพท์ (30 กลุ่ม สำหรับ 10 วัน วันละ 3 กลุ่ม)
const fullVocabData = [
  { id: 1, words: ["woe", "agony", "misery", "groom", "grief", "sorrow", "distress", "affliction"], meaning: "ความเศร้า ความทุกข์" },
  { id: 2, words: ["economical", "frugal", "thrifty", "saving", "tight-fisted"], meaning: "ประหยัด" },
  { id: 3, words: ["miserly", "stingy", "tight", "penny-pinching"], meaning: "ขี้เหนียว" },
  { id: 4, words: ["jeopardize", "threaten", "menace"], meaning: "ทำอันตราย" },
  { id: 5, words: ["spread", "scatter", "pervade", "disperse", "proliferate"], meaning: "แพร่กระจาย" },
  { id: 6, words: ["deal with", "cope with", "handle", "tackle"], meaning: "รับมือ จัดการ" },
  { id: 7, words: ["adequate", "enough", "sufficient"], meaning: "เพียงพอ" },
  { id: 8, words: ["force", "coerce", "compel", "oblige", "mandate"], meaning: "บังคับ" },
  { id: 9, words: ["compulsory", "obligatory", "mandatory"], meaning: "ที่บังคับ" },
  { id: 10, words: ["abide by", "comply with", "conform to", "obey"], meaning: "เชื่อฟัง ทำตาม" },
  { id: 11, words: ["foremost", "optimum", "optimal"], meaning: "ดีที่สุด" },
  { id: 12, words: ["set off", "set out", "embark on"], meaning: "เริ่มต้นออกเดินทาง" },
  { id: 13, words: ["innate", "inborn", "inbred", "congenital", "inherent"], meaning: "โดยกำเนิด" },
  { id: 14, words: ["remove", "get rid of", "eliminate", "disgard"], meaning: "กำจัด" },
  { id: 15, words: ["decay", "decline", "degenerate", "deteriorate"], meaning: "เสื่อมโทรม" },
  { id: 16, words: ["raise", "rear", "bring up", "nurture"], meaning: "เลี้ยงดู" },
  { id: 17, words: ["soar", "surge", "skyrocket", "shoot up"], meaning: "พุ่งทะยาน" },
  { id: 18, words: ["recede", "recoil", "retreat"], meaning: "ถดถอย" },
  { id: 19, words: ["motivate", "activate", "rouse", "arouse"], meaning: "กระตุ้น" },
  { id: 20, words: ["deflect", "divert", "deviate", "distract"], meaning: "เบี่ยงเบน" },
  { id: 21, words: ["coax", "cajole", "sway", "convince", "persuade"], meaning: "โน้มน้าว" },
  { id: 22, words: ["bar", "block", "obstruct", "impede", "hinder", "thwart"], meaning: "ขัดขวาง" },
  { id: 23, words: ["strange", "weird", "peculiar", "odd", "eccentric", "bizarre"], meaning: "แปลก ประหลาด" },
  { id: 24, words: ["look down on", "scorn", "contempt", "disdain", "insult"], meaning: "ดูถูก" },
  { id: 25, words: ["fatigue", "exhausted", "run down", "worn out", "weary"], meaning: "เหนื่อย" },
  { id: 26, words: ["firm", "company", "corporation", "enterprise"], meaning: "บริษัท" },
  { id: 27, words: ["essential", "crucial", "vital", "pivotal", "critical"], meaning: "สำคัญ" },
  { id: 28, words: ["announce", "proclaim", "declare"], meaning: "ประกาศ" },
  { id: 29, words: ["trivial", "trifling", "petty", "miscellaneous"], meaning: "เล็กน้อย ไม่สำคัญ" },
  { id: 30, words: ["erode", "corrode", "wear away", "eat away"], meaning: "กัดกร่อน" }
];

const START_DATE = new Date('2026-05-05');
START_DATE.setHours(0, 0, 0, 0);

const App = () => {
  const [user, setUser] = useState(null);
  const [username, setUsername] = useState(localStorage.getItem('vocab_user_v2') || "");
  const [loginInput, setLoginInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [userProgress, setUserProgress] = useState({});
  const [quizHistory, setQuizHistory] = useState(null); // เก็บสถิติ 10 วันล่าสุด
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [view, setView] = useState('calendar'); 
  
  // Quiz & Game States
  const [quizState, setQuizState] = useState({ 
    questions: [], 
    currentIdx: 0, 
    score: 0, 
    showResult: false, 
    answered: null, 
    title: "DAILY QUIZ",
    mistakes: [] // เก็บข้อที่ผิด
  });
  const [gameState, setGameState] = useState({ round: 1, cards: [], selected: [], matched: [], completed: false });
  const [showMistakes, setShowMistakes] = useState(false);

  // 1. Authentication & Cloud Sync
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) { console.error("Auth error:", err); }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || !username) return;
    setLoading(true);
    const userKey = username.toLowerCase().trim();
    const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'users', userKey);
    const unsubscribe = onSnapshot(docRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setUserProgress(data.learnedDates || {});
        setQuizHistory(data.lastTenDayQuiz || null);
      } else {
        setUserProgress({});
        setQuizHistory(null);
      }
      setLoading(false);
    }, (err) => {
      console.error("Firestore Listen Error:", err);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user, username]);

  // 2. Vocab Logic
  const getGroupsForDate = (date) => {
    const d = new Date(date); d.setHours(0,0,0,0);
    const diff = Math.floor((d.getTime() - START_DATE.getTime()) / (1000 * 60 * 60 * 24));
    if (diff >= 0) {
      const startIdx = (diff * 3) % fullVocabData.length;
      return [
        fullVocabData[startIdx], 
        fullVocabData[(startIdx + 1) % fullVocabData.length], 
        fullVocabData[(startIdx + 2) % fullVocabData.length]
      ];
    }
    return [];
  };

  const currentGroups = useMemo(() => getGroupsForDate(selectedDate), [selectedDate]);

  const markAsLearned = async () => {
    if (!user || !username) return;
    const dateKey = selectedDate.toISOString().split('T')[0];
    if (userProgress[dateKey]) return;
    const userKey = username.toLowerCase().trim();
    const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'users', userKey);
    const newProgress = { ...userProgress, [dateKey]: true };
    try {
      await setDoc(docRef, { learnedDates: newProgress, username, lastUpdated: new Date().toISOString() }, { merge: true });
    } catch (err) { console.error("Save error:", err); }
  };

  // 3. Quiz Logic (Daily & 10-Day Review)
  const startDailyQuiz = () => {
    let qs = [];
    currentGroups.forEach(g => {
      g.words.slice(0, 2).forEach(w => {
        const others = fullVocabData.filter(v => v.id !== g.id).map(v => v.meaning).sort(() => Math.random() - 0.5).slice(0, 3);
        qs.push({ word: w, answer: g.meaning, options: [...others, g.meaning].sort(() => Math.random() - 0.5) });
      });
    });
    setShowMistakes(false);
    setQuizState({ questions: qs.sort(() => Math.random() - 0.5), currentIdx: 0, score: 0, showResult: false, answered: null, title: "DAILY QUIZ", mistakes: [] });
    setView('quiz');
  };

  const startTenDayReview = () => {
    const learnedDates = Object.keys(userProgress).sort((a, b) => new Date(a) - new Date(b)).slice(-10);
    const dateRange = learnedDates.length > 0 ? `${learnedDates[0]} ถึง ${learnedDates[learnedDates.length - 1]}` : "";
    
    let pool = [];
    learnedDates.forEach(dateStr => {
      const groups = getGroupsForDate(new Date(dateStr));
      groups.forEach(g => {
        g.words.forEach(w => pool.push({ word: w, meaning: g.meaning, groupId: g.id }));
      });
    });

    const shuffledPool = pool.sort(() => Math.random() - 0.5).slice(0, 20);
    const qs = shuffledPool.map(item => {
      const others = fullVocabData.filter(v => v.id !== item.groupId).map(v => v.meaning).sort(() => Math.random() - 0.5).slice(0, 3);
      return { word: item.word, answer: item.meaning, options: [...others, item.meaning].sort(() => Math.random() - 0.5) };
    });

    setShowMistakes(false);
    setQuizState({ questions: qs, currentIdx: 0, score: 0, showResult: false, answered: null, title: "10-DAY CHALLENGE", mistakes: [], dateRange });
    setView('quiz');
  };

  const saveQuizResult = async (finalScore, mistakes, dateRange) => {
    if (!user || !username) return;
    const userKey = username.toLowerCase().trim();
    const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'users', userKey);
    try {
      await setDoc(docRef, { 
        lastTenDayQuiz: {
          score: finalScore,
          total: 20,
          dateRange,
          timestamp: new Date().toISOString(),
          mistakes: mistakes.slice(0, 10) // เก็บคำที่ผิดไว้ดู
        }
      }, { merge: true });
    } catch (err) { console.error("Save statistics error:", err); }
  };

  // 4. Game Logic
  const generateRoundCards = (roundNum) => {
    const shuffledGroups = [...fullVocabData].sort(() => Math.random() - 0.5).slice(0, 3);
    let cards = [];
    shuffledGroups.forEach((group, idx) => {
      const pairWords = [...group.words].sort(() => Math.random() - 0.5).slice(0, 2);
      cards.push({ id: `r${roundNum}-g${idx}-1`, text: pairWords[0], pairId: idx });
      cards.push({ id: `r${roundNum}-g${idx}-2`, text: pairWords[1], pairId: idx });
    });
    return cards.sort(() => Math.random() - 0.5);
  };

  const handleCardClick = (card) => {
    if (gameState.selected.length === 2 || gameState.matched.includes(card.id) || gameState.selected.some(s => s.id === card.id)) return;
    const newSelected = [...gameState.selected, card];
    setGameState(prev => ({ ...prev, selected: newSelected }));
    if (newSelected.length === 2) {
      if (newSelected[0].pairId === newSelected[1].pairId) {
        const newMatched = [...gameState.matched, newSelected[0].id, newSelected[1].id];
        setTimeout(() => {
          if (newMatched.length === gameState.cards.length) {
            if (gameState.round < 3) {
              setGameState({ round: gameState.round + 1, cards: generateRoundCards(gameState.round + 1), selected: [], matched: [], completed: false });
            } else { setGameState(prev => ({ ...prev, matched: newMatched, selected: [], completed: true })); }
          } else { setGameState(prev => ({ ...prev, matched: newMatched, selected: [] })); }
        }, 500);
      } else { setTimeout(() => setGameState(prev => ({ ...prev, selected: [] })), 800); }
    }
  };

  const handleSignOut = () => { localStorage.removeItem('vocab_user_v2'); setUsername(""); setUserProgress({}); };

  // --- Renders ---
  const renderCalendar = () => {
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();
    const days = new Date(year, month + 1, 0).getDate();
    const startDay = new Date(year, month, 1).getDay();
    const learnedCount = Object.keys(userProgress).length;
    return (
      <div className="max-w-md mx-auto space-y-4 mb-24 animate-in fade-in duration-500">
        <div className="bg-white rounded-[2.5rem] shadow-xl p-8 border border-slate-100">
          <div className="flex justify-between items-center mb-8">
            <button onClick={() => setSelectedDate(new Date(year, month - 1))} className="p-3 bg-slate-50 rounded-2xl hover:bg-slate-100"><ChevronLeft size={20}/></button>
            <h2 className="text-xl font-black text-slate-800">{new Intl.DateTimeFormat('th-TH', { month: 'long', year: 'numeric' }).format(selectedDate)}</h2>
            <button onClick={() => setSelectedDate(new Date(year, month + 1))} className="p-3 bg-slate-50 rounded-2xl hover:bg-slate-100"><ChevronRight size={20}/></button>
          </div>
          <div className="grid grid-cols-7 gap-2">
            {['S','M','T','W','T','F','S'].map((d, idx) => <div key={idx} className="text-center text-[10px] font-black text-slate-300 uppercase">{d}</div>)}
            {Array(startDay).fill(0).map((_, i) => <div key={i}/>)}
            {Array.from({ length: days }, (_, i) => i + 1).map(day => {
              const d = new Date(year, month, day); d.setHours(0,0,0,0);
              const key = d.toISOString().split('T')[0];
              const isSelected = selectedDate.getDate() === day && selectedDate.getMonth() === month;
              return (
                <button key={day} onClick={() => { setSelectedDate(d); setView('study'); }} className={`h-12 rounded-2xl transition-all font-black text-sm relative flex flex-col items-center justify-center ${isSelected ? 'bg-indigo-600 text-white shadow-xl scale-110 z-10' : 'hover:bg-indigo-50 text-slate-700'}`}>
                  {day} {userProgress[key] && <div className={`w-1.5 h-1.5 rounded-full mt-1 ${isSelected ? 'bg-white' : 'bg-green-500'}`} />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Progress & Stats Board */}
        <div className="bg-white rounded-[2.5rem] p-8 shadow-xl border border-slate-100 overflow-hidden relative">
           <div className="flex justify-between items-center mb-4">
              <div><h3 className="font-black text-slate-800 text-lg">ความคืบหน้า</h3><p className="text-xs font-bold text-slate-400">สะสม {learnedCount} / 10 วัน</p></div>
              <div className="bg-amber-100 p-3 rounded-2xl text-amber-600 shadow-inner"><Zap fill="currentColor" size={24}/></div>
           </div>
           <div className="w-full bg-slate-100 h-3 rounded-full mb-6 overflow-hidden"><div className="bg-indigo-600 h-full transition-all duration-700" style={{ width: `${Math.min((learnedCount/10)*100, 100)}%` }}></div></div>
           
           {/* Quiz Stats Board */}
           <div className="bg-slate-50 rounded-3xl p-5 mb-6 border border-slate-100">
              <div className="flex items-center gap-2 mb-3 text-indigo-600">
                <BarChart3 size={18} />
                <span className="font-black text-xs uppercase tracking-wider">LATEST 10-DAY STATS</span>
              </div>
              {quizHistory ? (
                <div className="space-y-1">
                  <div className="flex justify-between items-end">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Quiz Period</span>
                    <span className="text-[10px] font-black text-slate-600">{quizHistory.dateRange}</span>
                  </div>
                  <div className="flex justify-between items-center pt-1">
                    <span className="text-sm font-black text-slate-700">คะแนนที่ได้</span>
                    <span className="text-2xl font-black text-indigo-600">{quizHistory.score}<span className="text-xs text-slate-300">/20</span></span>
                  </div>
                </div>
              ) : (
                <p className="text-xs font-bold text-slate-400 italic">ยังไม่มีสถิติการสอบใหญ่</p>
              )}
           </div>

           {learnedCount >= 10 ? (
             <button onClick={startTenDayReview} className="w-full bg-green-500 hover:bg-green-600 text-white py-5 rounded-2xl font-black shadow-lg hover:scale-[1.02] transition-all">START 10-DAY REVIEW (20 Qs)</button>
           ) : (
             <div className="bg-slate-50 p-4 rounded-2xl text-center"><p className="text-xs font-bold text-slate-400">เรียนเพิ่มอีก <span className="text-indigo-600">{10 - learnedCount} วัน</span> เพื่อปลดล็อกข้อสอบสุ่ม</p></div>
           )}
        </div>
      </div>
    );
  };

  const renderStudy = () => (
    <div className="max-w-2xl mx-auto space-y-4 mb-28 animate-in slide-in-from-bottom duration-500">
       <div className="flex items-center justify-between bg-white p-4 rounded-3xl border border-slate-100 shadow-sm">
          <button onClick={() => setView('calendar')} className="flex items-center gap-2 text-indigo-600 font-black hover:opacity-70"><ChevronLeft size={20}/> BACK</button>
          <span className="font-black text-slate-800">{new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium' }).format(selectedDate)}</span>
       </div>
       {currentGroups.length > 0 ? (
         <div className="grid gap-4">
            {currentGroups.map((g, i) => (
              <div key={i} onClick={markAsLearned} className="group bg-white p-8 rounded-[3rem] border-2 border-transparent hover:border-indigo-100 transition-all shadow-sm hover:shadow-md cursor-pointer">
                 <div className="flex justify-between items-start mb-4">
                    <p className="text-indigo-600 font-black text-2xl tracking-tight">{g.meaning}</p>
                    {userProgress[selectedDate.toISOString().split('T')[0]] && <CheckCircle2 size={24} className="text-green-500" />}
                 </div>
                 <div className="flex flex-wrap gap-2">
                    {g.words.map((w, j) => <span key={j} className="bg-slate-50 text-slate-600 px-4 py-2 rounded-2xl text-xs font-black border border-slate-100 group-hover:bg-indigo-50 transition-colors">{w}</span>)}
                 </div>
              </div>
            ))}
            <div className="flex gap-3 mt-6">
               <button onClick={startDailyQuiz} className="flex-1 bg-indigo-600 text-white py-6 rounded-[2.5rem] font-black shadow-xl flex items-center justify-center gap-2 hover:bg-indigo-700 active:scale-95 transition-all"><HelpCircle size={24}/> DAILY QUIZ</button>
               <button onClick={() => { setGameState({ round: 1, cards: generateRoundCards(1), selected: [], matched: [], completed: false }); setView('game'); }} className="bg-amber-500 text-white px-10 rounded-[2.5rem] font-black shadow-xl hover:bg-amber-600 active:scale-95 transition-all"><Gamepad2 size={28}/></button>
            </div>
         </div>
       ) : <div className="bg-white p-20 rounded-[3.5rem] text-center font-black text-slate-200 border-4 border-dashed border-slate-50">ยังไม่ถึงกำหนดการเรียน</div>}
    </div>
  );

  const renderQuiz = () => {
    const q = quizState.questions[quizState.currentIdx];
    
    if (quizState.showResult) {
      return (
        <div className="max-w-md mx-auto space-y-4 mb-28 animate-in zoom-in">
          <div className="bg-white p-10 rounded-[3.5rem] shadow-2xl text-center space-y-6">
            <Trophy size={60} className="mx-auto text-amber-500" />
            <h2 className="text-2xl font-black text-slate-800 uppercase">Quiz Done!</h2>
            <div className="text-7xl font-black text-indigo-600 tabular-nums">{quizState.score}<span className="text-xl text-slate-300">/{quizState.questions.length}</span></div>
            
            <div className="flex flex-col gap-3 pt-4">
              {quizState.mistakes.length > 0 && (
                <button onClick={() => setShowMistakes(!showMistakes)} className="flex items-center justify-center gap-2 text-red-500 font-black text-sm hover:underline">
                  <AlertCircle size={16}/> {showMistakes ? "Hide Mistakes" : `Review Mistakes (${quizState.mistakes.length})`}
                </button>
              )}
              <button onClick={() => setView('calendar')} className="w-full bg-indigo-600 text-white py-5 rounded-3xl font-black shadow-xl hover:bg-indigo-700 transition-all">กลับหน้าหลัก</button>
            </div>
          </div>

          {showMistakes && quizState.mistakes.length > 0 && (
            <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border-l-8 border-red-400 space-y-4 animate-in slide-in-from-top duration-500">
               <h3 className="font-black text-slate-800 flex items-center gap-2"><XCircle className="text-red-500" size={18}/> คำที่ยังสับสนอยู่</h3>
               <div className="divide-y divide-slate-100">
                 {quizState.mistakes.map((m, idx) => (
                   <div key={idx} className="py-3 flex justify-between items-center">
                      <div>
                        <p className="font-black text-slate-700 text-lg">{m.word}</p>
                        <p className="text-xs font-bold text-slate-400 italic">คุณตอบ: {m.userAnswer}</p>
                      </div>
                      <p className="text-green-600 font-black text-sm">{m.correctAnswer}</p>
                   </div>
                 ))}
               </div>
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="max-w-2xl mx-auto space-y-6 mb-28">
        <div className="bg-white p-6 rounded-3xl flex justify-between items-center font-black shadow-sm border border-slate-100">
           <div className="flex flex-col">
             <span className="text-indigo-600 uppercase text-xs">{quizState.title}</span>
             {quizState.dateRange && <span className="text-[10px] text-slate-400">{quizState.dateRange}</span>}
           </div>
           <span className="text-slate-300 tabular-nums">{quizState.currentIdx + 1} / {quizState.questions.length}</span>
        </div>
        <div className="bg-white p-12 rounded-[3.5rem] shadow-2xl text-center space-y-10 border-b-8 border-slate-100">
           <h2 className="text-5xl font-black tracking-tight text-slate-800 break-words">{q?.word}</h2>
           <div className="grid gap-3">
              {q?.options.map((opt, i) => (
                <button key={i} disabled={!!quizState.answered} onClick={() => {
                   const isCorrect = opt === q.answer;
                   const newMistakes = isCorrect ? quizState.mistakes : [...quizState.mistakes, { word: q.word, userAnswer: opt, correctAnswer: q.answer }];
                   setQuizState(prev => ({...prev, answered: opt, mistakes: newMistakes}));
                   
                   setTimeout(() => {
                      if (quizState.currentIdx + 1 < quizState.questions.length) {
                        setQuizState(prev => ({...prev, currentIdx: prev.currentIdx + 1, score: isCorrect ? prev.score + 1 : prev.score, answered: null}));
                      } else { 
                        const finalScore = isCorrect ? quizState.score + 1 : quizState.score;
                        setQuizState(prev => ({...prev, score: finalScore, showResult: true})); 
                        // บันทึกสถิติถ้าเป็นการสอบ 10 วัน
                        if (quizState.title === "10-DAY CHALLENGE") {
                          saveQuizResult(finalScore, newMistakes, quizState.dateRange);
                        }
                      }
                   }, 600);
                }} className={`py-5 px-8 rounded-2xl text-left font-black border-2 transition-all flex justify-between items-center
                  ${!quizState.answered ? 'bg-slate-50 border-slate-50 hover:border-indigo-200' : 
                    opt === q.answer ? 'bg-green-500 border-green-500 text-white shadow-lg' : 
                    opt === quizState.answered ? 'bg-red-500 border-red-500 text-white shadow-lg' : 'bg-slate-50 border-slate-50 opacity-30'}
                `}>{opt}</button>
              ))}
           </div>
        </div>
      </div>
    );
  };

  const renderSynonymGame = () => {
    if (gameState.completed) {
      return (
        <div className="max-w-md mx-auto bg-white p-12 rounded-[3.5rem] shadow-2xl text-center space-y-8 animate-in zoom-in">
          <Trophy size={100} className="text-amber-500 mx-auto" /><h2 className="text-4xl font-black text-slate-800 uppercase">Perfect!</h2>
          <button onClick={() => setView('study')} className="w-full bg-indigo-600 text-white py-5 rounded-3xl font-black shadow-xl">กลับหน้าเรียน</button>
        </div>
      );
    }
    return (
      <div className="max-w-xl mx-auto space-y-6 mb-28 animate-in fade-in">
        <div className="bg-amber-500 p-6 rounded-[2.5rem] text-white flex justify-between items-center shadow-xl border-b-4 border-amber-600">
           <div className="flex items-center gap-4"><div className="bg-white/20 p-3 rounded-2xl"><Gamepad2 size={24}/></div><div><h3 className="font-black text-lg uppercase">Synonym Match</h3><p className="text-[10px] font-black opacity-80 uppercase">Round {gameState.round} of 3</p></div></div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {gameState.cards.map((card) => {
            const isSelected = gameState.selected.some(s => s.id === card.id);
            const isMatched = gameState.matched.includes(card.id);
            return (
              <button key={card.id} disabled={isMatched} onClick={() => handleCardClick(card)}
                className={`h-40 rounded-[2.5rem] p-6 flex items-center justify-center text-center font-black transition-all border-4 ${isMatched ? 'bg-green-100 border-green-100 text-green-600 opacity-40 scale-95' : isSelected ? 'bg-indigo-600 border-indigo-600 text-white scale-105 shadow-2xl' : 'bg-white border-white text-slate-700 hover:border-amber-200'}`}>
                <span className="text-2xl leading-tight">{card.text}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  if (!username) {
    return (
      <div className="min-h-screen bg-indigo-600 flex items-center justify-center p-6">
        <div className="bg-white w-full max-w-sm rounded-[3.5rem] p-12 shadow-2xl space-y-8 animate-in zoom-in">
          <div className="text-center space-y-4"><div className="bg-indigo-50 w-24 h-24 rounded-[2rem] flex items-center justify-center mx-auto text-indigo-600"><Star size={48} fill="currentColor" /></div><h1 className="text-3xl font-black text-slate-800 tracking-tighter uppercase">Vocab Master</h1></div>
          <form onSubmit={(e) => { e.preventDefault(); const n = loginInput.trim(); if(n){ setUsername(n); localStorage.setItem('vocab_user_v2', n); }}} className="space-y-4">
            <input type="text" value={loginInput} onChange={(e) => setLoginInput(e.target.value)} placeholder="Username / ID" className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-5 px-8 font-black focus:border-indigo-500 outline-none transition-all" required />
            <button type="submit" className="w-full bg-indigo-600 text-white py-5 rounded-2xl font-black shadow-xl active:scale-95 transition-all uppercase">LOG IN</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDFDFD] p-4 pb-24 font-sans">
      <header className="max-w-md mx-auto flex items-center justify-between py-8">
        <div className="flex items-center gap-3"><div className="bg-indigo-600 p-2.5 rounded-2xl shadow-lg"><BookOpen size={20} className="text-white"/></div><span className="font-black text-slate-800 tracking-tight text-lg uppercase">Vocab Master</span></div>
        <div className="bg-white pl-5 pr-2 py-2 rounded-full flex items-center gap-4 border border-slate-100 shadow-sm ring-4 ring-slate-50">
            {loading ? <Loader2 size={14} className="animate-spin text-indigo-600" /> : <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{username}</span>}
            <button onClick={handleSignOut} className="p-2 hover:bg-red-50 text-slate-200 hover:text-red-400 transition-colors rounded-full"><LogOut size={18}/></button>
        </div>
      </header>
      <main className="relative">
        {view === 'calendar' ? renderCalendar() : view === 'study' ? renderStudy() : view === 'game' ? renderSynonymGame() : renderQuiz()}
      </main>
      <nav className="fixed bottom-10 left-0 right-0 flex justify-center px-8 z-50">
        <div className="bg-white/90 backdrop-blur-xl border border-slate-200 p-2 rounded-full shadow-2xl flex gap-1 w-full max-w-xs ring-8 ring-slate-900/5">
          <button onClick={() => setView('calendar')} className={`flex-1 py-4 rounded-full flex items-center justify-center transition-all ${view === 'calendar' ? 'bg-indigo-600 text-white shadow-xl' : 'text-slate-300 hover:bg-slate-50'}`}><Calendar size={22}/></button>
          <button onClick={() => setView('study')} className={`flex-1 py-4 rounded-full flex items-center justify-center transition-all ${view === 'study' ? 'bg-indigo-600 text-white shadow-xl' : 'text-slate-300 hover:bg-slate-50'}`}><BookOpen size={22}/></button>
          <button onClick={() => { setGameState({ round: 1, cards: generateRoundCards(1), selected: [], matched: [], completed: false }); setView('game'); }} className={`flex-1 py-4 rounded-full flex items-center justify-center transition-all ${view === 'game' ? 'bg-amber-500 text-white shadow-xl' : 'text-slate-300 hover:bg-slate-50'}`}><Gamepad2 size={22}/></button>
        </div>
      </nav>
    </div>
  );
};

export default App;
