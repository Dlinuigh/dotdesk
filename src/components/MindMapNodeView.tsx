import { memo, useEffect, useRef, useState } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { NodeStyle } from '../types';

export type MindMapNodeData = {
  label: string;
  style?: Partial<NodeStyle>;
  onLabelChange: (id: string, label: string) => void;
  onEnterEdit?: (id: string) => void;
  rankdir?: 'TB' | 'LR' | 'BT' | 'RL';
};

function nodeFillToCss(style: Partial<NodeStyle> | undefined, fallback: string) {
  return style?.fillcolor || fallback;
}

function MindMapNodeViewImpl(props: NodeProps) {
  const data = props.data as unknown as MindMapNodeData;
  const id = props.id;
  const selected = props.selected;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(data.label);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) setDraft(data.label);
  }, [data.label, editing]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const fillColor = nodeFillToCss(data.style, '#eef4ff');
  const strokeColor = data.style?.color || '#5b7cfa';
  const fontColor = data.style?.fontcolor || '#1a2235';
  const fontSize = data.style?.fontsize ?? 18;
  const fontFamily = data.style?.fontname || 'Inter';
  const fontWeight = data.style?.fontweight === 'bold' ? 700 : 500;
  const fontStyle = data.style?.fontstyle === 'italic' ? 'italic' : 'normal';
  const penWidth = data.style?.penwidth ?? 1;
  const rankdir = data.rankdir ?? 'LR';

  const isHorizontal = rankdir === 'LR' || rankdir === 'RL';
  const targetPos = isHorizontal ? Position.Left : Position.Top;
  const sourcePos = isHorizontal ? Position.Right : Position.Bottom;

  const commit = () => {
    const next = draft.trim() || 'Untitled';
    if (next !== data.label) data.onLabelChange(id, next);
    setEditing(false);
  };

  return (
    <div
      className={`mm-rf-node${selected ? ' mm-rf-node--selected' : ''}`}
      style={{
        background: fillColor,
        border: `${Math.max(1, penWidth)}px solid ${strokeColor}`,
        color: fontColor,
        fontSize,
        fontFamily,
        fontWeight,
        fontStyle,
        boxShadow: selected ? `0 0 0 2px ${strokeColor}66` : undefined,
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        setEditing(true);
      }}
    >
      <Handle type="target" position={targetPos} className="mm-rf-handle" />
      {editing ? (
        <input
          ref={inputRef}
          className="mm-rf-edit"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === 'Enter') commit();
            else if (e.key === 'Escape') {
              setDraft(data.label);
              setEditing(false);
            }
          }}
          style={{ color: fontColor, fontSize, fontFamily, fontWeight, fontStyle }}
        />
      ) : (
        <span className="mm-rf-label">{data.label}</span>
      )}
      <Handle type="source" position={sourcePos} className="mm-rf-handle" />
    </div>
  );
}

export const MindMapNodeView = memo(MindMapNodeViewImpl);
