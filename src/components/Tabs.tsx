import React, { useState } from 'react';
import { invoke } from '@tauri-apps/api/tauri';

interface Tab {
  id: string;
  name: string;
  active: boolean;
}

interface TabsProps {
  onTabChange: (tabId: string) => void;
  onAddTab: (tabId: string) => void;
  onCloseTab: (tabId: string) => void;
}

const Tabs: React.FC<TabsProps> = ({ onTabChange, onAddTab, onCloseTab }) => {
  const [tabs, setTabs] = useState<Tab[]>([
    { id: '1', name: 'Term1', active: true }
  ]);
  const [tabCounter, setTabCounter] = useState(2);

  const addTab = () => {
    const newTab = {
      id: tabCounter.toString(),
      name: `Term${tabCounter}`,
      active: false
    };
    setTabs(prev => [...prev.map(t => ({ ...t, active: false })), newTab]);
    setTabCounter(prev => prev + 1);
    onAddTab(newTab.id);
    onTabChange(newTab.id);
  };

  const switchTab = (tabId: string) => {
    setTabs(prev =>
      prev.map(tab => ({
        ...tab,
        active: tab.id === tabId
      }))
    );
    onTabChange(tabId);
  };

  const closeTab = (tabId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (tabs.length === 1) return;

    const tabIndex = tabs.findIndex(t => t.id === tabId);
    const newTabs = tabs.filter(t => t.id !== tabId);
    
    if (tabs[tabIndex].active) {
      const newActiveIndex = tabIndex === 0 ? 0 : tabIndex - 1;
      newTabs[newActiveIndex].active = true;
      onTabChange(newTabs[newActiveIndex].id);
    }
    
    setTabs(newTabs);
    onCloseTab(tabId);
  };

  return (
    <div className="tabs-container">
      <div className="tabs">
        {tabs.map(tab => (
          <div
            key={tab.id}
            className={`tab ${tab.active ? 'active' : ''}`}
            onClick={() => switchTab(tab.id)}
          >
            <span>{tab.name}</span>
            <button 
              className="close-tab"
              onClick={(e) => closeTab(tab.id, e)}
            >
              ×
            </button>
          </div>
        ))}
        <button className="new-tab" onClick={addTab}>+</button>
      </div>
    </div>
  );
};

export default Tabs; 