# Changelog

## [2026-05-06] — LaTeX：dot2tex 使用完整文档输出

### 修复
- `compile_via_latex`：去掉 `--codeonly`，直接编译 dot2tex 生成的完整 `.tex`，避免 TikZ 中 `strokecolor` 等颜色未在序言中定义导致 xelatex 报错
- 在 `\begin{document}` 后注入 `\tikzset`，把 dot2tex 生成的非法键 `rounded`、`filled` 映射为 `rounded corners` 与 `fill=fillcolor`，修复 pgfkeys 报错
- 注入 `\providecolor{fillcolor}{HTML}{EEF4FF}`、`strokecolor` 兜底，避免部分 DOT 未定义 `fillcolor` 时 xcolor 报错

## [2026-05-06] — 外部工具：仅 PATH + DOTDESK_* 解析

### 变更
- `latex`：`xelatex` / `pdf2svg` / `dot2tex` 仅在 `PATH` 中查找，或通过 `DOTDESK_*` 指定绝对路径；`python -m dot2tex` 所用的解释器也须来自 `PATH` 或 `DOTDESK_PYTHON`
- `graphviz`：`dot` 仅在 `PATH` 中查找，或通过 `DOTDESK_GRAPHVIZ_DOT`；移除内置 Homebrew 等固定路径猜测
- `docs/latex-pipeline.md`：与上述策略一致

## [2026-05-06] — 画布 UX 优化（菜单 / 树状布局 / 字体 / LaTeX）

### 新增
- 三个面板（Style 边栏 / SVG 预览 / Render Log）独立可隐藏，顶部新增 icon toggle 组
- macOS 原生菜单栏（其他平台同一份 Tauri 菜单）：File / Edit / View / Render
  - File：Open / Save / Render Now / Export SVG / Export PDF
  - View：Mode 切换、三个面板 toggle
  - Render：DOT / LaTeX 引擎选择、Check Graphviz、Check LaTeX
- 节点字体：FontFamily 下拉、Bold / Italic toggle，默认字号由 14 → 18
- Reingold–Tilford 风格的自动树状布局：兄弟节点根据子树叶子数量自适应间距
- 拖动节点 = 选择「主生长方向」，snap 到 8 方向（N/NE/E/SE/S/SW/W/NW）
- 方向键导航：Left/Right/Up/Down 在树结构内跳转选择，并通过 ReactFlow `setCenter` 跟随视口
- LaTeX 渲染管道：`compile_via_latex`（`dot2tex → xelatex → pdf2svg`）+ `check_latex` 后端命令
- SVG 预览头部增加 `DOT / LaTeX` 引擎切换；导出 PDF 自动走 LaTeX 管道

### 变更
- `MindMapNode` 移除 `position`，新增 `growthDirection?: Dir8`
- `NodeStyle` 新增 `fontweight` / `fontstyle`；序列化时拼到 Graphviz `fontname`（如 `"Inter Bold"`）
- ReactFlow 增加 `disableKeyboardA11y` 关闭默认箭头移动节点
- 工具栏精简：Open/Save/Export/Check 按钮迁移到原生菜单
- 移除 `dagre`、`@types/dagre` 依赖（自实现 R-T 布局，bundle -75KB）

### 文档
- 新增 `docs/latex-pipeline.md`：LaTeX 三件套依赖、数据流、命令签名、错误排查
- `CHANGELOG` / `docs/plan.md` / `docs/SESSION_LOG.md` 同步更新

## [2026-05-06] — 交互画布升级

### 新增
- 思维导图升级为基于 ReactFlow 的可交互画布
- 节点支持鼠标拖动调整位置
- 多选支持：Ctrl/Cmd+Click 多选、Shift+拖拽框选、左键拖拽框选
- 边（edge）选中能力，可编辑边的样式（颜色、线型、箭头、粗细等）
- Style 边栏上下文感知：
  - 点击空白 → 显示 Graph 选项
  - 选中节点 → 显示 Node 选项
  - 选中边 → 显示 Edge 选项
  - 同时选中 → 显示 Node + Edge
- 初次进入用 dagre 自动布局，之后保留用户拖动位置
- ReactFlow 内置控件：缩放、适配视图、小地图（MiniMap）
- `EdgeStyleMap` 类型 + `applyEdgeStyle`，按边 ID 存储独立样式
- `MindMapNode` 新增 `position` 字段，参与 DOT 渲染但仅供画布使用

### 变更
- `mindMapToDot` 新增 `edgeStyles` 参数，输出逐边样式
- `DotStylePanel` props 重构：拆分 node/edge 选中处理回调
- 新增 `@xyflow/react`、`dagre` 依赖

### 文档
- 新增 `docs/interactive-canvas.md`，归档交互画布数据流、类型、文件职责与键盘行为
- `docs/architecture.md` 补充 MindMap / DotStylePanel 模块说明并链接上述文档

## [2026-05-06]

### 新增
- DOT 样式面板：可视化定制 Graph/Node/Edge 属性
- Style 固定边栏：在思维导图模式下始终显示在左侧
- 多选支持：Ctrl+Click 选中多个节点，群组修改样式
- 节点独立样式：每个 MindMapNode 支持独立的 style 属性
- mindMapToDot 输出带引号的颜色值和节点级联样式
- 属性分组折叠面板（Graph/Node/Edge 可折叠）
- 提供"Reset"按钮恢复 DOT 原始默认值
- 项目初始化：Tauri + React + TypeScript + Vite 模板
- DOT 源码编辑（Monaco Editor）
- Graphviz SVG 渲染（`dot -Tsvg`）
- DOT 文件打开/保存（Tauri dialog + fs 插件）
- SVG 导出功能
- Graphviz 环境检测与错误日志展示
- 思维导图模式：Tab 创建子节点、Enter 创建兄弟节点、Delete 删除节点、双击编辑
- 导图转 DOT 序列化 + SVG 渲染导出
- 项目文档体系：README.md、CHANGELOG.md、docs/ 文档
- 开发工作流 SKILL.md（`.github/skills/dotdesk-dev/`）
