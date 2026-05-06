# Changelog

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
