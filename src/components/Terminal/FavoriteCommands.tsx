import React, { useState, useEffect } from 'react';
import { Store } from 'tauri-plugin-store-api';
import { IconX, IconPlus } from '@tabler/icons-react';

interface FavoriteCommand {
  id: string;
  name: string;
  command: string;
}

interface FavoriteCommandsProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectCommand: (command: string) => void;
}

export const FavoriteCommands: React.FC<FavoriteCommandsProps> = ({
  isOpen,
  onClose,
  onSelectCommand,
}) => {
  const [commands, setCommands] = useState<FavoriteCommand[]>([]);
  const [newCommandName, setNewCommandName] = useState('');
  const [newCommandText, setNewCommandText] = useState('');
  const store = new Store('.settings.dat');

  useEffect(() => {
    loadCommands();
  }, []);

  const loadCommands = async () => {
    try {
      const savedCommands = await store.get<FavoriteCommand[]>('favorite_commands');
      if (savedCommands) {
        setCommands(savedCommands);
      }
    } catch (error) {
      console.error('Error loading commands:', error);
    }
  };

  const saveCommands = async (newCommands: FavoriteCommand[]) => {
    try {
      await store.set('favorite_commands', newCommands);
      await store.save();
    } catch (error) {
      console.error('Error saving commands:', error);
    }
  };

  const handleAddCommand = async () => {
    if (!newCommandName.trim() || !newCommandText.trim()) return;

    const newCommand: FavoriteCommand = {
      id: Date.now().toString(),
      name: newCommandName.trim(),
      command: newCommandText.trim(),
    };

    const updatedCommands = [...commands, newCommand];
    setCommands(updatedCommands);
    await saveCommands(updatedCommands);
    setNewCommandName('');
    setNewCommandText('');
  };

  const handleDeleteCommand = async (id: string) => {
    const updatedCommands = commands.filter(cmd => cmd.id !== id);
    setCommands(updatedCommands);
    await saveCommands(updatedCommands);
  };

  if (!isOpen) return null;

  return (
    <div className="favorite-commands-panel">
      <div className="favorite-commands-header">
        <h3>Favorite Commands</h3>
        <button onClick={onClose} className="close-button">
          <IconX size={20} />
        </button>
      </div>

      <div className="favorite-commands-content">
        <div className="add-command-section">
          <input
            type="text"
            value={newCommandName}
            onChange={(e) => setNewCommandName(e.target.value)}
            placeholder="Command name"
            className="command-input"
          />
          <input
            type="text"
            value={newCommandText}
            onChange={(e) => setNewCommandText(e.target.value)}
            placeholder="Command"
            className="command-input"
          />
          <button
            onClick={handleAddCommand}
            className="add-button"
            disabled={!newCommandName.trim() || !newCommandText.trim()}
          >
            <IconPlus size={20} />
          </button>
        </div>

        <div className="commands-list">
          {commands.map((cmd) => (
            <div key={cmd.id} className="command-item">
              <div 
                className="command-content"
                onClick={() => onSelectCommand(cmd.command)}
              >
                <span className="command-name">{cmd.name}</span>
                <span className="command-text">{cmd.command}</span>
              </div>
              <button
                onClick={() => handleDeleteCommand(cmd.id)}
                className="delete-button"
              >
                <IconX size={16} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}; 