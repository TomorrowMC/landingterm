import React, { useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { listen } from '@tauri-apps/api/event';
import { writeText } from '@tauri-apps/api/clipboard';
import './styles.css';
import { IconChevronDown, IconStar } from '@tabler/icons-react';
import { CommandBlock } from './CommandBlock';
import { FavoriteCommands } from './FavoriteCommands';
import { TerminalProps, CommandBlock as CommandBlockType, StreamOutput, ContextMenuPosition } from './types';

interface CommandResult {
  stdout: string;
  stderr: string;
  current_dir: string;
}

interface CommandBlock {
  id: number;
  command: string;
  output: string[];
  directory: string;
}

// ------------------ 右键菜单组件 ------------------
const ContextMenu = React.forwardRef<HTMLDivElement, {
  position: ContextMenuPosition;
  onClose: () => void;
  onCopy: () => void;
  status: string;
}>(({ position, onClose, onCopy, status }, ref) => {
  return (
    <div 
      ref={ref}
      className="terminal-context-menu"
      style={{ 
        left: position.x,
        top: position.y
      }}
    >
      <div 
        className="terminal-context-menu-item"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onCopy();
        }}
      >
        Copy {status && <span className="copy-status">{status}</span>}
      </div>
    </div>
  );
});

// ------------------ 命令块组件 ------------------
const CommandBlockComponent: React.FC<CommandBlock> = ({ command, output, directory }) => {
  const [contextMenu, setContextMenu] = useState<ContextMenuPosition | null>(null);
  const [copyStatus, setCopyStatus] = useState<string>('');
  const [selectedText, setSelectedText] = useState<string>('');
  const menuRef = useRef<HTMLDivElement>(null);

  // 右键菜单事件
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const selection = window.getSelection();
    const text = selection?.toString() || '';
    if (text) {
      setSelectedText(text);
      setContextMenu({ x: e.clientX, y: e.clientY });
      setCopyStatus('');
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    const selection = window.getSelection();
    const text = selection?.toString() || '';
    if (text) {
      setSelectedText(text);
    }
  };

  // 执行复制
  const handleCopy = async () => {
    try {
      if (!selectedText) {
        console.error('No text selected');
        return;
      }
      await writeText(selectedText);
      setCopyStatus('Copied!');
      
      // 3秒后清除状态
      setTimeout(() => {
        setCopyStatus('');
      }, 3000);

    } catch (error) {
      console.error('Failed to copy text:', error);
      setCopyStatus('Copy failed');
    }
  };

  // 点击外部关闭菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setContextMenu(null);
        setSelectedText('');
      }
    };

    if (contextMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [contextMenu]);

  return (
    <div 
      className="command-block" 
      onContextMenu={handleContextMenu}
      onMouseUp={handleMouseUp}
      onMouseDown={(e) => {
        // 阻止默认右键菜单
        if (e.button === 2) {
          e.preventDefault();
          e.stopPropagation();
        }
      }}
    >
      <div className="command-input">
        <span className="prompt">{directory} $ </span>
        <span className="command-text">{command}</span>
      </div>

      {output.length > 0 && (
        <div className="command-output">
          {output.map((line, index) => (
            <div 
              key={index} 
              className="output-line"
              onMouseUp={handleMouseUp}
            >
              {line}
            </div>
          ))}
        </div>
      )}

      {contextMenu && (
        <ContextMenu
          ref={menuRef}
          position={contextMenu}
          onClose={() => {
            setContextMenu(null);
            setSelectedText('');
          }}
          onCopy={handleCopy}
          status={copyStatus}
        />
      )}
    </div>
  );
};

