import React, { useState, useEffect } from 'react';
import { GameState, Question, AnswerOption, UserSubmission } from '../types/game';
import { liveSync } from '../services/liveSync';
import { sfx } from '../services/soundEffects';
import confetti from 'canvas-confetti';
import { Trophy, Users, Eye, Sparkles, Flame, CheckCircle, HelpCircle } from 'lucide-react';

interface StageDisplayViewProps {
  gameState: GameState;
  questions: Question[];
}

export const StageDisplayView: React.FC<StageDisplayViewProps> = ({ gameState, questions }) => {
  const currentQuestion = questions.find((q) => q.id === gameState.currentQuestionId) || questions[0];
  const submissions = liveSync.getSubmissions().filter((s) => s.questionId === currentQuestion.id);

  // Local state for options revealed on the board
  const [revealedIds, setRevealedIds] = useState<string[]>(gameState.revealedOptionIds || []);

  useEffect(() => {
    setRevealedIds(gameState.revealedOptionIds || []);
  }, [gameState.revealedOptionIds, gameState.currentQuestionId]);

  // Options sorted by effective percentage (manipulated if God Mode override set, otherwise preset)
  const sortedOptions = React.useMemo(() => {
    return [...currentQuestion.options].sort((a, b) => {
      const pctA = a.manipulatedPercentage !== undefined ? a.manipulatedPercentage : a.presetPercentage;
      const pctB = b.manipulatedPercentage !== undefined ? b.manipulatedPercentage : b.presetPercentage;
      return pctB - pctA;
    });
  }, [currentQuestion]);

  const toggleRevealOption = (optionId: string) => {
    const isAlreadyRevealed = revealedIds.includes(optionId);
    let updated: string[];

    if (isAlreadyRevealed) {
      updated = revealedIds.filter((id) => id !== optionId);
    } else {
      updated = [...revealedIds, optionId];
      sfx.playFlip();

      // Check if it's #1 top option
      if (optionId === sortedOptions[0].id) {
        sfx.playDing();
        sfx.playVictory();
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
        });
      } else {
        sfx.playDing();
      }
    }

    setRevealedIds(updated);
    liveSync.saveGameState({
      ...gameState,
      revealedOptionIds: updated,
    });
  };

  const revealAll = () => {
    const allIds = sortedOptions.map((o) => o.id);
    setRevealedIds(allIds);
    liveSync.saveGameState({
      ...gameState,
      revealedOptionIds: allIds,
    });
    sfx.playVictory();
    confetti({
      particleCount: 120,
      spread: 90,
      origin: { y: 0.5 },
    });
  };

  return (
    <div className="min-h-[90vh] max-w-6xl mx-auto p-4 sm:p-6 flex flex-col justify-between space-y-6">
      {/* Stage Header Banner */}
      <div className="bg-slate-900/90 border-2 border-amber-500/40 rounded-3xl p-4 sm:p-6 shadow-2xl relative overflow-hidden backdrop-blur-xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 via-yellow-400 to-orange-500 flex items-center justify-center text-slate-950 font-black text-2xl shadow-xl shadow-amber-500/30">
              <Flame className="w-7 h-7 stroke-[2.5]" />
            </div>

            <div>
              <span className="text-xs uppercase font-extrabold tracking-widest text-amber-400">
                Stage Question • {currentQuestion.category}
              </span>
              <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-slate-100 tracking-tight leading-snug">
                {currentQuestion.title}
              </h2>
            </div>
          </div>

          {/* Stage Player & Audience Count Badge */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="bg-slate-950/80 border border-amber-500/30 px-3.5 py-2 rounded-2xl flex items-center gap-2">
              <Users className="w-4 h-4 text-cyan-400" />
              <div className="text-xs">
                <span className="text-slate-400">Audience Votes: </span>
                <span className="font-bold text-cyan-300">{submissions.length}</span>
              </div>
            </div>

            <div className="bg-amber-500/10 border border-amber-500/30 px-3.5 py-2 rounded-2xl flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-400" />
              <div className="text-xs">
                <span className="text-slate-400">Stage Guy: </span>
                <span className="font-bold text-amber-300">{gameState.stagePlayerName}</span>
              </div>
            </div>
          </div>
        </div>

        {currentQuestion.bapuCommentary && (
          <div className="mt-4 pt-3 border-t border-slate-800 flex items-center gap-2 text-xs sm:text-sm text-amber-200/90 font-medium italic">
            <span className="text-lg">📢</span>
            <span>{currentQuestion.bapuCommentary}</span>
          </div>
        )}
      </div>

      {/* Main Stage Reveal Board */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-auto">
        {sortedOptions.map((option, index) => {
          const rankNum = index + 1;
          const isRevealed = revealedIds.includes(option.id);
          const pct = option.manipulatedPercentage !== undefined ? option.manipulatedPercentage : option.presetPercentage;
          const isGodOverridden = option.manipulatedPercentage !== undefined;

          return (
            <div
              key={option.id}
              onClick={() => toggleRevealOption(option.id)}
              className={`cursor-pointer min-h-[90px] rounded-3xl border-2 transition-all transform duration-500 relative overflow-hidden shadow-2xl flex items-center justify-between p-4 sm:p-5 ${
                isRevealed
                  ? 'bg-gradient-to-r from-amber-950/90 via-slate-900 to-slate-900 border-amber-500 shadow-amber-500/20 scale-[1.01]'
                  : 'bg-slate-900/80 border-slate-800 hover:border-amber-500/50 hover:scale-[1.005]'
              }`}
            >
              {/* Left Rank Indicator */}
              <div className="flex items-center gap-4 z-10 min-w-0">
                <div
                  className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black text-base sm:text-lg shadow-lg ${
                    isRevealed
                      ? 'bg-amber-400 text-slate-950 shadow-amber-400/30'
                      : 'bg-slate-800 text-amber-400 border border-slate-700'
                  }`}
                >
                  #{rankNum}
                </div>

                {isRevealed ? (
                  <div className="space-y-0.5">
                    <h3 className="text-base sm:text-lg font-bold text-slate-100 leading-snug">
                      {option.text}
                    </h3>
                    <div className="flex items-center gap-2 text-xs text-amber-300/80">
                      <span>Points: +{option.presetPoints}</span>
                      {isGodOverridden && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-red-500/20 text-red-300 font-mono border border-red-500/30">
                          Manipulated
                        </span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-slate-400 font-semibold text-sm">
                    <HelpCircle className="w-5 h-5 text-amber-500/60 animate-pulse" />
                    <span>Click to Reveal Option #{rankNum}</span>
                  </div>
                )}
              </div>

              {/* Right Percentage Badge or Hidden Card Lock */}
              <div className="z-10 shrink-0">
                {isRevealed ? (
                  <div className="text-right">
                    <div className="text-xl sm:text-2xl font-black text-amber-400 font-mono">
                      {pct}%
                    </div>
                    <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                      Majority
                    </span>
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-500">
                    <Eye className="w-5 h-5" />
                  </div>
                )}
              </div>

              {/* Background Animated Progress Bar when Revealed */}
              {isRevealed && (
                <div
                  className="absolute bottom-0 left-0 top-0 bg-amber-500/10 transition-all duration-1000 ease-out pointer-events-none"
                  style={{ width: `${pct}%` }}
                ></div>
              )}
            </div>
          );
        })}
      </div>

      {/* Stage Host Actions */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-4 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => sfx.playBuzzer()}
            className="px-4 py-2.5 rounded-xl font-bold bg-red-500/20 border border-red-500/40 text-red-300 hover:bg-red-500/30 active:scale-95 transition flex items-center gap-1.5 text-xs sm:text-sm"
          >
            ❌ Sound Wrong Buzzer
          </button>

          <button
            onClick={() => sfx.playDing()}
            className="px-4 py-2.5 rounded-xl font-bold bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/30 active:scale-95 transition flex items-center gap-1.5 text-xs sm:text-sm"
          >
            🔔 Sound Correct Ding
          </button>

          <button
            onClick={() => sfx.playDrumroll()}
            className="px-4 py-2.5 rounded-xl font-bold bg-amber-500/20 border border-amber-500/40 text-amber-300 hover:bg-amber-500/30 active:scale-95 transition flex items-center gap-1.5 text-xs sm:text-sm"
          >
            🥁 Drumroll Suspense
          </button>
        </div>

        <button
          onClick={revealAll}
          className="px-5 py-2.5 rounded-xl font-bold bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 shadow-lg shadow-amber-500/20 hover:brightness-110 active:scale-95 transition flex items-center gap-2 text-xs sm:text-sm"
        >
          <Sparkles className="w-4 h-4" /> Reveal All Board Answers
        </button>
      </div>
    </div>
  );
};
