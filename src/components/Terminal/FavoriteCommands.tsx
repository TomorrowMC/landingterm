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
          <textarea
            value={newCommandName}
            onChange={(e) => setNewCommandName(e.target.value)}
            placeholder="Command name"
            className="command-input name-input"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck="false"
            autoComplete="off"
            rows={1}
          />
          <textarea
            value={newCommandText}
            onChange={(e) => {
              setNewCommandText(e.target.value);
              // 自动调整高度
              const textarea = e.target;
              textarea.style.height = '0px'; // 重置高度以获取正确的 scrollHeight
              const minHeight = 32; // 最小高度
              const maxHeight = 150; // 最大高度
              const scrollHeight = Math.max(textarea.scrollHeight, minHeight);
              
              if (scrollHeight > maxHeight) {
                textarea.style.height = `${maxHeight}px`;
                textarea.style.overflowY = 'auto';
              } else {
                textarea.style.height = `${scrollHeight}px`;
                textarea.style.overflowY = 'hidden';
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && e.shiftKey) {
                e.preventDefault();
                const cursorPosition = e.currentTarget.selectionStart;
                const textBeforeCursor = newCommandText.slice(0, cursorPosition);
                const textAfterCursor = newCommandText.slice(cursorPosition);
                setNewCommandText(textBeforeCursor + '\n' + textAfterCursor);
                // 在下一个事件循环中设置光标位置
                setTimeout(() => {
                  e.currentTarget.selectionStart = cursorPosition + 1;
                  e.currentTarget.selectionEnd = cursorPosition + 1;
                }, 0);
              }
            }}
            placeholder="Command"
            className="command-input command-text-input"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck="false"
            autoComplete="off"
            rows={1}
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