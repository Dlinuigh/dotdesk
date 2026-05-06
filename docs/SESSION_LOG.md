# Session Log

> 每次对话结束时归档关键决策和变更摘要。最新记录在前。

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
