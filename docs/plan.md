# dotdesk 开发计划

## 项目定位

基于 Graphviz DOT 的思维导图桌面应用。后端使用本地 `dot` 命令渲染，前端提供键盘驱动的导图编辑界面。

## 阶段一：基础架构 ✅

- [x] Tauri + React + TypeScript + Vite 项目初始化
- [x] Monaco Editor DOT 编辑
- [x] Graphviz `dot -Tsvg` 渲染命令
- [x] SVG 预览展示
- [x] DOT 文件打开/保存
- [x] SVG 导出
- [x] Graphviz 环境检测与错误日志
- [x] 架构文档 `docs/architecture.md`

## 阶段二：思维导图功能

- [x] `MindMapNode` 树形数据结构
- [x] MindMap 交互组件
- [x] Tab 创建子节点
- [x] Enter 创建兄弟节点
- [x] Delete 删除节点
- [x] 双击编辑节点内容
- [x] 节点树 → DOT 序列化
- [x] 导图 SVG 渲染预览
- [x] 导图导出为 DOT/SVG

## 阶段三：文档体系

- [x] `README.md`
- [x] `CHANGELOG.md`
- [x] `docs/SESSION_LOG.md`
- [x] `docs/plan.md`
- [x] `.github/skills/dotdesk-dev/SKILL.md`

## 阶段四：DOT 样式边栏 ✅

- [x] `DotStyleConfig` 类型定义（Graph/Node/Edge）
- [x] `DotStylePanel` 边栏组件：折叠分组 + 完整属性控件
- [x] 固定边栏布局（三列 workspace）
- [x] `mindMapToDot` 支持全局样式 + 节点级联样式
- [x] Ctrl+Click 多选节点，批量应用样式
- [x] MindMapNode 添加可选 style 属性
- [x] 表单控件 Dark 主题样式 + 颜色值引号包裹

## 阶段五：交互画布升级 ✅

实现说明与数据流归档：`docs/interactive-canvas.md`。

- [x] 引入 `@xyflow/react` + `dagre` 依赖
- [x] `MindMapNode` 增加 `position` 字段
- [x] `EdgeStyleMap` 类型：按 `"src->tgt"` 存储边样式
- [x] 新增 `MindMapNodeView` 自定义节点组件（双击编辑、样式应用）
- [x] 重写 `MindMap` 为 ReactFlow 画布
- [x] dagre 自动初始布局，用户拖动后保留位置
- [x] Ctrl/Cmd 多选、Shift+拖拽 / 左键空白拖拽 框选
- [x] 边可被点击选中
- [x] `mindMapToDot` 支持 edgeStyles 输出逐边样式
- [x] `DotStylePanel` 上下文感知：根据选中类型显示 Graph/Node/Edge
- [x] `applyNodeStyle` + `applyEdgeStyle`，按选中元素分别应用
- [x] ReactFlow 控件 + MiniMap + 暗色主题适配

## 后续方向（待定）

- [ ] 节点之间自由连线（打破树结构）
- [ ] 单独删除某条边（不删节点）
- [ ] 复制 / 粘贴节点
- [ ] 撤销 / 重做
- [ ] 折叠/展开子树
- [ ] 导出 PNG / PDF
- [ ] LaTeX 文档集成
