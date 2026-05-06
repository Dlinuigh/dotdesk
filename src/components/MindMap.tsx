import { useCallback, useEffect, useRef, useState } from 'react';
import type { MindMapNode } from '../types';

let _idCounter = 0;
function genId(): string {
  return `n${++_idCounter}_${Date.now()}`;
}

function createNode(label = 'New Node'): MindMapNode {
  return { id: genId(), label, children: [] };
}

/** 从节点树生成 DOT 源码 */
export function mindMapToDot(root: MindMapNode): string {
  const lines: string[] = [];
  lines.push('digraph mindmap {');
  lines.push('  rankdir=LR;');
  lines.push('  node [shape=box, style="rounded,filled", fillcolor="#eef4ff", color="#5b7cfa", fontname="Inter"];');
  lines.push('  edge [color="#5b7cfa", arrowhead="vee"];');
  lines.push('');

  function walk(node: MindMapNode) {
    const escaped = node.label.replace(/"/g, '\\"');
    lines.push(`  "${node.id}" [label="${escaped}"];`);
    for (const child of node.children) {
      lines.push(`  "${node.id}" -> "${child.id}";`);
      walk(child);
    }
  }

  walk(root);

  lines.push('}');
  return lines.join('\n');
}

/** 查找节点（BFS） */
function findNode(root: MindMapNode, id: string): MindMapNode | null {
  if (root.id === id) return root;
  for (const child of root.children) {
    const found = findNode(child, id);
    if (found) return found;
  }
  return null;
}

/** 查找父节点 */
function findParent(root: MindMapNode, id: string): MindMapNode | null {
  for (const child of root.children) {
    if (child.id === id) return root;
    const found = findParent(child, id);
    if (found) return found;
  }
  return null;
}

/** 深度优先遍历获取所有节点（平铺） */
function getFlatNodes(root: MindMapNode): MindMapNode[] {
  const result: MindMapNode[] = [];
  function walk(node: MindMapNode) {
    result.push(node);
    for (const child of node.children) walk(child);
  }
  walk(root);
  return result;
}

/** 获取前一个兄弟节点 */
function prevSibling(parent: MindMapNode, id: string): MindMapNode | null {
  const idx = parent.children.findIndex((c) => c.id === id);
  return idx > 0 ? parent.children[idx - 1] : null;
}

/* ────────── 组件 ────────── */

type MindMapProps = {
  root: MindMapNode;
  onChange: (root: MindMapNode) => void;
  onDotChange: (dot: string) => void;
};

export function MindMap({ root, onChange, onDotChange }: MindMapProps) {
  const [selectedId, setSelectedId] = useState(root.id);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // 通知外部 DOT 变更
  const notifyDot = useCallback(
    (node: MindMapNode) => {
      onDotChange(mindMapToDot(node));
    },
    [onDotChange],
  );

  // 更新树（不可变）
  const updateTree = useCallback(
    (fn: (node: MindMapNode) => MindMapNode) => {
      const updated = fn(structuredClone(root));
      onChange(updated);
      notifyDot(updated);
    },
    [root, onChange, notifyDot],
  );

  // 聚焦编辑框
  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);

  // 选中节点滚动到视图中
  useEffect(() => {
    const el = nodeRefs.current.get(selectedId);
    if (el && containerRef.current) {
      el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [selectedId]);

  // 确保选中节点始终存在
  useEffect(() => {
    if (!findNode(root, selectedId)) {
      setSelectedId(root.id);
    }
  }, [root, selectedId]);

  /* ── 导航 ── */

  const selectNext = useCallback(() => {
    const flat = getFlatNodes(root);
    const idx = flat.findIndex((n) => n.id === selectedId);
    if (idx < flat.length - 1) setSelectedId(flat[idx + 1].id);
  }, [root, selectedId]);

  const selectPrev = useCallback(() => {
    const flat = getFlatNodes(root);
    const idx = flat.findIndex((n) => n.id === selectedId);
    if (idx > 0) setSelectedId(flat[idx - 1].id);
  }, [root, selectedId]);

  const selectFirstChild = useCallback(() => {
    const target = findNode(root, selectedId);
    if (target && target.children.length > 0) {
      setSelectedId(target.children[0].id);
    }
  }, [root, selectedId]);

  const selectParent = useCallback(() => {
    const parent = findParent(root, selectedId);
    if (parent) setSelectedId(parent.id);
  }, [root, selectedId]);

  /* ── 操作 ── */

  const addChild = useCallback(() => {
    updateTree((node) => {
      const target = findNode(node, selectedId);
      if (target) {
        const child = createNode();
        target.children.push(child);
        setSelectedId(child.id);
      }
      return node;
    });
  }, [selectedId, updateTree]);

  const addSibling = useCallback(() => {
    if (selectedId === root.id) {
      addChild();
      return;
    }
    updateTree((node) => {
      const parent = findParent(node, selectedId);
      if (parent) {
        const sibling = createNode();
        const idx = parent.children.findIndex((c) => c.id === selectedId);
        parent.children.splice(idx + 1, 0, sibling);
        setSelectedId(sibling.id);
      }
      return node;
    });
  }, [root.id, selectedId, addChild, updateTree]);

  const deleteNode = useCallback(() => {
    if (selectedId === root.id) return;
    updateTree((node) => {
      const parent = findParent(node, selectedId);
      if (parent) {
        const idx = parent.children.findIndex((c) => c.id === selectedId);
        const prev = idx > 0 ? parent.children[idx - 1] : null;
        parent.children.splice(idx, 1);
        setSelectedId(prev ? prev.id : parent.id);
      }
      return node;
    });
  }, [root.id, selectedId, updateTree]);

  const startEdit = useCallback((id: string, label: string) => {
    setEditingId(id);
    setEditValue(label);
  }, []);

  const commitEdit = useCallback(() => {
    if (editingId === null) return;
    const trimmed = editValue.trim() || 'Untitled';
    updateTree((node) => {
      const target = findNode(node, editingId);
      if (target) target.label = trimmed;
      return node;
    });
    setEditingId(null);
    // 退出编辑后把焦点还给容器，让方向键等键盘事件可用
    containerRef.current?.focus();
  }, [editingId, editValue, updateTree]);

  /* ── 键盘事件 ── */

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (editingId) {
        if (e.key === 'Escape') {
          setEditingId(null);
        } else if (e.key === 'Enter') {
          commitEdit();
        }
        return;
      }

      switch (e.key) {
        case 'Tab':
          e.preventDefault();
          addChild();
          break;
        case 'Enter':
          e.preventDefault();
          addSibling();
          break;
        case 'Delete':
        case 'Backspace':
          e.preventDefault();
          deleteNode();
          break;
        case 'ArrowDown':
          e.preventDefault();
          selectNext();
          break;
        case 'ArrowUp':
          e.preventDefault();
          selectPrev();
          break;
        case 'ArrowRight':
          e.preventDefault();
          selectFirstChild();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          selectParent();
          break;
        case ' ':
          e.preventDefault();
          {
            const node = findNode(root, selectedId);
            if (node) startEdit(node.id, node.label);
          }
          break;
      }
    },
    [editingId, addChild, addSibling, deleteNode, commitEdit, selectNext, selectPrev, selectFirstChild, selectParent, root, selectedId, startEdit],
  );

  /* ── 渲染节点树 ── */

  function renderNode(node: MindMapNode, depth: number): React.ReactNode {
    const isSelected = node.id === selectedId;
    const isEditing = node.id === editingId;

    const dotColor = isSelected ? '#ff6b6b' : '#5b7cfa';

    return (
      <div key={node.id} style={{ marginLeft: depth > 0 ? 28 : 0 }}>
        <div
          ref={(el) => {
            if (el) nodeRefs.current.set(node.id, el);
            else nodeRefs.current.delete(node.id);
          }}
          className={`mm-node${isSelected ? ' mm-node--selected' : ''}`}
          style={{
            border: `2px solid ${dotColor}`,
            borderRadius: 10,
            padding: '6px 14px',
            margin: '4px 0',
            cursor: 'pointer',
            background: isSelected ? '#1e2a4a' : '#141b2b',
            transition: 'border-color 0.15s, background 0.15s',
            display: 'inline-block',
            minWidth: 80,
          }}
          onClick={() => setSelectedId(node.id)}
        >
          {isEditing ? (
            <input
              ref={inputRef}
              className="mm-edit-input"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitEdit();
                if (e.key === 'Escape') {
                  setEditingId(null);
                  containerRef.current?.focus();
                }
                e.stopPropagation();
              }}
              style={{
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: '#ecf2ff',
                font: 'inherit',
                fontSize: '0.95rem',
                minWidth: 40,
                width: `${Math.max(40, editValue.length * 9)}px`,
              }}
            />
          ) : (
            <span style={{ fontSize: '0.95rem', fontWeight: isSelected ? 700 : 500, userSelect: 'none' }}>
              {node.label}
            </span>
          )}
        </div>
        {node.children.length > 0 && (
          <div style={{ borderLeft: '2px solid #34415f', marginLeft: 14, paddingLeft: 14 }}>
            {node.children.map((child) => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="panel mindmap-panel"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      style={{ outline: 'none', overflow: 'auto' }}
    >
      <div className="panel-header">
        <span>Mind Map</span>
        <span style={{ fontSize: '0.75rem', color: '#93a4c7' }}>
          Tab:子节点 · Enter:兄弟节点 · 方向键:移动 · Space:编辑 · Del:删除
        </span>
      </div>
      <div style={{ padding: '1.2rem 1.5rem', minHeight: 200 }}>
        {renderNode(root, 0)}
      </div>
    </div>
  );
}
