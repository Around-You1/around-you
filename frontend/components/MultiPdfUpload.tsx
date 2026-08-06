import { useState, useRef } from "react";
import { Upload, X, Loader2, FileText } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { getAuthenticatedBackend } from "../lib/backend";

interface MultiPdfUploadProps {
  label?: string;
  pdfs: string[];
  onChange: (urls: string[]) => void;
  maxPdfs?: number;
  maxSizeMB?: number;
}

const DEFAULT_MAX_SIZE_MB = 15;
const DEFAULT_MAX_PDFS = 20;

export default function MultiPdfUpload({
  label = "Menu PDF(s)",
  pdfs,
  onChange,
  maxPdfs = DEFAULT_MAX_PDFS,
  maxSizeMB = DEFAULT_MAX_SIZE_MB,
}: MultiPdfUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const validateFile = (file: File): string | null => {
    if (file.type !== "application/pdf") return `${file.name}: only PDF files are allowed.`;
    if (file.size > maxSizeMB * 1024 * 1024) return `${file.name}: exceeds ${maxSizeMB}MB limit.`;
    return null;
  };

  const readAsDataURL = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsDataURL(file);
    });

  const uploadFiles = async (fileList: FileList | File[]) => {
    const remaining = maxPdfs - pdfs.length;
    if (remaining <= 0) {
      toast({ title: "Limit reached", description: `You can only have up to ${maxPdfs} PDFs.`, variant: "destructive" });
      return;
    }
    const files = Array.from(fileList).slice(0, remaining);
    const errors: string[] = [];
    const valid = files.filter((f) => {
      const e = validateFile(f);
      if (e) errors.push(e);
      return !e;
    });
    if (errors.length) toast({ title: "Some files skipped", description: errors.join(" "), variant: "destructive" });
    if (!valid.length) return;

    setUploading(true);
    setProgress({ done: 0, total: valid.length });
    const backend = getAuthenticatedBackend();
    const newUrls: string[] = [];
    for (const file of valid) {
      try {
        const dataUrl = await readAsDataURL(file);
        const result = await backend.storage.upload({ data: dataUrl, contentType: "application/pdf" });
        newUrls.push(result.url);
      } catch (error) {
        console.error("PDF upload failed for", file.name, error);
        toast({ title: "Upload failed", description: `${file.name} failed to upload — the rest will continue.`, variant: "destructive" });
      }
      setProgress((p) => (p ? { ...p, done: p.done + 1 } : p));
    }
    if (newUrls.length) {
      onChange([...pdfs, ...newUrls]);
      toast({ title: "Success", description: `${newUrls.length} PDF${newUrls.length === 1 ? "" : "s"} uploaded successfully.` });
    }
    setUploading(false);
    setProgress(null);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) uploadFiles(e.target.files);
    e.target.value = "";
  };
  const handleRemove = (index: number) => onChange(pdfs.filter((_, i) => i !== index));
  const move = (index: number, dir: -1 | 1) => {
    const j = index + dir;
    if (j < 0 || j >= pdfs.length) return;
    const next = [...pdfs];
    [next[index], next[j]] = [next[j], next[index]];
    onChange(next);
  };

  const atLimit = pdfs.length >= maxPdfs;

  return (
    <div className="space-y-3">
      <Label>
        {label} ({pdfs.length}/{maxPdfs})
      </Label>
      <p className="text-xs text-muted-foreground">
        For a restaurant without an online menu — upload the menu as PDF(s). One PDF per page is fine; use the arrows to set page order.
      </p>

      {pdfs.length > 0 && (
        <div className="space-y-2">
          {pdfs.map((url, index) => (
            <div key={url + index} className="flex items-center gap-2 rounded-md border border-border p-2">
              <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <a href={url} target="_blank" rel="noopener noreferrer" className="text-sm underline truncate flex-1">
                Menu page {index + 1}
              </a>
              <button type="button" onClick={() => move(index, -1)} disabled={index === 0} className="text-sm px-1 disabled:opacity-30" aria-label="Move up">↑</button>
              <button type="button" onClick={() => move(index, 1)} disabled={index === pdfs.length - 1} className="text-sm px-1 disabled:opacity-30" aria-label="Move down">↓</button>
              <button type="button" onClick={() => handleRemove(index)} className="text-muted-foreground hover:text-destructive" aria-label="Remove PDF">
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {!atLimit && (
        <Card
          className={`border-2 border-dashed transition-colors cursor-pointer ${isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25"} ${uploading ? "opacity-50 cursor-not-allowed" : "hover:border-primary/50"}`}
          onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }}
          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
          onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); }}
          onDrop={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); if (e.dataTransfer.files?.length) uploadFiles(e.dataTransfer.files); }}
          onClick={() => !uploading && fileInputRef.current?.click()}
        >
          <div className="p-6 flex flex-col items-center justify-center text-center space-y-2">
            {uploading ? (
              <>
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
                <p className="text-sm text-muted-foreground">Uploading {progress ? `${progress.done}/${progress.total}` : "…"}</p>
              </>
            ) : (
              <>
                <div className="w-12 h-12 rounded-lg bg-muted/50 flex items-center justify-center">
                  <Upload className="w-6 h-6 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-foreground">Drag and drop menu PDFs here or click to upload</p>
                <p className="text-xs text-muted-foreground">PDF only — max {maxSizeMB}MB each, up to {maxPdfs - pdfs.length} more</p>
              </>
            )}
          </div>
        </Card>
      )}

      <input ref={fileInputRef} type="file" accept="application/pdf,.pdf" multiple onChange={handleFileSelect} className="hidden" disabled={uploading} />
    </div>
  );
}
