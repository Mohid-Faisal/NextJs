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
  entityType: "vendor" | "recipient" | "customer" | "shipment";
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
      const response = await fetch(`/api/${entityType}s/${entityId}`, {
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
      default:
        return "item";
    }
  };

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
              handleDelete();
            }
          }}
        />
      </div>

      <DialogFooter className="mt-4 flex justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          onClick={onClose}
          disabled={isDeleting}
        >
          Cancel
        </Button>
        <Button
          type="button"
          variant="destructive"
          onClick={handleDelete}
          disabled={isDeleting}
        >
          {isDeleting ? "Deleting..." : "Confirm Delete"}
        </Button>
      </DialogFooter>
    </motion.div>
  );
};

export default DeleteDialog;
