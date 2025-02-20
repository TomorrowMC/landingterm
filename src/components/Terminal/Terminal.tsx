import React, { useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
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
}

const CommandBlockComponent: React.FC<CommandBlock> = ({ command, output, directory }) => (
  <div className="command-block">
    <div className="command-input">
      <span className="prompt">{directory} $ </span>
      <span className="command-text">{command}</span>
    </div>
    {output.length > 0 && (
      <div className="command-output">
        {output.map((line, index) => (
          <div key={index} className="output-line">{line}</div>
        ))}
      </div>
    )}
  </div>
);

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

  // 确保终端始终获得焦点
  useEffect(() => {
    const handleClick = () => {
      inputRef.current?.focus();
    };
    
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  useEffect(() => {
    const setupListeners = async () => {
      const unlisten = await listen<StreamOutput>('terminal-output', (event) => {
        const { content, output_type, current_dir } = event.payload;
        
        setCurrentDir(current_dir);

        if (currentCommandBlock) {
          setCommandBlocks(prev => {
            const newBlocks = [...prev];
            const lastBlock = newBlocks[newBlocks.length - 1];
            
            if (content) {
              lastBlock.output.push(content);
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