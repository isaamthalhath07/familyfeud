import React, { useState } from 'react';
import type { GameState, Question } from '../../types/game';
import { deleteQuestion, saveQuestion } from '../../lib/gameActions';
import { Flame, Plus, Trash2, Pencil, X } from 'lucide-react';

const newId = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
const MIN_OPTIONS = 2;
const MAX_OPTIONS = 8;

interface Draft {
  id: string | null; // null = new question
  title: string;
  category: string;
  trivia: string;
  commentary: string;
  options: { id: string | null; text: string }[];
}

const emptyDraft = (): Draft => ({
  id: null,
  title: '',
  category: 'Gandhi Special',
  trivia: '',
  commentary: '',
  options: Array.from({ length: 5 }, () => ({ id: null, text: '' })),
});

const draftFrom = (q: Question): Draft => ({
  id: q.id,
  title: q.title,
  category: q.category,
  trivia: q.darkHumorTrivia ?? '',
  commentary: q.bapuCommentary ?? '',
  options: q.options.map((o) => ({ id: o.id, text: o.text })),
});

const inputCls = 'w-full bg-slate-900 border border-slate-700 rounded-xl py-2 px-3 text-xs text-amber-100 outline-none focus:border-amber-500';

export const QuestionBank: React.FC<{ questions: Question[]; state: GameState; onBroadcast: (id: string) => void }> = ({ questions, state, onBroadcast }) => {
  const [draft, setDraft] = useState<Draft | null>(null);

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft || !draft.title.trim()) return;
    const existing = questions.find((q) => q.id === draft.id);
    const texts = draft.options.map((o, i) => o.text.trim() || `Option ${i + 1}`);
    const question: Question = {
      id: draft.id ?? newId('q'),
      title: draft.title.trim(),
      category: draft.category.trim() || 'Gandhi Special',
      darkHumorTrivia: draft.trivia.trim() || undefined,
      bapuCommentary: draft.commentary.trim() || undefined,
      options: draft.options.map((o, i) => {
        // Editing keeps option ids, so votes already cast still count.
        const prev = existing?.options.find((x) => x.id === o.id);
        return prev
          ? { ...prev, text: texts[i] }
          : { id: newId('opt'), text: texts[i], presetPercentage: Math.max(5, 40 - i * 8), presetPoints: 20 };
      }),
    };
    saveQuestion(question);
    setDraft(null);
  };

  const setOption = (i: number, text: string) => setDraft((d) => d && { ...d, options: d.options.map((o, j) => (j === i ? { ...o, text } : o)) });

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="font-bold text-base text-slate-100 flex items-center gap-2">
          <Flame className="w-5 h-5 text-amber-400" /> Question Bank ({questions.length})
        </h3>
        <button
          id="admin-toggle-add-question"
          onClick={() => setDraft(draft ? null : emptyDraft())}
          className="px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500/20 border border-amber-500/40 text-amber-300 hover:bg-amber-500/30 transition flex items-center gap-1"
        >
          {draft ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />} {draft ? 'Cancel' : 'Add Question'}
        </button>
      </div>

      {draft && (
        <form onSubmit={save} className="bg-slate-950 p-4 rounded-2xl border border-amber-500/30 space-y-3">
          <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider">{draft.id ? 'Edit Question' : 'New Question'}</h4>
          <input type="text" required placeholder="Question (e.g. Rank what Bapu would say about…)" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} className={inputCls} />
          <input type="text" placeholder="Category (e.g. Gandhi Special)" value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} className={inputCls} />
          <input type="text" placeholder="Satire note shown on phones (optional)" value={draft.trivia} onChange={(e) => setDraft({ ...draft, trivia: e.target.value })} className={inputCls} />
          <input type="text" placeholder="Bapu commentary shown on stage (optional)" value={draft.commentary} onChange={(e) => setDraft({ ...draft, commentary: e.target.value })} className={inputCls} />

          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-slate-400">
              Answer options ({MIN_OPTIONS}–{MAX_OPTIONS}). Order doesn't matter — the crowd decides the ranking.
            </label>
            {draft.options.map((opt, i) => (
              <div key={i} className="flex gap-1.5">
                <input type="text" placeholder={`Option ${i + 1}`} value={opt.text} onChange={(e) => setOption(i, e.target.value)} className={inputCls} />
                {draft.options.length > MIN_OPTIONS && (
                  <button
                    type="button"
                    aria-label="Remove option"
                    onClick={() => setDraft({ ...draft, options: draft.options.filter((_, j) => j !== i) })}
                    className="px-2 rounded-lg text-slate-500 hover:text-red-400"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
            {draft.options.length < MAX_OPTIONS && (
              <button type="button" onClick={() => setDraft({ ...draft, options: [...draft.options, { id: null, text: '' }] })} className="text-[11px] font-semibold text-amber-300">
                + Add option
              </button>
            )}
          </div>

          <button type="submit" className="w-full py-2.5 rounded-xl font-bold text-xs bg-amber-500 text-slate-950 hover:brightness-110">
            {draft.id ? 'Save Changes' : 'Save Question To Bank'}
          </button>
        </form>
      )}

      <div className="space-y-2">
        {questions.map((q, i) => {
          const isActive = q.id === state.currentQuestionId;
          const done = q.options.every((o) => (state.revealed[q.id] ?? []).includes(o.id));
          return (
            <div
              key={q.id}
              className={`p-3.5 rounded-2xl border transition flex items-center justify-between gap-3 ${
                isActive ? 'bg-amber-500/10 border-amber-500 text-amber-200' : 'bg-slate-950 border-slate-800 text-slate-300'
              }`}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-black text-slate-500">Q{i + 1}</span>
                  <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-slate-800 text-amber-400 border border-slate-700">{q.category}</span>
                  {isActive && <span className="text-[10px] font-bold text-emerald-400">● LIVE</span>}
                  {done && <span className="text-[10px] font-bold text-cyan-300">✓ revealed</span>}
                </div>
                <p className="text-xs font-bold mt-1 leading-snug">{q.title}</p>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {!isActive && (
                  <button
                    id={`broadcast-${q.id}`}
                    onClick={() => onBroadcast(q.id)}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500 text-slate-950 hover:brightness-110"
                  >
                    Broadcast
                  </button>
                )}
                <button aria-label="Edit question" onClick={() => setDraft(draftFrom(q))} className="p-1.5 text-slate-500 hover:text-amber-300 rounded-lg">
                  <Pencil className="w-4 h-4" />
                </button>
                {questions.length > 1 && (
                  <button
                    aria-label="Delete question"
                    onClick={() => {
                      if (confirm(`Delete "${q.title}"? Points earned on it are removed too.`)) deleteQuestion(q.id);
                    }}
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
  );
};
