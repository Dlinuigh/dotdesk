import { useCallback, useEffect, useRef, useState } from 'react';
import type { DotStyleConfig, MindMapNode, NodeStyle } from '../types';

let _idCounter = 0;
function genId(): string {
  return `n${++_idCounter}_${Date.now()}`;
}

function createNode(label = 'New Node'): MindMapNode {
  return { id: genId(), label, children: [] };
}

/** 将样式对象转为 DOT 属性字符串 */
function styleToAttr(obj: Record<string, unknown>): string {
  return Object.entries(obj)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => {
      const val = typeof v === 'boolean' ? (v ? 'true' : 'false') : String(v);
      // 颜色值（#开头）、含空格或特殊字符的值需要加引号
      const needsQuote = /^#/.test(val) || /[ ,"']/.test(val);
      return needsQuote ? `  ${k}="${val}"` : `  ${k}=${val}`;
    })
    .join(',\n');
}

/** 将单个节点的 style 转为内联属性字符串 */
function nodeStyleToAttr(style: Partial<NodeStyle> | undefined): string {
  if (!style) return '';
  const entries = Object.entries(style).filter(([, v]) => v !== undefined && v !== null && v !== '');
  if (entries.length === 0) return '';
  return entries
    .map(([k, v]) => {
      const val = String(v);
      const needsQuote = /^#/.test(val) || /[ ,"']/.test(val);
      return `${k}="${val}"`;
    })
    .join(', ');
}

