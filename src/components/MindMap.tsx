import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type OnSelectionChangeParams,
  type NodeChange,
} from '@xyflow/react';
import dagre from 'dagre';
import type {
  DotStyleConfig,
  EdgeStyle,
  EdgeStyleMap,
  GraphStyle,
  MindMapNode,
  NodeStyle,
} from '../types';
import { MindMapNodeView, type MindMapNodeData } from './MindMapNodeView';

let _idCounter = 0;
function genId(): string {
  return `n${++_idCounter}_${Date.now()}`;
}

function createNode(label = 'New Node'): MindMapNode {
  return { id: genId(), label, children: [] };
}

/* ── DOT 序列化 ── */

function styleToAttr(obj: Record<string, unknown>): string {
  return Object.entries(obj)
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
  const entries = Object.entries(style).filter(([, v]) => v !== undefined && v !== null && v !== '');
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

function flatNodes(root: MindMapNode): MindMapNode[] {
  const out: MindMapNode[] = [];
  function walk(n: MindMapNode) {
    out.push(n);
    for (const c of n.children) walk(c);
  }
  walk(root);
  return out;
}

/** 写入指定节点的 position（返回新树） */
function setNodePosition(root: MindMapNode, id: string, pos: { x: number; y: number }): MindMapNode {
  const cloned = structuredClone(root);
  const target = findNode(cloned, id);
  if (target) target.position = pos;
  return cloned;
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

/* ── dagre 布局 ── */

const NODE_W = 160;
const NODE_H = 44;

function computeMissingLayout(
  rfNodes: Node<MindMapNodeData>[],
  rfEdges: Edge[],
  rankdir: GraphStyle['rankdir'] = 'LR',
): Node<MindMapNodeData>[] {
  const allHave = rfNodes.every((n) => n.position && (n.position.x !== 0 || n.position.y !== 0));
  if (allHave) return rfNodes;

  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: rankdir || 'LR', nodesep: 40, ranksep: 100 });
  g.setDefaultEdgeLabel(() => ({}));
  rfNodes.forEach((n) => g.setNode(n.id, { width: NODE_W, height: NODE_H }));
  rfEdges.forEach((e) => g.setEdge(e.source, e.target));
  dagre.layout(g);

  return rfNodes.map((n) => {
    if (n.position && (n.position.x !== 0 || n.position.y !== 0)) return n;
    const laid = g.node(n.id);
    return { ...n, position: { x: laid.x - NODE_W / 2, y: laid.y - NODE_H / 2 } };
  });
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

  function walk(node: MindMapNode) {
    rfNodes.push({
      id: node.id,
      type: 'mindNode',
      position: node.position ?? { x: 0, y: 0 },
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
  const rankdir = globalStyle?.graph?.rankdir ?? 'LR';
  const containerRef = useRef<HTMLDivElement>(null);
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

  // 树 → RF 数据（每次 root/style 变化重新计算）
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

  // 同步 RF 状态：root 结构变化或样式变化时重建 nodes/edges
  useEffect(() => {
    const positioned = computeMissingLayout(flowData.rfNodes, flowData.rfEdges, rankdir);
    setNodes(positioned);
    setEdges(flowData.rfEdges);

    // 如果有节点没有位置（首次布局），把布局结果写回 tree
    const treeAllHavePositions = flatNodes(root).every(
      (n) => n.position && (n.position.x !== 0 || n.position.y !== 0),
    );
    if (!treeAllHavePositions) {
      const cloned = structuredClone(root);
      for (const n of positioned) {
        const target = findNode(cloned, n.id);
        if (target) target.position = n.position;
      }
      onChange(cloned);
    }
  }, [flowData, rankdir, setNodes, setEdges]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // 节点拖动结束：写入 position 到 tree
  const onNodeDragStop = useCallback(
    (_e: React.MouseEvent, node: Node) => {
      const updated = setNodePosition(root, node.id, node.position);
      onChange(updated);
    },
    [root, onChange],
  );

  // 节点变化（捕获多选拖动）
  const handleNodesChange = useCallback(
    (changes: NodeChange<Node<MindMapNodeData>>[]) => {
      onNodesChange(changes);
      // 多选拖动时，position 类型变化的 dragging=false 表示拖动结束
      const dragEnded = changes.filter(
        (c) => c.type === 'position' && (c as { dragging?: boolean }).dragging === false,
      );
      if (dragEnded.length > 1) {
        let updated = root;
        for (const ch of dragEnded) {
          const change = ch as { id: string; position?: { x: number; y: number } };
          if (change.position) {
            updated = setNodePosition(updated, change.id, change.position);
          }
        }
        if (updated !== root) onChange(updated);
      }
    },
    [onNodesChange, root, onChange],
  );

  /* ── 编辑操作 ── */

  const addChild = useCallback(() => {
    const target = activeId ?? root.id;
    const cloned = structuredClone(root);
    const targetNode = findNode(cloned, target);
    if (!targetNode) return;
    const child = createNode();
    // 位置：偏移自父节点
    if (targetNode.position) {
      const offsetX = rankdir === 'LR' ? 220 : 0;
      const offsetY = rankdir === 'LR' ? targetNode.children.length * 60 : 100;
      child.position = {
        x: targetNode.position.x + offsetX,
        y: targetNode.position.y + offsetY,
      };
    }
    targetNode.children.push(child);
    onChange(cloned);
    setActiveId(child.id);
    setSelectedNodeIds([child.id]);
  }, [activeId, root, rankdir, onChange]);

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
    const refNode = parent.children[idx];
    if (refNode.position) {
      sibling.position = {
        x: refNode.position.x,
        y: refNode.position.y + (rankdir === 'LR' ? 60 : 100),
      };
    }
    parent.children.splice(idx + 1, 0, sibling);
    onChange(cloned);
    setActiveId(sibling.id);
    setSelectedNodeIds([sibling.id]);
  }, [activeId, root, rankdir, addChild, onChange]);

  const deleteSelected = useCallback(() => {
    const toRemove = selectedNodeIds.filter((id) => id !== root.id);
    if (toRemove.length === 0) return;
    const updated = removeNodeFromTree(root, toRemove);
    onChange(updated);
    setSelectedNodeIds([]);
    setActiveId(null);
  }, [selectedNodeIds, root, onChange]);

  /* ── 键盘事件 ── */

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // 正在编辑 input 时不拦截
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
      }
    },
    [addChild, addSibling, deleteSelected],
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
          Tab:子节点 · Enter:兄弟节点 · Del:删除 · Ctrl/⌘+Click:多选 · Shift+拖拽:框选 · 双击:编辑
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
