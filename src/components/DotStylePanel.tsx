import { useCallback, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { DotStyleConfig, GraphStyle, NodeStyle, EdgeStyle } from '../types';
import { DEFAULT_DOT_STYLE } from '../types';

/* ── 辅助控件 ── */

type ColorInputProps = {
  label: string;
  value: string | undefined;
  onChange: (v: string | undefined) => void;
};
function ColorInput({ label, value, onChange }: ColorInputProps) {
  return (
    <div className="style-field">
      <label className="style-label">{label}</label>
      <div className="style-color-wrap">
        <input
          type="color"
          value={value || '#000000'}
          onChange={(e) => onChange(e.target.value || undefined)}
          className="style-color-picker"
        />
        <input
          type="text"
          value={value || ''}
          onChange={(e) => onChange(e.target.value || undefined)}
          placeholder="none"
          className="style-input"
        />
      </div>
    </div>
  );
}

type SelectInputProps = {
  label: string;
  value: string | undefined;
  options: { value: string; label: string }[];
  onChange: (v: string | undefined) => void;
};
function SelectInput({ label, value, options, onChange }: SelectInputProps) {
  return (
    <div className="style-field">
      <label className="style-label">{label}</label>
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value || undefined)}
        className="style-input style-select"
      >
        <option value="">(default)</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

type NumberInputProps = {
  label: string;
  value: number | undefined;
  min?: number;
  max?: number;
  step?: number;
  onChange: (v: number | undefined) => void;
};
function NumberInput({ label, value, min, max, step = 0.1, onChange }: NumberInputProps) {
  return (
    <div className="style-field">
      <label className="style-label">{label}</label>
      <input
        type="number"
        value={value ?? ''}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v === '' ? undefined : Number(v));
        }}
        className="style-input"
      />
    </div>
  );
}

type TextInputProps = {
  label: string;
  value: string | undefined;
  placeholder?: string;
  onChange: (v: string | undefined) => void;
};
function TextInput({ label, value, placeholder, onChange }: TextInputProps) {
  return (
    <div className="style-field">
      <label className="style-label">{label}</label>
      <input
        type="text"
        value={value || ''}
        placeholder={placeholder || '(default)'}
        onChange={(e) => onChange(e.target.value || undefined)}
        className="style-input"
      />
    </div>
  );
}

type BoolInputProps = {
  label: string;
  value: boolean | undefined;
  onChange: (v: boolean | undefined) => void;
};
function BoolInput({ label, value, onChange }: BoolInputProps) {
  return (
    <div className="style-field style-field--row">
      <label className="style-label">{label}</label>
      <input
        type="checkbox"
        checked={value ?? false}
        onChange={(e) => onChange(e.target.checked || undefined)}
        className="style-checkbox"
      />
    </div>
  );
}

/* ── 可折叠分组 ── */

type CollapsibleGroupProps = {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
};
function CollapsibleGroup({ title, defaultOpen = true, children }: CollapsibleGroupProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="style-section">
      <button type="button" className="style-section-header" onClick={() => setOpen(!open)}>
        <span>{open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</span>
        <span>{title}</span>
      </button>
      {open && <div className="style-section-body">{children}</div>}
    </div>
  );
}

/* ── Graph 区域 ── */

