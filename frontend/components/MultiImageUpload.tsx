import { useState, useRef, useCallback } from "react";
import { Upload, X, Loader2, Image as ImageIcon, Star } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { getAuthenticatedBackend } from "../lib/backend";

interface MultiImageUploadProps {
  label?: string;
  images: string[];
  onChange: (urls: string[]) => void;
  maxImages?: number;
  maxSizeMB?: number;
}

const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const DEFAULT_MAX_SIZE_MB = 5;
const DEFAULT_MAX_IMAGES = 10;

export default function MultiImageUpload({
  label = "Images",
  images,
  onChange,
  maxImages = DEFAULT_MAX_IMAGES,
  maxSizeMB = DEFAULT_MAX_SIZE_MB,
}: MultiImageUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const validateFile = (file: File): string | null => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return `${file.name}: invalid file type. Please upload a JPG, PNG, or WebP image.`;
    }
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      return `${file.name}: exceeds ${maxSizeMB}MB limit.`;
    }
    return null;
  };

  const readAsDataURL = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsDataURL(file);
    });
  };

  const uploadFiles = async (fileList: FileList | File[]) => {
    const remainingSlots = maxImages - images.length;
    if (remainingSlots <= 0) {
      toast({
        title: "Limit reached",
        description: `You can only have up to ${maxImages} images.`,
        variant: "destructive",
      });
      return;
    }

    const files = Array.from(fileList).slice(0, remainingSlots);
    if (files.length < fileList.length) {
      toast({
        title: "Some files skipped",
        description: `Only ${remainingSlots} more image${remainingSlots === 1 ? "" : "s"} allowed — the rest weren't uploaded.`,
      });
    }

    const errors: string[] = [];
    const validFiles = files.filter((f) => {
      const err = validateFile(f);
      if (err) errors.push(err);
      return !err;
    });

    if (errors.length > 0) {
      toast({
        title: "Some files were skipped",
        description: errors.join(" "),
        variant: "destructive",
      });
    }

    if (validFiles.length === 0) return;

    setUploading(true);
    setProgress({ done: 0, total: validFiles.length });

    const backend = getAuthenticatedBackend();
    const newUrls: string[] = [];

    for (const file of validFiles) {
      try {
        const dataUrl = await readAsDataURL(file);
        const result = await backend.storage.upload({ data: dataUrl, contentType: file.type });
        newUrls.push(result.url);
      } catch (error) {
        console.error("Upload failed for", file.name, error);
        toast({
          title: "Upload failed",
          description: `${file.name} failed to upload — the rest will continue.`,
          variant: "destructive",
        });
      }
      setProgress((p) => (p ? { ...p, done: p.done + 1 } : p));
    }

    if (newUrls.length > 0) {
      onChange([...images, ...newUrls]);
      toast({
        title: "Success",
        description: `${newUrls.length} image${newUrls.length === 1 ? "" : "s"} uploaded successfully.`,
      });
    }

    setUploading(false);
    setProgress(null);
  };

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        uploadFiles(e.dataTransfer.files);
      }
    },
    [images, maxImages]
  );

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      uploadFiles(e.target.files);
    }
    e.target.value = "";
  };

  const handleRemove = (index: number) => {
    onChange(images.filter((_, i) => i !== index));
  };

  const handleMakePrimary = (index: number) => {
    if (index === 0) return;
    const reordered = [images[index], ...images.filter((_, i) => i !== index)];
    onChange(reordered);
  };

  const atLimit = images.length >= maxImages;

  return (
    <div className="space-y-3">
      <Label>
        {label} ({images.length}/{maxImages})
      </Label>

      {images.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {images.map((url, index) => (
            <div key={url + index} className="relative aspect-square rounded-lg overflow-hidden bg-muted border border-border group">
              <img src={url} alt={`Image ${index + 1}`} className="w-full h-full object-cover" />
              {index === 0 ? (
                <div className="absolute top-1 left-1 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1">
                  <Star className="w-3 h-3 fill-current" /> Primary
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => handleMakePrimary(index)}
                  className="absolute top-1 left-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  Make primary
                </button>
              )}
              <button
                type="button"
                onClick={() => handleRemove(index)}
                className="absolute top-1 right-1 bg-black/70 hover:bg-black/90 text-white rounded-full p-1"
                aria-label="Remove image"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {!atLimit && (
        <Card
          className={`
            border-2 border-dashed transition-colors cursor-pointer
            ${isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25"}
            ${uploading ? "opacity-50 cursor-not-allowed" : "hover:border-primary/50"}
          `}
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !uploading && fileInputRef.current?.click()}
        >
          <div className="p-6 flex flex-col items-center justify-center text-center space-y-2">
            {uploading ? (
              <>
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
                <p className="text-sm text-muted-foreground">
                  Uploading {progress ? `${progress.done}/${progress.total}` : "…"}
                </p>
              </>
            ) : (
              <>
                <div className="w-12 h-12 rounded-lg bg-muted/50 flex items-center justify-center">
                  <ImageIcon className="w-6 h-6 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-foreground">
                  Drag and drop images here or click to upload
                </p>
                <p className="text-xs text-muted-foreground">
                  Select multiple files at once — JPG, PNG, WebP (max {maxSizeMB}MB each, up to {maxImages - images.length} more)
                </p>
              </>
            )}
          </div>
        </Card>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".jpg,.jpeg,.png,.webp"
        multiple
        onChange={handleFileSelect}
        className="hidden"
        disabled={uploading}
      />
    </div>
  );
}
