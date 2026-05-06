import type { Dir8, MindMapNode } from '../types';

/* ── 几何参数 ── */

export const NODE_W = 160;
export const NODE_H = 44;
const SEP_DEPTH_H = 120; // 横向布局时父子之间深度间距
const SEP_DEPTH_V = 80; // 纵向布局时父子之间深度间距
const SEP_BREADTH_H = 16; // 横向布局时兄弟节点之间间距
const SEP_BREADTH_V = 32; // 纵向布局时兄弟节点之间间距

/* ── 方向工具 ── */

/** 把 8 方向归一化到 4 主轴：对角线落在水平上 */
export function dirToCardinal(d: Dir8 | undefined): 'N' | 'E' | 'S' | 'W' {
  switch (d) {
    case 'N':
      return 'N';
    case 'S':
      return 'S';
    case 'W':
    case 'NW':
    case 'SW':
      return 'W';
    case 'E':
    case 'NE':
    case 'SE':
    default:
      return 'E';
  }
}

/**
 * 从拖拽位移 (dx, dy) snap 到最接近的 8 方向。
 * 屏幕坐标系：Y 轴向下（dy > 0 = 南）。
 */
export function snapToDir8(dx: number, dy: number): Dir8 {
  if (dx === 0 && dy === 0) return 'E';
  const deg = (Math.atan2(dy, dx) * 180) / Math.PI; // -180 ~ 180
  const n = (deg + 360) % 360; // 0 ~ 360
  if (n < 22.5 || n >= 337.5) return 'E';
  if (n < 67.5) return 'SE';
  if (n < 112.5) return 'S';
  if (n < 157.5) return 'SW';
  if (n < 202.5) return 'W';
  if (n < 247.5) return 'NW';
  if (n < 292.5) return 'N';
  return 'NE';
}

/* ── R-T 布局 ── */

export type Pos = { x: number; y: number };
export type LayoutResult = Map<string, Pos>;

/**
 * Reingold–Tilford 风格的简化树布局。
 * - 根据 root.growthDirection 决定主轴。
 * - 后序计算每个子树在「面宽轴」上的占用宽度。
 * - 前序放置：每个子节点的中心 = 其分配区间的中心。
 *
 * 输出节点中心点；调用方按需把中心转换为 ReactFlow 的左上角坐标。
 */
export function layoutTree(root: MindMapNode): LayoutResult {
  const result: LayoutResult = new Map();
  const dir = dirToCardinal(root.growthDirection);
  const horizontal = dir === 'E' || dir === 'W';
  const depthSign = dir === 'W' || dir === 'N' ? -1 : 1;

  const NODE_DEPTH = horizontal ? NODE_W : NODE_H;
  const NODE_BREADTH = horizontal ? NODE_H : NODE_W;
  const SEP_DEPTH = horizontal ? SEP_DEPTH_H : SEP_DEPTH_V;
  const SEP_BREADTH = horizontal ? SEP_BREADTH_H : SEP_BREADTH_V;

  const breadth = new Map<string, number>();

  function computeBreadth(n: MindMapNode): number {
    if (n.children.length === 0) {
      breadth.set(n.id, NODE_BREADTH);
      return NODE_BREADTH;
    }
    let sum = 0;
    for (const c of n.children) sum += computeBreadth(c);
    sum += (n.children.length - 1) * SEP_BREADTH;
    const b = Math.max(NODE_BREADTH, sum);
    breadth.set(n.id, b);
    return b;
  }
  computeBreadth(root);

  /**
   * @param n           当前节点
   * @param depth       从根到当前节点中心的「深度坐标」
   * @param breadthStart 该节点子树在「面宽轴」上的起点
   */
  function place(n: MindMapNode, depth: number, breadthStart: number) {
    const myBreadth = breadth.get(n.id)!;
    const myBreadthCenter = breadthStart + myBreadth / 2;

    const depthCoord = depth * depthSign;
    const breadthCoord = myBreadthCenter;
    result.set(
      n.id,
      horizontal
        ? { x: depthCoord, y: breadthCoord }
        : { x: breadthCoord, y: depthCoord },
    );

    if (n.children.length === 0) return;

    const nextDepth = depth + NODE_DEPTH + SEP_DEPTH;
    const childrenTotal =
      n.children.reduce((s, c) => s + breadth.get(c.id)!, 0) +
      (n.children.length - 1) * SEP_BREADTH;
    let cursor = breadthStart + (myBreadth - childrenTotal) / 2;
    for (const c of n.children) {
      const cb = breadth.get(c.id)!;
      place(c, nextDepth, cursor);
      cursor += cb + SEP_BREADTH;
    }
  }
  place(root, 0, 0);

  return result;
}

/* ── 树导航 ── */

export function findParentNode(root: MindMapNode, id: string): MindMapNode | null {
  for (const child of root.children) {
    if (child.id === id) return root;
    const found = findParentNode(child, id);
    if (found) return found;
  }
  return null;
}

export type NavTarget = 'parent' | 'child' | 'prevSibling' | 'nextSibling';

export function navigate(
  root: MindMapNode,
  currentId: string,
  target: NavTarget,
): string | null {
  if (target === 'parent') {
    const p = findParentNode(root, currentId);
    return p ? p.id : null;
  }

  if (target === 'child') {
    const node = findById(root, currentId);
    return node && node.children.length > 0 ? node.children[0].id : null;
  }

  // siblings
  const parent = findParentNode(root, currentId);
  if (!parent) return null;
  const idx = parent.children.findIndex((c) => c.id === currentId);
  if (idx < 0) return null;
  const next = target === 'prevSibling' ? idx - 1 : idx + 1;
  return next >= 0 && next < parent.children.length
    ? parent.children[next].id
    : null;
}

function findById(root: MindMapNode, id: string): MindMapNode | null {
  if (root.id === id) return root;
  for (const c of root.children) {
    const f = findById(c, id);
    if (f) return f;
  }
  return null;
}

/** 根据当前布局方向把 4 个方向键映射为树导航目标。 */
export function arrowKeyToNavTarget(
  key: string,
  dir: 'N' | 'E' | 'S' | 'W',
): NavTarget | null {
  const horizontal = dir === 'E' || dir === 'W';
  if (horizontal) {
    if (key === 'ArrowUp') return 'prevSibling';
    if (key === 'ArrowDown') return 'nextSibling';
    if (dir === 'E') {
      if (key === 'ArrowLeft') return 'parent';
      if (key === 'ArrowRight') return 'child';
    } else {
      if (key === 'ArrowLeft') return 'child';
      if (key === 'ArrowRight') return 'parent';
    }
  } else {
    if (key === 'ArrowLeft') return 'prevSibling';
    if (key === 'ArrowRight') return 'nextSibling';
    if (dir === 'S') {
      if (key === 'ArrowUp') return 'parent';
      if (key === 'ArrowDown') return 'child';
    } else {
      if (key === 'ArrowUp') return 'child';
      if (key === 'ArrowDown') return 'parent';
    }
  }
  return null;
}
