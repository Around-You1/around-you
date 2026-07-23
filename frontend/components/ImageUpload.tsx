import { useState, useRef, useCallback, useEffect } from "react";
import { Upload, X, Loader2, Image as ImageIcon } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { getAuthenticatedBackend } from "../lib/backend";

interface ImageUploadProps {
  label?: string;
  imageUrl?: string;
  onImageUploaded: (url: string) => void;
  maxSizeMB?: number;
}

const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const DEFAULT_MAX_SIZE_MB = 5;

export default function ImageUpload({ 
  label = "Image", 
  imageUrl, 
  onImageUploaded, 
  maxSizeMB = DEFAULT_MAX_SIZE_MB 
}: ImageUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | undefined>(imageUrl);
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    setPreviewUrl(imageUrl);
  }, [imageUrl]);

  const validateFile = (file: File): string | null => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return `Invalid file type. Please upload a JPG, PNG, or WebP image.`;
    }

    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      return `File size exceeds ${maxSizeMB}MB limit. Please choose a smaller image.`;
    }

    return null;
  };

  const getImageDimensions = (file: File): Promise<{ width: number; height: number }> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve({ width: img.width, height: img.height });
      };
      
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Failed to load image"));
      };
      
      img.src = url;
    });
  };

  const uploadImage = async (file: File) => {
    const validationError = validateFile(file);
    if (validationError) {
      toast({
        title: "Invalid File",
        description: validationError,
        variant: "destructive",
      });
      return;
    }

    setUploading(true);

    try {
      const dimensions = await getImageDimensions(file);
      setImageDimensions(dimensions);

      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = reader.result as string;

        try {
          const backend = getAuthenticatedBackend();
          const result = await backend.storage.upload({
            data: base64String,
            contentType: file.type,
          });

          setPreviewUrl(result.url);
          onImageUploaded(result.url);
          
          const widthCm = (dimensions.width / 96) * 2.54;
          const heightCm = (dimensions.height / 96) * 2.54;
          
          toast({
            title: "Success",
            description: `Image uploaded successfully (${dimensions.width}×${dimensions.height}px, ${widthCm.toFixed(1)}×${heightCm.toFixed(1)}cm)`,
          });
        } catch (error) {
          console.error("Upload failed:", error);
          toast({
            title: "Upload Failed",
            description: "Failed to upload image. Please try again.",
            variant: "destructive",
          });
        } finally {
          setUploading(false);
        }
      };

      reader.readAsDataURL(file);
    } catch (error) {
      console.error("Failed to process image:", error);
      toast({
        title: "Error",
        description: "Failed to process image. Please try again.",
        variant: "destructive",
      });
      setUploading(false);
    }
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

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      uploadImage(files[0]);
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      uploadImage(files[0]);
    }
  };

  const handleRemove = () => {
    setPreviewUrl(undefined);
    setImageDimensions(null);
    onImageUploaded("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      
      {previewUrl ? (
        <Card className="p-4">
          <div className="space-y-3">
            <div className="relative aspect-video w-full max-w-md mx-auto rounded-lg overflow-hidden bg-muted">
              <img 
                src={previewUrl} 
                alt="Preview" 
                className="w-full h-full object-cover"
              />
            </div>
            
            {imageDimensions && (
              <div className="text-xs text-muted-foreground text-center">
                Dimensions: {imageDimensions.width} × {imageDimensions.height} px 
                ({((imageDimensions.width / 96) * 2.54).toFixed(1)} × {((imageDimensions.height / 96) * 2.54).toFixed(1)} cm)
              </div>
            )}
            
            <div className="flex gap-2 justify-center">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                <Upload className="w-4 h-4 mr-2" />
                Replace Image
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleRemove}
                disabled={uploading}
              >
                <X className="w-4 h-4 mr-2" />
                Remove
              </Button>
            </div>
          </div>
        </Card>
      ) : (
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
          <div className="p-8 flex flex-col items-center justify-center text-center space-y-4">
            {uploading ? (
              <>
                <Loader2 className="w-10 h-10 text-primary animate-spin" />
                <p className="text-sm text-muted-foreground">Uploading image...</p>
              </>
            ) : (
              <>
                <div className="w-16 h-16 rounded-lg bg-muted/50 flex items-center justify-center">
                  <ImageIcon className="w-8 h-8 text-muted-foreground" />
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">
                    Module not populated. Awaiting input or sync from source.
                  </p>
                  <p className="text-sm font-medium text-foreground">
                    Drag and drop image here or click to upload
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Supports JPG, PNG, WebP (max {maxSizeMB}MB)
                  </p>
                </div>
              </>
            )}
          </div>
        </Card>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".jpg,.jpeg,.png,.webp"
        onChange={handleFileSelect}
        className="hidden"
        disabled={uploading}
      />
    </div>
  );
}