function GraphFields({ style, onChange }: { style: GraphStyle; onChange: (s: GraphStyle) => void }) {
  const set = useCallback(
    <K extends keyof GraphStyle>(key: K, value: GraphStyle[K]) => {
      onChange({ ...style, [key]: value });
    },
    [style, onChange],
  );
  return (
    <>
      <div className="style-group">
        <div className="style-group-title">Layout</div>
        <SelectInput label="rankdir" value={style.rankdir} options={[
          { value: 'TB', label: 'TB (top→bottom)' },
          { value: 'LR', label: 'LR (left→right)' },
          { value: 'BT', label: 'BT (bottom→top)' },
          { value: 'RL', label: 'RL (right→left)' },
        ]} onChange={(v) => set('rankdir', v as GraphStyle['rankdir'])} />
        <SelectInput label="layout" value={style.layout} options={[
          { value: 'dot', label: 'dot' }, { value: 'neato', label: 'neato' },
          { value: 'twopi', label: 'twopi' }, { value: 'circo', label: 'circo' },
          { value: 'fdp', label: 'fdp' }, { value: 'sfdp', label: 'sfdp' },
          { value: 'osage', label: 'osage' }, { value: 'patchwork', label: 'patchwork' },
        ]} onChange={(v) => set('layout', v)} />
        <SelectInput label="splines" value={style.splines} options={[
          { value: 'true', label: 'true' }, { value: 'false', label: 'false (straight)' },
          { value: 'polyline', label: 'polyline' }, { value: 'ortho', label: 'ortho' },
          { value: 'curved', label: 'curved' },
        ]} onChange={(v) => set('splines', v)} />
        <NumberInput label="nodesep" value={style.nodesep} min={0} step={0.05} onChange={(v) => set('nodesep', v)} />
        <NumberInput label="ranksep" value={style.ranksep} min={0} step={0.05} onChange={(v) => set('ranksep', v)} />
      </div>
      <div className="style-group">
        <div className="style-group-title">Colors</div>
        <ColorInput label="bgcolor" value={style.bgcolor} onChange={(v) => set('bgcolor', v)} />
        <ColorInput label="fontcolor" value={style.fontcolor} onChange={(v) => set('fontcolor', v)} />
      </div>
      <div className="style-group">
        <div className="style-group-title">Typography</div>
        <TextInput label="fontname" value={style.fontname} onChange={(v) => set('fontname', v)} />
        <NumberInput label="fontsize" value={style.fontsize} min={1} max={200} step={1} onChange={(v) => set('fontsize', v)} />
        <TextInput label="label" value={style.label} placeholder="Graph label" onChange={(v) => set('label', v)} />
      </div>
      <div className="style-group">
        <div className="style-group-title">Dimensions</div>
        <TextInput label="pad" value={style.pad} placeholder="e.g. 0.5" onChange={(v) => set('pad', v)} />
        <TextInput label="margin" value={style.margin} placeholder="e.g. 0.5,0.5" onChange={(v) => set('margin', v)} />
        <NumberInput label="dpi" value={style.dpi} min={1} step={1} onChange={(v) => set('dpi', v)} />
        <TextInput label="overlap" value={style.overlap} placeholder="scale / prism" onChange={(v) => set('overlap', v)} />
      </div>
      <div className="style-group">
        <div className="style-group-title">Options</div>
        <BoolInput label="compound" value={style.compound} onChange={(v) => set('compound', v)} />
        <BoolInput label="center" value={style.center} onChange={(v) => set('center', v)} />
        <BoolInput label="concentrate" value={style.concentrate} onChange={(v) => set('concentrate', v)} />
      </div>
    </>
  );
}

/* ── Node 区域 ── */

