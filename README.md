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
- ✅ 交互画布（ReactFlow + R-T 自动树状布局；Ctrl/Shift 多选 + 框选）
- ✅ 8 方向拖动 = 选择子树主生长方向（snap）
- ✅ 方向键节点导航 + 视口跟随
- ✅ 边（edge）选中和样式编辑
- ✅ Style 边栏上下文感知：根据选中类型展示 Graph / Node / Edge
- ✅ 三个面板（Style / SVG / Render Log）独立可隐藏
- ✅ macOS 原生菜单栏（File/Edit/View/Render）+ 跨平台 Tauri 菜单
- ✅ 字体：FontFamily 下拉 + Bold / Italic toggle
- ✅ 思维导图键盘操作：Tab/Enter/Delete
- ✅ 导图导出为 DOT / SVG / PDF（PDF 走 LaTeX 管道）
- ✅ SVG 预览引擎切换：DOT (Graphviz) / LaTeX (xelatex + TikZ)
- ✅ DOT 样式边栏（可视化配置颜色、形状、字体、箭头等全部 DOT 属性）

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

### 导图画布

思维导图模式提供基于 ReactFlow 的可交互画布。布局由 Reingold–Tilford 树状算法自动决定，
用户不直接编辑节点坐标，但可以通过拖动节点来选择"主生长方向"。

| 操作 | 行为 |
|---|---|
| 单击节点 | 选中（替换之前的选中） |
| Ctrl/Cmd + 单击 | 多选（添加/移除） |
| Shift + 拖拽 / 左键空白拖拽 | 框选（marquee select） |
| 拖拽节点 | snap 到 8 方向（N/NE/E/SE/S/SW/W/NW），改变子树主生长方向 |
| 中键/右键拖拽 | 平移画布 |
| 滚轮 / 触控板 | 缩放画布 |
| 双击节点 | 进入文字编辑模式 |
| **Tab** | 给当前选中节点添加子节点 |
| **Enter** | 添加兄弟节点 |
| **Delete / Backspace** | 删除选中的节点（含子树） |
| **方向键** | 在树结构内导航选择 |

边可被点击选中，选中后在 Style 边栏可编辑边的颜色、线型、箭头、粗细等。

### 传统 DOT 编辑

也可以在 Monaco 编辑器中直接编辑 DOT 源码，点击 Render 渲染预览。

### Style 边栏（上下文感知）

左侧 **Style** 边栏根据画布选中状态自动切换显示内容：

| 选中状态 | 显示区域 |
|---|---|
| 啥都没选（点击空白） | Graph |
| 选中 1+ 节点 | Node |
| 选中 1+ 边 | Edge |
| 节点和边都选 | Node + Edge |

每个区域内按功能分组（颜色、字体、尺寸、形状等）展示控件，修改即时生效。

## 项目结构

```
dotdesk/
├── src/                    # 前端源码
│   ├── App.tsx             # 主应用 + 状态管理
│   ├── types.ts            # TypeScript 类型定义
│   ├── components/         # React 组件
│   │   ├── DotEditor.tsx           # DOT 编辑器 (Monaco)
│   │   ├── DotStylePanel.tsx       # DOT 样式边栏（上下文感知）
│   │   ├── MindMap.tsx             # ReactFlow 画布 + DOT 序列化
│   │   ├── MindMapNodeView.tsx     # 自定义画布节点
│   │   ├── layout.ts               # R-T 树状布局 + 8 方向 snap + 树导航
│   │   ├── RenderLog.tsx           # 渲染日志
│   │   └── SvgPreview.tsx          # SVG 预览（DOT/LaTeX 引擎切换）
│   └── styles.css          # 全局样式
├── src-tauri/              # Rust 后端源码
│   ├── src/
│   │   ├── main.rs         # 入口
│   │   ├── lib.rs          # Tauri 插件 / 菜单 / 命令注册
│   │   ├── menu.rs         # 原生菜单（File/Edit/View/Render）
│   │   ├── graphviz.rs     # Graphviz 检测与 dot -Tsvg 渲染
│   │   └── latex.rs        # LaTeX 编译管道（dot2tex → xelatex → pdf2svg）
│   └── Cargo.toml
├── docs/                   # 项目文档
│   ├── architecture.md
│   ├── interactive-canvas.md   # 交互画布（ReactFlow）实现说明
│   ├── latex-pipeline.md       # LaTeX 渲染管道与依赖
│   ├── plan.md
│   └── SESSION_LOG.md
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
