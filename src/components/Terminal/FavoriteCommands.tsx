import React, { useState, useEffect } from 'react';
import { IconX, IconPlus, IconCopy, IconPlayerPlay } from '@tabler/icons-react';
import useFavoriteStore from '../../store/favoriteStore';
import type { FavoriteCommand } from '../../store/favoriteStore';

interface FavoriteCommandsProps {
  onSelectCommand: (command: string) => void;
  onRunCommand?: (command: string) => void;
}

export const FavoriteCommands: React.FC<FavoriteCommandsProps> = ({
  onSelectCommand,
  onRunCommand,
}) => {
  const { isOpen, commands, setIsOpen, addCommand, deleteCommand, initStore } = useFavoriteStore();
  const [newCommandName, setNewCommandName] = useState('');
  const [newCommandText, setNewCommandText] = useState('');
  const [expandedCommands, setExpandedCommands] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      try {
        await initStore();
        setIsLoading(false);
      } catch (error) {
        console.error('Error initializing store:', error);
        setIsLoading(false);
      }
    };

    init();
  }, [initStore]);

  const handleAddCommand = async () => {
    if (!newCommandName.trim() || !newCommandText.trim()) return;

    const newCommand: FavoriteCommand = {
      id: Date.now().toString(),
      name: newCommandName.trim(),
      command: newCommandText.trim(),
    };

    await addCommand(newCommand);
    setNewCommandName('');
    setNewCommandText('');
  };

  const handleDeleteCommand = async (id: string) => {
    await deleteCommand(id);
    setExpandedCommands(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const toggleCommandExpand = (id: string) => {
    setExpandedCommands(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  if (!isOpen) return null;

  return (
    <div className="favorite-commands-panel">
      <div className="favorite-commands-header">
        <h3>Favorite Commands</h3>
        <button onClick={() => setIsOpen(false).catch(console.error)} className="close-button">
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
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck="false"
            autoComplete="off"
            inputMode="text"
          />
          <input
            type="text"
            value={newCommandText}
            onChange={(e) => setNewCommandText(e.target.value)}
            placeholder="Command"
            className="command-input"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck="false"
            autoComplete="off"
            inputMode="text"
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
                onClick={() => toggleCommandExpand(cmd.id)}
              >
                <span className="command-name">{cmd.name}</span>
                <span className={`command-text ${expandedCommands.has(cmd.id) ? 'expanded' : 'collapsed'}`}>
                  {cmd.command}
                </span>
              </div>
              <div className="command-actions">
                <button
                  className="action-button paste"
                  onClick={() => onSelectCommand(cmd.command)}
                  title="Paste command"
                >
                  <IconCopy size={16} />
                </button>
                {onRunCommand && (
                  <button
                    className="action-button run"
                    onClick={() => onRunCommand(cmd.command)}
                    title="Run command"
                  >
                    <IconPlayerPlay size={16} />
                  </button>
                )}
                <button
                  className="action-button delete"
                  onClick={() => handleDeleteCommand(cmd.id)}
                  title="Delete command"
                >
                  <IconX size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}; 