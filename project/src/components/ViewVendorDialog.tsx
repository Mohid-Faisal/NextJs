"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, MapPin, Phone, Mail, Building, User, Globe } from "lucide-react";
import { Country } from "country-state-city";

interface Vendor {
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

interface ViewVendorDialogProps {
  vendor: Vendor | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ViewVendorDialog({ vendor, open, onOpenChange }: ViewVendorDialogProps) {
  if (!vendor) return null;

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
      <DialogContent size="2xl" className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-center text-foreground">
            Vendor Details
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-2">
          {/* Header Card */}
          <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 border-blue-200 dark:border-blue-800">
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
                    <Building className="w-3 h-3 text-white" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-foreground">{vendor.CompanyName}</h3>
                    <p className="text-xs text-muted-foreground">Vendor ID: #{vendor.id}</p>
                  </div>
                </div>
                <Badge variant="secondary" className="text-xs px-2 py-1">
                  Vendor
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Contact Information */}
          <Card>
            <CardContent className="p-3">
              <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <User className="w-3 h-3 text-blue-600" />
                Contact Information
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <User className="w-3 h-3 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Contact Person</p>
                      <p className="font-medium text-xs">{vendor.PersonName || "Not specified"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="w-3 h-3 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Phone</p>
                      <p className="font-medium text-xs">{vendor.Phone || "Not specified"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="w-3 h-3 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Email</p>
                      <p className="font-medium text-xs">{vendor.Email || "Not specified"}</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-3 h-3 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Created On</p>
                      <p className="font-medium text-xs">{formatDate(vendor.createdAt)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Building className="w-3 h-3 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Company</p>
                      <p className="font-medium text-xs">{vendor.CompanyName || "Not specified"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Vendor ID</p>
                      <p className="font-medium text-xs">#{vendor.id}</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Location Information */}
          <Card>
            <CardContent className="p-3">
              <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <MapPin className="w-3 h-3 text-blue-600" />
                Location Information
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Globe className="w-3 h-3 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Country</p>
                      <p className="font-medium text-xs">{getCountryName(vendor.Country)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3 h-3 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">State/Province</p>
                      <p className="font-medium text-xs">{vendor.State || "Not specified"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3 h-3 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">City</p>
                      <p className="font-medium text-xs">{vendor.City || "Not specified"}</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3 h-3 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Zip Code</p>
                      <p className="font-medium text-xs">{vendor.Zip || "Not specified"}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <MapPin className="w-3 h-3 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-xs text-muted-foreground">Address</p>
                      <p className="font-medium text-xs">{vendor.Address || "Not specified"}</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
} 