function NodeFields({ style, onChange }: { style: NodeStyle; onChange: (s: NodeStyle) => void }) {
  const set = useCallback(
    <K extends keyof NodeStyle>(key: K, value: NodeStyle[K]) => {
      onChange({ ...style, [key]: value });
    },
    [style, onChange],
  );
  return (
    <>
      <div className="style-group">
        <div className="style-group-title">Shape & Style</div>
        <SelectInput label="shape" value={style.shape} options={[
          { value: 'box', label: 'box' }, { value: 'ellipse', label: 'ellipse' },
          { value: 'circle', label: 'circle' }, { value: 'diamond', label: 'diamond' },
          { value: 'plaintext', label: 'plaintext' }, { value: 'none', label: 'none' },
          { value: 'doublecircle', label: 'doublecircle' }, { value: 'egg', label: 'egg' },
          { value: 'hexagon', label: 'hexagon' }, { value: 'octagon', label: 'octagon' },
          { value: 'parallelogram', label: 'parallelogram' }, { value: 'square', label: 'square' },
          { value: 'star', label: 'star' }, { value: 'triangle', label: 'triangle' },
          { value: 'Msquare', label: 'Msquare' }, { value: 'Mdiamond', label: 'Mdiamond' },
          { value: 'Mcircle', label: 'Mcircle' },
        ]} onChange={(v) => set('shape', v)} />
        <TextInput label="style" value={style.style} placeholder="solid / filled / rounded" onChange={(v) => set('style', v)} />
        <NumberInput label="peripheries" value={style.peripheries} min={1} max={10} step={1} onChange={(v) => set('peripheries', v)} />
        <NumberInput label="gradientangle" value={style.gradientangle} min={0} max={360} step={1} onChange={(v) => set('gradientangle', v)} />
      </div>
      <div className="style-group">
        <div className="style-group-title">Colors</div>
        <ColorInput label="fillcolor" value={style.fillcolor} onChange={(v) => set('fillcolor', v)} />
        <ColorInput label="color (stroke)" value={style.color} onChange={(v) => set('color', v)} />
        <ColorInput label="fontcolor" value={style.fontcolor} onChange={(v) => set('fontcolor', v)} />
      </div>
      <div className="style-group">
        <div className="style-group-title">Typography</div>
        <TextInput label="fontname" value={style.fontname} onChange={(v) => set('fontname', v)} />
        <NumberInput label="fontsize" value={style.fontsize} min={1} max={200} step={1} onChange={(v) => set('fontsize', v)} />
      </div>
      <div className="style-group">
        <div className="style-group-title">Dimensions</div>
        <NumberInput label="width (in)" value={style.width} min={0} step={0.1} onChange={(v) => set('width', v)} />
        <NumberInput label="height (in)" value={style.height} min={0} step={0.1} onChange={(v) => set('height', v)} />
        <NumberInput label="penwidth" value={style.penwidth} min={0} step={0.5} onChange={(v) => set('penwidth', v)} />
      </div>
    </>
  );
}

/* ── Edge 区域 ── */

function EdgeFields({ style, onChange }: { style: EdgeStyle; onChange: (s: EdgeStyle) => void }) {
  const set = useCallback(
    <K extends keyof EdgeStyle>(key: K, value: EdgeStyle[K]) => {
      onChange({ ...style, [key]: value });
    },
    [style, onChange],
  );
  return (
    <>
      <div className="style-group">
        <div className="style-group-title">Arrow</div>
        <SelectInput label="arrowhead" value={style.arrowhead} options={[
          { value: 'normal', label: 'normal' }, { value: 'vee', label: 'vee' },
          { value: 'dot', label: 'dot' }, { value: 'diamond', label: 'diamond' },
          { value: 'box', label: 'box' }, { value: 'crow', label: 'crow' },
          { value: 'none', label: 'none' }, { value: 'tee', label: 'tee' },
          { value: 'open', label: 'open' },
        ]} onChange={(v) => set('arrowhead', v)} />
        <SelectInput label="arrowtail" value={style.arrowtail} options={[
          { value: 'normal', label: 'normal' }, { value: 'vee', label: 'vee' },
          { value: 'dot', label: 'dot' }, { value: 'diamond', label: 'diamond' },
          { value: 'box', label: 'box' }, { value: 'crow', label: 'crow' },
          { value: 'none', label: 'none' }, { value: 'tee', label: 'tee' },
        ]} onChange={(v) => set('arrowtail', v)} />
        <NumberInput label="arrowsize" value={style.arrowsize} min={0} step={0.25} onChange={(v) => set('arrowsize', v)} />
        <SelectInput label="dir" value={style.dir} options={[
          { value: 'forward', label: 'forward' }, { value: 'back', label: 'back' },
          { value: 'both', label: 'both' }, { value: 'none', label: 'none' },
        ]} onChange={(v) => set('dir', v as EdgeStyle['dir'])} />
      </div>
      <div className="style-group">
        <div className="style-group-title">Colors</div>
        <ColorInput label="color" value={style.color} onChange={(v) => set('color', v)} />
        <ColorInput label="fontcolor" value={style.fontcolor} onChange={(v) => set('fontcolor', v)} />
      </div>
      <div className="style-group">
        <div className="style-group-title">Style</div>
        <SelectInput label="linestyle" value={style.style} options={[
          { value: 'solid', label: 'solid' }, { value: 'dashed', label: 'dashed' },
          { value: 'dotted', label: 'dotted' }, { value: 'bold', label: 'bold' },
        ]} onChange={(v) => set('style', v)} />
        <NumberInput label="penwidth" value={style.penwidth} min={0} step={0.5} onChange={(v) => set('penwidth', v)} />
        <NumberInput label="weight" value={style.weight} min={0} step={1} onChange={(v) => set('weight', v)} />
      </div>
      <div className="style-group">
        <div className="style-group-title">Typography</div>
        <TextInput label="fontname" value={style.fontname} onChange={(v) => set('fontname', v)} />
        <NumberInput label="fontsize" value={style.fontsize} min={1} max={200} step={1} onChange={(v) => set('fontsize', v)} />
      </div>
      <div className="style-group">
        <div className="style-group-title">Options</div>
        <BoolInput label="decorate" value={style.decorate} onChange={(v) => set('decorate', v)} />
      </div>
    </>
  );
}

