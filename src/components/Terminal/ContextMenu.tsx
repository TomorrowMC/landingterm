import React from 'react';
import { ContextMenuProps } from './types';
import './styles.css';

export const ContextMenu = React.forwardRef<HTMLDivElement, ContextMenuProps>(
  ({ position, onClose, onCopy, status }, ref) => {
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
  }
); 