export type PreviewEngine = 'dot' | 'latex';

type SvgPreviewProps = {
  svg: string;
  emptyMessage: string;
  engine?: PreviewEngine;
  onEngineChange?: (engine: PreviewEngine) => void;
};

export function SvgPreview({ svg, emptyMessage, engine, onEngineChange }: SvgPreviewProps) {
  const showSwitcher = !!engine && !!onEngineChange;
  return (
    <div className="panel preview-panel">
      <div className="panel-header">
        <span>SVG Preview</span>
        {showSwitcher && (
          <div className="engine-switch" role="tablist" aria-label="Render engine">
            <button
              type="button"
              role="tab"
              aria-selected={engine === 'dot'}
              className={`engine-btn${engine === 'dot' ? ' engine-btn--on' : ''}`}
              onClick={() => onEngineChange('dot')}
              title="Render with Graphviz dot"
            >
              DOT
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={engine === 'latex'}
              className={`engine-btn${engine === 'latex' ? ' engine-btn--on' : ''}`}
              onClick={() => onEngineChange('latex')}
              title="Compile via xelatex (TikZ)"
            >
              LaTeX
            </button>
          </div>
        )}
      </div>
      <div className="preview-canvas">
        {svg ? (
          <div className="svg-output" dangerouslySetInnerHTML={{ __html: svg }} />
        ) : (
          <p className="empty-state">{emptyMessage}</p>
        )}
      </div>
    </div>
  );
}
