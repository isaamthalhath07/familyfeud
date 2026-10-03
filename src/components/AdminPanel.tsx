import React, { useState, useEffect } from 'react';
import { GameState, Question } from '../types/game';
import { liveSync } from '../services/liveSync';
import { sfx } from '../services/soundEffects';
import { ShieldAlert, Play, Pause, RotateCcw, Sliders, Plus, Trash2, Flame, Lock, KeyRound, LogOut, CheckCircle } from 'lucide-react';

interface AdminPanelProps {
  gameState: GameState;
  questions: Question[];
}

const SECRET_PIN = 'isaam';

export const AdminPanel: React.FC<AdminPanelProps> = ({ gameState, questions }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return sessionStorage.getItem('PARIVAR_ADMIN_AUTH') === 'true';
  });
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);

  const currentQuestion = questions.find((q) => q.id === gameState.currentQuestionId) || questions[0];

  // Local state for God Mode overrides
  const [optionOverrides, setOptionOverrides] = useState<Record<string, number>>({});
  const [stageGuyName, setStageGuyName] = useState<string>(gameState.stagePlayerName);

  // New question form state
  const [isAddingQuestion, setIsAddingQuestion] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState<'Gandhi Special' | 'Indian Parivar' | 'Dark Satire'>('Gandhi Special');
  const [newTrivia, setNewTrivia] = useState('');
  const [newCommentary, setNewCommentary] = useState('');
  const [newOptionsText, setNewOptionsText] = useState(['Option 1', 'Option 2', 'Option 3', 'Option 4', 'Option 5']);

  // Sync initial overrides
  useEffect(() => {
    if (currentQuestion) {
      const initial: Record<string, number> = {};
      currentQuestion.options.forEach((o) => {
        initial[o.id] = o.manipulatedPercentage !== undefined ? o.manipulatedPercentage : o.presetPercentage;
      });
      setOptionOverrides(initial);
    }
  }, [currentQuestion]);

  // Timer interval effect
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (gameState.isTimerRunning && gameState.timerSeconds > 0) {
      interval = setInterval(() => {
        const nextTime = gameState.timerSeconds - 1;
        liveSync.saveGameState({
          ...gameState,
          timerSeconds: nextTime,
          isTimerRunning: nextTime > 0,
          phase: nextTime === 0 ? 'LOCKED' : gameState.phase,
        });

        if (nextTime <= 5 && nextTime > 0) {
          sfx.playTick();
        } else if (nextTime === 0) {
          sfx.playBuzzer();
        }
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [gameState]);

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinInput.trim().toLowerCase() === SECRET_PIN) {
      sessionStorage.setItem('PARIVAR_ADMIN_AUTH', 'true');
      setIsAuthenticated(true);
      setPinError(false);
      sfx.playVictory();
    } else {
      setPinError(true);
      sfx.playBuzzer();
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('PARIVAR_ADMIN_AUTH');
    setIsAuthenticated(false);
    setPinInput('');
  };

  // If not authenticated with PIN "isaam"
  if (!isAuthenticated) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-slate-900/90 border-2 border-red-500/40 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl text-center space-y-6 relative overflow-hidden">
          <div className="w-14 h-14 rounded-2xl bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-400 mx-auto">
            <KeyRound className="w-7 h-7" />
          </div>

          <div>
            <h2 className="text-2xl font-black text-slate-100 tracking-tight">Admin Secret Access</h2>
            <p className="text-xs text-slate-400 mt-1">Enter the secret PIN to unlock God Mode & Stage Controls.</p>
          </div>

          <form onSubmit={handlePinSubmit} className="space-y-4">
            <div>
              <input
                type="password"
                required
                placeholder="Enter Secret PIN"
                value={pinInput}
                onChange={(e) => {
                  setPinInput(e.target.value);
                  setPinError(false);
                }}
                className={`w-full text-center tracking-widest text-lg font-mono bg-slate-950 border rounded-2xl py-3.5 px-4 text-amber-200 outline-none transition ${
                  pinError ? 'border-red-500 ring-2 ring-red-500/30' : 'border-slate-700 focus:border-amber-500'
                }`}
              />
              {pinError && (
                <p className="text-xs font-bold text-red-400 mt-2">
                  ❌ Incorrect Secret PIN. Try again!
                </p>
              )}
            </div>

            <button
              type="submit"
              className="w-full py-3.5 rounded-2xl font-bold bg-gradient-to-r from-red-600 via-amber-600 to-red-500 text-white shadow-xl shadow-red-500/20 hover:brightness-110 active:scale-[0.99] transition text-sm"
            >
              Unlock Admin Panel
            </button>
          </form>
        </div>
      </div>
    );
  }

  const handleSelectQuestion = (qId: string) => {
    liveSync.saveGameState({
      ...gameState,
      currentQuestionId: qId,
      revealedOptionIds: [],
      timerSeconds: 60,
      isTimerRunning: false,
      phase: 'VOTING',
    });
    sfx.playDing();
  };

  const handleToggleTimer = () => {
    const nextState = !gameState.isTimerRunning;
    liveSync.saveGameState({
      ...gameState,
      isTimerRunning: nextState,
    });
    if (nextState) sfx.playDing();
  };

  const handleResetTimer = () => {
    liveSync.saveGameState({
      ...gameState,
      timerSeconds: 60,
      isTimerRunning: false,
    });
  };

  const handlePhaseChange = (phase: GameState['phase']) => {
    liveSync.saveGameState({
      ...gameState,
      phase,
    });
    sfx.playFlip();
  };

  const handleUpdateStageGuy = (e: React.FormEvent) => {
    e.preventDefault();
    liveSync.saveGameState({
      ...gameState,
      stagePlayerName: stageGuyName,
    });
    sfx.playDing();
  };

  // God Mode: Manipulate Option Percentage Override
  const handlePercentageChange = (optionId: string, val: number) => {
    const updatedOverrides = { ...optionOverrides, [optionId]: val };
    setOptionOverrides(updatedOverrides);

    const updatedQuestions = questions.map((q) => {
      if (q.id === currentQuestion.id) {
        return {
          ...q,
          options: q.options.map((o) => {
            if (o.id === optionId) {
              return { ...o, manipulatedPercentage: val };
            }
            return o;
          }),
        };
      }
      return q;
    });

    liveSync.saveQuestions(updatedQuestions);
    liveSync.saveGameState({
      ...gameState,
      godModeEnabled: true,
    });
  };

  const resetManipulations = () => {
    const updatedQuestions = questions.map((q) => {
      if (q.id === currentQuestion.id) {
        return {
          ...q,
          options: q.options.map((o) => ({ ...o, manipulatedPercentage: undefined })),
        };
      }
      return q;
    });

    const resetOverrides: Record<string, number> = {};
    currentQuestion.options.forEach((o) => {
      resetOverrides[o.id] = o.presetPercentage;
    });

    setOptionOverrides(resetOverrides);
    liveSync.saveQuestions(updatedQuestions);
    sfx.playDing();
  };

  const handleSaveNewQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const newQ: Question = {
      id: 'q_' + Math.random().toString(36).substring(2, 9),
      title: newTitle.trim(),
      category: newCategory,
      darkHumorTrivia: newTrivia.trim() || undefined,
      bapuCommentary: newCommentary.trim() || undefined,
      options: newOptionsText.map((txt, idx) => ({
        id: `opt_${Math.random().toString(36).substring(2, 7)}`,
        text: txt.trim() || `Option ${idx + 1}`,
        presetPercentage: Math.max(5, 40 - idx * 8),
        presetPoints: Math.max(5, 40 - idx * 8),
      })),
    };

    const updated = [...questions, newQ];
    liveSync.saveQuestions(updated);
    setIsAddingQuestion(false);
    setNewTitle('');
    setNewTrivia('');
    setNewCommentary('');
    sfx.playVictory();
  };

  const handleDeleteQuestion = (qId: string) => {
    if (questions.length <= 1) return;
    const updated = questions.filter((q) => q.id !== qId);
    liveSync.saveQuestions(updated);
    if (gameState.currentQuestionId === qId) {
      liveSync.saveGameState({
        ...gameState,
        currentQuestionId: updated[0].id,
      });
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900/90 border border-red-500/40 rounded-3xl p-5 shadow-2xl backdrop-blur-xl flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-400">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-slate-100 flex items-center gap-2">
              Host Control Center & God Mode Panel
            </h2>
            <p className="text-xs text-slate-400">
              Control live state, timers, question broadcast, and override majority percentages in real-time.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Phase Badges */}
          <div className="flex items-center gap-1.5 bg-slate-950 p-1.5 rounded-2xl border border-slate-800 text-xs font-semibold">
            {(['VOTING', 'LOCKED', 'STAGE_GUESSING', 'REVEALED'] as GameState['phase'][]).map((phase) => (
              <button
                key={phase}
                onClick={() => handlePhaseChange(phase)}
                className={`px-3 py-1.5 rounded-xl transition ${
                  gameState.phase === phase
                    ? 'bg-red-500 text-white font-bold shadow-md shadow-red-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {phase}
              </button>
            ))}
          </div>

          <button
            onClick={handleLogout}
            className="p-2.5 rounded-2xl bg-slate-950 border border-slate-800 text-slate-400 hover:text-red-400 transition"
            title="Lock Admin Panel"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Live State & Timer Controls */}
        <div className="space-y-6">
          {/* Active Timer Card */}
          <div className="bg-slate-900/80 border border-amber-500/30 rounded-3xl p-5 shadow-xl">
            <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-3">
              ⏱️ Voting Timer Control
            </h3>

            <div className="text-center py-4 bg-slate-950 rounded-2xl border border-slate-800 mb-4">
              <span className="font-mono text-4xl sm:text-5xl font-black text-amber-300">
                {gameState.timerSeconds}s
              </span>
              <p className="text-xs text-slate-500 mt-1 font-semibold">
                Status: {gameState.isTimerRunning ? 'RUNNING 🟢' : 'PAUSED ⏸️'}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleToggleTimer}
                className={`py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition ${
                  gameState.isTimerRunning
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                }`}
              >
                {gameState.isTimerRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                {gameState.isTimerRunning ? 'Pause Timer' : 'Start Timer'}
              </button>

              <button
                onClick={handleResetTimer}
                className="py-3 rounded-xl font-bold text-xs bg-slate-800 border border-slate-700 text-slate-300 hover:text-white flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-4 h-4" /> Reset (60s)
              </button>
            </div>
          </div>

          {/* Stage Contestant Name Card */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5 shadow-xl">
            <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-3">
              🎭 Stage Guy / Contestant Setup
            </h3>

            <form onSubmit={handleUpdateStageGuy} className="space-y-3">
              <input
                type="text"
                value={stageGuyName}
                onChange={(e) => setStageGuyName(e.target.value)}
                placeholder="Contestant Name"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2.5 px-3.5 text-xs text-amber-100 outline-none focus:border-amber-500"
              />
              <button
                type="submit"
                className="w-full py-2.5 rounded-xl font-bold text-xs bg-amber-500/20 border border-amber-500/30 text-amber-300 hover:bg-amber-500/30 transition"
              >
                Update Stage Guy Name
              </button>
            </form>
          </div>
        </div>

        {/* Middle Column: God Mode Percentage Override */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-slate-900/90 border-2 border-red-500/40 rounded-3xl p-5 shadow-2xl relative overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Sliders className="w-5 h-5 text-red-400" />
                <h3 className="font-bold text-base text-slate-100">
                  Real-Time Majority Percentage Manipulator ("God Mode")
                </h3>
              </div>

              <button
                onClick={resetManipulations}
                className="text-xs text-slate-400 hover:text-red-400 border border-slate-700 px-2.5 py-1 rounded-lg"
              >
                Reset Overrides
              </button>
            </div>

            <p className="text-xs text-slate-400 mb-4">
              Adjust the sliders below to override majority response percentages live. This updates stage board reveals and rankings immediately!
            </p>

            <div className="space-y-3">
              {currentQuestion.options.map((option, idx) => {
                const currentVal = optionOverrides[option.id] ?? option.presetPercentage;
                return (
                  <div key={option.id} className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-amber-200">
                        #{idx + 1}. {option.text}
                      </span>
                      <span className="font-mono font-bold text-red-400 bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20">
                        {currentVal}% Override
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min="1"
                        max="90"
                        value={currentVal}
                        onChange={(e) => handlePercentageChange(option.id, parseInt(e.target.value))}
                        className="w-full accent-red-500 cursor-pointer"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Question Bank Manager & Switcher */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-slate-100 flex items-center gap-2">
                <Flame className="w-5 h-5 text-amber-400" /> Question Bank Manager ({questions.length} Questions)
              </h3>

              <button
                onClick={() => setIsAddingQuestion(!isAddingQuestion)}
                className="px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500/20 border border-amber-500/40 text-amber-300 hover:bg-amber-500/30 transition flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> {isAddingQuestion ? 'Cancel' : 'Add Question'}
              </button>
            </div>

            {/* Add New Question Form */}
            {isAddingQuestion && (
              <form onSubmit={handleSaveNewQuestion} className="bg-slate-950 p-4 rounded-2xl border border-amber-500/30 space-y-3">
                <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider">New Question Details</h4>
                <input
                  type="text"
                  required
                  placeholder="Question Title (e.g. Rank what Mahatma Gandhi would say...)"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2 px-3 text-xs text-amber-100"
                />

                <input
                  type="text"
                  placeholder="Dark Humor Satire Note (optional)"
                  value={newTrivia}
                  onChange={(e) => setNewTrivia(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2 px-3 text-xs text-amber-100"
                />

                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-slate-400">Options (1 to 5):</label>
                  {newOptionsText.map((opt, i) => (
                    <input
                      key={i}
                      type="text"
                      value={opt}
                      onChange={(e) => {
                        const copy = [...newOptionsText];
                        copy[i] = e.target.value;
                        setNewOptionsText(copy);
                      }}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg py-1.5 px-3 text-xs text-slate-200"
                    />
                  ))}
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl font-bold text-xs bg-amber-500 text-slate-950 hover:brightness-110"
                >
                  Save Question To Bank
                </button>
              </form>
            )}

            {/* Question Selector List */}
            <div className="space-y-2">
              {questions.map((q) => {
                const isActive = q.id === gameState.currentQuestionId;
                return (
                  <div
                    key={q.id}
                    className={`p-3.5 rounded-2xl border transition flex items-center justify-between gap-3 ${
                      isActive
                        ? 'bg-amber-500/10 border-amber-500 text-amber-200'
                        : 'bg-slate-950 border-slate-800 text-slate-300'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-slate-800 text-amber-400 border border-slate-700">
                          {q.category}
                        </span>
                        {isActive && <span className="text-[10px] font-bold text-emerald-400">● LIVE BROADCAST</span>}
                      </div>
                      <p className="text-xs font-bold mt-1 leading-snug">{q.title}</p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {!isActive && (
                        <button
                          onClick={() => handleSelectQuestion(q.id)}
                          className="px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500 text-slate-950 hover:brightness-110"
                        >
                          Broadcast Live
                        </button>
                      )}

                      {questions.length > 1 && (
                        <button
                          onClick={() => handleDeleteQuestion(q.id)}
                          className="p-1.5 text-slate-500 hover:text-red-400 rounded-lg"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
