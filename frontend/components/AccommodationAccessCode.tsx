import { useState } from "react";
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

interface AccommodationAccessCodeProps {
  accommodationId: number;
  // The owner's verified Edit Code, required to authorise the change server-side.
  editCode?: string;
}

// AccommodationAccessCode lets the owner (in the edit-code-unlocked profile
// editor) issue a fresh Profile Access Code — e.g. when guests change over so
// new guests get a different code. The old code stops working immediately.
export default function AccommodationAccessCode({ accommodationId, editCode }: AccommodationAccessCodeProps) {
  const [newCode, setNewCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const { toast } = useToast();

  const regenerate = async () => {
    setBusy(true);
    try {
      const backend = getAuthenticatedBackend();
      const res = await backend.accommodation.regenerateAccessCode({ id: accommodationId, editCode });
      const code = (res as { accessCode?: string }).accessCode ?? null;
      setNewCode(code);
      toast({
        title: "Access Code changed",
        description: "Your previous code no longer works. Share the new one with your guests.",
      });
    } catch (e: any) {
      toast({ title: "Couldn't change the code", description: e?.message || "Please try again.", variant: "destructive" });
    } finally {
      setBusy(false);
      setConfirm(false);
    }
  };

  const copy = () => {
    if (newCode) {
      navigator.clipboard.writeText(newCode);
      setCopied(true);
      toast({ title: "Copied!", description: "New access code copied to clipboard" });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <>
      <div className="space-y-2 p-4 bg-muted/50 rounded-lg border border-border">
        <Label className="text-base font-semibold text-foreground">Profile Access Code</Label>
        <p className="text-xs text-muted-foreground">
          This is the code your guests use to sign in. If guests have checked out, you can issue a new
          one — the old code (and any old printed QR) stops working immediately.
        </p>

        {newCode && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-foreground">Your new Access Code:</p>
            <div className="flex gap-2 items-center">
              <Input value={newCode} readOnly className="font-mono tracking-widest" />
              <Button type="button" variant="outline" size="sm" onClick={copy}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        )}

        <Button type="button" variant="outline" size="sm" onClick={() => setConfirm(true)} disabled={busy}>
          <RefreshCw className="h-4 w-4 mr-2" />
          {newCode ? "Change Access Code again" : "Change Access Code"}
        </Button>
      </div>

      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Change your Access Code?</AlertDialogTitle>
            <AlertDialogDescription>
              A new Access Code will be generated and the current one will stop working immediately.
              Anyone using the old code — or an old printed QR code — will no longer be able to sign in.
              This can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={regenerate} disabled={busy}>
              {busy ? "Changing…" : "Change Access Code"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
