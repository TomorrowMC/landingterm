# 项目结构说明

## 前端部分 (src/)
- src/
  - components/
    - Terminal/
      - Terminal.tsx         # 终端主组件（处理命令输入和显示）
      - styles.css          # 终端样式文件
  - App.tsx                 # 应用主入口
  - main.tsx               # React入口文件
  - App.css                # 应用全局样式
  - index.css              # 全局基础样式
  - vite-env.d.ts         # Vite类型声明文件

## 后端部分 (src-tauri/)
- src-tauri/
  - src/
    - main.rs              # Rust主入口文件（处理前端命令调用）
    - terminal/
      - mod.rs            # 终端模块声明
      - process.rs        # 终端命令执行处理
  - Cargo.toml            # Rust依赖配置
  - tauri.conf.json      # Tauri应用配置
  - icons/               # 应用图标目录

## 配置文件
- package.json           # Node.js项目配置
- vite.config.ts        # Vite构建配置
- tsconfig.json         # TypeScript配置
- .gitignore            # Git忽略配置

## 功能说明
- 前端部分：
  - 提供终端界面和交互
  - 处理命令输入和显示
  - 支持命令历史显示
  - 错误信息展示

- 后端部分：
  - 命令执行处理
  - 进程管理
  - 输出处理（标准输出和错误输出）
  - 跨平台支持（macOS优先）

## 开发命令
- `npm run tauri dev`    # 开发模式运行
- `npm run build`        # 构建应用
- `npm run preview`      # 预览构建结果 