'use client';

import { useState } from 'react';

interface ArtImgProps {
  src: string;
  alt: string;
  letter: string;
  className?: string;
  imgClassName?: string;
  title?: string;
}

/**
 * Plain <img> with a graceful fallback: if the contracted art file
 * (/cards/<id>.webp, /heroes/<id>.webp, …) is not there yet, render a
 * gold-on-void gradient medallion with the first letter instead —
 * so `npm run build` never depends on generated art existing.
 */
export default function ArtImg({ src, alt, letter, className = '', imgClassName = '', title }: ArtImgProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        className={`flex items-center justify-center bg-gradient-to-br from-[#3a2456] via-void to-abyss ${className}`}
        title={title ?? alt}
        aria-label={alt}
        role="img"
      >
        <span className="font-display font-bold gold-text leading-none select-none">
          {letter}
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      title={title ?? alt}
      draggable={false}
      onError={() => setFailed(true)}
      className={`${className} ${imgClassName}`}
    />
  );
}
