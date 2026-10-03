import React, { useState, useEffect, useMemo } from 'react';
import type { LiveSnapshot } from '../services/liveSync';
import { liveSync } from '../services/liveSync';
import { sfx } from '../services/soundEffects';
import { useCountdown } from '../hooks/useLiveGame';
import { computeRanking } from '../lib/scoring';
import {
  ShieldAlert,
  Play,
  Pause,
  RotateCcw,
  Sliders,
  Plus,
  Trash2,
  Flame,
  KeyRound,
  LogOut,
  Sparkles,
  Users,
  Eye,
  CheckCircle2,
  RefreshCw,
  Clock,
  ArrowUp,
  ArrowDown
} from 'lucide-react';

const SECRET_PIN = 'isaam';

export const AdminPanel: React.FC<{ live: LiveSnapshot }> = ({ live }) => {
  const { state, questions, submissions } = live;

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return sessionStorage.getItem('PARIVAR_ADMIN_AUTH') === 'true';
  });
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);

  // Activate admin self-healing mode once authenticated
  useEffect(() => {
    if (isAuthenticated) {
      liveSync.enableAdminMode();
    }
  }, [isAuthenticated]);

  const currentQuestion = questions.find((q) => q.id === state.currentQuestionId) || questions[0];
  const ranking = useMemo(() => computeRanking(currentQuestion, submissions), [currentQuestion, submissions]);
  const voteCount = submissions.filter((s) => s.questionId === currentQuestion.id).length;
  const remaining = useCountdown(state);

  const [stageGuyNameInput, setStageGuyNameInput] = useState(state.stagePlayerName);
  const [timerDurationInput, setTimerDurationInput] = useState(state.timerDuration);

  // New question state
  const [isAddingQuestion, setIsAddingQuestion] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState('Gandhi Special');
  const [newTrivia, setNewTrivia] = useState('');
  const [newCommentary, setNewCommentary] = useState('');
  const [newOptionsText, setNewOptionsText] = useState(['Option 1', 'Option 2', 'Option 3', 'Option 4', 'Option 5']);

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
                id="admin-pin-input"
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
              id="admin-pin-submit"
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

  // --- ACTIONS ---
  const handleSelectQuestion = (qId: string) => {
    liveSync.updateState({
      currentQuestionId: qId,
      revealedOptionIds: [],
      timerEndsAt: null,
      timerRemaining: state.timerDuration,
      phase: 'VOTING',
    });
    sfx.playDing();
  };

  const handleStartVoting = () => {
    const duration = timerDurationInput || 60;
    liveSync.updateState({
      timerDuration: duration,
      timerEndsAt: Date.now() + duration * 1000,
      timerRemaining: duration,
      phase: 'VOTING',
    });
    sfx.playDing();
  };

  const handlePauseTimer = () => {
    if (state.timerEndsAt) {
      liveSync.updateState({
        timerEndsAt: null,
        timerRemaining: remaining,
      });
    } else {
      liveSync.updateState({
        timerEndsAt: Date.now() + state.timerRemaining * 1000,
      });
    }
    sfx.playDing();
  };

  const handleResetTimer = () => {
    liveSync.updateState({
      timerEndsAt: null,
      timerRemaining: state.timerDuration,
    });
  };

  const handlePhaseChange = (phase: typeof state.phase) => {
    liveSync.updateState({ phase });
    sfx.playFlip();
  };

  const handlePercentageChange = (optionId: string, val: number) => {
    liveSync.setQuestions((qs) =>
      qs.map((q) => {
        if (q.id === currentQuestion.id) {
          return {
            ...q,
            options: q.options.map((o) => (o.id === optionId ? { ...o, manipulatedPercentage: val } : o)),
          };
        }
        return q;
      })
    );
  };

  const resetManipulations = () => {
    liveSync.setQuestions((qs) =>
      qs.map((q) => {
        if (q.id === currentQuestion.id) {
          return {
            ...q,
            options: q.options.map((o) => ({ ...o, manipulatedPercentage: undefined })),
          };
        }
        return q;
      })
    );
    sfx.playDing();
  };

  const handleUpdateStageGuy = (e: React.FormEvent) => {
    e.preventDefault();
    liveSync.updateState({ stagePlayerName: stageGuyNameInput });
    sfx.playDing();
  };

  const handleSetStageGuessOrder = (optionIdOrder: string[]) => {
    liveSync.updateState((s) => ({
      stageGuesses: {
        ...s.stageGuesses,
        [currentQuestion.id]: optionIdOrder,
      },
    }));
  };

  const handleSaveNewQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const newQ = {
      id: 'q_' + Math.random().toString(36).slice(2, 9),
      title: newTitle.trim(),
      category: newCategory.trim() || 'Gandhi Special',
      darkHumorTrivia: newTrivia.trim() || undefined,
      bapuCommentary: newCommentary.trim() || undefined,
      options: newOptionsText.map((txt, idx) => ({
        id: `opt_${Math.random().toString(36).slice(2, 7)}`,
        text: txt.trim() || `Option ${idx + 1}`,
        presetPercentage: Math.max(5, 40 - idx * 8),
        presetPoints: 20,
      })),
    };

    liveSync.setQuestions((prev) => [...prev, newQ]);
    setIsAddingQuestion(false);
    setNewTitle('');
    setNewTrivia('');
    setNewCommentary('');
    sfx.playVictory();
  };

  const handleDeleteQuestion = (qId: string) => {
    if (questions.length <= 1) return;
    liveSync.setQuestions((qs) => qs.filter((q) => q.id !== qId));
    if (state.currentQuestionId === qId) {
      const remainingQs = questions.filter((q) => q.id !== qId);
      liveSync.updateState({ currentQuestionId: remainingQs[0].id });
    }
  };

  const currentStageGuess = state.stageGuesses[currentQuestion.id] || currentQuestion.options.map((o) => o.id);

  const moveStageOption = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= currentStageGuess.length) return;
    const next = [...currentStageGuess];
    [next[idx], next[target]] = [next[target], next[idx]];
    handleSetStageGuessOrder(next);
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
              Real-time cross-device sync active. Changes push immediately to stage and audience screens.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Phase Badges */}
          <div className="flex items-center gap-1.5 bg-slate-950 p-1.5 rounded-2xl border border-slate-800 text-xs font-semibold">
            {(['VOTING', 'LOCKED', 'STAGE_GUESSING', 'REVEALED'] as const).map((phase) => (
              <button
                key={phase}
                id={`admin-phase-${phase.toLowerCase()}`}
                onClick={() => handlePhaseChange(phase)}
                className={`px-3 py-1.5 rounded-xl transition ${
                  state.phase === phase
                    ? 'bg-red-500 text-white font-bold shadow-md shadow-red-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {phase}
              </button>
            ))}
          </div>

          <button
            id="admin-logout"
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
          <div className="bg-slate-900/80 border border-amber-500/30 rounded-3xl p-5 shadow-xl space-y-4">
            <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider">
              ⏱️ Voting Timer Control
            </h3>

            <div className="text-center py-4 bg-slate-950 rounded-2xl border border-slate-800">
              <span id="admin-timer-display" className="font-mono text-4xl sm:text-5xl font-black text-amber-300">
                {remaining}s
              </span>
              <p className="text-xs text-slate-500 mt-1 font-semibold">
                Status: {state.timerEndsAt ? 'RUNNING 🟢' : 'PAUSED ⏸️'} | Votes: <span className="text-cyan-300 font-bold">{voteCount}</span>
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                id="admin-start-voting"
                onClick={handleStartVoting}
                className="py-3 rounded-xl font-bold text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30 flex items-center justify-center gap-2"
              >
                <Play className="w-4 h-4" /> Start Round Timer
              </button>

              <button
                id="admin-pause-timer"
                onClick={handlePauseTimer}
                className="py-3 rounded-xl font-bold text-xs bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 flex items-center justify-center gap-2"
              >
                <Pause className="w-4 h-4" /> {state.timerEndsAt ? 'Pause' : 'Resume'}
              </button>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
              <label htmlFor="admin-timer-duration" className="text-xs text-slate-400 shrink-0">Duration (s):</label>
              <input
                id="admin-timer-duration"
                type="number"
                min="10"
                max="300"
                value={timerDurationInput}
                onChange={(e) => setTimerDurationInput(parseInt(e.target.value) || 60)}
                className="w-20 bg-slate-950 border border-slate-700 rounded-lg py-1 px-2 text-xs font-mono text-amber-300"
              />
              <button
                onClick={handleResetTimer}
                className="ml-auto px-3 py-1 rounded-lg bg-slate-800 text-xs font-bold text-slate-300 hover:text-white flex items-center gap-1"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Reset
              </button>
            </div>
          </div>

          {/* Stage Contestant Setup */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4">
            <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider">
              🎭 Stage Guy / Contestant Setup
            </h3>

            <form onSubmit={handleUpdateStageGuy} className="space-y-3">
              <input
                id="admin-stage-guy-input"
                type="text"
                value={stageGuyNameInput}
                onChange={(e) => setStageGuyNameInput(e.target.value)}
                placeholder="Contestant Name"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2.5 px-3.5 text-xs text-amber-100 outline-none focus:border-amber-500"
              />
              <button
                type="submit"
                className="w-full py-2.5 rounded-xl font-bold text-xs bg-amber-500/20 border border-amber-500/30 text-amber-300 hover:bg-amber-500/30 transition"
              >
                Update Contestant Name
              </button>
            </form>

            <div className="pt-3 border-t border-slate-800 space-y-2">
              <label className="text-xs font-semibold text-slate-400">Contestant's Guessed Order:</label>
              <div className="space-y-1.5">
                {currentStageGuess.map((optId, idx) => {
                  const optText = currentQuestion.options.find((o) => o.id === optId)?.text ?? '';
                  return (
                    <div key={optId} className="flex items-center justify-between bg-slate-950 p-2 rounded-xl border border-slate-800 text-xs">
                      <span className="font-mono text-amber-400 font-bold mr-2">#{idx + 1}</span>
                      <span className="truncate flex-1 font-medium text-slate-200">{optText}</span>
                      <div className="flex items-center gap-1 ml-2">
                        <button
                          type="button"
                          onClick={() => moveStageOption(idx, -1)}
                          disabled={idx === 0}
                          className="p-1 rounded bg-slate-800 text-slate-300 disabled:opacity-30"
                        >
                          <ArrowUp className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveStageOption(idx, 1)}
                          disabled={idx === currentStageGuess.length - 1}
                          className="p-1 rounded bg-slate-800 text-slate-300 disabled:opacity-30"
                        >
                          <ArrowDown className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Dangerous actions */}
          <div className="bg-slate-900/80 border border-red-500/20 rounded-3xl p-5 shadow-xl space-y-3">
            <h3 className="text-xs font-bold text-red-400 uppercase tracking-wider">
              ⚠️ Room Controls
            </h3>
            <button
              id="admin-clear-votes"
              onClick={() => {
                if (confirm('Clear audience votes for this question?')) {
                  liveSync.clearSubmissions(currentQuestion.id);
                }
              }}
              className="w-full py-2.5 rounded-xl font-bold text-xs bg-red-950/40 border border-red-500/30 text-red-300 hover:bg-red-900/40 transition"
            >
              Clear Votes For Current Question
            </button>
            <button
              id="admin-reset-game"
              onClick={() => {
                if (confirm('Reset entire game state and all scores?')) {
                  liveSync.resetGame();
                }
              }}
              className="w-full py-2.5 rounded-xl font-bold text-xs bg-slate-950 border border-slate-800 text-slate-400 hover:text-white transition"
            >
              Reset Entire Game
            </button>
          </div>
        </div>

        {/* Middle & Right Column: God Mode Override & Question Bank */}
        <div className="lg:col-span-2 space-y-6">
          {/* God Mode Percentage Overrides */}
          <div className="bg-slate-900/90 border-2 border-red-500/40 rounded-3xl p-5 shadow-2xl relative overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Sliders className="w-5 h-5 text-red-400" />
                <h3 className="font-bold text-base text-slate-100">
                  Real-Time Majority Percentage Manipulator ("God Mode")
                </h3>
              </div>

              <button
                id="admin-reset-godmode"
                onClick={resetManipulations}
                className="text-xs text-slate-400 hover:text-red-400 border border-slate-700 px-2.5 py-1 rounded-lg"
              >
                Reset Overrides
              </button>
            </div>

            <p className="text-xs text-slate-400 mb-4">
              Adjust percentages below to override crowd votes. The stage board ranks options automatically based on these values!
            </p>

            <div className="space-y-3">
              {ranking.map((row) => {
                const option = row.option;
                const currentPct = row.pct;
                const isOverridden = row.overridden;
                return (
                  <div key={option.id} className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-amber-200">
                        #{row.rank}. {option.text}
                      </span>
                      <div className="flex items-center gap-2 font-mono">
                        <span className="text-slate-400 text-[11px]">
                          Audience: {row.audiencePct !== null ? `${row.audiencePct}%` : 'no votes'}
                        </span>
                        <span className={`px-2 py-0.5 rounded font-bold border ${isOverridden ? 'bg-red-500/20 border-red-500/40 text-red-300' : 'bg-amber-500/10 border-amber-500/30 text-amber-300'}`}>
                          {currentPct}% {isOverridden ? '(Manipulated)' : ''}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min="1"
                        max="95"
                        value={currentPct}
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
                id="admin-toggle-add-question"
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
                const isActive = q.id === state.currentQuestionId;
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
                          id={`broadcast-${q.id}`}
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
