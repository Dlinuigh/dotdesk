# Session Log

> 每次对话结束时归档关键决策和变更摘要。最新记录在前。

---

## [0004] 2026-05-06 — 将实现归档至文档

### 对话摘要
将交互画布改造后的工作内容写入仓库文档，便于后续查阅：
1. 新建 `docs/interactive-canvas.md`：数据流（Mermaid）、类型说明、文件职责表、ReactFlow 配置摘要、dagre 布局策略、`mindMapToDot` 与画布分工、已实现/未实现键盘项、后续扩展方向
2. 更新 `docs/architecture.md`：模块边界增加 MindMap、DotStylePanel、App 状态职责，并链接 `interactive-canvas.md`
3. 更新 `docs/plan.md`：阶段五增加归档文档引用
4. 更新 `CHANGELOG.md`：增加「文档」小节记录上述变更
5. 更新 `README.md`：项目结构树中列出 `docs/` 下主要文档

### 关键决策
- 计划中提到的 Space / 方向键导航若代码尚未实现，在 `interactive-canvas.md` 中明确标注为「当前未实现」，避免文档与行为不一致

---

## [0003] 2026-05-06 — 交互画布升级（ReactFlow + dagre）

### 对话摘要
第三回合对话，把思维导图重构为真正的可交互画布：
1. 引入 `@xyflow/react` v12 + `dagre` v0.8 + `@types/dagre` 依赖
2. `MindMapNode` 增加 `position` 字段；新增 `EdgeStyleMap` 类型按 `"src->tgt"` 存边样式
3. 新建 `MindMapNodeView`（ReactFlow 自定义节点）：双击编辑、自定义样式、Handle 连接点
4. 重写 `MindMap` 为 ReactFlow 画布，包含：
   - `treeToFlow` 树→nodes/edges 转换
   - `computeMissingLayout` 仅对没有 position 的节点跑 dagre
   - 拖动写回 tree、键盘 Tab/Enter/Delete 兼容
   - 选中（节点 + 边）状态上报父组件
5. `mindMapToDot` 增加 `edgeStyles` 参数，输出 `[color="#xx", penwidth=2, ...]`
6. `DotStylePanel` 上下文感知：根据 `selectedNodeIds`/`selectedEdgeIds` 显示 Graph/Node/Edge
7. App 增加 `edgeStyles` 状态、`applyEdgeStyle`、`applyNodeStyle` 与 `selectedEdgeStyle` 衍生
8. ReactFlow 暗色主题 + MiniMap + Controls 样式适配

### 关键决策
- 节点位置存在 tree 中（`MindMapNode.position`），使切换模式不丢失布局
- 首次进入用 dagre 自动布局，仅当节点没有 position 时执行
- 边样式按 `"sourceId->targetId"` 字符串作为 key（与 ReactFlow 的 edge.id 一致）
- ReactFlow `selectionOnDrag` + `panOnDrag={[1, 2]}`：左键拖拽 = 框选，中/右键 = 平移
- 多选键码 `['Control', 'Meta']` 同时支持 Ctrl 和 Cmd
- 删除根节点禁止；Delete 键只删非根选中节点
- 删除单条边、自由连线、复制粘贴等留作下一阶段

### 涉及文件
- `package.json` — 新增 ReactFlow + dagre 依赖
- `src/main.tsx` — 引入 `@xyflow/react/dist/style.css`
- `src/types.ts` — `position`、`EdgeStyleMap`、`SelectionState`
- `src/components/MindMapNodeView.tsx`（新建）
- `src/components/MindMap.tsx`（重写）
- `src/components/DotStylePanel.tsx`（上下文感知）
- `src/App.tsx`（edgeStyles + selection 联动）
- `src/styles.css`（ReactFlow 暗色主题）
- `CHANGELOG.md`、`README.md`、`docs/plan.md`
- 归档说明见 `docs/interactive-canvas.md`（本会话补充）

---

## [0002] 2026-05-06 — DOT 样式边栏与多选支持

### 对话摘要
第二回合对话，完成了以下工作：
1. 新增 `DotStyleConfig`/`GraphStyle`/`NodeStyle`/`EdgeStyle` 类型定义 (`src/types.ts`)
2. 新建 `DotStylePanel` 样式边栏组件，三个可折叠面板 (Graph/Node/Edge)
3. 思维导图增加 Ctrl+Click 多选支持
4. `MindMapNode` 增加可选 `style` 属性，支持节点独立样式
5. `mindMapToDot` 修复颜色值引号包裹，支持节点级联样式输出
6. 布局改为三列：Style 边栏 | MindMap | SVG Preview
7. 移除三段模式切换，保留 Mind Map / DOT Editor 两段

### 关键决策
- Style 不再作为独立模式，而是固定在思维导图左侧的边栏
- 没有选中节点时 Node 属性修改全局默认值，选中后修改选中节点
- 使用 `<input type="color">` 原生控件实现色盘，无需第三方库
- 颜色值在 DOT 输出中始终加引号包裹

---

## [0001] 2026-05-06 — 项目初始化与导图功能开发

### 对话摘要
首次对话，完成了以下工作：
1. 创建 `.github/skills/dotdesk-dev/SKILL.md` — 开发工作流技能
2. 创建 `README.md` — 项目简介
3. 创建 `CHANGELOG.md` — 变更日志
4. 创建 `docs/SESSION_LOG.md` — 对话归档
5. 创建 `docs/plan.md` — 项目计划
6. 实现思维导图核心功能（MindMap 组件）
7. 导图模式支持 Tab/Enter/Delete/双击编辑

### 关键决策
- SKILL.md 放在 workspace 范围 (`.github/skills/dotdesk-dev/`)
- 导图使用树形数据结构 `MindMapNode`，序列化为 DOT
- 先建文档体系再开发功能
- 导图模式与 DOT 编辑模式共存，通过 toggle 切换
