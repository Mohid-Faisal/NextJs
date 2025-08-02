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

const DeleteDialog = ({
  onDelete,
  onClose,
}: {
  onDelete?: () => void;
  onClose?: () => void;
}) => {
  const [password, setPassword] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);

    if (password === "admin123") {
      toast.success("Customer deleted!");
      onDelete?.();
      onClose?.(); // Close the dialog from parent
      setPassword("");
    } else {
      toast.error("Incorrect password!");
    }

    setIsDeleting(false);
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
        Are you sure you want to delete this customer? This action cannot be
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
