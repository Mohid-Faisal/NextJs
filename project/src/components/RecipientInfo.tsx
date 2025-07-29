"use client";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FaInfoCircle } from "react-icons/fa";
import AddRecipientDialog from "./AddRecipientDialog";

export default function RecipientInfoSection({
  recipientQuery,
  setRecipientQuery,
  recipientResults,
  selectedRecipient,
  setSelectedRecipient,
}: {
  recipientQuery: string;
  setRecipientQuery: (val: string) => void;
  recipientResults: any[];
  selectedRecipient: any;
  setSelectedRecipient: (val: any) => void;
}) {
  return (
    <Card className="bg-white border border-gray-100 shadow-sm">
      <CardContent className="p-6">
        {/* Header */}
        <div className="flex items-center gap-2 mb-4">
          <FaInfoCircle className="text-primary" />
          <span className="font-medium">Recipient Information</span>
        </div>

        <div className="space-y-6">
          {/* Recipient Name */}
          <div className="flex flex-col text-black">
            <Label className="mb-1">Recipient/Client</Label>
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <Select
                  onValueChange={(val) => {
                    const selected = recipientResults.find((r) => r.id === val);
                    setSelectedRecipient(selected ?? null);
                    setRecipientQuery(selected?.Company ?? "");
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Search recipient name..." />
                  </SelectTrigger>
                  <SelectContent>
                    <div className="px-2 py-1">
                      <Input
                        className="w-full text-sm"
                        placeholder="Type to search"
                        value={recipientQuery}
                        onChange={(e) =>
                          setRecipientQuery(e.target.value)
                        }
                      />
                    </div>
                    {recipientResults.length > 0 ? (
                      recipientResults.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.Company}
                        </SelectItem>
                      ))
                    ) : (
                      <div className="px-4 py-2 text-gray-500 text-sm">
                        {recipientQuery.length >= 2
                          ? "No matches found."
                          : "Type at least 2 characters"}
                      </div>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <AddRecipientDialog triggerLabel="+" />
            </div>
          </div>

          {/* Recipient Address */}
          <div className="flex flex-col text-black">
            <Label className="mb-1">Recipient/Client Address</Label>
            <div className="flex gap-2">
              <Input
                value={selectedRecipient?.Address ?? ""}
                readOnly
                placeholder="Recipient address"
                className="flex-1 bg-gray-100"
              />
              <AddRecipientDialog triggerLabel="+" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
