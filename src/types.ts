export type RenderResult = {
  ok: boolean;
  svg: string | null;
  stdout: string;
  stderr: string;
};

export type GraphvizStatus = {
  available: boolean;
  version: string | null;
  message: string;
};

/** 思维导图节点 */
export interface MindMapNode {
  id: string;
  label: string;
  children: MindMapNode[];
  style?: Partial<NodeStyle>;
  position?: { x: number; y: number };
}

/** 边样式映射，key 为 "sourceId->targetId" */
export type EdgeStyleMap = Record<string, Partial<EdgeStyle>>;

/** 选择上下文（同时支持节点与边） */
export interface SelectionState {
  nodes: string[];
  edges: string[];
}

/* ── DOT 样式配置 ── */

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

export const DEFAULT_DOT_STYLE: DotStyleConfig = {
  graph: {
    rankdir: 'LR',
    splines: 'true',
    nodesep: 0.25,
    ranksep: 0.75,
  },
  node: {
    shape: 'box',
    style: 'rounded,filled',
    fillcolor: '#eef4ff',
    color: '#5b7cfa',
    fontname: 'Inter',
    fontsize: 14,
    penwidth: 1,
  },
  edge: {
    color: '#5b7cfa',
    arrowhead: 'vee',
    penwidth: 1,
  },
};
