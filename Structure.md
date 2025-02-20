# Project Structure

## Frontend (React + TypeScript)
- `src/`
  - `components/`
    - `Terminal/`
      - `Terminal.tsx` - 主终端组件
      - `CommandBlock.tsx` - 命令块组件
      - `ContextMenu.tsx` - 右键菜单组件
      - `types.ts` - 类型定义文件
      - `styles.css` - 终端样式
    - `Tabs.tsx` - 标签页管理组件
  - `App.tsx` - 主应用组件
  - `App.css` - 全局样式
  - `main.tsx` - 应用入口

## Backend (Rust + Tauri)
- `src-tauri/`
  - `src/`
    - `lib.rs` - 主库文件，包含 Tauri 插件初始化
    - `terminal/`
      - `mod.rs` - 终端模块定义
      - `process.rs` - 终端进程管理
  - `Cargo.toml` - Rust 依赖配置
  - `tauri.conf.json` - Tauri 配置文件

## Key Files
- `package.json` - 前端依赖配置
- `tsconfig.json` - TypeScript 配置
- `vite.config.ts` - Vite 构建配置

## 配置文件
- `.gitignore`            # Git忽略配置

## 功能说明
- 前端部分：
  - 提供终端界面和交互
  - 处理命令输入和显示
  - 支持命令历史显示
  - 错误信息展示
  - 支持文本选择和复制功能
  - 自动滚动和手动滚动控制

- 后端部分：
  - 命令执行处理
  - 进程管理
  - 输出处理（标准输出和错误输出）
  - 跨平台支持（macOS优先）

## 组件说明
- `Terminal/`
  - `Terminal.tsx`: 主终端组件，负责整体终端的管理和渲染
  - `CommandBlock.tsx`: 命令块组件，处理单个命令的显示和交互
  - `ContextMenu.tsx`: 右键菜单组件，处理文本选择和复制功能
  - `types.ts`: 统一的类型定义文件
  - `styles.css`: 终端相关样式

## 开发命令
- `npm run tauri dev`    # 开发模式运行
- `npm run build`        # 构建应用
- `npm run preview`      # 预览构建结果 