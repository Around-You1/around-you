import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";

interface ImageCarouselProps {
  images: string[];
  alt: string;
  className?: string;
  placeholderClassName?: string;
  intervalMs?: number;
  firstIntervalMs?: number;
}

export default function ImageCarousel({
  images,
  alt,
  className = "w-full h-48 md:h-64 object-cover rounded-lg",
  placeholderClassName = "w-full h-48 md:h-64 rounded-lg",
  intervalMs = 3000,
  firstIntervalMs,
}: ImageCarouselProps) {
  const validImages = images.filter(Boolean);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [lightbox, setLightbox] = useState(false);
  const [lightIndex, setLightIndex] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const swipedRef = useRef(false);

  const goTo = (i: number) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentIndex((i + validImages.length) % validImages.length);
      setIsTransitioning(false);
    }, 400);
  };

  const advance = () => goTo(currentIndex + 1);

  useEffect(() => {
    if (lightbox || validImages.length <= 1) return;
    const delay = currentIndex === 0 ? (firstIntervalMs ?? intervalMs) : intervalMs;
    timerRef.current = setTimeout(advance, delay);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, validImages.length, intervalMs, firstIntervalMs, lightbox]);

  // Lightbox: lock scroll + keyboard nav.
  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightbox(false);
      else if (e.key === "ArrowRight") setLightIndex((p) => (p + 1) % validImages.length);
      else if (e.key === "ArrowLeft") setLightIndex((p) => (p - 1 + validImages.length) % validImages.length);
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prevOverflow; };
  }, [lightbox, validImages.length]);

  if (validImages.length === 0) {
    return (
      <div className={`bg-muted flex items-center justify-center ${placeholderClassName}`}>
        <span className="text-muted-foreground text-sm">No image available</span>
      </div>
    );
  }

  const onTouchStart = (e: React.TouchEvent) => {
    swipedRef.current = false;
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart.current) return;
    const dx = e.changedTouches[0].clientX - touchStart.current.x;
    const dy = e.changedTouches[0].clientY - touchStart.current.y;
    touchStart.current = null;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
      swipedRef.current = true; // a real swipe — change image, suppress the open-click
      if (validImages.length > 1) goTo(currentIndex + (dx < 0 ? 1 : -1));
    }
  };
  const onClick = () => {
    if (swipedRef.current) { swipedRef.current = false; return; } // was a swipe, not a tap
    setLightIndex(currentIndex);
    setLightbox(true);
  };

  const cur = validImages[currentIndex];

  return (
    <>
      <div
        className={`relative overflow-hidden cursor-zoom-in select-none ${className}`}
        onClick={onClick}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        role="button"
        aria-label="Tap to enlarge"
      >
        {/* Blurred, zoomed copy fills the frame behind the whole image (no cropping). */}
        <img
          src={cur}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover scale-110 blur-2xl opacity-60"
          draggable={false}
        />
        {/* The actual image, shown whole. */}
        <img
          key={currentIndex}
          src={cur}
          alt={`${alt} ${currentIndex + 1}`}
          className={`relative z-10 w-full h-full object-contain transition-opacity duration-400 ${isTransitioning ? "opacity-0" : "opacity-100"}`}
          style={{ transition: "opacity 0.4s ease-in-out" }}
          draggable={false}
        />
        {validImages.length > 1 && (
          <>
            <div className="absolute z-20 bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
              {validImages.map((_, i) => (
                <button
                  key={i}
                  onClick={(e) => { e.stopPropagation(); goTo(i); }}
                  className={`w-2 h-2 rounded-full transition-all duration-200 ${i === currentIndex ? "bg-white scale-125" : "bg-white/50"}`}
                  aria-label={`Go to image ${i + 1}`}
                />
              ))}
            </div>
            <div className="absolute z-20 top-2 right-2 bg-black/40 text-white text-xs px-2 py-0.5 rounded-full pointer-events-none">
              {currentIndex + 1} / {validImages.length}
            </div>
          </>
        )}
      </div>

      {lightbox && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 z-[1000] bg-black/90 flex items-center justify-center"
          onClick={() => setLightbox(false)}
          onTouchStart={onTouchStart}
          onTouchEnd={(e) => {
            if (!touchStart.current) return;
            const dx = e.changedTouches[0].clientX - touchStart.current.x;
            const dy = e.changedTouches[0].clientY - touchStart.current.y;
            touchStart.current = null;
            if (validImages.length > 1 && Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
              setLightIndex((p) => (p + (dx < 0 ? 1 : -1) + validImages.length) % validImages.length);
            }
          }}
        >
          <button
            onClick={(e) => { e.stopPropagation(); setLightbox(false); }}
            className="absolute top-3 right-3 z-10 flex items-center justify-center w-11 h-11 rounded-full bg-white/15 text-white text-2xl leading-none hover:bg-white/25"
            aria-label="Close"
          >
            ×
          </button>
          {validImages.length > 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); setLightIndex((p) => (p - 1 + validImages.length) % validImages.length); }}
              className="absolute left-2 z-10 flex items-center justify-center w-11 h-11 rounded-full bg-brand text-brand-foreground text-3xl leading-none hover:bg-brand/90 shadow-md"
              aria-label="Previous"
            >
              ‹
            </button>
          )}
          <img
            src={validImages[lightIndex]}
            alt={`${alt} ${lightIndex + 1}`}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[88vh] max-w-[92vw] object-contain select-none"
            draggable={false}
          />
          {validImages.length > 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); setLightIndex((p) => (p + 1) % validImages.length); }}
              className="absolute right-2 z-10 flex items-center justify-center w-11 h-11 rounded-full bg-brand text-brand-foreground text-3xl leading-none hover:bg-brand/90 shadow-md"
              aria-label="Next"
            >
              ›
            </button>
          )}
          {validImages.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white text-sm bg-white/10 px-3 py-1 rounded-full">
              {lightIndex + 1} / {validImages.length}
            </div>
          )}
        </div>,
        document.body
      )}
    </>
  );
}
