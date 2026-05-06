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

## 阶段四：DOT 样式边栏

- [x] `DotStyleConfig` 类型定义（Graph/Node/Edge）
- [x] `DotStylePanel` 边栏组件：折叠分组 + 完整属性控件
- [x] 固定边栏布局（三列 workspace）
- [x] `mindMapToDot` 支持全局样式 + 节点级联样式
- [x] Ctrl+Click 多选节点，批量应用样式
- [x] MindMapNode 添加可选 style 属性
- [x] 表单控件 Dark 主题样式 + 颜色值引号包裹

## 后续方向（待定）

- [ ] 拖拽调整节点层级
- [ ] 节点颜色/样式自定义
- [ ] 撤销/重做
- [ ] 折叠/展开子树
- [ ] 导出 PNG/PDF
- [ ] LaTeX 文档集成
