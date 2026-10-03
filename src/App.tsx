import React, { useState, useEffect } from 'react';
import { GameState, Question } from './types/game';
import { liveSync } from './services/liveSync';
import { Navbar } from './components/Navbar';
import { MobileAudienceView } from './components/MobileAudienceView';
import { StageDisplayView } from './components/StageDisplayView';
import { AdminPanel } from './components/AdminPanel';

export function App() {
  const getInitialView = (): 'audience' | 'stage' | 'admin' => {
    const path = window.location.pathname.toLowerCase();
    if (path.startsWith('/admin')) return 'admin';
    if (path.startsWith('/stage')) return 'stage';
    return 'audience';
  };

  const [currentView, setCurrentView] = useState<'audience' | 'stage' | 'admin'>(getInitialView);
  const [gameState, setGameState] = useState<GameState>(liveSync.getGameState());
  const [questions, setQuestions] = useState<Question[]>(liveSync.getQuestions());

  const handleViewChange = (view: 'audience' | 'stage' | 'admin') => {
    setCurrentView(view);
    const newPath = view === 'audience' ? '/' : `/${view}`;
    window.history.pushState(null, '', newPath);
  };

  useEffect(() => {
    const onPopState = () => {
      setCurrentView(getInitialView());
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    const unsubState = liveSync.subscribeGameState(setGameState);
    const unsubQuestions = liveSync.subscribeQuestions(setQuestions);

    // Heartbeat check every 1.5s to ensure cross-device synchronization
    const heartbeat = setInterval(() => {
      setGameState(liveSync.getGameState());
      setQuestions(liveSync.getQuestions());
    }, 1500);

    return () => {
      unsubState();
      unsubQuestions();
      clearInterval(heartbeat);
    };
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-[#0b0d17] text-slate-100 font-sans selection:bg-amber-500 selection:text-slate-950">
      <Navbar
        currentView={currentView}
        onViewChange={handleViewChange}
        roomCode={gameState.roomCode}
      />

      <main className="flex-1 pb-8">
        {currentView === 'audience' && (
          <MobileAudienceView gameState={gameState} questions={questions} />
        )}

        {currentView === 'stage' && (
          <StageDisplayView gameState={gameState} questions={questions} />
        )}

        {currentView === 'admin' && (
          <AdminPanel gameState={gameState} questions={questions} />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/80 py-4 text-center text-xs text-slate-500">
        <p>Parivar Feud • Gandhi & Indian Family Dark Satire Game Show • Live Cross-Device Sync Active</p>
      </footer>
    </div>
  );
}

export default App;
