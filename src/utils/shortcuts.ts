import { appWindow, WebviewWindow } from '@tauri-apps/api/window'

export function setupShortcuts() {
  const handleKeydown = async (e: KeyboardEvent) => {
    // CMD+N (Mac) 或 Ctrl+N (Windows/Linux) 创建新窗口
    if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
      e.preventDefault()
      
      // 创建新窗口
      const newWindow = new WebviewWindow(`terminal-${Date.now()}`, {
        width: 800,
        height: 600,
        minWidth: 600,
        minHeight: 400,
        title: 'Landing Terminal',
        decorations: true,
        theme: 'Dark',
        hiddenTitle: true
      })
    }
  }

  // 监听键盘事件
  document.addEventListener('keydown', handleKeydown)

  // 返回清理函数
  return () => {
    document.removeEventListener('keydown', handleKeydown)
  }
} 