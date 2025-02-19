import React, { useState } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import '../styles/tabs.css';

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
  const [editingTab, setEditingTab] = useState<string | null>(null);
  const [usedNames, setUsedNames] = useState<Set<string>>(new Set(['Term1']));

  const getNextAvailableName = () => {
    let counter = 1;
    let name = `Term${counter}`;
    while (usedNames.has(name)) {
      counter++;
      name = `Term${counter}`;
    }
    return name;
  };

  const addTab = () => {
    const newName = getNextAvailableName();
    const newTab = {
      id: tabCounter.toString(),
      name: newName,
      active: true
    };
    
    setTabs(prev => prev.map(t => ({ ...t, active: false })).concat(newTab));
    setTabCounter(prev => prev + 1);
    setUsedNames(prev => new Set(prev).add(newName));
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

    const closingTab = tabs.find(t => t.id === tabId);
    if (closingTab) {
      setUsedNames(prev => {
        const newSet = new Set(prev);
        newSet.delete(closingTab.name);
        return newSet;
      });
    }

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

  const handleDoubleClick = (tabId: string) => {
    setEditingTab(tabId);
  };

  const handleNameChange = (tabId: string, newName: string) => {
    const oldTab = tabs.find(t => t.id === tabId);
    if (oldTab) {
      setUsedNames(prev => {
        const newSet = new Set(prev);
        newSet.delete(oldTab.name);
        newSet.add(newName || oldTab.name);
        return newSet;
      });
    }

    setTabs(prev =>
      prev.map(tab =>
        tab.id === tabId ? { ...tab, name: newName || tab.name } : tab
      )
    );
    setEditingTab(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent, tabId: string) => {
    if (e.key === 'Enter') {
      handleNameChange(tabId, (e.target as HTMLInputElement).value);
    } else if (e.key === 'Escape') {
      setEditingTab(null);
    }
  };

  return (
    <div className="tabs-container">
      <div className="tabs">
        {tabs.map(tab => (
          <div
            key={tab.id}
            className={`tab ${tab.active ? 'active' : ''}`}
            onClick={() => switchTab(tab.id)}
            onDoubleClick={() => handleDoubleClick(tab.id)}
          >
            {editingTab === tab.id ? (
              <input
                type="text"
                defaultValue={tab.name}
                autoFocus
                onBlur={(e) => handleNameChange(tab.id, e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, tab.id)}
                onClick={(e) => e.stopPropagation()}
                className="tab-name-input"
              />
            ) : (
              <span>{tab.name}</span>
            )}
            <button 
              className="close-tab"
              onClick={(e) => closeTab(tab.id, e)}
              title="Close terminal"
            >
              ×
            </button>
          </div>
        ))}
        <button 
          className="new-tab" 
          onClick={addTab}
          title="New terminal"
        >
          +
        </button>
      </div>
    </div>
  );
};

export default Tabs; 