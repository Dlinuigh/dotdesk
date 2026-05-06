---
name: DOT Style Panel Plan
overview: 在 dotdesk 中增加 DOT 样式定制面板（DotStylePanel），通过选项卡方式对所有 DOT 属性（Graph/Node/Edge）进行可视化配置，样式配置将自动合并到导图的 DOT 输出中。
todos:
  - id: add-types
    content: 在 types.ts 中添加 DotStyleConfig、GraphStyle、NodeStyle、EdgeStyle 类型定义
    status: completed
  - id: create-style-panel
    content: 新建 DotStylePanel.tsx 组件，实现 Graph/Node/Edge 三个子选项卡，包含全部 DOT 属性控件
    status: completed
  - id: modify-app-tsx
    content: 修改 App.tsx：模式改为三段切换、添加 dotStyle 状态、集成 DotStylePanel
    status: completed
  - id: modify-mindmap
    content: 修改 mindMapToDot 函数，使其接受 DotStyleConfig 并生成带样式的 DOT 源码
    status: completed
  - id: add-css-styles
    content: 在 styles.css 中添加表单控件、选项卡、Dark 主题相关样式
    status: completed
  - id: update-docs
    content: 更新 CHANGELOG.md、README.md、docs/plan.md
    status: completed
isProject: false
---

## 目标

为 dotdesk 增加一个 "Style" 模式（与 Mind Map / DOT Editor 并列），提供三个子选项卡分别定制 Graph（图）、Node（节点）、Edge（连接线）的全部 DOT 属性，并自动反映到渲染结果中。

## 涉及文件

| 文件 | 改动说明 |
|---|---|
| `src/types.ts` | 新增 `DotStyleConfig`、`GraphStyle`、`NodeStyle`、`EdgeStyle` 类型 |
| `src/components/DotStylePanel.tsx` | **新建** - 样式面板组件，含 Graph/Node/Edge 三子选项卡 |
| `src/App.tsx` | 模式从 boolean 改为 "mindmap"\|"editor"\|"style"，添加 dotStyle 状态，传入 mindMapToDot |
| `src/components/MindMap.tsx` | `mindMapToDot()` 新增 `style` 参数，生成的 DOT 应用样式配置 |
| `src/styles.css` | 新增表单控件样式、选项卡样式、Dark 主题配色 |
| `docs/plan.md` | 更新开发计划 |
| `CHANGELOG.md` | 记录本次变更 |
| `README.md` | 更新功能列表和项目结构 |

## 详细设计

### 1. 类型定义（`src/types.ts`）

新增三个接口和一个配置接口：

```typescript
export interface GraphStyle {
  rankdir?: 'TB' | 'LR' | 'BT' | 'RL';
  bgcolor?: string;
  fontname?: string;
  fontsize?: number;
  fontcolor?: string;
  label?: string;
  splines?: string;
  layout?: string;
  nodesep?: number;
  ranksep?: number;
  pad?: string;
  margin?: string;
  dpi?: number;
  overlap?: string;
  compound?: boolean;
  center?: boolean;
  concentrate?: boolean;
}

export interface NodeStyle {
  shape?: string;
  style?: string;
  fillcolor?: string;
  color?: string;
  fontname?: string;
  fontsize?: number;
  fontcolor?: string;
  penwidth?: number;
  width?: number;
  height?: number;
  peripheries?: number;
  gradientangle?: number;
}

export interface EdgeStyle {
  color?: string;
  style?: string;
  penwidth?: number;
  arrowhead?: string;
  arrowtail?: string;
  arrowsize?: number;
  dir?: 'forward' | 'back' | 'both' | 'none';
  fontname?: string;
  fontsize?: number;
  fontcolor?: string;
  weight?: number;
  decorate?: boolean;
}

export interface DotStyleConfig {
  graph: GraphStyle;
  node: NodeStyle;
  edge: EdgeStyle;
}
```

### 2. 新建 `DotStylePanel` 组件（`src/components/DotStylePanel.tsx`）

- 三个子选项卡：`Graph` | `Node` | `Edge`
- 每个选项卡内按属性类型使用最佳控件：
  - **颜色**：`<input type="color">` — fillcolor, color, bgcolor, fontcolor
  - **枚举**：`<select>` — rankdir, shape, style, arrowhead, dir, splines, layout
  - **数值**：`<input type="number">` — fontsize, penwidth, width, height, nodesep, ranksep, arrowsize
  - **文本**：`<input type="text">` — fontname, label, pad, margin
  - **布尔**：`<input type="checkbox">` — compound, center, decorate, concentrate
- 属性按功能分组，加标题（如 "Layout"、"Colors"、"Typography"）
- 每个属性包含标签和控件，默认值为空/DOT 默认值
- 提供 "重置默认" 按钮恢复 DOT 原始默认值

### 3. 修改 `App.tsx`

- `mindMapMode` boolean 改为 `mode: 'mindmap' | 'editor' | 'style'`
- 新增 `dotStyle: DotStyleConfig` 状态，初始为默认 DOT 值
- toolbar 按钮改为三段切换
- Style 模式下渲染 `DotStylePanel` 组件
- 将 `dotStyle` 和 `setDotStyle` 传递给 `DotStylePanel`
- 将 `dotStyle` 传递给 `MindMap`（最终进入 `mindMapToDot`）

### 4. 修改 `MindMap.tsx` 的 `mindMapToDot`

函数签名改为：
```typescript
export function mindMapToDot(root: MindMapNode, style?: DotStyleConfig): string
```

生成 DOT 时注入样式块：
```
digraph mindmap {
  // 来自 style.graph 的属性
  rankdir=LR;
  bgcolor="#ffffff";

  // 来自 style.node 的属性
  node [shape=box, style="rounded,filled", fillcolor="#eef4ff", ...];

  // 来自 style.edge 的属性
  edge [color="#5b7cfa", arrowhead="vee", ...];

  // 节点关系...
}
```

只输出非空的属性，保留已有的默认值兼容。

### 5. 布局方案

```
┌────────────────────────────────────────────────┐
│  Topbar (title + toolbar: Mind Map | DOT | Style)  │
├────────────────┬───────────────────────────────┤
│  MindMap /     │   SVG Preview                 │
│  DotEditor /   │                               │
│  DotStylePanel │                               │
├────────────────┴───────────────────────────────┤
│  Render Log                                     │
└─────────────────────────────────────────────────┘
```

Style 面板内容区使用子选项卡（Graph / Node / Edge），面板内部可滚动。

### 6. CSS 样式新增

在 `styles.css` 中新增：
- `.style-panel` — 样式面板容器
- `.sub-tabs` / `.sub-tab` — 子选项卡样式（与主 tabs 风格一致）
- `.style-group` / `.style-group-title` — 属性分组
- `.style-field` / `.style-label` / `.style-input` — 表单控件布局
- 各种输入控件的 dark 主题样式（`input[type="color"]`, `select`, `input[type="number"]`, `input[type="text"]`, `input[type="checkbox"]`）

### 7. 交互逻辑

- Style 变更 → 自动更新 DOT → 自动触发渲染（与 mind map 变更行为一致）
- 切换到 Mind Map 模式时，样式自动生效
- 切换到 DOT Editor 模式时，样式不自动注入（保留用户手写 DOT），但可以提供一个 "插入样式" 按钮
