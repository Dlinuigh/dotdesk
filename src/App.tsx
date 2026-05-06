import { useCallback, useEffect, useMemo, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open, save } from '@tauri-apps/plugin-dialog';
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
import { Download, FileDown, FileInput, GitBranch, Save, Wand2 } from 'lucide-react';
import { DotEditor } from './components/DotEditor';
import { DotStylePanel } from './components/DotStylePanel';
import { MindMap, mindMapToDot } from './components/MindMap';
import { RenderLog } from './components/RenderLog';
import { SvgPreview } from './components/SvgPreview';
import type { DotStyleConfig, GraphvizStatus, MindMapNode, NodeStyle, RenderResult } from './types';
import { DEFAULT_DOT_STYLE } from './types';

const DEFAULT_MINDMAP: MindMapNode = {
  id: 'root',
  label: 'Central Idea',
  children: [
    {
      id: 'c1',
      label: 'Topic 1',
      children: [
        { id: 'c1a', label: 'Subtopic 1.1', children: [] },
        { id: 'c1b', label: 'Subtopic 1.2', children: [] },
      ],
    },
    {
      id: 'c2',
      label: 'Topic 2',
      children: [
        { id: 'c2a', label: 'Subtopic 2.1', children: [] },
      ],
    },
    {
      id: 'c3',
      label: 'Topic 3',
      children: [],
    },
  ],
};

/** 深度优先遍历所有节点 */
function flatNodes(root: MindMapNode): MindMapNode[] {
  const result: MindMapNode[] = [];
  function walk(n: MindMapNode) {
    result.push(n);
    for (const c of n.children) walk(c);
  }
  walk(root);
  return result;
}

