"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, X, FileText, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface BulkUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function BulkUploadModal({ isOpen, onClose }: BulkUploadModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{
    success: number;
    failed: number;
    skipped: number;
    errors: string[];
  } | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      const allowedTypes = [
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ];
      
      if (!allowedTypes.includes(selectedFile.type)) {
        toast.error("Please upload an Excel file (.xlsx or .xls)");
        return;
      }
      
      setFile(selectedFile);
      setUploadResult(null);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      toast.error("Please select a file to upload");
      return;
    }

    setUploading(true);
    setUploadResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/bulk-upload-shipments", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setUploadResult({
          success: data.results.success,
          failed: data.results.failed,
          skipped: data.results.skipped,
          errors: data.results.errors || [],
        });
        toast.success(data.message);
      } else {
        toast.error(data.message || "Upload failed");
        setUploadResult({
          success: 0,
          failed: 0,
          skipped: 0,
          errors: [data.message || "Unknown error"],
        });
      }
    } catch (error: any) {
      console.error("Upload error:", error);
      toast.error("Failed to upload file. Please try again.");
      setUploadResult({
        success: 0,
        failed: 0,
        skipped: 0,
        errors: [error.message || "Unknown error"],
      });
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setUploadResult(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">Bulk Upload Shipments</DialogTitle>
          <DialogDescription>
            Upload an Excel file with shipment data. The file should contain columns: Date, Reference, Tracking, Sender, Receiver, Country, Shipping Mode, Type, Vendor, Service Mode, Status, Pcs, Description, Weight, Vendor Weight, Price, CoS
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* File Input */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Select Excel File</label>
            <div className="flex items-center gap-4">
              <label
                htmlFor="bulk-upload-file"
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                <Upload className="w-5 h-5" />
                <span className="text-sm">Choose File</span>
              </label>
              <input
                id="bulk-upload-file"
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                className="hidden"
              />
              {file && (
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <FileText className="w-4 h-4" />
                  <span>{file.name}</span>
                  <button
                    onClick={() => setFile(null)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Upload Result */}
          {uploadResult && (
            <div className="space-y-3 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold">Upload Results</h3>
              </div>
              
              <div className="grid grid-cols-3 gap-4">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Success</div>
                    <div className="text-lg font-semibold">{uploadResult.success}</div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <XCircle className="w-5 h-5 text-red-500" />
                  <div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Failed</div>
                    <div className="text-lg font-semibold">{uploadResult.failed}</div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-yellow-500" />
                  <div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Skipped</div>
                    <div className="text-lg font-semibold">{uploadResult.skipped}</div>
                  </div>
                </div>
              </div>

              {uploadResult.errors.length > 0 && (
                <div className="mt-3">
                  <div className="text-sm font-medium mb-2">Errors:</div>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {uploadResult.errors.map((error, index) => (
                      <div key={index} className="text-xs text-red-600 dark:text-red-400">
                        {error}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={uploading}
            >
              Close
            </Button>
            <Button
              onClick={handleUpload}
              disabled={!file || uploading}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {uploading ? "Uploading..." : "Upload"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
