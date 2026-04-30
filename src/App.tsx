import { useCallback, useEffect, useMemo, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open, save } from '@tauri-apps/plugin-dialog';
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
import { Download, FileDown, FileInput, Save, Wand2 } from 'lucide-react';
import { DotEditor } from './components/DotEditor';
import { RenderLog } from './components/RenderLog';
import { SvgPreview } from './components/SvgPreview';
import type { GraphvizStatus, RenderResult } from './types';

const DEFAULT_DOT = `digraph dotdesk {
  rankdir=LR;
  node [shape=box, style="rounded,filled", fillcolor="#eef4ff", color="#5b7cfa"];

  editor [label="DOT Editor"];
  graphviz [label="Graphviz dot"];
  preview [label="SVG Preview"];

  editor -> graphviz -> preview;
}`;

function App() {
  const [dotSource, setDotSource] = useState(DEFAULT_DOT);
  const [currentPath, setCurrentPath] = useState<string | null>(null);
  const [svg, setSvg] = useState('');
  const [renderResult, setRenderResult] = useState<RenderResult | null>(null);
  const [graphvizStatus, setGraphvizStatus] = useState<GraphvizStatus | null>(null);
  const [isRendering, setIsRendering] = useState(false);

  const fileLabel = useMemo(() => currentPath ?? 'Untitled graph.dot', [currentPath]);

  const checkGraphviz = useCallback(async () => {
    const status = await invoke<GraphvizStatus>('check_graphviz');
    setGraphvizStatus(status);
    return status;
  }, []);

  const renderDot = useCallback(async () => {
    setIsRendering(true);
    try {
      const result = await invoke<RenderResult>('render_dot_to_svg', { source: dotSource });
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
  }, [checkGraphviz, renderDot]);

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
          <button type="button" onClick={openDotFile}>
            <FileInput size={16} /> Open
          </button>
          <button type="button" onClick={saveDotFile}>
            <Save size={16} /> Save
          </button>
          <button type="button" onClick={renderDot} disabled={isRendering}>
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

      <section className="workspace">
        <DotEditor value={dotSource} onChange={setDotSource} />
        <SvgPreview svg={svg} emptyMessage="Render a DOT graph to see the SVG preview." />
      </section>

      <RenderLog graphvizStatus={graphvizStatus} renderResult={renderResult} />
    </main>
  );
}

export default App;