/* ── 主组件（边栏） ── */

type DotStylePanelProps = {
  globalStyle: DotStyleConfig;
  selectedNodeStyle?: Partial<NodeStyle>;
  selectedCount: number;
  onChangeGlobal: (style: DotStyleConfig) => void;
  onChangeSelected: (s: Partial<NodeStyle>) => void;
};

export function DotStylePanel({
  globalStyle,
  selectedNodeStyle,
  selectedCount,
  onChangeGlobal,
  onChangeSelected,
}: DotStylePanelProps) {
  const [sections, setSections] = useState<Record<string, boolean>>({
    graph: true,
    node: true,
    edge: false,
  });

  const handleReset = () => {
    onChangeGlobal(DEFAULT_DOT_STYLE);
  };

  const nodeLabel = selectedCount > 0
    ? `Node (${selectedCount} selected)`
    : 'Node (defaults)';

  return (
    <div className="panel style-sidebar">
      <div className="panel-header">
        <span>Style</span>
        <button type="button" className="style-reset-btn" onClick={handleReset}>
          Reset
        </button>
      </div>
      <div className="style-sidebar-body">
        {/* Graph */}
        <div className="style-section">
          <button
            type="button"
            className="style-section-header"
            onClick={() => setSections((s) => ({ ...s, graph: !s.graph }))}
          >
            <span>{sections.graph ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</span>
            <span>Graph</span>
          </button>
          {sections.graph && (
            <div className="style-section-body">
              <GraphFields
                style={globalStyle.graph}
                onChange={(g) => onChangeGlobal({ ...globalStyle, graph: g })}
              />
            </div>
          )}
        </div>

        {/* Node */}
        <div className="style-section">
          <button
            type="button"
            className="style-section-header"
            onClick={() => setSections((s) => ({ ...s, node: !s.node }))}
          >
            <span>{sections.node ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</span>
            <span>{nodeLabel}</span>
          </button>
          {sections.node && (
            <div className="style-section-body">
              <NodeFields
                style={selectedCount > 0 ? (selectedNodeStyle ?? globalStyle.node) : globalStyle.node}
                onChange={(s) => {
                  if (selectedCount > 0) {
                    onChangeSelected(s);
                  } else {
                    onChangeGlobal({ ...globalStyle, node: s });
                  }
                }}
              />
            </div>
          )}
        </div>

        {/* Edge */}
        <div className="style-section">
          <button
            type="button"
            className="style-section-header"
            onClick={() => setSections((s) => ({ ...s, edge: !s.edge }))}
          >
            <span>{sections.edge ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</span>
            <span>Edge</span>
          </button>
          {sections.edge && (
            <div className="style-section-body">
              <EdgeFields
                style={globalStyle.edge}
                onChange={(e) => onChangeGlobal({ ...globalStyle, edge: e })}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
