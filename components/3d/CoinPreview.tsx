'use client';

import dynamic from 'next/dynamic';
import { Component, useCallback, useEffect, useRef, useState } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { useReducedMotion } from '../../lib/prefersReducedMotion';
import { MODEL_MANIFEST } from './modelManifest';
import type { CoinPreviewProps, ModelKey } from './modelManifest';
import styles from './CoinPreview.module.css';

// Three and its renderer live in this client chunk, never in the route's initial bundle.
const LazyCoin = dynamic(() => import('./Coin3D'), { ssr: false, loading: () => null });
type Availability = Partial<Record<ModelKey, { available: boolean; fallback: string }>>;
let discovery: Promise<Availability> | undefined;
function discoverModels() {
  return discovery ??= fetch('/api/models').then(async response => {
    if (!response.ok) throw new Error('Model discovery unavailable');
    return await response.json() as Availability;
  }).catch(() => { discovery = undefined; return {}; });
}

class PreviewBoundary extends Component<{ children: ReactNode; onFailure: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(_error: Error, _info: ErrorInfo) { this.props.onFailure(); }
  render() { return this.state.failed ? null : this.props.children; }
}

/** Lightweight, accessible entry point. It imports WebGL only when the preview approaches the viewport. */
export function CoinPreview({
  model = 'hero-whale', size = 160, speed = 0.18, autoRotate = true,
  className = '', label = 'Золотая монета Кита', fallbackSrc,
}: CoinPreviewProps) {
  const frame = useRef<HTMLDivElement>(null);
  const [entered, setEntered] = useState(false);
  const [visible, setVisible] = useState(false);
  const [pageVisible, setPageVisible] = useState(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [assets, setAssets] = useState<Availability>({});
  const [posterFailed, setPosterFailed] = useState(false);
  const reducedMotion = useReducedMotion();
  const manifest = MODEL_MANIFEST[model];
  const onReady = useCallback(() => setReady(true), []);
  const onFailure = useCallback(() => { setReady(false); setFailed(true); }, []);

  useEffect(() => { setReady(false); setFailed(false); setPosterFailed(false); }, [model]);
  useEffect(() => {
    if (!entered) return;
    let cancelled = false;
    void discoverModels().then(value => { if (!cancelled) setAssets(value); });
    return () => { cancelled = true; };
  }, [entered]);

  useEffect(() => {
    const updateVisibility = () => setPageVisible(document.visibilityState === 'visible');
    updateVisibility();
    document.addEventListener('visibilitychange', updateVisibility);
    const element = frame.current;
    if (!element) return () => document.removeEventListener('visibilitychange', updateVisibility);
    if (!('IntersectionObserver' in window)) {
      setEntered(true); setVisible(true);
      return () => document.removeEventListener('visibilitychange', updateVisibility);
    }
    // Loading may start slightly ahead of scrolling; rotation requires actual visibility.
    const loadObserver = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setEntered(true); loadObserver.disconnect(); }
    }, { rootMargin: '120px' });
    const viewObserver = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.05 });
    loadObserver.observe(element); viewObserver.observe(element);
    return () => {
      loadObserver.disconnect(); viewObserver.disconnect();
      document.removeEventListener('visibilitychange', updateVisibility);
    };
  }, []);

  return <div ref={frame} role="img" aria-label={label}
    className={`${styles.frame} ${ready ? styles.ready : ''} ${className}`}
    style={{ width: size, height: size }}>
    <div className={styles.fallback} aria-hidden="true"><img src={posterFailed ? manifest.fallback : fallbackSrc ?? assets[model]?.fallback ?? manifest.fallback} alt="" onError={() => setPosterFailed(true)} /></div>
    {entered && assets[model]?.available && !failed && <PreviewBoundary key={model} onFailure={onFailure}>
      <LazyCoin model={model} speed={speed} autoRotate={autoRotate}
        active={visible && pageVisible && !reducedMotion}
        onReady={onReady} onFailure={onFailure} />
    </PreviewBoundary>}
  </div>;
}

export function Whale3D(props: Omit<CoinPreviewProps, 'model'>) {
  return <CoinPreview {...props} model="hero-whale" />;
}

export function VictoryCoin({ size = 156, speed = 0.26, className = '', label = 'Трофей победы', model = 'trophy', ...props }: CoinPreviewProps) {
  return <CoinPreview {...props} model={model} size={size} speed={speed} label={label} className={`${styles.victory} ${className}`} />;
}

export type { CoinPreviewProps, ModelKey } from './modelManifest';
