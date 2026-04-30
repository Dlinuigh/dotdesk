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
