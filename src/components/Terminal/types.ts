export interface TerminalProps {
  id: string;
}

export interface CommandResult {
  stdout: string;
  stderr: string;
  current_dir: string;
}

export interface CommandBlock {
  id: number;
  command: string;
  output: string[];
  directory: string;
}

export interface StreamOutput {
  content: string;
  output_type: string;
  current_dir: string;
  should_replace_last: boolean;
  terminalId: string;
}

export interface ContextMenuPosition {
  x: number;
  y: number;
}

export interface ContextMenuProps {
  position: ContextMenuPosition;
  onClose: () => void;
  onCopy: () => void;
  status: string;
}

export interface CommandBlockProps extends CommandBlock {} 