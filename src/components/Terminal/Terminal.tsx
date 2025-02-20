import React, { useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { listen } from '@tauri-apps/api/event';
import { writeText } from '@tauri-apps/api/clipboard';
import './styles.css';
import { IconChevronDown, IconStar, IconPlayerStop } from '@tabler/icons-react';
import { CommandBlock } from './CommandBlock';
import { FavoriteCommands } from './FavoriteCommands';
import { TerminalProps, CommandBlock as CommandBlockType, StreamOutput, ContextMenuPosition } from './types';
import useFavoriteStore from '../../store/favoriteStore';

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
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [input, setInput] = useState<string>('');
  const [commandBlocks, setCommandBlocks] = useState<CommandBlockType[]>([]);
  const [currentDir, setCurrentDir] = useState<string>('~');
  const [blockId, setBlockId] = useState(0);
  const [autoScroll, setAutoScroll] = useState(true);
  const scrollTimeout = useRef<NodeJS.Timeout>();
  const [isExecuting, setIsExecuting] = useState(false);
  const [currentCommandBlock, setCurrentCommandBlock] = useState<CommandBlockType | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const { isOpen, setIsOpen } = useFavoriteStore();
  const [inputHeight, setInputHeight] = useState(0);

  const adjustTextareaHeight = () => {
    const textarea = inputRef.current;
    if (textarea) {
      const previousHeight = textarea.style.height;
      textarea.style.height = 'auto';
      
      // 如果内容高度超过最大高度，启用滚动
      if (textarea.scrollHeight > 150) {
        textarea.style.height = '150px';
        textarea.style.overflowY = 'auto';
        // 滚动到光标位置
        const cursorPosition = textarea.selectionStart;
        requestAnimationFrame(() => {
          // 临时设置高度以获取正确的光标位置
          textarea.style.height = 'auto';
          const cursorY = textarea.scrollHeight;
          textarea.style.height = '150px';
          
          // 确保光标可见
          if (cursorPosition === textarea.value.length) {
            // 如果光标在末尾，滚动到底部
            textarea.scrollTop = textarea.scrollHeight;
          } else {
            // 否则滚动到光标位置
            const lineHeight = parseInt(getComputedStyle(textarea).lineHeight);
            const approximateLines = cursorPosition / 50; // 假设平均每行50个字符
            const scrollPosition = Math.max(0, (approximateLines * lineHeight) - 75);
            textarea.scrollTop = scrollPosition;
          }
        });
      } else {
        textarea.style.height = `${textarea.scrollHeight}px`;
        textarea.style.overflowY = 'hidden';
      }
      
      // 计算整个输入区域的高度（包括padding和border）
      const inputContainer = textarea.closest('.terminal-input-line');
      if (inputContainer) {
        const totalHeight = inputContainer.getBoundingClientRect().height;
        const newInputHeight = totalHeight + 32; // 32px for bottom margin
        setInputHeight(newInputHeight);

        // 更新scroll-to-bottom按钮的位置
        document.documentElement.style.setProperty('--input-offset', `${newInputHeight + 16}px`);

        // 如果高度发生变化，自动滚动到底部
        if (previousHeight !== textarea.style.height) {
          scrollToBottom(0);
        }
      }
    }
  };

  const scrollToBottom = (delay: number = 0) => {
    setTimeout(() => {
      const terminal = terminalRef.current;
      if (terminal) {
        const newScrollTop = terminal.scrollHeight - terminal.clientHeight;
        terminal.scrollTo({
          top: newScrollTop,
          behavior: delay > 0 ? 'smooth' : 'auto'  // 立即滚动时不使用平滑效果
        });
      }
    }, delay);
  };

  // 监听输入变化
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
  };

  useEffect(() => {
    adjustTextareaHeight();
  }, [input]);

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
    adjustTextareaHeight();
  }, [input]);

  const handleKeyPress = async (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (e.shiftKey) {
        // 换行时立即调整高度并滚动
        requestAnimationFrame(() => {
          adjustTextareaHeight();
          scrollToBottom(0);
        });
      } else {
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
    }
  };

  const handleSelectFavoriteCommand = (command: string) => {
    setInput(command);
    inputRef.current?.focus();
  };

  const handleRunFavoriteCommand = async (command: string) => {
    if (isExecuting) return; // 防止命令重复执行
    
    try {
      setIsExecuting(true);
      setAutoScroll(true);
      scrollToBottom(0);

      const newBlock: CommandBlockType = {
        id: blockId,
        command: command,
        output: [],
        directory: currentDir
      };
      
      setCommandBlocks(prev => [...prev, newBlock]);
      setCurrentCommandBlock(newBlock);
      setBlockId(prev => prev + 1);

      await invoke('execute_command_stream', { 
        command,
        terminalId: id
      });
    } catch (error) {
      const errorBlock: CommandBlockType = {
        id: blockId,
        command: command,
        output: [`Error: ${error}`],
        directory: currentDir
      };
      setCommandBlocks(prev => [...prev, errorBlock]);
      setBlockId(prev => prev + 1);
      setIsExecuting(false);
      setCurrentCommandBlock(null);
      scrollToBottom(50);
    }
  };

  const handleStopCommand = async () => {
    if (!isExecuting) return;
    try {
      await invoke('stop_command', { terminalId: id });
      setIsExecuting(false);
      setCurrentCommandBlock(null);
    } catch (error) {
      console.error('Failed to stop command:', error);
    }
  };

  // 修改 ESC 键处理
  useEffect(() => {
    const handleEscKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false).catch(console.error);
      }
    };

    document.addEventListener('keydown', handleEscKey);
    return () => {
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [isOpen, setIsOpen]);

  // 组件卸载时清理CSS变量
  useEffect(() => {
    return () => {
      document.documentElement.style.removeProperty('--input-offset');
    };
  }, []);

  return (
    <div className="terminal-wrapper">
      <div className={`terminal-main-content ${isOpen ? 'with-panel' : ''}`}>
        <div className="terminal-scroll-container" ref={terminalRef}>
          <div className="terminal-content" style={{ paddingBottom: `${inputHeight}px` }}>
            <div className="terminal-blocks">
              {commandBlocks.map((block) => (
                <CommandBlock key={block.id} {...block} />
              ))}
            </div>
          </div>
        </div>
        {!autoScroll && (
          <button 
            className={`scroll-to-bottom ${!autoScroll ? 'visible' : ''} ${isOpen ? 'with-panel' : ''}`}
            onClick={() => {
              setAutoScroll(true);
              scrollToBottom();
            }}
            title="Scroll to bottom"
          >
            <IconChevronDown size={16} />
          </button>
        )}
        <div className={`terminal-input-container ${isOpen ? 'with-panel' : ''}`}>
          <div className="terminal-input-line">
            <div className="terminal-input-main">
              <span className="prompt">{currentDir} $ </span>
              <textarea
                ref={inputRef}
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyPress}
                className="terminal-input"
                autoFocus
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck="false"
                autoComplete="off"
                rows={1}
              />
            </div>
            <div className="terminal-input-tools">
              {isExecuting && (
                <button
                  className="terminal-icon-button stop"
                  onClick={handleStopCommand}
                  title="Stop current command"
                >
                  <IconPlayerStop size={16} />
                </button>
              )}
              <button
                className={`terminal-icon-button ${isOpen ? 'active' : ''}`}
                onClick={() => {
                  setIsOpen(!isOpen)
                    .catch(error => console.error('Failed to toggle favorite commands panel:', error));
                }}
                title={isOpen ? "Close Favorite Commands" : "Open Favorite Commands"}
              >
                <IconStar size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>
      <FavoriteCommands
        onSelectCommand={handleSelectFavoriteCommand}
        onRunCommand={handleRunFavoriteCommand}
      />
    </div>
  );
};