import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Copy, Check, RefreshCw } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { getAuthenticatedBackend } from "../lib/backend";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface EditCodeDisplayProps {
  entityType: "accommodation" | "restaurant" | "service" | "attraction" | "estate_agency" | "estate_agent";
  entityId: number;
}

// EditCodeDisplay shows (and lets admins/reps regenerate) the secret Edit Code
// for any entity via the generic edit-code API. Unlike PartnerAccessCodeDisplay
// it does not touch the partner/view code, so it works for accommodations too
// (which have no separate partner code). The owner uses this code to unlock
// editing of their own profile from their dashboard.
export default function EditCodeDisplay({ entityType, entityId }: EditCodeDisplayProps) {
  const [editCode, setEditCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showRegenDialog, setShowRegenDialog] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const backend = getAuthenticatedBackend();
        const res = await backend.editCode.get({ entityType, entityId });
        if (alive) setEditCode((res as { editCode?: string }).editCode ?? null);
      } catch (error) {
        console.error("Failed to load edit code:", error);
      }
    })();
    return () => {
      alive = false;
    };
  }, [entityType, entityId]);

  const copyToClipboard = () => {
    if (editCode) {
      navigator.clipboard.writeText(editCode);
      setCopied(true);
      toast({ title: "Copied!", description: "Edit code copied to clipboard" });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleRegenerate = async () => {
    setIsRegenerating(true);
    try {
      const backend = getAuthenticatedBackend();
      const res = await backend.editCode.regenerate({ entityType, entityId });
      setEditCode((res as { editCode?: string }).editCode ?? null);
      toast({ title: "Edit Code Regenerated", description: "A new edit code has been generated. Share it with the owner." });
    } catch (error) {
      console.error("Failed to regenerate edit code:", error);
      toast({ title: "Error", description: "Failed to regenerate edit code. Please try again.", variant: "destructive" });
    } finally {
      setIsRegenerating(false);
      setShowRegenDialog(false);
    }
  };

  return (
    <>
      <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
        <Label className="text-base font-semibold">Edit Code</Label>
        <div className="flex gap-2">
          <Input value={editCode ?? ""} readOnly className="font-mono" placeholder="—" />
          <Button type="button" variant="outline" onClick={copyToClipboard} className="flex-shrink-0" disabled={!editCode}>
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>
        <div className="flex items-start justify-between gap-4">
          <p className="text-xs text-muted-foreground">
            Give this to the owner so they can edit their own profile after signing in with their Access Code. It is separate from the login code and does not grant login.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowRegenDialog(true)}
            disabled={isRegenerating}
            className="flex-shrink-0"
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            Regenerate
          </Button>
        </div>
      </div>

      <AlertDialog open={showRegenDialog} onOpenChange={setShowRegenDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Regenerate Edit Code?</AlertDialogTitle>
            <AlertDialogDescription>
              This generates a new edit code and invalidates the current one. An owner using the old edit code will need the new one to edit their profile. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRegenerate} disabled={isRegenerating}>
              {isRegenerating ? "Regenerating..." : "Regenerate"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