function App() {
  const [mindMapRoot, setMindMapRoot] = useState<MindMapNode>(DEFAULT_MINDMAP);
  const [dotSource, setDotSource] = useState(() => mindMapToDot(DEFAULT_MINDMAP, DEFAULT_DOT_STYLE));
  const [currentPath, setCurrentPath] = useState<string | null>(null);
  const [svg, setSvg] = useState('');
  const [renderResult, setRenderResult] = useState<RenderResult | null>(null);
  const [graphvizStatus, setGraphvizStatus] = useState<GraphvizStatus | null>(null);
  const [isRendering, setIsRendering] = useState(false);
  const [mode, setMode] = useState<'mindmap' | 'editor'>('mindmap');
  const [dotStyle, setDotStyle] = useState<DotStyleConfig>(DEFAULT_DOT_STYLE);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);

  const fileLabel = useMemo(() => currentPath ?? 'Untitled graph.dot', [currentPath]);

  const checkGraphviz = useCallback(async () => {
    const status = await invoke<GraphvizStatus>('check_graphviz');
    setGraphvizStatus(status);
    return status;
  }, []);

  const renderDot = useCallback(async (source?: string) => {
    setIsRendering(true);
    const src = source ?? dotSource;
    try {
      const result = await invoke<RenderResult>('render_dot_to_svg', { source: src });
      setRenderResult(result);
      setSvg(result.svg ?? '');
      return result;
    } catch (error) {
      const failedResult = {
        ok: false,
        svg: null,
        stdout: '',
        stderr: error instanceof Error ? error.message : String(error),
      };
      setRenderResult(failedResult);
      setSvg('');
      return failedResult;
    } finally {
      setIsRendering(false);
    }
  }, [dotSource]);

  useEffect(() => {
    checkGraphviz().then((status) => {
      if (status.available) {
        renderDot();
      }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // dotStyle 变更时重新生成 DOT 并渲染（仅在 mindmap 模式下）
  useEffect(() => {
    if (mode !== 'mindmap') return;
    const dot = mindMapToDot(mindMapRoot, dotStyle);
    setDotSource(dot);
    renderDot(dot);
  }, [dotStyle, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  // 导图变更时自动渲染
  const handleMindMapChange = useCallback((newRoot: MindMapNode) => {
    setMindMapRoot(newRoot);
  }, []);

  const handleDotFromMindMap = useCallback((dot: string) => {
    setDotSource(dot);
    renderDot(dot);
  }, [renderDot]);

  // 选中节点样式变更：将 partial style 应用到所有选中的节点
  const applyNodeStyle = useCallback(
    (partial: Partial<NodeStyle>) => {
      if (selectedNodeIds.length === 0) return;
      const cloned = structuredClone(mindMapRoot);
      const all = flatNodes(cloned);
      for (const n of all) {
        if (selectedNodeIds.includes(n.id)) {
          n.style = { ...(n.style || {}), ...partial };
        }
      }
      setMindMapRoot(cloned);
      const dot = mindMapToDot(cloned, dotStyle);
      setDotSource(dot);
      renderDot(dot);
    },
    [selectedNodeIds, mindMapRoot, dotStyle, renderDot],
  );

  // 获取选中节点的合并样式（用于边栏展示）
  const selectedNodeStyle = useMemo((): Partial<NodeStyle> | undefined => {
    if (selectedNodeIds.length === 0) return undefined;
    const all = flatNodes(mindMapRoot);
    const selectedNodes = all.filter((n) => selectedNodeIds.includes(n.id));
    if (selectedNodes.length === 0) return undefined;
    // 合并：取最后一个选中节点的样式（如果多个节点样式不同，展示第一个有样式的）
    for (const n of selectedNodes) {
      if (n.style && Object.keys(n.style).length > 0) {
        return n.style;
      }
    }
    return undefined;
  }, [selectedNodeIds, mindMapRoot]);

  async function openDotFile() {
    const selected = await open({
      multiple: false,
      filters: [{ name: 'DOT files', extensions: ['dot', 'gv'] }],
    });

    if (typeof selected !== 'string') {
      return;
    }

    const contents = await readTextFile(selected);
    setCurrentPath(selected);
    setDotSource(contents);
    setMode('editor');
  }

  async function saveDotFile() {
    const targetPath =
      currentPath ??
      (await save({
        defaultPath: 'graph.dot',
        filters: [{ name: 'DOT files', extensions: ['dot', 'gv'] }],
      }));

    if (!targetPath) {
      return;
    }

    await writeTextFile(targetPath, dotSource);
    setCurrentPath(targetPath);
  }

  async function exportSvg() {
    const latestSvg = svg || (await renderDot()).svg;

    const targetPath = await save({
      defaultPath: 'graph.svg',
      filters: [{ name: 'SVG files', extensions: ['svg'] }],
    });

    if (targetPath && latestSvg) {
      await writeTextFile(targetPath, latestSvg);
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <h1>dotdesk</h1>
          <p>{fileLabel}</p>
        </div>
        <div className="toolbar">
          <div className="mode-tabs">
            <button
              type="button"
              className={`mode-tab${mode === 'mindmap' ? ' mode-tab--active' : ''}`}
              onClick={() => setMode('mindmap')}
            >
              <GitBranch size={16} /> Mind Map
            </button>
            <button
              type="button"
              className={`mode-tab${mode === 'editor' ? ' mode-tab--active' : ''}`}
              onClick={() => setMode('editor')}
            >
              <FileInput size={16} /> DOT Editor
            </button>
          </div>
          <button type="button" onClick={openDotFile}>
            <FileInput size={16} /> Open
          </button>
          <button type="button" onClick={saveDotFile}>
            <Save size={16} /> Save
          </button>
          <button type="button" onClick={() => renderDot()} disabled={isRendering}>
            <Wand2 size={16} /> {isRendering ? 'Rendering...' : 'Render'}
          </button>
          <button type="button" onClick={exportSvg} disabled={!svg && !dotSource}>
            <Download size={16} /> Export SVG
          </button>
          <button type="button" onClick={checkGraphviz}>
            <FileDown size={16} /> Check Graphviz
          </button>
        </div>
      </header>

      <section className={`workspace ${mode === 'mindmap' ? 'workspace--with-sidebar' : ''}`}>
        {mode === 'mindmap' ? (
          <>
            <DotStylePanel
              globalStyle={dotStyle}
              selectedNodeStyle={selectedNodeStyle}
              selectedCount={selectedNodeIds.length}
              onChangeGlobal={setDotStyle}
              onChangeSelected={applyNodeStyle}
            />
            <MindMap
              root={mindMapRoot}
              onChange={handleMindMapChange}
              onDotChange={handleDotFromMindMap}
              onSelectionChange={setSelectedNodeIds}
              style={dotStyle}
            />
          </>
        ) : (
          <DotEditor value={dotSource} onChange={setDotSource} />
        )}
        <SvgPreview svg={svg} emptyMessage="Render a DOT graph to see the SVG preview." />
      </section>

      <RenderLog graphvizStatus={graphvizStatus} renderResult={renderResult} />
    </main>
  );
}

export default App;
