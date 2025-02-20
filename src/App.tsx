import { useState, useEffect } from 'react';
import Tabs from './components/Tabs';
import { Terminal } from "./components/Terminal/Terminal";
import { setupShortcuts } from './utils/shortcuts'

interface TerminalInstance {
  id: string;
  active: boolean;
}

function App() {
  const [terminals, setTerminals] = useState<TerminalInstance[]>([
    { id: '1', active: true }
  ]);

  const handleTabChange = (tabId: string) => {
    setTerminals(prev => prev.map(term => ({
      ...term,
      active: term.id === tabId
    })));
  };

  const handleAddTab = (tabId: string) => {
    setTerminals(prev => [...prev, { id: tabId, active: true }]);
  };

  const handleCloseTab = (tabId: string) => {
    setTerminals(prev => {
      const newTerminals = prev.filter(term => term.id !== tabId);
      if (prev.find(term => term.id === tabId)?.active && newTerminals.length > 0) {
        newTerminals[newTerminals.length - 1].active = true;
      }
      return newTerminals;
    });
  };

  useEffect(() => {
    const cleanup = setupShortcuts()
    return cleanup
  }, [])

  return (
    <div className="app">
      <div className="titlebar" data-tauri-drag-region>
        <Tabs 
          onTabChange={handleTabChange} 
          onAddTab={handleAddTab}
          onCloseTab={handleCloseTab}
        />
      </div>
      <div className="terminals-container">
        {terminals.map(term => (
          <div 
            key={term.id}
            className={`flex-1 ${term.active ? 'flex' : 'hidden'}`}
          >
            <Terminal id={term.id} />
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;
