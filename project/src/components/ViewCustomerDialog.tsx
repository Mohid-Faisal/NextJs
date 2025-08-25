"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, MapPin, Phone, Mail, Building, User, Globe, FileText, Shield, Package, Users, DollarSign, Truck } from "lucide-react";
import { Country } from "country-state-city";

interface Customer {
  id: number;
  CompanyName: string;
  PersonName: string;
  Email: string;
  Phone: string;
  DocumentType: string;
  DocumentNumber: string;
  Country: string;
  State: string;
  City: string;
  Zip: string;
  Address: string;
  ActiveStatus: string;
  createdAt: string;
  currentBalance?: number;
  // Shipment information
  shipmentCount?: number;
  uniqueRecipients?: string[];
  totalShipmentValue?: number;
  recentShipments?: Array<{
    id: number;
    trackingId: string;
    recipientName: string;
    destination: string;
    totalCost: number;
    shipmentDate: string;
    deliveryStatus: string;
    invoiceStatus: string;
  }>;
}

interface ViewCustomerDialogProps {
  customer: Customer | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ViewCustomerDialog({ customer, open, onOpenChange }: ViewCustomerDialogProps) {
  if (!customer) return null;

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

  const getStatusBadge = (status: string) => {
    // console.log(status);
    return status === "Active" ? (
      <Badge className="bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900 dark:text-green-200 dark:hover:bg-green-800">
        Active
      </Badge>
    ) : (
      <Badge className="bg-red-100 text-red-800 hover:bg-red-200 dark:bg-red-900 dark:text-red-200 dark:hover:bg-red-800">
        Inactive
      </Badge>
    );
  };

  const getDeliveryStatusBadge = (status: string) => {
    const statusColors = {
      'Delivered': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      'In Transit': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      'Pending': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      'Failed': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    };
    
    const colorClass = statusColors[status as keyof typeof statusColors] || 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    
    return (
      <Badge className={colorClass}>
        {status || 'Unknown'}
      </Badge>
    );
  };

  const getInvoiceStatusBadge = (status: string) => {
    const statusColors = {
      'Paid': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      'Pending': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      'Overdue': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      'Cancelled': 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
    };
    
    const colorClass = statusColors[status as keyof typeof statusColors] || 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    
    return (
      <Badge className={colorClass}>
        {status || 'Unknown'}
      </Badge>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="6xl" className="max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-center text-foreground">
            Customer Details
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Header Card */}
          <Card className="bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-950 dark:to-indigo-950 border-purple-200 dark:border-purple-800">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center">
                    <Building className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-foreground">{customer.CompanyName}</h3>
                    <p className="text-sm text-muted-foreground">Customer ID: #{customer.id}</p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  {getStatusBadge(customer.ActiveStatus)}
                  <Badge variant="secondary" className="text-sm">
                    Customer
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

                     {/* Contact Information */}
           <Card>
             <CardContent className="p-6">
               <h4 className="text-lg font-semibold mb-4 flex items-center gap-2">
                 <User className="w-5 h-5 text-purple-600" />
                 Contact Information
               </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <User className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Contact Person</p>
                      <p className="font-medium">{customer.PersonName || "Not specified"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Phone</p>
                      <p className="font-medium">{customer.Phone || "Not specified"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Email</p>
                      <p className="font-medium">{customer.Email || "Not specified"}</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Created On</p>
                      <p className="font-medium">{formatDate(customer.createdAt)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Shield className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Status</p>
                      <div className="mt-1">
                        {getStatusBadge(customer.ActiveStatus)}
                      </div>
                    </div>
                  </div>
                  {customer.currentBalance !== undefined && (
                    <div className="flex items-center gap-3">
                      <DollarSign className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Current Balance</p>
                        <p className={`font-medium ${customer.currentBalance > 0 ? 'text-red-600' : customer.currentBalance < 0 ? 'text-green-600' : 'text-gray-600'}`}>
                          ${customer.currentBalance.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

                     {/* Shipment Information */}
           <Card>
             <CardContent className="p-6">
               <h4 className="text-lg font-semibold mb-4 flex items-center gap-2">
                 <Truck className="w-5 h-5 text-blue-600" />
                 Shipment Information
               </h4>
              
                             {/* Shipment Summary */}
               <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                 <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                   <div className="flex items-center gap-3">
                     <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                       <Package className="w-5 h-5 text-blue-600" />
                     </div>
                     <div className="min-w-0 flex-1">
                       <p className="text-2xl font-bold text-blue-600 truncate">{customer.shipmentCount || 0}</p>
                       <p className="text-xs text-muted-foreground">Total Shipments</p>
                     </div>
                   </div>
                 </div>
                 
                 <div className="bg-green-50 dark:bg-green-950 p-4 rounded-lg border border-green-200 dark:border-green-800">
                   <div className="flex items-center gap-3">
                     <div className="w-10 h-10 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                       <Users className="w-5 h-5 text-green-600" />
                     </div>
                     <div className="min-w-0 flex-1">
                       <p className="text-2xl font-bold text-green-600 truncate">{customer.uniqueRecipients?.length || 0}</p>
                       <p className="text-xs text-muted-foreground">Unique Recipients</p>
                     </div>
                   </div>
                 </div>
                 
                 <div className="bg-purple-50 dark:bg-purple-950 p-4 rounded-lg border border-purple-200 dark:border-purple-800">
                   <div className="flex items-center gap-3">
                     <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center">
                       <DollarSign className="w-5 h-5 text-purple-600" />
                     </div>
                     <div className="min-w-0 flex-1">
                       <p className="text-2xl font-bold text-purple-600 truncate">
                         ${(customer.totalShipmentValue || 0).toLocaleString()}
                       </p>
                       <p className="text-xs text-muted-foreground">Total Value</p>
                     </div>
                   </div>
                 </div>
               </div>

                             {/* Recent Shipments */}
               {customer.recentShipments && customer.recentShipments.length > 0 && (
                 <div>
                   <h5 className="text-md font-semibold mb-3 flex items-center gap-2">
                     <Package className="w-4 h-4 text-blue-600" />
                     Recent Shipments
                   </h5>
                   <div className="space-y-3">
                     {customer.recentShipments.map((shipment) => (
                       <div key={shipment.id} className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg border">
                         <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                           <div className="flex-1 min-w-0">
                             <div className="flex items-center gap-2 mb-2">
                               <span className="font-semibold text-sm">#{shipment.trackingId}</span>
                               <span className="text-xs text-muted-foreground">•</span>
                               <span className="text-xs">{formatDate(shipment.shipmentDate)}</span>
                             </div>
                             <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                               <div>
                                 <span className="text-muted-foreground">To: </span>
                                 <span className="font-medium truncate block">{shipment.recipientName}</span>
                               </div>
                               <div>
                                 <span className="text-muted-foreground">Dest: </span>
                                 <span className="font-medium truncate block">{shipment.destination}</span>
                               </div>
                             </div>
                           </div>
                           <div className="flex flex-col items-end gap-2">
                             <div className="text-right">
                               <p className="font-semibold text-green-600 text-sm">${shipment.totalCost.toLocaleString()}</p>
                             </div>
                             <div className="flex gap-1">
                               {getDeliveryStatusBadge(shipment.deliveryStatus)}
                               {getInvoiceStatusBadge(shipment.invoiceStatus)}
                             </div>
                           </div>
                         </div>
                       </div>
                     ))}
                   </div>
                 </div>
               )}

                             {/* Recipients List */}
               {customer.uniqueRecipients && customer.uniqueRecipients.length > 0 && (
                 <div className="mt-6">
                   <h5 className="text-md font-semibold mb-3 flex items-center gap-2">
                     <Users className="w-4 h-4 text-green-600" />
                     Recipients ({customer.uniqueRecipients.length})
                   </h5>
                   <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg border">
                     <div className="flex flex-wrap gap-2">
                       {customer.uniqueRecipients.map((recipient, index) => (
                         <Badge key={index} variant="secondary" className="text-xs px-2 py-1">
                           {recipient}
                         </Badge>
                       ))}
                     </div>
                   </div>
                 </div>
               )}
            </CardContent>
          </Card>

                     {/* Document Information */}
           <Card>
             <CardContent className="p-6">
               <h4 className="text-lg font-semibold mb-4 flex items-center gap-2">
                 <FileText className="w-5 h-5 text-blue-600" />
                 Document Information
               </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <FileText className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Document Type</p>
                      <p className="font-medium">{customer.DocumentType || "Not specified"}</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <FileText className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Document Number</p>
                      <p className="font-medium">{customer.DocumentNumber || "Not specified"}</p>
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
                 <MapPin className="w-5 h-5 text-purple-600" />
                 Location Information
               </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Globe className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Country</p>
                      <p className="font-medium">{getCountryName(customer.Country)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <MapPin className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">State/Province</p>
                      <p className="font-medium">{customer.State || "Not specified"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <MapPin className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">City</p>
                      <p className="font-medium">{customer.City || "Not specified"}</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <MapPin className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Zip Code</p>
                      <p className="font-medium">{customer.Zip || "Not specified"}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <MapPin className="w-4 h-4 text-muted-foreground mt-1" />
                    <div>
                      <p className="text-sm text-muted-foreground">Address</p>
                      <p className="font-medium">{customer.Address || "Not specified"}</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Summary */}
          <Card className="bg-muted">
            <CardContent className="p-6">
              <h4 className="text-xl font-semibold mb-4 text-foreground">Summary</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                <div className="bg-card p-3 rounded-lg border">
                  <p className="text-2xl font-bold text-purple-600">{customer.id}</p>
                  <p className="text-xs text-muted-foreground">Customer ID</p>
                </div>
                <div className="bg-card p-3 rounded-lg border">
                  <p className="text-2xl font-bold text-green-600">
                    {customer.CompanyName ? "✓" : "✗"}
                  </p>
                  <p className="text-xs text-muted-foreground">Company</p>
                </div>
                <div className="bg-card p-3 rounded-lg border">
                  <p className="text-2xl font-bold text-blue-600">
                    {customer.shipmentCount || 0}
                  </p>
                  <p className="text-xs text-muted-foreground">Shipments</p>
                </div>
                <div className="bg-card p-3 rounded-lg border">
                  <p className="text-2xl font-bold text-orange-600">
                    {customer.ActiveStatus === "Active" ? "✓" : "✗"}
                  </p>
                  <p className="text-xs text-muted-foreground">Status</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
} 