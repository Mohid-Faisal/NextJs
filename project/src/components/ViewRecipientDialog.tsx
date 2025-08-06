"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, MapPin, Phone, Mail, Building, User, Globe } from "lucide-react";
import { Country } from "country-state-city";

interface Recipient {
  id: number;
  CompanyName: string;
  PersonName: string;
  Email: string;
  Phone: string;
  Country: string;
  State: string;
  City: string;
  Zip: string;
  Address: string;
  createdAt: string;
}

interface ViewRecipientDialogProps {
  recipient: Recipient | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ViewRecipientDialog({ recipient, open, onOpenChange }: ViewRecipientDialogProps) {
  if (!recipient) return null;

  const formatDate = (dateString: string) => {
    if (!dateString) return "Not specified";
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getCountryName = (countryCode: string) => {
    return Country.getCountryByCode(countryCode)?.name || countryCode;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-center text-gray-800">
            Recipient Details
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Header Card */}
          <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-green-600 rounded-full flex items-center justify-center">
                    <Building className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900">{recipient.CompanyName}</h3>
                    <p className="text-sm text-gray-600">Recipient ID: #{recipient.id}</p>
                  </div>
                </div>
                <Badge variant="secondary" className="text-sm">
                  Active Recipient
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Contact Information */}
          <Card>
            <CardContent className="p-6">
              <h4 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <User className="w-5 h-5 text-green-600" />
                Contact Information
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <User className="w-4 h-4 text-gray-500" />
                    <div>
                      <p className="text-sm text-gray-600">Contact Person</p>
                      <p className="font-medium">{recipient.PersonName || "Not specified"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Phone className="w-4 h-4 text-gray-500" />
                    <div>
                      <p className="text-sm text-gray-600">Phone</p>
                      <p className="font-medium">{recipient.Phone || "Not specified"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Mail className="w-4 h-4 text-gray-500" />
                    <div>
                      <p className="text-sm text-gray-600">Email</p>
                      <p className="font-medium">{recipient.Email || "Not specified"}</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Calendar className="w-4 h-4 text-gray-500" />
                    <div>
                      <p className="text-sm text-gray-600">Created On</p>
                      <p className="font-medium">{formatDate(recipient.createdAt)}</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Location Information */}
          <Card>
            <CardContent className="p-6">
              <h4 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-green-600" />
                Location Information
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Globe className="w-4 h-4 text-gray-500" />
                    <div>
                      <p className="text-sm text-gray-600">Country</p>
                      <p className="font-medium">{getCountryName(recipient.Country)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <MapPin className="w-4 h-4 text-gray-500" />
                    <div>
                      <p className="text-sm text-gray-600">State/Province</p>
                      <p className="font-medium">{recipient.State || "Not specified"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <MapPin className="w-4 h-4 text-gray-500" />
                    <div>
                      <p className="text-sm text-gray-600">City</p>
                      <p className="font-medium">{recipient.City || "Not specified"}</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <MapPin className="w-4 h-4 text-gray-500" />
                    <div>
                      <p className="text-sm text-gray-600">Zip Code</p>
                      <p className="font-medium">{recipient.Zip || "Not specified"}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <MapPin className="w-4 h-4 text-gray-500 mt-1" />
                    <div>
                      <p className="text-sm text-gray-600">Address</p>
                      <p className="font-medium">{recipient.Address || "Not specified"}</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Summary */}
          <Card className="bg-gray-50">
            <CardContent className="p-6">
              <h4 className="text-lg font-semibold mb-3 text-gray-800">Summary</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                <div className="bg-white p-3 rounded-lg">
                  <p className="text-2xl font-bold text-green-600">{recipient.id}</p>
                  <p className="text-xs text-gray-600">Recipient ID</p>
                </div>
                <div className="bg-white p-3 rounded-lg">
                  <p className="text-2xl font-bold text-green-600">
                    {recipient.CompanyName ? "✓" : "✗"}
                  </p>
                  <p className="text-xs text-gray-600">Company</p>
                </div>
                <div className="bg-white p-3 rounded-lg">
                  <p className="text-2xl font-bold text-purple-600">
                    {recipient.Phone ? "✓" : "✗"}
                  </p>
                  <p className="text-xs text-gray-600">Phone</p>
                </div>
                <div className="bg-white p-3 rounded-lg">
                  <p className="text-2xl font-bold text-orange-600">
                    {recipient.Email ? "✓" : "✗"}
                  </p>
                  <p className="text-xs text-gray-600">Email</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
} 