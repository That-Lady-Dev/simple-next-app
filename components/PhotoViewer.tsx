"use client";

import { useEffect } from "react";

// Full-screen view of a meal photo. Closes on Escape, on the backdrop, or on
// the close button.
export function PhotoViewer({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    // Stop the page behind from scrolling while the photo is open.
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  return (
    <div className="viewer" role="dialog" aria-modal="true" aria-label={alt} onClick={onClose}>
      <button className="viewer-close" onClick={onClose} aria-label="Close photo">
        ✕
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} onClick={(e) => e.stopPropagation()} />
    </div>
  );
}

// The thumbnail in a list: opens the photo instead of the row's own action.
export function PhotoThumb({ src, name, onOpen }: { src?: string; name: string; onOpen: () => void }) {
  if (!src) return <div className="thumb">🍽️</div>;
  return (
    <button type="button" className="thumb-btn" onClick={onOpen} aria-label={`View photo of ${name}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="thumb" src={src} alt="" />
      <span className="thumb-zoom" aria-hidden>
        ⤢
      </span>
    </button>
  );
}
