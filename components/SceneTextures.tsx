'use client';
import { useEffect } from 'react';

/** Use light live text on supplied dark stone; preserve minted text while the slot is absent. */
export default function SceneTextures() {
  useEffect(() => {
    const tablet = new Image();
    const root = document.documentElement;
    tablet.onload = () => root.setAttribute('data-imperivm-tablet', 'ready');
    tablet.onerror = () => root.removeAttribute('data-imperivm-tablet');
    tablet.src = '/ui/buttons/tablet-normal.png';
    return () => { tablet.onload = null; tablet.onerror = null; root.removeAttribute('data-imperivm-tablet'); };
  }, []);
  return null;
}
