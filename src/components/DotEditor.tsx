import Editor from '@monaco-editor/react';

type DotEditorProps = {
  value: string;
  onChange: (value: string) => void;
};

export function DotEditor({ value, onChange }: DotEditorProps) {
  return (
    <div className="panel editor-panel">
      <div className="panel-header">
        <span>DOT Source</span>
      </div>
      <Editor
        height="100%"
        defaultLanguage="dot"
        theme="vs-dark"
        value={value}
        options={{
          automaticLayout: true,
          fontSize: 14,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          tabSize: 2,
          wordWrap: 'on',
        }}
        onChange={(nextValue) => onChange(nextValue ?? '')}
      />
    </div>
  );
}
