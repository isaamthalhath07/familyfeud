import React, { useState, useEffect } from 'react';
import { GameState, Question, AnswerOption, UserSubmission, AudienceMember } from '../types/game';
import { liveSync } from '../services/liveSync';
import { sfx } from '../services/soundEffects';
import { ArrowUp, ArrowDown, Send, Award, CheckCircle2, Lock, Sparkles, User, RefreshCw } from 'lucide-react';

interface MobileAudienceViewProps {
  gameState: GameState;
  questions: Question[];
}

const AVATARS = ['🧘‍♂️', '👑', '🔥', '🦁', '⚡', '🌶️', '🎭', '🦚'];
const SATIRE_BADGES = ['Ahinsa Master', 'Dandi Pioneer', 'Charkha Weaver', 'Satyagrahi', 'Desi Feud Legend'];

export const MobileAudienceView: React.FC<MobileAudienceViewProps> = ({ gameState, questions }) => {
  const [user, setUser] = useState<AudienceMember | null>(() => {
    const saved = localStorage.getItem('PARIVAR_FEUD_USER');
    return saved ? JSON.parse(saved) : null;
  });

  const [nameInput, setNameInput] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState('🧘‍♂️');

  const currentQuestion = questions.find((q) => q.id === gameState.currentQuestionId) || questions[0];
  
  // Local state for user's drag/reordered options
  const [orderedOptions, setOrderedOptions] = useState<AnswerOption[]>([]);
  const [hasSubmitted, setHasSubmitted] = useState<boolean>(false);
  const [userScoreGained, setUserScoreGained] = useState<number>(0);

  // Initialize option order when question changes
  useEffect(() => {
    if (currentQuestion) {
      setOrderedOptions([...currentQuestion.options]);
      setHasSubmitted(false);
      setUserScoreGained(0);

      // Check if user already submitted for this question
      if (user) {
        const subs = liveSync.getSubmissions();
        const existing = subs.find((s) => s.userId === user.id && s.questionId === currentQuestion.id);
        if (existing) {
          setHasSubmitted(true);
          setUserScoreGained(existing.scoreGained);
          // Restore submitted order
          const restored = existing.rankedOptionIds
            .map((id) => currentQuestion.options.find((o) => o.id === id))
            .filter((o): o is AnswerOption => Boolean(o));
          if (restored.length === currentQuestion.options.length) {
            setOrderedOptions(restored);
          }
        }
      }
    }
  }, [gameState.currentQuestionId, user]);

  const handleCreateProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameInput.trim()) return;

    const newMember: AudienceMember = {
      id: 'usr_' + Math.random().toString(36).substring(2, 9),
      name: nameInput.trim(),
      totalScore: 0,
      streak: 0,
      avatar: selectedAvatar,
      badge: SATIRE_BADGES[Math.floor(Math.random() * SATIRE_BADGES.length)],
    };

    localStorage.setItem('PARIVAR_FEUD_USER', JSON.stringify(newMember));
    setUser(newMember);
    liveSync.saveAudienceMember(newMember);
    sfx.playDing();
  };

  const moveOption = (index: number, direction: 'UP' | 'DOWN') => {
    if (hasSubmitted || gameState.phase === 'LOCKED' || gameState.phase === 'REVEALED') return;
    const newIndex = direction === 'UP' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= orderedOptions.length) return;

    const updated = [...orderedOptions];
    const [moved] = updated.splice(index, 1);
    updated.splice(newIndex, 0, moved);

    setOrderedOptions(updated);
    sfx.playFlip();
  };

  const handleSubmitRanking = () => {
    if (!user || !currentQuestion || hasSubmitted) return;

    // Calculate score based on proximity to default/manipulated top rankings
    const rankedIds = orderedOptions.map((o) => o.id);
    
    // Determine target order (manipulated or preset)
    const targetOptions = [...currentQuestion.options].sort((a, b) => {
      const pctA = a.manipulatedPercentage !== undefined ? a.manipulatedPercentage : a.presetPercentage;
      const pctB = b.manipulatedPercentage !== undefined ? b.manipulatedPercentage : b.presetPercentage;
      return pctB - pctA;
    });

    let points = 50; // base score for submitting
    if (rankedIds[0] === targetOptions[0].id) points += 50; // exact top guess bonus
    if (rankedIds[1] === targetOptions[1].id) points += 30;

    const submission: UserSubmission = {
      userId: user.id,
      userName: user.name,
      questionId: currentQuestion.id,
      rankedOptionIds: rankedIds,
      scoreGained: points,
      submittedAt: Date.now(),
    };

    liveSync.addSubmission(submission);

    // Update user score
    const updatedUser = { ...user, totalScore: user.totalScore + points };
    localStorage.setItem('PARIVAR_FEUD_USER', JSON.stringify(updatedUser));
    setUser(updatedUser);
    liveSync.saveAudienceMember(updatedUser);

    setHasSubmitted(true);
    setUserScoreGained(points);
    sfx.playVictory();
  };

  // If user profile is not set up
  if (!user) {
    return (
      <div className="min-h-[85vh] flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-slate-900/90 border border-amber-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl pointer-events-none"></div>

          <div className="text-center mb-6">
            <div className="inline-flex p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 mb-3 text-3xl">
              🦚
            </div>
            <h2 className="text-2xl font-black text-amber-300 tracking-tight">Join Parivar Feud</h2>
            <p className="text-xs text-slate-400 mt-1">Enter your stage name to vote & rank majority answers live!</p>
          </div>

          <form onSubmit={handleCreateProfile} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Your Stage Name
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  required
                  maxLength={18}
                  placeholder="e.g. Rahul Gandhi Fan #1"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-xl py-3 pl-10 pr-4 text-sm text-amber-100 outline-none transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Choose Your Avatar
              </label>
              <div className="grid grid-cols-4 gap-2">
                {AVATARS.map((av) => (
                  <button
                    key={av}
                    type="button"
                    onClick={() => setSelectedAvatar(av)}
                    className={`py-2 text-2xl rounded-xl border transition ${
                      selectedAvatar === av
                        ? 'bg-amber-500/20 border-amber-500 scale-105 shadow-md shadow-amber-500/20'
                        : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    {av}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3.5 rounded-xl font-bold bg-gradient-to-r from-amber-500 via-yellow-400 to-orange-500 text-slate-950 shadow-lg shadow-amber-500/25 hover:brightness-110 active:scale-[0.99] transition"
            >
              Enter Game Room
            </button>
          </form>
        </div>
      </div>
    );
  }

  const isLocked = gameState.phase === 'LOCKED' || gameState.phase === 'REVEALED';

  return (
    <div className="max-w-md mx-auto px-4 py-4 space-y-4 pb-20">
      {/* Top User Status Card */}
      <div className="bg-slate-900/80 border border-amber-500/30 rounded-2xl p-3 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-2xl">
            {user.avatar}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-sm text-slate-100">{user.name}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30">
                {user.badge}
              </span>
            </div>
            <p className="text-[11px] text-slate-400">Total Points: <span className="text-amber-400 font-bold">{user.totalScore} pts</span></p>
          </div>
        </div>

        <button
          onClick={() => {
            localStorage.removeItem('PARIVAR_FEUD_USER');
            setUser(null);
          }}
          className="text-xs text-slate-400 hover:text-red-400 p-1.5"
          title="Change Profile"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Question Card */}
      <div className="bg-slate-900/90 border border-amber-500/30 rounded-3xl p-5 shadow-2xl relative overflow-hidden backdrop-blur-md">
        <div className="flex items-center justify-between text-xs mb-2">
          <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-300 font-semibold border border-amber-500/20">
            {currentQuestion.category}
          </span>

          <div className="flex items-center gap-1 font-mono font-bold text-amber-400">
            <span>⏱️</span>
            <span>{gameState.timerSeconds}s</span>
          </div>
        </div>

        <h3 className="text-base sm:text-lg font-bold text-amber-100 leading-snug mb-3">
          {currentQuestion.title}
        </h3>

        {currentQuestion.darkHumorTrivia && (
          <div className="bg-amber-950/30 border border-amber-500/20 rounded-xl p-2.5 text-xs text-amber-200/90 italic">
            🔥 <span className="font-semibold text-amber-400">Satire Note:</span> {currentQuestion.darkHumorTrivia}
          </div>
        )}
      </div>

      {/* Subtitle / Instructions */}
      <div className="flex items-center justify-between text-xs text-slate-300 px-1">
        <span className="font-semibold text-amber-300/90 uppercase tracking-wider">
          Rank options (1 = Most Popular)
        </span>
        {hasSubmitted ? (
          <span className="text-emerald-400 font-bold flex items-center gap-1">
            <CheckCircle2 className="w-4 h-4" /> Vote Submitted!
          </span>
        ) : isLocked ? (
          <span className="text-red-400 font-bold flex items-center gap-1">
            <Lock className="w-4 h-4" /> Voting Closed
          </span>
        ) : (
          <span className="text-slate-400">Use ▲ ▼ to reorder</span>
        )}
      </div>

      {/* Option Ranking List */}
      <div className="space-y-2.5">
        {orderedOptions.map((option, index) => {
          const rankNumber = index + 1;
          const isTopRank = rankNumber === 1;

          return (
            <div
              key={option.id}
              className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                isTopRank
                  ? 'bg-gradient-to-r from-amber-500/20 via-yellow-500/10 to-slate-900 border-amber-500/50 shadow-lg shadow-amber-500/10'
                  : 'bg-slate-900/70 border-slate-800'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <span
                  className={`w-7 h-7 rounded-xl flex items-center justify-center font-extrabold text-xs shadow ${
                    isTopRank ? 'bg-amber-400 text-slate-950' : 'bg-slate-800 text-amber-300 border border-slate-700'
                  }`}
                >
                  #{rankNumber}
                </span>

                <p className="text-xs sm:text-sm font-medium text-slate-100 leading-tight">
                  {option.text}
                </p>
              </div>

              {/* Up / Down Controls */}
              {!hasSubmitted && !isLocked && (
                <div className="flex flex-col gap-1 shrink-0">
                  <button
                    onClick={() => moveOption(index, 'UP')}
                    disabled={index === 0}
                    className="p-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:text-amber-300 disabled:opacity-30 disabled:pointer-events-none transition"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => moveOption(index, 'DOWN')}
                    disabled={index === orderedOptions.length - 1}
                    className="p-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:text-amber-300 disabled:opacity-30 disabled:pointer-events-none transition"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Submit Button */}
      {!hasSubmitted && !isLocked && (
        <button
          onClick={handleSubmitRanking}
          className="w-full py-3.5 rounded-2xl font-bold bg-gradient-to-r from-amber-500 via-yellow-400 to-orange-500 text-slate-950 shadow-xl shadow-amber-500/20 hover:brightness-110 active:scale-[0.99] transition flex items-center justify-center gap-2 text-sm"
        >
          <Send className="w-4 h-4" /> Submit My Ranking
        </button>
      )}

      {/* Submitted Confirmation Banner */}
      {hasSubmitted && (
        <div className="bg-emerald-950/40 border border-emerald-500/40 rounded-2xl p-4 text-center space-y-2">
          <div className="inline-flex p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
            <Sparkles className="w-6 h-6" />
          </div>
          <h4 className="font-bold text-sm text-emerald-300">Your Rank Prediction is Locked!</h4>
          <p className="text-xs text-slate-300">
            You scored <span className="font-bold text-amber-400">+{userScoreGained} points</span>! Watch the Stage TV screen for the final reveal!
          </p>
        </div>
      )}
    </div>
  );
};
