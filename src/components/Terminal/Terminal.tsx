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
  const [input, setInput] = useState<string>('');
  const [commandBlocks, setCommandBlocks] = useState<CommandBlock[]>([]);
  const [currentDir, setCurrentDir] = useState<string>('~');
  const [blockId, setBlockId] = useState(0);

  useEffect(() => {
    // 初始化时获取当前目录
    invoke<CommandResult>('execute_cmd', { command: 'pwd' })
      .then(result => {
        setCurrentDir(result.current_dir);
      })
      .catch(console.error);
  }, []);

  const handleKeyPress = async (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      
      try {
        const result = await invoke<CommandResult>('execute_cmd', { command: input });
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
      }
    }
  };

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [commandBlocks]);

  return (
    <div className="terminal-wrapper">
      <div className="terminal-container" ref={terminalRef}>
        <div className="terminal-blocks">
          {commandBlocks.map((block) => (
            <CommandBlockComponent key={block.id} {...block} />
          ))}
        </div>
        <div className="terminal-input-line">
          <span className="prompt">{currentDir} $ </span>
          <input
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