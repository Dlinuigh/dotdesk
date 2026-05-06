# dotdesk

> 基于 Graphviz DOT 的思维导图桌面应用

将 Graphviz DOT 语言与思维导图交互结合，提供所见即所得的导图编辑体验。后端使用 Graphviz `dot` 命令渲染，前端支持键盘导航编辑。

## 技术栈

- **桌面框架**: [Tauri v2](https://tauri.app/)
- **前端**: React + TypeScript + Vite
- **编辑器**: Monaco Editor (VS Code 内核)
- **后端**: Rust Tauri commands
- **渲染引擎**: Graphviz `dot -Tsvg`

## 功能

- ✅ DOT 源码编辑（Monaco Editor）
- ✅ Graphviz SVG 实时渲染
- ✅ DOT 文件打开/保存
- ✅ SVG 导出
- ✅ Graphviz 环境检测与错误日志
- ✅ 思维导图模式（键盘导航创建节点 + 多选）
- ✅ 导图导出为 DOT / SVG
- ✅ DOT 样式边栏（可视化配置 Graph/Node/Edge 属性，Ctrl+Click 多选节点批量修改）

## 快速开始

### 前置条件

- [Node.js](https://nodejs.org/) >= 18
- [Rust](https://www.rust-lang.org/) (通过 `rustup` 安装)
- [Graphviz](https://graphviz.org/) (渲染引擎)

```bash
# 安装 Graphviz（macOS）
brew install graphviz

# Ubuntu / Debian
sudo apt install graphviz

# Windows (choco)
choco install graphviz
```

### 启动开发环境

```bash
# 克隆项目
git clone <repo-url>
cd dotdesk

# 安装前端依赖
npm install

# 启动 Tauri 开发模式
npm run tauri:dev
```

### 构建

```bash
npm run tauri:build
```

## 使用指南

### 导图模式

按下 **Tab** 创建子节点，**Enter** 创建兄弟节点，双击节点内容进行编辑，**Delete** 删除节点。
**Ctrl+Click** 多选节点，选中的节点可以在左侧 Style 边栏中批量修改样式。

### 传统 DOT 编辑

也可以在 Monaco 编辑器中直接编辑 DOT 源码，点击 Render 渲染预览。

### 样式边栏

在思维导图模式下，左侧 **Style** 边栏始终可用。包含三个折叠面板：
- **Graph** — 布局方向、引擎、间距、背景色等全局属性
- **Node** — 节点形状、填充色、边框色、字体、尺寸
- **Edge** — 箭头样式、线型、颜色、粗细

未选中节点时修改 Node 属性 = 修改全局默认值；选中一个或多个节点后修改 Node 属性 = 应用到所选节点。

## 项目结构

```
dotdesk/
├── src/                    # 前端源码
│   ├── App.tsx             # 主应用 + 状态管理
│   ├── types.ts            # TypeScript 类型定义
│   ├── components/         # React 组件
│   │   ├── DotEditor.tsx   # DOT 编辑器 (Monaco)
│   │   ├── DotStylePanel.tsx # DOT 样式边栏
│   │   ├── MindMap.tsx     # 思维导图（支持多选）
│   │   ├── RenderLog.tsx   # 渲染日志
│   │   └── RenderLog.tsx   # 渲染日志
│   └── styles.css          # 全局样式
├── src-tauri/              # Rust 后端源码
│   ├── src/
│   │   ├── main.rs         # 入口
│   │   ├── lib.rs          # Tauri 插件注册 + 命令入口
│   │   └── graphviz.rs     # Graphviz 检测和渲染命令
│   └── Cargo.toml
├── docs/                   # 项目文档
├── .github/skills/         # VS Code Agent Skills
└── package.json
```

## 开发

```bash
# 前端开发（浏览器模式，无 Tauri）
npm run dev

# Tauri 桌面开发
npm run tauri:dev

# 构建
npm run tauri:build
```

## 许可证

MIT
