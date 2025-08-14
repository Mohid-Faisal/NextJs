"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSearchParams } from "next/navigation";

type Option = { label: string; value: string };

export default function AddPaymentPage() {
  const searchParams = useSearchParams();
  const isEditMode = searchParams.get('mode') === 'edit';
  const paymentId = searchParams.get('id');
  const [transactionType, setTransactionType] = useState<"Expense" | "Transfer" | "Return">("Expense");
  const [category, setCategory] = useState("Operations Cost");
  
  // Update category when transaction type changes
  useEffect(() => {
    if (transactionType === "Transfer") {
      setCategory("Cash to Bank");
    } else if (transactionType === "Expense") {
      setCategory("Operations Cost");
    } else if (transactionType === "Return") {
      setCategory("Overpayment Return");
    }
  }, [transactionType]);
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [currency, setCurrency] = useState("PKR");
  const [amount, setAmount] = useState(0);
  const [fromAccount, setFromAccount] = useState("Us");
  const [toAccount, setToAccount] = useState("Us");
  const [mode, setMode] = useState("Cash");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [reference, setReference] = useState("");
  const [dueDate, setDueDate] = useState<string>("");
  const [description, setDescription] = useState("");
  
  // Transfer-specific fields
  const [fromMode, setFromMode] = useState("Cash");
  const [toMode, setToMode] = useState("Bank Transfer");

  const [customerOptions, setCustomerOptions] = useState<Option[]>([]);
  const [vendorOptions, setVendorOptions] = useState<Option[]>([]);

  useEffect(() => {
    const load = async () => {
      const [customersRes, vendorsRes] = await Promise.all([
        fetch(`/api/customers?limit=all`),
        fetch(`/api/vendors?limit=all`),
      ]);
      const customersJson = await customersRes.json();
      const vendorsJson = await vendorsRes.json();
      setCustomerOptions([
        { label: "Us", value: "Us" },
        ...customersJson.customers.map((c: any) => ({ label: c.CompanyName, value: String(c.id) })),
      ]);
      setVendorOptions([
        { label: "Us", value: "Us" },
        ...vendorsJson.vendors.map((v: any) => ({ label: v.CompanyName, value: String(v.id) })),
      ]);

             // If in edit mode, populate form with existing data
       if (isEditMode && paymentId) {
         const editTransactionType = searchParams.get('transactionType');
         setTransactionType((editTransactionType === "Income" || editTransactionType === "Expense" || editTransactionType === "Transfer" || editTransactionType === "Return") ? editTransactionType as "Expense" | "Transfer" | "Return" : "Expense");
         setCategory(searchParams.get('category') || "Operations Cost");
        setDate(searchParams.get('date')?.slice(0, 10) || new Date().toISOString().slice(0, 10));
        setCurrency(searchParams.get('currency') || "PKR");
        setAmount(parseFloat(searchParams.get('amount') || '0'));
        
        // Handle from/to accounts based on party types
        const fromPartyType = searchParams.get('fromPartyType');
        const fromCustomerId = searchParams.get('fromCustomerId');
        const toPartyType = searchParams.get('toPartyType');
        const toVendorId = searchParams.get('toVendorId');
        
        if (fromPartyType === 'US') {
          setFromAccount("Us");
        } else if (fromCustomerId) {
          setFromAccount(fromCustomerId);
        }
        
        if (toPartyType === 'US') {
          setToAccount("Us");
        } else if (toVendorId) {
          setToAccount(toVendorId);
        }
        
                 setMode(searchParams.get('paymentMode') || "Cash");
         setReference(searchParams.get('reference') || "");
         setDueDate(searchParams.get('dueDate')?.slice(0, 10) || "");
         setDescription(searchParams.get('description') || "");
         
         // Handle customer selection for Return transactions
         if (editTransactionType === "Return") {
           const toCustomerId = searchParams.get('toCustomerId');
           if (toCustomerId) {
             setSelectedCustomerId(toCustomerId);
           }
         }
      }
    };
    load();
  }, [isEditMode, paymentId, searchParams]);

  const handleSave = async () => {
    // Validate customer selection for Return transactions
    if (transactionType === "Return" && (!selectedCustomerId || selectedCustomerId === "Us")) {
      const { toast } = await import("sonner");
      toast.error("Please select a customer for the return transaction.");
      return;
    }

    const payload: any = {
      transactionType,
      category,
      date: new Date(date).toISOString(),
      currency,
      amount: Number(amount),
      reference: reference || undefined,
      dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
      description: description || undefined,
    };

    // Handle mode and parties based on transaction type
    if (transactionType === "Transfer") {
      payload.mode = fromMode; // Use fromMode for transfers
      payload.fromPartyType = 'US';
      payload.toPartyType = 'US';
      payload.fromCustomerId = undefined;
      payload.toVendorId = undefined;
      // Update description to include transfer details
      payload.description = `${payload.description || ''} (Transfer from ${fromMode} to ${toMode})`.trim();
    } else if (transactionType === "Return") {
      // For returns, money goes from company to customer
      payload.mode = mode;
      payload.fromPartyType = 'US';
      payload.toPartyType = 'CUSTOMER';
      payload.fromCustomerId = undefined;
      payload.toVendorId = undefined;
      if (selectedCustomerId && selectedCustomerId !== "Us") {
        payload.toCustomerId = selectedCustomerId;
        // Update description to include customer name
        const selectedCustomer = customerOptions.find(c => c.value === selectedCustomerId);
        if (selectedCustomer) {
          payload.description = `${payload.description || ''} (Return to ${selectedCustomer.label})`.trim();
        }
      }
    } else {
      // For expenses, all transactions are from/to the company
      payload.mode = mode;
      payload.fromPartyType = 'US';
      payload.toPartyType = 'US';
      payload.fromCustomerId = undefined;
      payload.toVendorId = undefined;
    }

    const url = isEditMode && paymentId 
      ? `/api/accounts/payments/${paymentId}`
      : `/api/accounts/payments`;
    
    const method = isEditMode ? "PUT" : "POST";
    
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    
    try {
      const json = await res.json();
      if (!res.ok || json?.success === false) {
        const { toast } = await import("sonner");
        toast.error(json?.message || `Failed to ${isEditMode ? 'update' : 'add'} payment.`);
        return;
      }
      const { toast } = await import("sonner");
      toast.success(`Payment ${isEditMode ? 'updated' : 'added'} successfully.`);
      window.location.href = "/dashboard/accounts/payments";
    } catch (e: any) {
      const { toast } = await import("sonner");
      toast.error(e?.message || "Unexpected error.");
    }
  };

     return (
     <div className="p-8 max-w-4xl mx-auto bg-white dark:bg-zinc-900">
       <h2 className="text-2xl font-semibold mb-8 text-gray-800 dark:text-gray-200">{isEditMode ? 'Edit Payment' : 'Add Payment'}</h2>
       <Card className="border border-gray-200 dark:border-gray-700 shadow-sm">
         <CardContent className="p-8">
           <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                         <div className="md:col-span-3 text-sm font-medium text-gray-700 dark:text-gray-300">Transaction Type</div>
             <div className="md:col-span-9 flex gap-8">
               {(["Expense", "Transfer", "Return"] as const).map((t) => (
                 <label key={t} className="flex items-center gap-3 cursor-pointer">
                   <input
                     type="radio"
                     name="transactionType"
                     value={t}
                     checked={transactionType === t}
                     onChange={() => setTransactionType(t)}
                     className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                   />
                   <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t}</span>
                 </label>
               ))}
             </div>

                         <div className="md:col-span-3 text-sm font-medium text-gray-700 dark:text-gray-300">Category</div>
            <div className="md:col-span-9">
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                                     {transactionType === "Transfer" ? (
                     <>
                       <SelectItem value="Cash to Bank">Cash to Bank</SelectItem>
                       <SelectItem value="Bank to Cash">Bank to Cash</SelectItem>
                     </>
                   ) : transactionType === "Return" ? (
                     <>
                       <SelectItem value="Overpayment Return">Overpayment Return</SelectItem>
                       <SelectItem value="Customer Refund">Customer Refund</SelectItem>
                       <SelectItem value="Vendor Refund">Vendor Refund</SelectItem>
                       <SelectItem value="Error Correction">Error Correction</SelectItem>
                     </>
                   ) : (
                     <>
                       <SelectItem value="Operations Cost">Operations Cost</SelectItem>
                       <SelectItem value="Expenditure (Fixed)">Expenditure (Fixed)</SelectItem>
                       <SelectItem value="Expenditure (Variable)">Expenditure (Variable)</SelectItem>
                       <SelectItem value="Payable Statement">Payable Statement</SelectItem>
                       <SelectItem value="Returnable">Returnable</SelectItem>
                     </>
                   )}
                </SelectContent>
              </Select>
            </div>

                         <div className="md:col-span-3 text-sm font-medium text-gray-700 dark:text-gray-300">Date</div>
            <div className="md:col-span-9">
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>

                         <div className="md:col-span-3 text-sm font-medium text-gray-700 dark:text-gray-300">Value</div>
            <div className="md:col-span-2">
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {['PKR','USD','EUR','GBP'].map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-7">
              <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(parseFloat(e.target.value || '0'))} />
            </div>

            {/* From/To on one line aligned with other fields */}
            {transactionType === "Transfer" ? (
              <>
                <div className="md:col-span-3 text-sm font-medium text-gray-700 dark:text-gray-300">From Account</div>
                <div className="md:col-span-3">
                  <Select value={fromMode} onValueChange={setFromMode}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {['Cash','Bank'].map(m => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-3 text-sm font-medium text-gray-700 dark:text-gray-300">To Account</div>
                <div className="md:col-span-3">
                  <Select value={toMode} onValueChange={setToMode}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {['Cash','Bank'].map(m => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            ) : transactionType === "Return" ? (
              <>
                <div className="md:col-span-3 text-sm font-medium text-gray-700 dark:text-gray-300">Mode</div>
                <div className="md:col-span-3">
                  <Select value={mode} onValueChange={setMode}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {['Cash','Bank Transfer','Card','Cheque'].map(m => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-3 text-sm font-medium text-gray-700 dark:text-gray-300">Return To Customer</div>
                <div className="md:col-span-3">
                  <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select customer" />
                    </SelectTrigger>
                    <SelectContent>
                      {customerOptions.map(customer => (
                        <SelectItem key={customer.value} value={customer.value}>
                          {customer.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            ) : (
              <>
                <div className="md:col-span-3 text-sm font-medium text-gray-700 dark:text-gray-300">Mode</div>
                <div className="md:col-span-3">
                  <Select value={mode} onValueChange={setMode}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {['Cash','Bank Transfer','Card','Cheque'].map(m => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
                          <div className="md:col-span-3 text-sm font-medium text-gray-700 dark:text-gray-300">Reference</div>
             <div className="md:col-span-3">
               <Input placeholder="Reference #" value={reference} onChange={(e) => setReference(e.target.value)} />
             </div>
             {transactionType !== "Transfer" && (
               <>
                 <div className="md:col-span-3 text-sm font-medium text-gray-700 dark:text-gray-300">Due Date</div>
                 <div className="md:col-span-3">
                   <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                 </div>
               </>
             )}
           </div>

           <div className="mt-6">
             <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Description</div>
             <Input
               placeholder="Enter description details..."
               value={description}
               onChange={(e) => setDescription(e.target.value)}
             />
           </div>
         <div className="mt-8 flex justify-end">
           <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-2 rounded-lg font-medium transition-colors">
             {isEditMode ? 'Update Payment' : 'Save Payment'}
           </Button>
         </div>
       </CardContent>
     </Card>
   </div>
 );
}


