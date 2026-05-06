import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  useReactFlow,
  type Node,
  type Edge,
  type OnSelectionChangeParams,
  type NodeChange,
} from '@xyflow/react';
import type {
  Dir8,
  DotStyleConfig,
  EdgeStyle,
  EdgeStyleMap,
  GraphStyle,
  MindMapNode,
  NodeStyle,
} from '../types';
import { MindMapNodeView, type MindMapNodeData } from './MindMapNodeView';
import {
  NODE_H,
  NODE_W,
  arrowKeyToNavTarget,
  dirToCardinal,
  layoutTree,
  navigate,
  snapToDir8,
} from './layout';

let _idCounter = 0;
function genId(): string {
  return `n${++_idCounter}_${Date.now()}`;
}

function createNode(label = 'New Node'): MindMapNode {
  return { id: genId(), label, children: [] };
}

/* ── DOT 序列化 ── */

/**
 * 把 fontweight/fontstyle 合并到 fontname 后，再返回纯 DOT 属性对象。
 * Graphviz 的 fontname 会被传给底层字体子系统，"Inter Bold Italic" 在 Pango/cairo
 * 后端通常能正确识别为粗斜体；fontweight/fontstyle 不是 Graphviz 标准属性，所以
 * 不能直接输出，只能拼到 fontname。
 */
function normalizeFontAttrs(
  raw: Record<string, unknown>,
): Record<string, unknown> {
  const obj = { ...raw };
  const weight = obj.fontweight as 'normal' | 'bold' | undefined;
  const styleAttr = obj.fontstyle as 'normal' | 'italic' | undefined;
  delete obj.fontweight;
  delete obj.fontstyle;

  const baseName = (obj.fontname as string | undefined) || '';
  const tokens: string[] = [];
  if (baseName) tokens.push(baseName);
  if (weight === 'bold') tokens.push('Bold');
  if (styleAttr === 'italic') tokens.push('Italic');
  if (tokens.length > 0) {
    obj.fontname = tokens.join(' ');
  }
  return obj;
}

function styleToAttr(obj: Record<string, unknown>): string {
  const normalized = normalizeFontAttrs(obj);
  return Object.entries(normalized)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => {
      const val = typeof v === 'boolean' ? (v ? 'true' : 'false') : String(v);
      const needsQuote = /^#/.test(val) || /[ ,"']/.test(val);
      return needsQuote ? `  ${k}="${val}"` : `  ${k}=${val}`;
    })
    .join(',\n');
}

function inlineStyleToAttr(style: Partial<NodeStyle> | Partial<EdgeStyle> | undefined): string {
  if (!style) return '';
  const normalized = normalizeFontAttrs(style as Record<string, unknown>);
  const entries = Object.entries(normalized).filter(
    ([, v]) => v !== undefined && v !== null && v !== '',
  );
  if (entries.length === 0) return '';
  return entries
    .map(([k, v]) => {
      const val = typeof v === 'boolean' ? (v ? 'true' : 'false') : String(v);
      return `${k}="${val}"`;
    })
    .join(', ');
}

