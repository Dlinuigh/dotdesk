# Session Log

> 每次对话结束时归档关键决策和变更摘要。最新记录在前。

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
