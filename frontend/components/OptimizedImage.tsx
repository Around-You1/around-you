import { useState } from "react";
import { Loader2 } from "lucide-react";

interface OptimizedImageProps {
  src: string;
  alt: string;
  className?: string;
  placeholderClassName?: string;
}

export default function OptimizedImage({ 
  src, 
  alt, 
  className = "",
  placeholderClassName = ""
}: OptimizedImageProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  if (error || !src) {
    return (
      <div className={`${placeholderClassName || className} bg-muted flex items-center justify-center p-2`}>
        <span className="text-xs text-muted-foreground text-center">Module not populated. Awaiting input or sync from source.</span>
      </div>
    );
  }

  return (
    <div className="relative">
      {loading && (
        <div className={`${placeholderClassName || className} bg-muted flex items-center justify-center absolute inset-0`}>
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      )}
      <img
        src={src}
        alt={alt}
        className={className}
        loading="lazy"
        decoding="async"
        onLoad={() => setLoading(false)}
        onError={() => {
          setLoading(false);
          setError(true);
        }}
        style={loading ? { visibility: 'hidden' } : {}}
      />
    </div>
  );
}