/** 从节点树生成 DOT 源码 */
export function mindMapToDot(
  root: MindMapNode,
  style?: DotStyleConfig,
  edgeStyles?: EdgeStyleMap,
): string {
  const lines: string[] = [];
  lines.push('digraph mindmap {');

  if (style?.graph) {
    const g = styleToAttr(style.graph as Record<string, unknown>);
    if (g) lines.push(`graph [\n${g}\n];`);
  }
  if (style?.node) {
    const n = styleToAttr(style.node as Record<string, unknown>);
    if (n) lines.push(`node [\n${n}\n];`);
  }
  if (style?.edge) {
    const e = styleToAttr(style.edge as Record<string, unknown>);
    if (e) lines.push(`edge [\n${e}\n];`);
  }

  lines.push('');

  function walk(node: MindMapNode) {
    const escaped = node.label.replace(/"/g, '\\"');
    const styleAttr = inlineStyleToAttr(node.style);
    const suffix = styleAttr ? `, ${styleAttr}` : '';
    lines.push(`  "${node.id}" [label="${escaped}"${suffix}];`);
    for (const child of node.children) {
      const eid = `${node.id}->${child.id}`;
      const eStyle = edgeStyles?.[eid];
      const eAttr = inlineStyleToAttr(eStyle);
      const edgeSuffix = eAttr ? ` [${eAttr}]` : '';
      lines.push(`  "${node.id}" -> "${child.id}"${edgeSuffix};`);
      walk(child);
    }
  }

  walk(root);
  lines.push('}');
  return lines.join('\n');
}

/* ── 树工具 ── */

function findNode(root: MindMapNode, id: string): MindMapNode | null {
  if (root.id === id) return root;
  for (const child of root.children) {
    const found = findNode(child, id);
    if (found) return found;
  }
  return null;
}

function findParent(root: MindMapNode, id: string): MindMapNode | null {
  for (const child of root.children) {
    if (child.id === id) return root;
    const found = findParent(child, id);
    if (found) return found;
  }
  return null;
}

/** 在 ReactFlow 节点数组中查找指定 id 的中心点（左上角 + 半个尺寸） */
function findRfCenter(rfNodes: Node<MindMapNodeData>[], id: string) {
  const n = rfNodes.find((x) => x.id === id);
  if (!n) return null;
  return { x: n.position.x + NODE_W / 2, y: n.position.y + NODE_H / 2 };
}

/** 移除指定节点（包括子树） */
function removeNodeFromTree(root: MindMapNode, ids: string[]): MindMapNode {
  if (ids.includes(root.id)) return root; // 不允许删除根
  const cloned = structuredClone(root);
  function prune(node: MindMapNode) {
    node.children = node.children.filter((c) => !ids.includes(c.id));
    for (const c of node.children) prune(c);
  }
  prune(cloned);
  return cloned;
}

/* ── 树 ↔ ReactFlow ── */

function dashFromStyle(style: string | undefined): string | undefined {
  switch (style) {
    case 'dashed':
      return '6 4';
    case 'dotted':
      return '2 3';
    default:
      return undefined;
  }
}

function treeToFlow(
  root: MindMapNode,
  edgeStyles: EdgeStyleMap,
  globalEdge: Partial<EdgeStyle> | undefined,
  callbacks: { onLabelChange: (id: string, label: string) => void; rankdir: GraphStyle['rankdir'] },
): { rfNodes: Node<MindMapNodeData>[]; rfEdges: Edge[] } {
  const rfNodes: Node<MindMapNodeData>[] = [];
  const rfEdges: Edge[] = [];

  // R-T 自动布局：返回每个节点的中心坐标
  const positions = layoutTree(root);

  function walk(node: MindMapNode) {
    const center = positions.get(node.id) ?? { x: 0, y: 0 };
    rfNodes.push({
      id: node.id,
      type: 'mindNode',
      // ReactFlow 用左上角坐标；把中心点转换过去
      position: { x: center.x - NODE_W / 2, y: center.y - NODE_H / 2 },
      data: {
        label: node.label,
        style: node.style,
        onLabelChange: callbacks.onLabelChange,
        rankdir: callbacks.rankdir,
      },
    });
    for (const child of node.children) {
      const eid = `${node.id}->${child.id}`;
      const eStyle = { ...(globalEdge || {}), ...(edgeStyles[eid] || {}) };
      const stroke = eStyle.color || '#5b7cfa';
      const strokeWidth = eStyle.penwidth ?? 1;
      const dashArray = dashFromStyle(eStyle.style);
      rfEdges.push({
        id: eid,
        source: node.id,
        target: child.id,
        type: 'smoothstep',
        style: {
          stroke,
          strokeWidth,
          ...(dashArray ? { strokeDasharray: dashArray } : {}),
        },
        markerEnd: { type: 'arrowclosed' as const, color: stroke, width: 16, height: 16 },
        data: { edgeStyle: eStyle },
      });
      walk(child);
    }
  }

  walk(root);
  return { rfNodes, rfEdges };
}

/* ── 主组件 ── */

const nodeTypes = { mindNode: MindMapNodeView };

type MindMapProps = {
  root: MindMapNode;
  edgeStyles: EdgeStyleMap;
  globalStyle?: DotStyleConfig;
  onChange: (root: MindMapNode) => void;
  onDotChange: (dot: string) => void;
  onSelectionChange?: (nodeIds: string[], edgeIds: string[]) => void;
};

function MindMapInner({
  root,
  edgeStyles,
  globalStyle,
  onChange,
  onDotChange,
  onSelectionChange,
}: MindMapProps) {
  // 主轴方向由 root.growthDirection 决定（snap 后），rankdir 仅为兼容属性
  const cardinal = dirToCardinal(root.growthDirection);
  const rankdir: GraphStyle['rankdir'] =
    cardinal === 'E' ? 'LR' : cardinal === 'W' ? 'RL' : cardinal === 'S' ? 'TB' : 'BT';

  const containerRef = useRef<HTMLDivElement>(null);
  const reactFlow = useReactFlow();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [selectedEdgeIds, setSelectedEdgeIds] = useState<string[]>([]);

  // 节点 label 修改回调（编辑提交时触发）
  const onLabelChange = useCallback(
    (id: string, label: string) => {
      const cloned = structuredClone(root);
      const target = findNode(cloned, id);
      if (target) target.label = label;
      onChange(cloned);
    },
    [root, onChange],
  );

  // 树 → RF 数据（每次 root/style 变化重新计算并跑布局）
  const flowData = useMemo(
    () =>
      treeToFlow(root, edgeStyles, globalStyle?.edge, {
        onLabelChange,
        rankdir,
      }),
    [root, edgeStyles, globalStyle?.edge, onLabelChange, rankdir],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState<Node<MindMapNodeData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // 同步 RF 状态：root/边样式变化时重新跑布局并刷新 RF nodes/edges
  useEffect(() => {
    setNodes(flowData.rfNodes);
    setEdges(flowData.rfEdges);
  }, [flowData, setNodes, setEdges]);

  // 通知 DOT 变化
  useEffect(() => {
    onDotChange(mindMapToDot(root, globalStyle, edgeStyles));
  }, [root, globalStyle, edgeStyles, onDotChange]);

  // 选择变化
  const handleSelectionChange = useCallback(
    (params: OnSelectionChangeParams) => {
      const ns = params.nodes.map((n) => n.id);
      const es = params.edges.map((e) => e.id);
      setSelectedNodeIds(ns);
      setSelectedEdgeIds(es);
      if (ns.length > 0) setActiveId(ns[ns.length - 1]);
      onSelectionChange?.(ns, es);
    },
    [onSelectionChange],
  );

  /**
   * 节点拖动结束：根据拖动后位置相对父节点的方向，snap 到 8 方向。
   * - 拖动根节点：直接修改 root.growthDirection
   * - 拖动子节点：把方向写入子节点 growthDirection（仅作为该子树主方向；
   *   当前 layoutTree 仅看 root，所以子节点方向暂不影响布局，但保留以便后续扩展）
   * 无论如何，拖动不写回坐标——下一次渲染会回到布局位置。
   */
  const onNodeDragStop = useCallback(
    (_e: React.MouseEvent, node: Node) => {
      // 找到父节点（如果是 root 就和自身比较——此时用屏幕中心作参考）
      const parent = findParent(root, node.id);
      const referenceCenter = parent ? findRfCenter(flowData.rfNodes, parent.id) : null;
      const myCenter = {
        x: node.position.x + NODE_W / 2,
        y: node.position.y + NODE_H / 2,
      };

      let dx = 0;
      let dy = 0;
      if (referenceCenter) {
        dx = myCenter.x - referenceCenter.x;
        dy = myCenter.y - referenceCenter.y;
      } else {
        // 拖动 root：以拖动距离为参考（把 root 当作从原 root.position 移动）
        const original = findRfCenter(flowData.rfNodes, node.id);
        if (!original) {
          setNodes(flowData.rfNodes); // 还原
          return;
        }
        dx = myCenter.x - original.x;
        dy = myCenter.y - original.y;
      }

      const threshold = 20;
      if (Math.hypot(dx, dy) < threshold) {
        setNodes(flowData.rfNodes); // 微小拖动，回到原位
        return;
      }

      const dir: Dir8 = snapToDir8(dx, dy);
      const cloned = structuredClone(root);
      if (parent === null) {
        cloned.growthDirection = dir;
      } else {
        const target = findNode(cloned, node.id);
        if (target) target.growthDirection = dir;
      }
      onChange(cloned);
    },
    [root, flowData.rfNodes, setNodes, onChange],
  );

  // 节点变化：保持 RF 内部 dragging 状态，但不写回坐标到 tree
  const handleNodesChange = useCallback(
    (changes: NodeChange<Node<MindMapNodeData>>[]) => {
      onNodesChange(changes);
    },
    [onNodesChange],
  );

  /* ── 编辑操作 ── */

  const addChild = useCallback(() => {
    const target = activeId ?? root.id;
    const cloned = structuredClone(root);
    const targetNode = findNode(cloned, target);
    if (!targetNode) return;
    const child = createNode();
    targetNode.children.push(child);
    onChange(cloned);
    setActiveId(child.id);
    setSelectedNodeIds([child.id]);
  }, [activeId, root, onChange]);

  const addSibling = useCallback(() => {
    if (!activeId || activeId === root.id) {
      addChild();
      return;
    }
    const cloned = structuredClone(root);
    const parent = findParent(cloned, activeId);
    if (!parent) return;
    const idx = parent.children.findIndex((c) => c.id === activeId);
    const sibling = createNode();
    parent.children.splice(idx + 1, 0, sibling);
    onChange(cloned);
    setActiveId(sibling.id);
    setSelectedNodeIds([sibling.id]);
  }, [activeId, root, addChild, onChange]);

  const deleteSelected = useCallback(() => {
    const toRemove = selectedNodeIds.filter((id) => id !== root.id);
    if (toRemove.length === 0) return;
    const updated = removeNodeFromTree(root, toRemove);
    onChange(updated);
    setSelectedNodeIds([]);
    setActiveId(null);
  }, [selectedNodeIds, root, onChange]);

  /** 方向键导航：在树结构内部移动选择 */
  const navigateBy = useCallback(
    (key: string) => {
      if (!activeId) return;
      const navTarget = arrowKeyToNavTarget(key, cardinal);
      if (!navTarget) return;
      const next = navigate(root, activeId, navTarget);
      if (!next) return;
      setActiveId(next);
      setSelectedNodeIds([next]);
      onSelectionChange?.([next], selectedEdgeIds);
      // 把视口跟到新节点
      const center = findRfCenter(flowData.rfNodes, next);
      if (center) reactFlow.setCenter(center.x, center.y, { duration: 200, zoom: undefined });
    },
    [activeId, cardinal, root, selectedEdgeIds, onSelectionChange, flowData.rfNodes, reactFlow],
  );

  /* ── 键盘事件 ── */

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      if (e.key === 'Tab') {
        e.preventDefault();
        addChild();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        addSibling();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        deleteSelected();
      } else if (
        e.key === 'ArrowUp' ||
        e.key === 'ArrowDown' ||
        e.key === 'ArrowLeft' ||
        e.key === 'ArrowRight'
      ) {
        e.preventDefault();
        e.stopPropagation();
        navigateBy(e.key);
      }
    },
    [addChild, addSibling, deleteSelected, navigateBy],
  );

  return (
    <div
      ref={containerRef}
      className="panel mindmap-panel"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      style={{ outline: 'none' }}
    >
      <div className="panel-header">
        <span>Mind Map</span>
        <span style={{ fontSize: '0.75rem', color: '#93a4c7' }}>
          Tab:子节点 · Enter:兄弟节点 · Del:删除 · ←↑↓→:导航 · 拖动:改方向 · 双击:编辑 · Ctrl+Click:多选
        </span>
      </div>
      <div className="mindmap-canvas">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={handleNodesChange}
          onEdgesChange={onEdgesChange}
          onSelectionChange={handleSelectionChange}
          onNodeDragStop={onNodeDragStop}
          nodesConnectable={false}
          selectionOnDrag
          panOnDrag={[1, 2]}
          multiSelectionKeyCode={['Control', 'Meta']}
          selectionKeyCode="Shift"
          deleteKeyCode={null}
          disableKeyboardA11y
          fitView
          fitViewOptions={{ padding: 0.2 }}
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={16} size={1} color="#26334d" />
          <Controls position="bottom-right" />
          <MiniMap
            position="top-right"
            pannable
            zoomable
            maskColor="rgba(16,21,34,0.7)"
            style={{ background: '#141b2b', border: '1px solid #26334d' }}
          />
        </ReactFlow>
      </div>
    </div>
  );
}

export function MindMap(props: MindMapProps) {
  return (
    <ReactFlowProvider>
      <MindMapInner {...props} />
    </ReactFlowProvider>
  );
}