// ------------------ 主终端组件 ------------------
export const Terminal: React.FC<TerminalProps> = ({ id }) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [input, setInput] = useState<string>('');
  const [commandBlocks, setCommandBlocks] = useState<CommandBlockType[]>([]);
  const [currentDir, setCurrentDir] = useState<string>('~');
  const [blockId, setBlockId] = useState(0);
  const [autoScroll, setAutoScroll] = useState(true);
  const scrollTimeout = useRef<NodeJS.Timeout>();
  const [isExecuting, setIsExecuting] = useState(false);
  const [currentCommandBlock, setCurrentCommandBlock] = useState<CommandBlockType | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [isFavoritesOpen, setIsFavoritesOpen] = useState(false);

  const scrollToBottom = (delay: number = 0) => {
    setTimeout(() => {
      const terminal = terminalRef.current;
      if (terminal) {
        terminal.scrollTo({
          top: terminal.scrollHeight,
          behavior: 'smooth'
        });
      }
    }, delay);
  };

  useEffect(() => {
    const terminal = terminalRef.current;
    if (!terminal) return;

    const handleScroll = () => {
      if (scrollTimeout.current) {
        clearTimeout(scrollTimeout.current);
      }
      const isNearBottom = 
        terminal.scrollHeight - terminal.scrollTop - terminal.clientHeight < 20;
      setAutoScroll(isNearBottom);
    };

    terminal.addEventListener('scroll', handleScroll);
    return () => terminal.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (commandBlocks.length > 0) {
      scrollToBottom(50);
    }
  }, [commandBlocks]);

  useEffect(() => {
    invoke('execute_command_stream', { 
      command: 'pwd',
      terminal_id: id
    }).catch(console.error);

    invoke('create_terminal', { id });
    return () => {
      invoke('close_terminal', { id });
    };
  }, [id]);

  useEffect(() => {
    const handleMouseDown = () => {
      setIsSelecting(true);
    };

    const handleMouseUp = () => {
      setTimeout(() => {
        setIsSelecting(false);
      }, 0);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // 如果用户正在选择文本，不要自动聚焦
      if (isSelecting) return;
      
      // 如果用户按下的是功能键或组合键，不要自动聚焦
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      
      // 忽略一些特殊键
      const ignoredKeys = [
        'Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 
        'Escape', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
        'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12'
      ];
      
      if (ignoredKeys.includes(e.key)) return;

      // 检查当前是否有多个输入框
      const inputElements = document.querySelectorAll('input[type="text"]');
      if (inputElements.length > 1) return;

      // 如果当前焦点是在可编辑元素上，不要改变焦点
      const activeElement = document.activeElement;
      if (
        activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement ||
        (activeElement instanceof HTMLElement && activeElement.isContentEditable)
      ) {
        if (activeElement !== inputRef.current) return;
      }

      // 聚焦到输入框
      inputRef.current?.focus();
    };
    
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('keydown', handleKeyDown);
    
    // 组件挂载时，只有在没有其他输入框的情况下才自动聚焦
    const inputElements = document.querySelectorAll('input[type="text"]');
    if (inputElements.length === 1) {
      inputRef.current?.focus();
    }
    
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isSelecting]);

  useEffect(() => {
    const setupListeners = async () => {
      const unlisten = await listen<StreamOutput>('terminal-output', (event) => {
        const { content, current_dir, should_replace_last, terminalId } = event.payload;
        
        if (terminalId !== id) return;

        setCurrentDir(current_dir);

        if (currentCommandBlock && content) {
          setCommandBlocks(prev => {
            const newBlocks = [...prev];
            const lastBlock = newBlocks[newBlocks.length - 1];

            const spinnerRegex = /[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]/g;
            const sanitizedCurrent = content.replace(spinnerRegex, '');

            const lastOutputIndex = lastBlock.output.length - 1;
            const lastLine = lastOutputIndex >= 0 ? lastBlock.output[lastOutputIndex] : '';
            const sanitizedLast = lastLine.replace(spinnerRegex, '');

            const doReplace = (sanitizedCurrent === sanitizedLast) || should_replace_last;

            if (doReplace && lastBlock.output.length > 0) {
              lastBlock.output[lastBlock.output.length - 1] = content;
            } else {
              lastBlock.output.push(content);
            }
            return newBlocks;
          });
        }
      });

      const unlistenComplete = await listen<{ terminalId: string }>('terminal-command-complete', (event) => {
        if (event.payload.terminalId !== id) return;
        setCurrentCommandBlock(null);
        setIsExecuting(false);
        scrollToBottom(50);
      });

      return () => {
        unlisten();
        unlistenComplete();
      };
    };

    setupListeners();
  }, [currentCommandBlock, id]);

  const handleKeyPress = async (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      try {
        setIsExecuting(true);
        setAutoScroll(true);
        scrollToBottom(0);

        const newBlock: CommandBlockType = {
          id: blockId,
          command: input,
          output: [],
          directory: currentDir
        };
        
        setCommandBlocks(prev => [...prev, newBlock]);
        setCurrentCommandBlock(newBlock);
        setBlockId(prev => prev + 1);
        const cmdToRun = input; 
        setInput('');

        await invoke('execute_command_stream', { 
          command: cmdToRun,
          terminalId: id
        });
      } catch (error) {
        const errorBlock: CommandBlockType = {
          id: blockId,
          command: input,
          output: [`Error: ${error}`],
          directory: currentDir
        };
        setCommandBlocks(prev => [...prev, errorBlock]);
        setBlockId(prev => prev + 1);
        setInput('');
        setIsExecuting(false);
        setCurrentCommandBlock(null);
        scrollToBottom(50);
      }
    }
  };

  const handleSelectFavoriteCommand = (command: string) => {
    setInput(command);
    setIsFavoritesOpen(false);
    inputRef.current?.focus();
  };

  // Add useEffect for Esc key handling
  useEffect(() => {
    const handleEscKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFavoritesOpen) {
        setIsFavoritesOpen(false);
      }
    };

    document.addEventListener('keydown', handleEscKey);
    return () => {
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [isFavoritesOpen]);

  return (
    <div className="terminal-wrapper">
      <div className={`terminal-main-content ${isFavoritesOpen ? 'with-panel' : ''}`}>
        <div className="terminal-scroll-container" ref={terminalRef}>
          <div className="terminal-content">
            <div className="terminal-blocks">
              {commandBlocks.map((block) => (
                <CommandBlock key={block.id} {...block} />
              ))}
            </div>
          </div>
        </div>
        {!autoScroll && (
          <button 
            className={`scroll-to-bottom ${!autoScroll ? 'visible' : ''} ${isFavoritesOpen ? 'with-panel' : ''}`}
            onClick={() => {
              setAutoScroll(true);
              scrollToBottom();
            }}
            title="Scroll to bottom"
          >
            <IconChevronDown size={16} />
          </button>
        )}
        <div className={`terminal-input-container ${isFavoritesOpen ? 'with-panel' : ''}`}>
          <div className="terminal-input-line">
            <div className="terminal-input-main">
              <span className="prompt">{currentDir} $ </span>
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                className="terminal-input"
                autoFocus
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck="false"
                autoComplete="off"
              />
            </div>
            <div className="terminal-input-tools">
              <button
                className={`terminal-icon-button ${isFavoritesOpen ? 'active' : ''}`}
                onClick={() => setIsFavoritesOpen(!isFavoritesOpen)}
                title={isFavoritesOpen ? "Close Favorite Commands" : "Open Favorite Commands"}
              >
                <IconStar size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>
      <FavoriteCommands
        isOpen={isFavoritesOpen}
        onClose={() => setIsFavoritesOpen(false)}
        onSelectCommand={handleSelectFavoriteCommand}
      />
    </div>
  );
};