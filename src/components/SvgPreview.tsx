type SvgPreviewProps = {
  svg: string;
  emptyMessage: string;
};

export function SvgPreview({ svg, emptyMessage }: SvgPreviewProps) {
  return (
    <div className="panel preview-panel">
      <div className="panel-header">
        <span>SVG Preview</span>
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
