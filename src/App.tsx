import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { open, save } from '@tauri-apps/plugin-dialog';
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
import { FileInput, GitBranch, PanelLeft, PanelRight, Terminal, Wand2 } from 'lucide-react';
import { DotEditor } from './components/DotEditor';
import { DotStylePanel } from './components/DotStylePanel';
import { MindMap, mindMapToDot } from './components/MindMap';
import { RenderLog } from './components/RenderLog';
import { SvgPreview } from './components/SvgPreview';
import type {
  DotStyleConfig,
  EdgeStyle,
  EdgeStyleMap,
  GraphvizStatus,
  MindMapNode,
  NodeStyle,
  RenderResult,
} from './types';
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
      children: [{ id: 'c2a', label: 'Subtopic 2.1', children: [] }],
    },
    { id: 'c3', label: 'Topic 3', children: [] },
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
  const [edgeStyles, setEdgeStyles] = useState<EdgeStyleMap>({});
  const [dotSource, setDotSource] = useState(() =>
    mindMapToDot(DEFAULT_MINDMAP, DEFAULT_DOT_STYLE, {}),
  );
  const [currentPath, setCurrentPath] = useState<string | null>(null);
  const [svg, setSvg] = useState('');
  const [renderResult, setRenderResult] = useState<RenderResult | null>(null);
  const [graphvizStatus, setGraphvizStatus] = useState<GraphvizStatus | null>(null);
  const [isRendering, setIsRendering] = useState(false);
  const [mode, setMode] = useState<'mindmap' | 'editor'>('mindmap');
  const [dotStyle, setDotStyle] = useState<DotStyleConfig>(DEFAULT_DOT_STYLE);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [selectedEdgeIds, setSelectedEdgeIds] = useState<string[]>([]);
  const [panels, setPanels] = useState({ style: true, preview: true, log: true });
  const [previewEngine, setPreviewEngine] = useState<'dot' | 'latex'>('dot');

  const togglePanel = useCallback((key: 'style' | 'preview' | 'log') => {
    setPanels((p) => ({ ...p, [key]: !p[key] }));
  }, []);

  const fileLabel = useMemo(() => currentPath ?? 'Untitled graph.dot', [currentPath]);

  const checkGraphviz = useCallback(async () => {
    const status = await invoke<GraphvizStatus>('check_graphviz');
    setGraphvizStatus(status);
    return status;
  }, []);

  const renderDot = useCallback(
    async (source?: string, engineOverride?: 'dot' | 'latex') => {
      setIsRendering(true);
      const src = source ?? dotSource;
      const engine = engineOverride ?? previewEngine;
      try {
        const cmd = engine === 'latex' ? 'compile_via_latex' : 'render_dot_to_svg';
        const result = await invoke<RenderResult>(cmd, { source: src });
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
    },
    [dotSource, previewEngine],
  );

  useEffect(() => {
    checkGraphviz().then((status) => {
      if (status.available) {
        renderDot();
      }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // dotStyle 变更时（mindmap 模式下）重新生成 DOT 并渲染
  useEffect(() => {
    if (mode !== 'mindmap') return;
    const dot = mindMapToDot(mindMapRoot, dotStyle, edgeStyles);
    setDotSource(dot);
    renderDot(dot);
  }, [dotStyle, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  // 切换渲染引擎时立即重渲染当前 dotSource
  useEffect(() => {
    if (!dotSource) return;
    renderDot(dotSource, previewEngine);
  }, [previewEngine]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleMindMapChange = useCallback((newRoot: MindMapNode) => {
    setMindMapRoot(newRoot);
  }, []);

  const handleDotFromMindMap = useCallback(
    (dot: string) => {
      setDotSource(dot);
      renderDot(dot);
    },
    [renderDot],
  );

  const handleSelectionChange = useCallback((nodeIds: string[], edgeIds: string[]) => {
    setSelectedNodeIds(nodeIds);
    setSelectedEdgeIds(edgeIds);
  }, []);

  // 应用样式到选中的节点
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
      const dot = mindMapToDot(cloned, dotStyle, edgeStyles);
      setDotSource(dot);
      renderDot(dot);
    },
    [selectedNodeIds, mindMapRoot, dotStyle, edgeStyles, renderDot],
  );

  // 应用样式到选中的边
  const applyEdgeStyle = useCallback(
    (partial: Partial<EdgeStyle>) => {
      if (selectedEdgeIds.length === 0) return;
      const next: EdgeStyleMap = { ...edgeStyles };
      for (const id of selectedEdgeIds) {
        next[id] = { ...(next[id] || {}), ...partial };
      }
      setEdgeStyles(next);
      const dot = mindMapToDot(mindMapRoot, dotStyle, next);
      setDotSource(dot);
      renderDot(dot);
    },
    [selectedEdgeIds, edgeStyles, mindMapRoot, dotStyle, renderDot],
  );

  // 选中节点的合并样式（取第一个有样式的节点）
  const selectedNodeStyle = useMemo((): Partial<NodeStyle> | undefined => {
    if (selectedNodeIds.length === 0) return undefined;
    const all = flatNodes(mindMapRoot);
    const selected = all.filter((n) => selectedNodeIds.includes(n.id));
    for (const n of selected) {
      if (n.style && Object.keys(n.style).length > 0) return n.style;
    }
    return undefined;
  }, [selectedNodeIds, mindMapRoot]);

  // 选中边的合并样式
  const selectedEdgeStyle = useMemo((): Partial<EdgeStyle> | undefined => {
    if (selectedEdgeIds.length === 0) return undefined;
    for (const id of selectedEdgeIds) {
      const s = edgeStyles[id];
      if (s && Object.keys(s).length > 0) return s;
    }
    return undefined;
  }, [selectedEdgeIds, edgeStyles]);

  async function openDotFile() {
    const selected = await open({
      multiple: false,
      filters: [{ name: 'DOT files', extensions: ['dot', 'gv'] }],
    });

    if (typeof selected !== 'string') return;

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

    if (!targetPath) return;

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

  // 后续 latex-backend 任务实现：暂时占位，菜单可点但调用会失败
  async function exportPdf() {
    const targetPath = await save({
      defaultPath: 'graph.pdf',
      filters: [{ name: 'PDF files', extensions: ['pdf'] }],
    });
    if (!targetPath) return;
    try {
      const result = await invoke<RenderResult & { pdf?: string }>('compile_via_latex', {
        source: dotSource,
        outputPath: targetPath,
      });
      setRenderResult(result);
    } catch (error) {
      setRenderResult({
        ok: false,
        svg: null,
        stdout: '',
        stderr: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async function checkLatex() {
    try {
      const status = await invoke<GraphvizStatus>('check_latex');
      setGraphvizStatus(status);
    } catch (error) {
      const process_path = await invoke<string>('get_process_path_debug').catch(() => '');
      setGraphvizStatus({
        available: false,
        version: null,
        message: `LaTeX check failed: ${error instanceof Error ? error.message : String(error)}`,
        process_path,
      });
    }
  }

  /* ── 原生菜单事件订阅 ── */

  const handlersRef = useRef<Record<string, () => void>>({});
  // 每次渲染同步最新闭包到 ref，避免重新挂载监听器
  handlersRef.current = {
    'file:open': () => void openDotFile(),
    'file:save': () => void saveDotFile(),
    'file:render': () => void renderDot(),
    'file:export-svg': () => void exportSvg(),
    'file:export-pdf': () => void exportPdf(),
    'view:mode-mindmap': () => setMode('mindmap'),
    'view:mode-editor': () => setMode('editor'),
    'view:toggle-style': () => togglePanel('style'),
    'view:toggle-preview': () => togglePanel('preview'),
    'view:toggle-log': () => togglePanel('log'),
    'render:check-graphviz': () => void checkGraphviz(),
    'render:check-latex': () => void checkLatex(),
    'render:engine-dot': () => setPreviewEngine('dot'),
    'render:engine-latex': () => setPreviewEngine('latex'),
  };

  useEffect(() => {
    const unlistenPromise = listen<string>('menu', (event) => {
      const handler = handlersRef.current[event.payload];
      handler?.();
    });
    return () => {
      unlistenPromise.then((unlisten) => unlisten()).catch(() => {});
    };
  }, []);

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
          <button type="button" onClick={() => renderDot()} disabled={isRendering}>
            <Wand2 size={16} /> {isRendering ? 'Rendering...' : 'Render'}
          </button>
          <div className="panel-toggle-group">
            <button
              type="button"
              className={`icon-toggle${panels.style ? ' icon-toggle--on' : ''}`}
              onClick={() => togglePanel('style')}
              title="Toggle Style sidebar"
              disabled={mode !== 'mindmap'}
            >
              <PanelLeft size={16} />
            </button>
            <button
              type="button"
              className={`icon-toggle${panels.preview ? ' icon-toggle--on' : ''}`}
              onClick={() => togglePanel('preview')}
              title="Toggle SVG preview"
            >
              <PanelRight size={16} />
            </button>
            <button
              type="button"
              className={`icon-toggle${panels.log ? ' icon-toggle--on' : ''}`}
              onClick={() => togglePanel('log')}
              title="Toggle render log"
            >
              <Terminal size={16} />
            </button>
          </div>
        </div>
      </header>

      <section
        className={`workspace${mode === 'mindmap' && panels.style ? ' workspace--with-sidebar' : ''}${
          panels.preview ? '' : ' workspace--no-preview'
        }`}
      >
        {mode === 'mindmap' ? (
          <>
            {panels.style && (
              <DotStylePanel
                globalStyle={dotStyle}
                selectedNodeIds={selectedNodeIds}
                selectedEdgeIds={selectedEdgeIds}
                selectedNodeStyle={selectedNodeStyle}
                selectedEdgeStyle={selectedEdgeStyle}
                onChangeGlobal={setDotStyle}
                onChangeNodeSelected={applyNodeStyle}
                onChangeEdgeSelected={applyEdgeStyle}
              />
            )}
            <MindMap
              root={mindMapRoot}
              edgeStyles={edgeStyles}
              globalStyle={dotStyle}
              onChange={handleMindMapChange}
              onDotChange={handleDotFromMindMap}
              onSelectionChange={handleSelectionChange}
            />
          </>
        ) : (
          <DotEditor value={dotSource} onChange={setDotSource} />
        )}
        {panels.preview && (
          <SvgPreview
            svg={svg}
            emptyMessage="Render a DOT graph to see the SVG preview."
            engine={previewEngine}
            onEngineChange={setPreviewEngine}
          />
        )}
      </section>

      {panels.log && <RenderLog graphvizStatus={graphvizStatus} renderResult={renderResult} />}
    </main>
  );
}

export default App;
