import React, { useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { writeText } from '@tauri-apps/api/clipboard';
import './styles.css';
import { IconChevronDown } from '@tabler/icons-react';

interface TerminalProps {
  id: string;
}

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

interface StreamOutput {
  content: string;
  output_type: string;
  current_dir: string;
  should_replace_last: boolean;
}

interface ContextMenuPosition {
  x: number;
  y: number;
}

const ContextMenu: React.FC<{
  position: ContextMenuPosition;
  onClose: () => void;
  onCopy: () => void;
  status: string;
}> = ({ position, onClose, onCopy, status }) => {
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      e.preventDefault();
      onClose();
    };
    
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [onClose]);

  return (
    <div 
      className="terminal-context-menu"
      style={{ 
        left: position.x,
        top: position.y
      }}
      onClick={(e) => e.stopPropagation()}
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
};

const CommandBlockComponent: React.FC<CommandBlock> = ({ command, output, directory }) => {
  const [contextMenu, setContextMenu] = useState<ContextMenuPosition | null>(null);
  const [copyStatus, setCopyStatus] = useState<string>('');
  const [selectedText, setSelectedText] = useState<string>('');

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const selection = window.getSelection();
    const text = selection?.toString() || '';
    if (text) {
      setSelectedText(text);
      setContextMenu({ x: e.clientX, y: e.clientY });
      setCopyStatus('');
      console.log('Selected text:', text); // Debug log
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    const selection = window.getSelection();
    const text = selection?.toString() || '';
    if (text) {
      setSelectedText(text);
      console.log('Updated selected text:', text); // Debug log
    }
  };

  const handleCopy = async () => {
    try {
      if (!selectedText) {
        console.error('No text selected');
        return;
      }

      console.log('Copying text:', selectedText); // Debug log
      await writeText(selectedText);
      console.log('Text copied successfully');
      
      setCopyStatus('Copied!');
      
      setTimeout(() => {
        setCopyStatus('');
      }, 3000);

    } catch (error) {
      console.error('Failed to copy text:', error);
      setCopyStatus('Copy failed');
    } finally {
      setTimeout(() => {
        setContextMenu(null);
      }, 500);
    }
  };

  return (
    <div 
      className="command-block" 
      onContextMenu={handleContextMenu}
      onMouseUp={handleMouseUp}
      onMouseDown={(e) => {
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

export const Terminal: React.FC<TerminalProps> = ({ id }) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [input, setInput] = useState<string>('');
  const [commandBlocks, setCommandBlocks] = useState<CommandBlock[]>([]);
  const [currentDir, setCurrentDir] = useState<string>('~');
  const [blockId, setBlockId] = useState(0);
  const [autoScroll, setAutoScroll] = useState(true);
  const isUserScrolling = useRef(false);
  const scrollTimeout = useRef<NodeJS.Timeout>();
  const [isExecuting, setIsExecuting] = useState(false);
  const lastOutputRef = useRef<string>('');
  const [currentCommandBlock, setCurrentCommandBlock] = useState<CommandBlock | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);

  // 简化的滚动到底部函数
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

  // 监听滚动事件
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

  // 监听命令块变化
  useEffect(() => {
    if (commandBlocks.length > 0) {
      scrollToBottom(50);
    }
  }, [commandBlocks]);

  // 初始化终端
  useEffect(() => {
    // 使用新的流式命令来获取当前目录
    invoke('execute_command_stream', { command: 'pwd' })
      .catch(console.error);

    invoke('create_terminal', { id });
    return () => {
      invoke('close_terminal', { id });
    };
  }, [id]);

  // 修改确保终端获得焦点的处理器
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      // 如果用户正在选择文本，不要重新聚焦到输入框
      if (!isSelecting && !window.getSelection()?.toString()) {
        inputRef.current?.focus();
      }
    };
    
    const handleMouseDown = () => {
      setIsSelecting(true);
    };

    const handleMouseUp = () => {
      // 延迟重置选择状态，以确保上下文菜单可以正确显示
      setTimeout(() => {
        setIsSelecting(false);
      }, 0);
    };
    
    document.addEventListener('click', handleClick);
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      document.removeEventListener('click', handleClick);
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isSelecting]);

  useEffect(() => {
    const setupListeners = async () => {
      const unlisten = await listen<StreamOutput>('terminal-output', (event) => {
        const { content, output_type, current_dir, should_replace_last } = event.payload;
        
        setCurrentDir(current_dir);

        if (currentCommandBlock) {
          setCommandBlocks(prev => {
            const newBlocks = [...prev];
            const lastBlock = newBlocks[newBlocks.length - 1];
            
            if (content) {
              if (should_replace_last && lastBlock.output.length > 0) {
                // 如果需要替换最后一行（处理\r的情况）
                lastBlock.output[lastBlock.output.length - 1] = content;
              } else {
                lastBlock.output.push(content);
              }
            }
            
            return newBlocks;
          });
        }
      });

      const unlistenComplete = await listen<number | null>('terminal-command-complete', () => {
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
  }, [currentCommandBlock]);

  const handleKeyPress = async (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      
      try {
        setIsExecuting(true);
        setAutoScroll(true);
        scrollToBottom(0);

        // Create a new command block
        const newBlock: CommandBlock = {
          id: blockId,
          command: input,
          output: [],
          directory: currentDir
        };
        
        setCommandBlocks(prev => [...prev, newBlock]);
        setCurrentCommandBlock(newBlock);
        setBlockId(prev => prev + 1);
        setInput('');

        // Execute the command with streaming
        await invoke('execute_command_stream', { command: input });
      } catch (error) {
        const errorBlock: CommandBlock = {
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

  return (
    <div className="terminal-wrapper">
      <div className="terminal-scroll-container" ref={terminalRef}>
        <div className="terminal-content">
          <div className="terminal-blocks">
            {commandBlocks.map((block) => (
              <CommandBlockComponent key={block.id} {...block} />
            ))}
          </div>
        </div>
      </div>
      {!autoScroll && (
        <button 
          className={`scroll-to-bottom ${!autoScroll ? 'visible' : ''}`}
          onClick={() => {
            setAutoScroll(true);
            scrollToBottom();
          }}
          title="Scroll to bottom"
        >
          ▼
        </button>
      )}
      <div className="terminal-input-container">
        <div className="terminal-input-line">
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
      </div>
    </div>
  );
}; 