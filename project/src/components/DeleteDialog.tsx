"use client";

import {
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useState } from "react";

interface DeleteDialogProps {
  onDelete?: () => void;
  onClose?: () => void;
  entityType: "vendor" | "recipient" | "customer" | "shipment" | "invoice" | "payment";
  entityId: number;
}

const DeleteDialog = ({
  onDelete,
  onClose,
  entityType,
  entityId,
}: DeleteDialogProps) => {
  const [password, setPassword] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [step, setStep] = useState<"password" | "verification">("password");
  const [verificationCode, setVerificationCode] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSendingCode, setIsSendingCode] = useState(false);

  const handlePasswordSubmit = async () => {
    if (!password.trim()) {
      toast.error("Please enter your password");
      return;
    }

    if (entityType === "shipment") {
      // For shipments, proceed to 2FA verification
      setIsSendingCode(true);
      try {
        const token = document.cookie
          .split("; ")
          .find((row) => row.startsWith("token="))
          ?.split("=")[1];

        if (!token) {
          toast.error("Authentication required");
          return;
        }

        // Send 2FA code to user's email
        const response = await fetch(`/api/shipments/${entityId}/send-2fa`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ password }),
        });

        const data = await response.json();

        if (response.ok) {
          setStep("verification");
          toast.success("Verification code sent to your email!");
        } else {
          toast.error(data.error || "Failed to send verification code");
        }
      } catch (error) {
        console.error("Error sending 2FA code:", error);
        toast.error("An error occurred while sending verification code");
      } finally {
        setIsSendingCode(false);
      }
    } else {
      // For other entities, proceed with normal deletion
      handleDelete();
    }
  };

  const handleVerificationSubmit = async () => {
    if (!verificationCode.trim()) {
      toast.error("Please enter the verification code");
      return;
    }

    if (verificationCode.length !== 6) {
      toast.error("Please enter the 6-digit verification code");
      return;
    }

    setIsVerifying(true);
    try {
      const token = document.cookie
        .split("; ")
        .find((row) => row.startsWith("token="))
        ?.split("=")[1];

      if (!token) {
        toast.error("Authentication required");
        return;
      }

      // Verify 2FA code and delete shipment
      const response = await fetch(`/api/shipments/${entityId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ password, verificationCode }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success("Shipment deleted successfully!");
        onDelete?.();
        onClose?.();
        setPassword("");
        setVerificationCode("");
        setStep("password");
      } else {
        toast.error(data.error || "Failed to delete shipment");
      }
    } catch (error) {
      console.error("Verification error:", error);
      toast.error("An error occurred during verification");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleDelete = async () => {
    if (!password.trim()) {
      toast.error("Please enter your password");
      return;
    }

    setIsDeleting(true);

    try {
      // Get the token from cookies
      const token = document.cookie
        .split("; ")
        .find((row) => row.startsWith("token="))
        ?.split("=")[1];

      if (!token) {
        toast.error("Authentication required");
        return;
      }

      // Make the delete API call
      const apiUrl = entityType === "invoice" 
        ? `/api/accounts/invoices/${entityId}`
        : entityType === "payment"
        ? `/api/accounts/payments/${entityId}`
        : `/api/${entityType}s/${entityId}`;
        
      const response = await fetch(apiUrl, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ password }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(`${entityType.charAt(0).toUpperCase() + entityType.slice(1)} deleted successfully!`);
        onDelete?.();
        onClose?.();
        setPassword("");
      } else {
        toast.error(data.error || "Failed to delete");
      }
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("An error occurred while deleting");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleVerificationCodeChange = (index: number, value: string) => {
    // Only allow single digits
    if (value.length > 1) return;
    
    // Update the verification code at the specific index
    const newCode = verificationCode.split('');
    newCode[index] = value;
    setVerificationCode(newCode.join(''));
    
    // Auto-focus to next input if value entered
    if (value && index < 5) {
      const nextInput = document.getElementById(`verification-${index + 1}`);
      if (nextInput) nextInput.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    // Handle backspace to go to previous input
    if (e.key === 'Backspace' && !verificationCode[index] && index > 0) {
      const prevInput = document.getElementById(`verification-${index - 1}`);
      if (prevInput) prevInput.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').slice(0, 6);
    if (/^\d{6}$/.test(pastedData)) {
      setVerificationCode(pastedData);
      // Focus the last filled input
      const lastIndex = Math.min(pastedData.length - 1, 5);
      const lastInput = document.getElementById(`verification-${lastIndex}`);
      if (lastInput) lastInput.focus();
    }
  };

  const getEntityDisplayName = () => {
    switch (entityType) {
      case "vendor":
        return "vendor";
      case "recipient":
        return "recipient";
      case "customer":
        return "customer";
      case "shipment":
        return "shipment";
      case "invoice":
        return "invoice";
      case "payment":
        return "payment";
      default:
        return "item";
    }
  };

  const handleBackToPassword = () => {
    setStep("password");
    setVerificationCode("");
  };

  if (step === "verification" && entityType === "shipment") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full"
      >
        <DialogHeader>
          <DialogTitle className="text-lg text-center mb-2">
            Two-Factor Authentication
          </DialogTitle>
        </DialogHeader>
        <div className="text-sm text-gray-700 mb-4 text-center">
          We've sent a 6-digit verification code to your email. Please enter it below to confirm the deletion.
        </div>

        <div className="space-y-4">
          <Label className="text-sm text-center block">
            Enter the 6-digit code:
          </Label>
          <div className="flex justify-center gap-2">
            {[0, 1, 2, 3, 4, 5].map((index) => (
              <Input
                key={index}
                id={`verification-${index}`}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={verificationCode[index] || ""}
                onChange={(e) => handleVerificationCodeChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                onPaste={handlePaste}
                className="w-12 h-12 text-center text-lg font-semibold"
                placeholder="0"
              />
            ))}
          </div>
        </div>

        <DialogFooter className="mt-6 flex justify-between">
          <Button
            type="button"
            variant="ghost"
            onClick={handleBackToPassword}
            disabled={isVerifying}
          >
            ← Back
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleVerificationSubmit}
            disabled={isVerifying || verificationCode.length !== 6}
          >
            {isVerifying ? "Verifying..." : "Confirm Deletion"}
          </Button>
        </DialogFooter>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full"
    >
      <DialogHeader>
        <DialogTitle className="text-lg text-center mb-2">
          Confirm Deletion
        </DialogTitle>
      </DialogHeader>
      <div className="text-sm text-gray-700 mb-4 text-center">
        Are you sure you want to delete this {getEntityDisplayName()}? This action cannot be
        undone.
        {entityType === "shipment" && (
          <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-red-700">
            ⚠️ Shipment deletion requires two-factor authentication for security.
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="password" className="text-sm">
          Enter your password to confirm:
        </Label>
        <Input
          id="password"
          type="password"
          placeholder="Your password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyPress={(e) => {
            if (e.key === "Enter") {
              handlePasswordSubmit();
            }
          }}
        />
      </div>

      <DialogFooter className="mt-4 flex justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          onClick={onClose}
          disabled={isDeleting || isSendingCode}
        >
          Cancel
        </Button>
        <Button
          type="button"
          variant="destructive"
          onClick={handlePasswordSubmit}
          disabled={isDeleting || isSendingCode}
        >
          {isSendingCode ? "Sending Code..." : isDeleting ? "Deleting..." : "Continue"}
        </Button>
      </DialogFooter>
    </motion.div>
  );
};

export default DeleteDialog;
