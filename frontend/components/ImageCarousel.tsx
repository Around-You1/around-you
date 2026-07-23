import { useState, useEffect, useRef } from "react";

interface ImageCarouselProps {
  images: string[];
  alt: string;
  className?: string;
  placeholderClassName?: string;
  intervalMs?: number;
}

export default function ImageCarousel({
  images,
  alt,
  className = "w-full h-48 md:h-64 object-cover rounded-lg",
  placeholderClassName = "w-full h-48 md:h-64 rounded-lg",
  intervalMs = 3000,
}: ImageCarouselProps) {
  const validImages = images.filter(Boolean);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const advance = () => {
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % validImages.length);
      setIsTransitioning(false);
    }, 400);
  };

  useEffect(() => {
    if (validImages.length <= 1) return;
    timerRef.current = setTimeout(advance, intervalMs);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [currentIndex, validImages.length, intervalMs]);

  if (validImages.length === 0) {
    return (
      <div className={`bg-muted flex items-center justify-center ${placeholderClassName}`}>
        <span className="text-muted-foreground text-sm">No image available</span>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-lg">
      <img
        key={currentIndex}
        src={validImages[currentIndex]}
        alt={`${alt} ${currentIndex + 1}`}
        className={`${className} transition-opacity duration-400 ${isTransitioning ? "opacity-0" : "opacity-100"}`}
        style={{ transition: "opacity 0.4s ease-in-out" }}
      />
      {validImages.length > 1 && (
        <>
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
            {validImages.map((_, i) => (
              <button
                key={i}
                onClick={() => {
                  if (timerRef.current) clearTimeout(timerRef.current);
                  setIsTransitioning(true);
                  setTimeout(() => {
                    setCurrentIndex(i);
                    setIsTransitioning(false);
                  }, 400);
                }}
                className={`w-2 h-2 rounded-full transition-all duration-200 ${
                  i === currentIndex ? "bg-white scale-125" : "bg-white/50"
                }`}
                aria-label={`Go to image ${i + 1}`}
              />
            ))}
          </div>
          <div className="absolute top-2 right-2 bg-black/40 text-white text-xs px-2 py-0.5 rounded-full">
            {currentIndex + 1} / {validImages.length}
          </div>
        </>
      )}
    </div>
  );
}
