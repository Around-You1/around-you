import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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

interface PartnerAccessCodeDisplayProps {
  entityId: number;
  entityType: "restaurant" | "service" | "attraction";
}

export default function PartnerAccessCodeDisplay({ entityId, entityType }: PartnerAccessCodeDisplayProps) {
  const [partnerCode, setPartnerCode] = useState<string | null>(null);
  const [codeActive, setCodeActive] = useState(true);
  const [copied, setCopied] = useState(false);
  const [showRegenerateDialog, setShowRegenerateDialog] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isTogglingActive, setIsTogglingActive] = useState(false);
  const [editCode, setEditCode] = useState<string | null>(null);
  const [editCopied, setEditCopied] = useState(false);
  const [showEditRegenDialog, setShowEditRegenDialog] = useState(false);
  const [isRegeneratingEdit, setIsRegeneratingEdit] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadPartnerCode();
    loadEditCode();
  }, [entityId, entityType]);

  const loadEditCode = async () => {
    try {
      const backend = getAuthenticatedBackend();
      const res = await backend.editCode.get({ entityType, entityId });
      setEditCode((res as { editCode?: string }).editCode ?? null);
    } catch (error) {
      console.error("Failed to load edit code:", error);
    }
  };

  const copyEditToClipboard = () => {
    if (editCode) {
      navigator.clipboard.writeText(editCode);
      setEditCopied(true);
      toast({ title: "Copied!", description: "Partner edit code copied to clipboard" });
      setTimeout(() => setEditCopied(false), 2000);
    }
  };

  const handleRegenerateEdit = async () => {
    setIsRegeneratingEdit(true);
    try {
      const backend = getAuthenticatedBackend();
      const res = await backend.editCode.regenerate({ entityType, entityId });
      setEditCode((res as { editCode?: string }).editCode ?? null);
      toast({ title: "Edit Code Regenerated", description: "A new edit code has been generated. Share it with the partner." });
    } catch (error) {
      console.error("Failed to regenerate edit code:", error);
      toast({ title: "Error", description: "Failed to regenerate edit code. Please try again.", variant: "destructive" });
    } finally {
      setIsRegeneratingEdit(false);
      setShowEditRegenDialog(false);
    }
  };

  const loadPartnerCode = async () => {
    try {
      const backend = getAuthenticatedBackend();
      let response;
      
      if (entityType === "restaurant") {
        response = await backend.restaurant.getPartnerCode({ id: entityId });
      } else if (entityType === "service") {
        response = await backend.service.getPartnerCode({ id: entityId });
      } else {
        response = await backend.attraction.getPartnerCode({ id: entityId });
      }

      setPartnerCode(response.partnerCode);
      setCodeActive(response.codeActive);
    } catch (error) {
      console.error("Failed to load partner code:", error);
    }
  };

  const copyToClipboard = () => {
    if (partnerCode) {
      navigator.clipboard.writeText(partnerCode);
      setCopied(true);
      toast({
        title: "Copied!",
        description: "Partner access code copied to clipboard",
      });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleRegenerate = async () => {
    setIsRegenerating(true);
    try {
      const backend = getAuthenticatedBackend();
      let response;
      
      if (entityType === "restaurant") {
        response = await backend.restaurant.regeneratePartnerCode({ id: entityId });
      } else if (entityType === "service") {
        response = await backend.service.regeneratePartnerCode({ id: entityId });
      } else {
        response = await backend.attraction.regeneratePartnerCode({ id: entityId });
      }

      setPartnerCode(response.partnerCode);
      setCodeActive(true);
      toast({
        title: "Code Regenerated",
        description: "A new partner access code has been generated and is now active.",
      });
    } catch (error) {
      console.error("Failed to regenerate partner code:", error);
      toast({
        title: "Error",
        description: "Failed to regenerate partner access code. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsRegenerating(false);
      setShowRegenerateDialog(false);
    }
  };

  const handleToggleActive = async (active: boolean) => {
    setIsTogglingActive(true);
    try {
      const backend = getAuthenticatedBackend();
      
      if (entityType === "restaurant") {
        await backend.restaurant.togglePartnerCode({ id: entityId, active });
      } else if (entityType === "service") {
        await backend.service.togglePartnerCode({ id: entityId, active });
      } else {
        await backend.attraction.togglePartnerCode({ id: entityId, active });
      }

      setCodeActive(active);
      toast({
        title: active ? "Code Activated" : "Code Deactivated",
        description: active 
          ? "Partner access code is now active and can be used for login." 
          : "Partner access code has been deactivated and cannot be used for login.",
      });
    } catch (error) {
      console.error("Failed to toggle partner code:", error);
      toast({
        title: "Error",
        description: "Failed to update access code status. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsTogglingActive(false);
    }
  };

  if (!partnerCode) {
    return null;
  }

  return (
    <>
      <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
        <div className="flex items-center justify-between">
          <Label className="text-base font-semibold">Partner Access Code</Label>
          <div className="flex items-center gap-2">
            <Label htmlFor="code-active" className="text-sm">
              {codeActive ? "Active" : "Inactive"}
            </Label>
            <Switch
              id="code-active"
              checked={codeActive}
              onCheckedChange={handleToggleActive}
              disabled={isTogglingActive}
            />
          </div>
        </div>
        
        <div className="flex gap-2">
          <Input
            value={partnerCode}
            readOnly
            className="font-mono"
          />
          <Button
            type="button"
            variant="outline"
            onClick={copyToClipboard}
            className="flex-shrink-0"
          >
            {copied ? (
              <Check className="h-4 w-4" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
        </div>

        <div className="flex items-start justify-between gap-4">
          <p className="text-xs text-muted-foreground">
            {codeActive ? (
              <>Persistent access code for Partner login. Valid until deactivated or regenerated.</>
            ) : (
              <span className="text-amber-600 font-medium">This code is currently deactivated and cannot be used for login.</span>
            )}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowRegenerateDialog(true)}
            disabled={isRegenerating}
            className="flex-shrink-0"
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            Regenerate
          </Button>
        </div>
      </div>

      <div className="space-y-4 p-4 bg-muted/50 rounded-lg mt-4">
        <Label className="text-base font-semibold">Partner Edit Code</Label>
        <div className="flex gap-2">
          <Input value={editCode ?? ""} readOnly className="font-mono" placeholder="—" />
          <Button type="button" variant="outline" onClick={copyEditToClipboard} className="flex-shrink-0" disabled={!editCode}>
            {editCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>
        <div className="flex items-start justify-between gap-4">
          <p className="text-xs text-muted-foreground">
            Give this to the partner so they can edit their own profile from the Partner Dashboard. It is separate from the login code above and does not grant login.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowEditRegenDialog(true)}
            disabled={isRegeneratingEdit}
            className="flex-shrink-0"
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            Regenerate
          </Button>
        </div>
      </div>

      <AlertDialog open={showEditRegenDialog} onOpenChange={setShowEditRegenDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Regenerate Edit Code?</AlertDialogTitle>
            <AlertDialogDescription>
              This generates a new edit code and invalidates the current one. A partner using the old edit code will need the new one to edit their profile. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRegenerateEdit} disabled={isRegeneratingEdit}>
              {isRegeneratingEdit ? "Regenerating..." : "Regenerate"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showRegenerateDialog} onOpenChange={setShowRegenerateDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Regenerate Access Code?</AlertDialogTitle>
            <AlertDialogDescription>
              This will generate a new partner access code and invalidate the current one. 
              Any partners using the old code will need to use the new code to log in.
              This action cannot be undone.
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
