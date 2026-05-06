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
}
