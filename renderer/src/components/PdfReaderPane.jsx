import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist';
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

GlobalWorkerOptions.workerSrc = workerSrc;

function normalizePdfBytes(bytes) {
  if (!bytes) return new Uint8Array();
  if (bytes instanceof Uint8Array) return bytes;
  if (bytes instanceof ArrayBuffer) return new Uint8Array(bytes);
  if (ArrayBuffer.isView(bytes)) {
    return new Uint8Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  }
  if (Array.isArray(bytes)) {
    return Uint8Array.from(bytes);
  }
  if (Array.isArray(bytes?.data)) {
    return Uint8Array.from(bytes.data);
  }
  return new Uint8Array();
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function formatScaleLabel(scale) {
  if (!Number.isFinite(scale) || scale <= 0) return '100%';
  return `${Math.round(scale * 100)}%`;
}

async function destroyLoadingTask(task) {
  if (!task || typeof task.destroy !== 'function') return;
  try {
    await task.destroy();
  } catch (error) {
  }
}

export default function PdfReaderPane({ viewer, onClose, pdfStatus, onLoadDocument }) {
  const canvasRef = useRef(null);
  const stageRef = useRef(null);
  const renderTaskRef = useRef(null);
  const [pdfDocument, setPdfDocument] = useState(null);
  const [pageCount, setPageCount] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [zoomMode, setZoomMode] = useState('fit-width');
  const [customScale, setCustomScale] = useState(1);
  const [containerWidth, setContainerWidth] = useState(0);
  const [baseViewport, setBaseViewport] = useState(null);
  const [loadState, setLoadState] = useState({ loading: false, error: '', message: '' });
  const [rendering, setRendering] = useState(false);

  const pdfStatusText = useMemo(() => {
    if (!pdfStatus) return '';
    return String(pdfStatus.message || '').trim();
  }, [pdfStatus]);

  useEffect(() => {
    const node = stageRef.current;
    if (!node) return undefined;

    const updateWidth = () => {
      const nextWidth = Math.max(0, Math.floor(node.clientWidth || 0));
      setContainerWidth(nextWidth);
    };

    updateWidth();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateWidth);
      return () => window.removeEventListener('resize', updateWidth);
    }

    const observer = new ResizeObserver(() => updateWidth());
    observer.observe(node);
    return () => observer.disconnect();
  }, [viewer?.paperKey]);

  useEffect(() => {
    if (!viewer?.payload && !viewer?.target) {
      setPdfDocument(null);
      setPageCount(0);
      setBaseViewport(null);
      setLoadState({ loading: false, error: '', message: '' });
      return undefined;
    }

    let cancelled = false;
    let loadingTask = null;
    let activeDocument = null;

    setLoadState({ loading: true, error: '', message: '正在加载 PDF…' });
    setPdfDocument(null);
    setPageCount(0);
    setPageNumber(1);
    setBaseViewport(null);
    setZoomMode('fit-width');
    setCustomScale(1);

    (async () => {
      const payload = viewer.payload || {
        paper_key: viewer.paperKey,
        favorite_key: viewer.paperKey,
        title: viewer.title,
        target: viewer.target,
      };
      const result = await onLoadDocument(payload);
      const data = normalizePdfBytes(result?.bytes);
      if (!data.length) {
        throw new Error(result?.message || '未读取到 PDF 内容');
      }

      loadingTask = getDocument({ data });
      activeDocument = await loadingTask.promise;
      if (cancelled) {
        await activeDocument.destroy();
        return;
      }

      setPdfDocument(activeDocument);
      setPageCount(activeDocument.numPages || 0);
      setLoadState({ loading: false, error: '', message: '' });
    })().catch(async (error) => {
      if (cancelled) return;
      if (activeDocument) {
        await activeDocument.destroy().catch(() => {});
      }
      await destroyLoadingTask(loadingTask);
      setLoadState({
        loading: false,
        error: String(error?.message || error || 'PDF 加载失败').trim() || 'PDF 加载失败',
        message: '',
      });
    });

    return () => {
      cancelled = true;
      renderTaskRef.current?.cancel?.();
      void destroyLoadingTask(loadingTask);
      if (activeDocument) {
        activeDocument.destroy().catch(() => {});
      }
    };
  }, [viewer?.paperKey, viewer?.target, onLoadDocument]);

  const fitWidthScale = useMemo(() => {
    if (!baseViewport?.width || !containerWidth) return 1;
    return clamp((containerWidth - 40) / baseViewport.width, 0.4, 3.5);
  }, [baseViewport, containerWidth]);

  const actualScale = useMemo(() => {
    return zoomMode === 'fit-width' ? fitWidthScale : clamp(customScale, 0.4, 3.5);
  }, [zoomMode, fitWidthScale, customScale]);

  useEffect(() => {
    if (!pdfDocument || !pageNumber || !canvasRef.current) return undefined;

    let cancelled = false;
    let pageProxy = null;

    const renderPage = async () => {
      setRendering(true);
      const page = await pdfDocument.getPage(pageNumber);
      pageProxy = page;
      if (cancelled) return;

      const nextBaseViewport = page.getViewport({ scale: 1 });
      setBaseViewport((prev) => {
        if (!prev || prev.width !== nextBaseViewport.width || prev.height !== nextBaseViewport.height) {
          return nextBaseViewport;
        }
        return prev;
      });

      const viewport = page.getViewport({ scale: actualScale });
      const canvas = canvasRef.current;
      if (!canvas) return;

      const pixelRatio = window.devicePixelRatio || 1;
      canvas.width = Math.ceil(viewport.width * pixelRatio);
      canvas.height = Math.ceil(viewport.height * pixelRatio);
      canvas.style.width = `${Math.ceil(viewport.width)}px`;
      canvas.style.height = `${Math.ceil(viewport.height)}px`;

      const context = canvas.getContext('2d', { alpha: false });
      if (!context) {
        throw new Error('无法初始化 PDF 画布');
      }
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      context.clearRect(0, 0, viewport.width, viewport.height);

      renderTaskRef.current?.cancel?.();
      const renderTask = page.render({ canvasContext: context, viewport });
      renderTaskRef.current = renderTask;
      await renderTask.promise;
      if (!cancelled) {
        setRendering(false);
      }
    };

    renderPage().catch((error) => {
      if (cancelled || error?.name === 'RenderingCancelledException') return;
      setLoadState({
        loading: false,
        error: String(error?.message || error || 'PDF 渲染失败').trim() || 'PDF 渲染失败',
        message: '',
      });
      setRendering(false);
    });

    return () => {
      cancelled = true;
      renderTaskRef.current?.cancel?.();
      pageProxy?.cleanup?.();
    };
  }, [pdfDocument, pageNumber, actualScale]);

  const adjustZoom = useCallback((delta) => {
    setZoomMode('custom');
    setCustomScale((prev) => clamp((zoomMode === 'fit-width' ? fitWidthScale : prev) + delta, 0.4, 3.5));
  }, [fitWidthScale, zoomMode]);

  const handleWheel = useCallback((event) => {
    if (!(event.metaKey || event.ctrlKey)) return;
    event.preventDefault();
    adjustZoom(event.deltaY < 0 ? 0.12 : -0.12);
  }, [adjustZoom]);

  const statusClass = pdfStatus?.state === 'ready'
    ? 'ready'
    : pdfStatus?.state === 'downloading'
      ? 'downloading'
      : pdfStatus?.state === 'error'
        ? 'error'
        : 'idle';

  return (
    <div className="embedded-pdf-pane">
      <div className="embedded-pdf-toolbar">
        <div className="embedded-pdf-toolbar-copy">
          <div className="embedded-pdf-title">{viewer?.title || 'PDF 阅读'}</div>
          {pdfStatusText && <div className={`embedded-pdf-status ${statusClass}`}>{pdfStatusText}</div>}
          {!pdfStatusText && loadState.message && <div className="embedded-pdf-status">{loadState.message}</div>}
        </div>
        <div className="embedded-pdf-actions embedded-pdf-actions-wide">
          <button className="mini-btn" onClick={() => setPageNumber((prev) => Math.max(1, prev - 1))} disabled={!pageCount || pageNumber <= 1}>上一页</button>
          <div className="embedded-pdf-counter">{pageCount ? `${pageNumber} / ${pageCount}` : '-- / --'}</div>
          <button className="mini-btn" onClick={() => setPageNumber((prev) => Math.min(pageCount || 1, prev + 1))} disabled={!pageCount || pageNumber >= pageCount}>下一页</button>
          <button className="mini-btn" onClick={() => adjustZoom(-0.12)} disabled={!pdfDocument}>－</button>
          <button className={`mini-btn ${zoomMode === 'fit-width' ? 'active' : ''}`.trim()} onClick={() => setZoomMode('fit-width')} disabled={!pdfDocument}>适宽</button>
          <button className={`mini-btn ${zoomMode === 'custom' && Math.abs(actualScale - 1) < 0.01 ? 'active' : ''}`.trim()} onClick={() => {
            setZoomMode('custom');
            setCustomScale(1);
          }} disabled={!pdfDocument}>100%</button>
          <div className="embedded-pdf-scale">{formatScaleLabel(actualScale)}</div>
          <button className="mini-btn" onClick={() => adjustZoom(0.12)} disabled={!pdfDocument}>＋</button>
          <button className="mini-btn" onClick={onClose}>关闭 PDF</button>
        </div>
      </div>
      <div className="embedded-pdf-stage" ref={stageRef} onWheel={handleWheel}>
        {loadState.error ? (
          <div className="embedded-pdf-error">
            <strong>PDF 打开失败</strong>
            <span>{loadState.error}</span>
          </div>
        ) : loadState.loading ? (
          <div className="embedded-pdf-loading">
            <div className="embedded-pdf-spinner" />
            <span>{loadState.message || '正在加载 PDF…'}</span>
          </div>
        ) : !pdfDocument ? (
          <div className="embedded-pdf-empty">暂无 PDF 内容</div>
        ) : (
          <div className="embedded-pdf-canvas-wrap">
            <canvas ref={canvasRef} className="embedded-pdf-canvas" />
            {rendering && <div className="embedded-pdf-rendering">正在渲染页面…</div>}
          </div>
        )}
      </div>
    </div>
  );
}
