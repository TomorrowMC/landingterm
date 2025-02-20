import create from 'zustand';
import { Store } from 'tauri-plugin-store-api';
import { appDataDir } from '@tauri-apps/api/path';
import { emit, listen } from '@tauri-apps/api/event';

interface FavoriteCommand {
  id: string;
  name: string;
  command: string;
}

interface FavoriteStore {
  isOpen: boolean;
  commands: FavoriteCommand[];
  setIsOpen: (isOpen: boolean) => void;
  setCommands: (commands: FavoriteCommand[]) => void;
  addCommand: (command: FavoriteCommand) => void;
  deleteCommand: (id: string) => void;
  store: Store | null;
  initStore: () => Promise<void>;
}

// 创建一个全局的 store 实例
let globalStore: Store | null = null;

const useFavoriteStore = create<FavoriteStore>((set, get) => {
  // 设置事件监听器
  listen<boolean>('favorite-panel-state-changed', (event) => {
    set({ isOpen: event.payload });
  });

  listen<FavoriteCommand[]>('favorite-commands-changed', (event) => {
    set({ commands: event.payload });
  });

  return {
    isOpen: false,
    commands: [],
    store: null,
    setIsOpen: async (isOpen) => {
      set({ isOpen });
      // 广播状态变化到所有窗口
      await emit('favorite-panel-state-changed', isOpen);
    },
    setCommands: async (commands) => {
      set({ commands });
      // 广播命令变化到所有窗口
      await emit('favorite-commands-changed', commands);
    },
    addCommand: async (command) => {
      const { commands, store } = get();
      const newCommands = [...commands, command];
      // 保存到本地存储
      if (store) {
        await store.set('favorite_commands', newCommands);
        await store.save();
      }
      // 更新状态并广播
      await get().setCommands(newCommands);
    },
    deleteCommand: async (id) => {
      const { commands, store } = get();
      const newCommands = commands.filter(cmd => cmd.id !== id);
      // 保存到本地存储
      if (store) {
        await store.set('favorite_commands', newCommands);
        await store.save();
      }
      // 更新状态并广播
      await get().setCommands(newCommands);
    },
    initStore: async () => {
      if (!globalStore) {
        const dataDir = await appDataDir();
        globalStore = new Store(`${dataDir}/favorite_commands.json`);
      }
      set({ store: globalStore });
      try {
        const savedCommands = await globalStore.get<FavoriteCommand[]>('favorite_commands');
        if (savedCommands) {
          // 初始化时也广播命令
          await get().setCommands(savedCommands);
        }
      } catch (error) {
        console.error('Error loading commands:', error);
      }
    },
  };
});

export default useFavoriteStore;
export type { FavoriteCommand }; 