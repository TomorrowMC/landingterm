import React, { useEffect, useRef, useState } from 'react';
import { writeText } from '@tauri-apps/api/clipboard';
import { CommandBlockProps, ContextMenuPosition } from './types';
import { ContextMenu } from './ContextMenu';
import './styles.css';

export const CommandBlock: React.FC<CommandBlockProps> = ({ command, output, directory }) => {
  const [contextMenu, setContextMenu] = useState<ContextMenuPosition | null>(null);
  const [copyStatus, setCopyStatus] = useState<string>('');
  const [selectedText, setSelectedText] = useState<string>('');
  const menuRef = useRef<HTMLDivElement>(null);

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

  const handleCopy = async () => {
    try {
      if (!selectedText) {
        console.error('No text selected');
        return;
      }
      await writeText(selectedText);
      setCopyStatus('Copied!');
      
      setTimeout(() => {
        setCopyStatus('');
      }, 3000);

    } catch (error) {
      console.error('Failed to copy text:', error);
      setCopyStatus('Copy failed');
    }
  };

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