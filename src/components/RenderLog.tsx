import type { GraphvizStatus, RenderResult } from '../types';

type RenderLogProps = {
  graphvizStatus: GraphvizStatus | null;
  renderResult: RenderResult | null;
};

export function RenderLog({ graphvizStatus, renderResult }: RenderLogProps) {
  const statusClass = graphvizStatus?.available ? 'status-ok' : 'status-error';
  const logText = [
    graphvizStatus?.message,
    graphvizStatus?.process_path
      ? `PATH (this process, search order):\n${graphvizStatus.process_path}`
      : '',
    renderResult?.stdout ? `stdout:\n${renderResult.stdout}` : '',
    renderResult?.stderr ? `stderr:\n${renderResult.stderr}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');

  return (
    <div className="log-panel">
      <div className="log-header">
        <span>Render Log</span>
        {graphvizStatus && <span className={statusClass}>{graphvizStatus.available ? 'Graphviz ready' : 'Graphviz missing'}</span>}
      </div>
      <pre>{logText || 'No render output yet.'}</pre>
    </div>
  );
}
