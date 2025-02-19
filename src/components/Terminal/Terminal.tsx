import React, { useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import './styles.css';

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
    invoke<CommandResult>('execute_terminal_command', { command: 'pwd' })
      .then(result => {
        setCurrentDir(result.current_dir);
      })
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

  const handleKeyPress = async (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      
      try {
        setIsExecuting(true);
        setAutoScroll(true); // 确保启用自动滚动
        scrollToBottom(0); // 立即滚动到底部显示输入的命令
        
        const result = await invoke<CommandResult>('execute_terminal_command', { command: input });
        const newBlock: CommandBlock = {
          id: blockId,
          command: input,
          output: [
            ...(result.stdout ? result.stdout.split('\n') : []),
            ...(result.stderr ? result.stderr.split('\n') : [])
          ].filter(line => line.length > 0),
          directory: currentDir
        };
        
        setCommandBlocks(prev => [...prev, newBlock]);
        setBlockId(prev => prev + 1);
        setCurrentDir(result.current_dir);
        setInput('');
        
        // 命令执行完成后滚动
        scrollToBottom(50);
        setIsExecuting(false);
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
        {!autoScroll && (
          <button 
            className="scroll-to-bottom"
            onClick={() => {
              setAutoScroll(true);
              scrollToBottom();
            }}
            title="Scroll to bottom"
          >
            ↓
          </button>
        )}
      </div>
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