import { useEffect, useState } from 'react';
import { Navbar } from './components/Navbar';
import { MobileAudienceView } from './components/MobileAudienceView';
import { StageDisplayView } from './components/StageDisplayView';
import { AdminPanel } from './components/AdminPanel';
import { useLiveGame } from './hooks/useLiveGame';

type View = 'audience' | 'stage' | 'admin';

const viewFromPath = (): View => {
  const path = window.location.pathname.toLowerCase();
  if (path.startsWith('/admin')) return 'admin';
  if (path.startsWith('/stage')) return 'stage';
  return 'audience';
};

export function App() {
  const [view, setView] = useState<View>(viewFromPath);
  const live = useLiveGame();

  useEffect(() => {
    const onPop = () => setView(viewFromPath());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    document.title =
      view === 'admin' ? 'Parivar Feud • Host Control' : view === 'stage' ? 'Parivar Feud • Stage' : 'Parivar Feud • Play Live';
  }, [view]);

  return (
    <div className="min-h-screen flex flex-col bg-[#0b0d17] text-slate-100 font-sans selection:bg-amber-500 selection:text-slate-950">
      <Navbar
        currentView={view}
        roomCode={live.state.roomCode}
        connectedBrokers={live.connectedBrokers}
        totalBrokers={live.totalBrokers}
      />

      <main className="flex-1 pb-8">
        {view === 'audience' && <MobileAudienceView live={live} />}
        {view === 'stage' && <StageDisplayView live={live} />}
        {view === 'admin' && <AdminPanel live={live} />}
      </main>

      <footer className="border-t border-slate-900 bg-slate-950/80 py-4 text-center text-xs text-slate-500">
        <p>Parivar Feud • Gandhi & Indian Family Dark Satire Game Show</p>
      </footer>
    </div>
  );
}

export default App;