/** 从节点树生成 DOT 源码 */
export function mindMapToDot(root: MindMapNode, style?: DotStyleConfig): string {
  const lines: string[] = [];
  lines.push('digraph mindmap {');

  // graph attributes
  if (style?.graph) {
    const g = styleToAttr(style.graph as Record<string, unknown>);
    if (g) {
      lines.push(`graph [\n${g}\n];`);
    }
  }

  // node default attributes
  if (style?.node) {
    const n = styleToAttr(style.node as Record<string, unknown>);
    if (n) {
      lines.push(`node [\n${n}\n];`);
    }
  }

  // edge default attributes
  if (style?.edge) {
    const e = styleToAttr(style.edge as Record<string, unknown>);
    if (e) {
      lines.push(`edge [\n${e}\n];`);
    }
  }

  lines.push('');

  function walk(node: MindMapNode) {
    const escaped = node.label.replace(/"/g, '\\"');
    const styleAttr = nodeStyleToAttr(node.style);
    const suffix = styleAttr ? `, ${styleAttr}` : '';
    lines.push(`  "${node.id}" [label="${escaped}"${suffix}];`);
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
  onSelectionChange?: (ids: string[]) => void;
  style?: DotStyleConfig;
};

export function MindMap({ root, onChange, onDotChange, onSelectionChange, style }: MindMapProps) {
  const [activeId, setActiveId] = useState(root.id);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set([root.id]));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // 通知外部选中变化
  useEffect(() => {
    onSelectionChange?.(Array.from(selectedIds));
  }, [selectedIds, onSelectionChange]);

  // 通知外部 DOT 变更
  const notifyDot = useCallback(
    (node: MindMapNode) => {
      onDotChange(mindMapToDot(node, style));
    },
    [onDotChange, style],
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
    const el = nodeRefs.current.get(activeId);
    if (el && containerRef.current) {
      el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [activeId]);

  // 确保 activeId 始终存在
  useEffect(() => {
    if (!findNode(root, activeId)) {
      setActiveId(root.id);
      setSelectedIds(new Set([root.id]));
    }
  }, [root, activeId]);

  /* ── 选择操作 ── */

  const handleNodeClick = useCallback(
    (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      setActiveId(id);
      if (e.ctrlKey || e.metaKey) {
        // Ctrl+Click: 切换选中
        setSelectedIds((prev) => {
          const next = new Set(prev);
          if (next.has(id)) {
            if (next.size > 1) next.delete(id); // 保留至少一个选中
          } else {
            next.add(id);
          }
          return next;
        });
      } else {
        // 普通点击：单选
        setSelectedIds(new Set([id]));
      }
    },
    [],
  );

  /* ── 导航 ── */

  const selectNext = useCallback(() => {
    const flat = getFlatNodes(root);
    const idx = flat.findIndex((n) => n.id === activeId);
    if (idx < flat.length - 1) {
      const nextId = flat[idx + 1].id;
      setActiveId(nextId);
      setSelectedIds(new Set([nextId]));
    }
  }, [root, activeId]);

  const selectPrev = useCallback(() => {
    const flat = getFlatNodes(root);
    const idx = flat.findIndex((n) => n.id === activeId);
    if (idx > 0) {
      const prevId = flat[idx - 1].id;
      setActiveId(prevId);
      setSelectedIds(new Set([prevId]));
    }
  }, [root, activeId]);

  const selectFirstChild = useCallback(() => {
    const target = findNode(root, activeId);
    if (target && target.children.length > 0) {
      const childId = target.children[0].id;
      setActiveId(childId);
      setSelectedIds(new Set([childId]));
    }
  }, [root, activeId]);

  const selectParent = useCallback(() => {
    const parent = findParent(root, activeId);
    if (parent) {
      setActiveId(parent.id);
      setSelectedIds(new Set([parent.id]));
    }
  }, [root, activeId]);

  /* ── 操作 ── */

  const addChild = useCallback(() => {
    updateTree((node) => {
      const target = findNode(node, activeId);
      if (target) {
        const child = createNode();
        target.children.push(child);
        setActiveId(child.id);
        setSelectedIds(new Set([child.id]));
      }
      return node;
    });
  }, [activeId, updateTree]);

  const addSibling = useCallback(() => {
    if (activeId === root.id) {
      addChild();
      return;
    }
    updateTree((node) => {
      const parent = findParent(node, activeId);
      if (parent) {
        const sibling = createNode();
        const idx = parent.children.findIndex((c) => c.id === activeId);
        parent.children.splice(idx + 1, 0, sibling);
        setActiveId(sibling.id);
        setSelectedIds(new Set([sibling.id]));
      }
      return node;
    });
  }, [root.id, activeId, addChild, updateTree]);

  const deleteNode = useCallback(() => {
    if (activeId === root.id) return;
    updateTree((node) => {
      const parent = findParent(node, activeId);
      if (parent) {
        const idx = parent.children.findIndex((c) => c.id === activeId);
        const prev = idx > 0 ? parent.children[idx - 1] : null;
        parent.children.splice(idx, 1);
        // 删除后选中父节点或前一个兄弟
        const nextId = prev ? prev.id : parent.id;
        setActiveId(nextId);
        setSelectedIds(new Set([nextId]));
      }
      return node;
    });
  }, [root.id, activeId, updateTree]);

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
            const node = findNode(root, activeId);
            if (node) startEdit(node.id, node.label);
          }
          break;
      }
    },
    [editingId, addChild, addSibling, deleteNode, commitEdit, selectNext, selectPrev, selectFirstChild, selectParent, root, activeId, startEdit],
  );

  /* ── 渲染节点树 ── */

  function renderNode(node: MindMapNode, depth: number): React.ReactNode {
    const isSelected = selectedIds.has(node.id);
    const isActive = node.id === activeId;
    const isEditing = node.id === editingId;

    const dotColor = isActive && isSelected ? '#ff6b6b' : '#5b7cfa';

    return (
      <div key={node.id} style={{ marginLeft: depth > 0 ? 28 : 0 }}>
        <div
          ref={(el) => {
            if (el) nodeRefs.current.set(node.id, el);
            else nodeRefs.current.delete(node.id);
          }}
          className={`mm-node${isSelected ? ' mm-node--selected' : ''}${isActive ? ' mm-node--active' : ''}`}
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
            outline: isSelected ? '1px solid #6f8dff88' : undefined,
          }}
          onClick={(e) => handleNodeClick(e, node.id)}
          onDoubleClick={() => startEdit(node.id, node.label)}
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
