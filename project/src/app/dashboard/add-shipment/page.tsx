"use client";

import { useEffect, useMemo, useState } from "react";
import AddCustomerDialog from "@/components/AddCustomerDialog";
import AddRecipientDialog from "@/components/AddRecipientDialog";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FaBoxOpen,
  FaInfoCircle,
  FaTruck,
  FaFileInvoice,
} from "react-icons/fa";
import { Checkbox } from "@/components/ui/checkbox";
import countries from "../../../../data/countries.json";

// Add type for sender/recipient
interface Party {
  id: number;
  Company: string;
  Address: string;
}

const AddShipmentPage = () => {
  const router = useRouter();

  const [senderQuery, setSenderQuery] = useState("");
  const [recipientQuery, setRecipientQuery] = useState("");
  const [senderResults, setSenderResults] = useState<Party[]>([]);
  const [recipientResults, setRecipientResults] = useState<Party[]>([]);
  const [selectedSender, setSelectedSender] = useState<Party | null>(null);
  const [selectedRecipient, setSelectedRecipient] = useState<Party | null>(
    null
  );

  useEffect(() => {
    const fetchData = async () => {
      const endpoints = [
        { fn: setDeliveryTimes, url: "/api/settings/deliveryTime" },
        { fn: setPaymentMethods, url: "/api/settings/paymentMethod" },
        { fn: setDeliveryStatuses, url: "/api/settings/deliveryStatus" },
        { fn: setShippingModes, url: "/api/settings/shippingMode" },
        { fn: setPackagingTypes, url: "/api/settings/packagingType" },
        { fn: setCourierCompanies, url: "/api/settings/courierCompany" },
        { fn: setServiceModes, url: "/api/settings/serviceMode" },
      ];

      for (const { fn, url } of endpoints) {
        const res = await fetch(url);
        const data = await res.json();
        fn(data);
      }
    };

    fetchData();
  }, []);

  // Fetch senders
  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      if (senderQuery.length > 0) {
        fetch(`/api/search/customers?query=${senderQuery}`)
          .then((res) => res.json())
          .then((data) =>
            setSenderResults(
              data.map((item: Party) => ({
                id: item.id,
                Company: item.Company, // map from 'Company'
                Address: item.Address, // map from 'Address'
              }))
            )
          );
        // console.log(senderResults)
      } else {
        setSenderResults([]);
      }
    }, 300); // Debounce

    return () => clearTimeout(delayDebounce);
  }, [senderQuery]);

  // Fetch recipients
  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      if (recipientQuery.length > 0) {
        fetch(`/api/search/recipients?query=${recipientQuery}`)
          .then((res) => res.json())
          .then((data) =>
            setRecipientResults(
              data.map((item: Party) => ({
                id: item.id,
                Company: item.Company, // map from 'Company'
                Address: item.Address, // map from 'Address'
              }))
            )
          );
        // console.log(recipientResults)
      } else {
        setRecipientResults([]);
      }
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [recipientQuery]);

  // Types
  type Option = { id: string; name: string };

  const [deliveryTimes, setDeliveryTimes] = useState<Option[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<Option[]>([]);
  const [deliveryStatuses, setDeliveryStatuses] = useState<Option[]>([]);
  const [shippingModes, setShippingModes] = useState<Option[]>([]);
  const [packagingTypes, setPackagingTypes] = useState<Option[]>([]);
  const [courierCompanies, setCourierCompanies] = useState<Option[]>([]);
  const [serviceModes, setServiceModes] = useState<Option[]>([]);

  const [form, setForm] = useState({
    shippingPrefix: "AWB",
    awbNumber: "",
    agency: "Deprixa Miami",
    office: "Deprixa Group",
    senderName: "",
    senderAddress: "",
    recipientName: "",
    recipientAddress: "",
    deliveryTime: "24 - 48 Hours",
    paymentMethod: "Postpaid 15 day",
    deliveryStatus: "In_Warehouse",
    shippingMode: "Ocean Freight",
    packaging: "Small",
    courier: "Deprixa Express",
    serviceMode: "After 2 Days",
    driver: "",
    amount: 1,
    packageDescription: "",
    weight: 0,
    length: 0,
    width: 0,
    height: 0,
    weightVol: 0,
    fixedCharge: 0,
    decValue: 0,
    price: 3.55,
    discount: 0,
    valueAssured: 100,
    insurance: 2,
    customs: 0.1,
    tax: 19,
    declaredValue: 3,
    reissue: 0,
    manualRate: false,
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSelect = (name: string, value: string) => {
    setForm({ ...form, [name]: value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log(form);

    const res = await fetch("/api/add-shipment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    const data = await res.json();
    if (data.success) {
      toast.success("Shipment added successfully!");
      setForm({
        shippingPrefix: "AWB",
        awbNumber: "",
        agency: "Deprixa Miami",
        office: "Deprixa Group",
        senderName: "",
        senderAddress: "",
        recipientName: "",
        recipientAddress: "",
        deliveryTime: "24 - 48 Hours",
        paymentMethod: "Postpaid 15 day",
        deliveryStatus: "In_Warehouse",
        shippingMode: "Ocean Freight",
        packaging: "Small",
        courier: "Deprixa Express",
        serviceMode: "After 2 Days",
        driver: "",
        amount: 1,
        packageDescription: "",
        weight: 0,
        length: 0,
        width: 0,
        height: 0,
        weightVol: 0,
        fixedCharge: 0,
        decValue: 0,
        price: 3.55,
        discount: 0,
        valueAssured: 100,
        insurance: 2,
        customs: 0.1,
        tax: 19,
        declaredValue: 3,
        reissue: 0,
        manualRate: false,
      });
    } else {
      toast.error(data.message || "Failed to add shipment.");
    }
  };

  const renderSelect = (
    label: string,
    placeholder: string,
    options: Option[]
  ) => (
    <div>
      <Label className="mb-1 block">{label}</Label>
      <Select>
        <SelectTrigger className="w-full">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.id} value={option.name}>
              {option.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  // Example country list
  const countryList = countries.map((country) => ({
    code: country.code,
    name: country.name,
  }));

  const selectItems = useMemo(
    () =>
      countryList.map((country) => (
        <SelectItem key={country.code} value={country.code}>
          {country.name} ({country.code})
        </SelectItem>
      )),
    [countryList]
  );

  const [isChecked, setIsChecked] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-7xl mx-auto px-2 py-6 text-gray-900"
    >
      <form onSubmit={handleSubmit}>
        {/* Record shipment header */}
        <div className="flex items-center gap-2 mb-2">
          <FaBoxOpen className="text-xl text-primary" />
          <h1 className="text-2xl font-semibold">Add shipment</h1>
        </div>

        {/* Shipment Info Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          {/* Left Section: Shipping Prefix + AWB */}
          <Card className="bg-white border border-gray-100 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-end gap-6">
                {/* Shipping Prefix + Checkbox */}
                <div className="flex flex-col gap-2">
                  <Label className="text-sm font-medium mb-1">
                    Shipping Prefix
                  </Label>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="countryCode"
                      checked={isChecked}
                      onCheckedChange={(checked) => setIsChecked(!!checked)}
                    />
                    <Label
                      htmlFor="countryCode"
                      className="text-sm text-gray-600"
                    >
                      Country code
                    </Label>

                    {!isChecked ? (
                      <Input
                        className="w-24 bg-gray-100 text-center border-none"
                        readOnly
                        value="AWB"
                      />
                    ) : (
                      <Select
                        onValueChange={(value) =>
                          handleSelect("shippingPrefix", value)
                        }
                        value={form.shippingPrefix}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue placeholder="Select Country" />
                        </SelectTrigger>
                        <SelectContent>{selectItems}</SelectContent>
                      </Select>
                    )}
                  </div>
                </div>

                {/* Tracking ID */}
                <div className="flex flex-col gap-2">
                  <Label className="text-sm font-medium mb-1">
                    Tracking ID
                  </Label>
                  <Input
                    id="awbNumber"
                    name="awbNumber"
                    value={form.awbNumber}
                    onChange={handleChange}
                    required
                    className="bg-gray-50"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Right Section: List of Agencies + Office of origin */}
          <Card className="bg-white border border-gray-100 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-end gap-6">
                {/* List of Agencies */}
                <div className="flex flex-col gap-2 w-full">
                  <Label className="text-sm font-medium mb-1">
                    List of Agencies
                  </Label>
                  <Select
                    defaultValue={form.agency}
                    onValueChange={(value) => handleSelect("agency", value)}
                    value={form.agency}
                  >
                    <SelectTrigger className="bg-gray-50 w-full">
                      <SelectValue placeholder="Select agency" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PSS">PSS</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Office of Origin */}
                <div className="flex flex-col gap-2 w-full">
                  <Label className="text-sm font-medium mb-1">
                    Office of origin
                  </Label>
                  <Select
                    defaultValue={form.office}
                    onValueChange={(value) => handleSelect("office", value)}
                    value={form.office}
                  >
                    <SelectTrigger className="bg-gray-50 w-full">
                      <SelectValue placeholder="Select office" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Lahore PK">Lahore PK</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sender/Recipient Info Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          {/* Sender Card */}
          <Card className="bg-white border border-gray-100 shadow-sm">
            <CardContent className="p-6">
              {/* Header */}
              <div className="flex items-center gap-2 mb-4">
                <FaInfoCircle className="text-primary" />
                <span className="font-medium">Sender Information</span>
              </div>

              <div className="space-y-6">
                {/* Sender Name with Add Button */}
                <div className="flex flex-col text-black">
                  <Label className="mb-1">Sender/Customer</Label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <Select
                        onValueChange={(val) => {
                          const selected = senderResults.find(
                            (s) => s.id === Number(val)
                          );
                          setSelectedSender(selected ?? null);
                          setSenderQuery(selected?.Company ?? "");
                        }}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Search sender name..." />
                        </SelectTrigger>
                        <SelectContent>
                          <div className="px-2 py-1">
                            <Input
                              className="w-full text-sm"
                              placeholder="Type to search"
                              value={senderQuery}
                              onChange={(e) => setSenderQuery(e.target.value)}
                            />
                          </div>
                          {senderResults.length > 0 ? (
                            senderResults.map((s) => (
                              <SelectItem key={s.id} value={String(s.id)}>
                                {s.Company}
                              </SelectItem>
                            ))
                          ) : (
                            <div className="px-4 py-2 text-gray-500 text-sm">
                              {senderQuery.length >= 2
                                ? "No matches found."
                                : "Type at least 2 characters"}
                            </div>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    <AddCustomerDialog triggerLabel="+" />
                  </div>
                </div>

                {/* Sender Address */}
                <div className="flex flex-col text-black">
                  <Label className="mb-1">Sender/Customer Address</Label>
                  <div className="flex gap-2">
                    <Input
                      value={selectedSender?.Address ?? ""}
                      readOnly
                      placeholder="Sender address"
                      className="flex-1 bg-gray-100"
                    />
                    <AddCustomerDialog triggerLabel="+" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recipient Card */}
          <Card className="bg-white border border-gray-100 shadow-sm">
            <CardContent className="p-6">
              {/* Header */}
              <div className="flex items-center gap-2 mb-4">
                <FaInfoCircle className="text-primary" />
                <span className="font-medium">Recipient Information</span>
              </div>

              <div className="space-y-6">
                {/* Recipient Name with Add Button */}
                <div className="flex flex-col text-black">
                  <Label className="mb-1">Recipient/Client</Label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <Select
                        onValueChange={(val) => {
                          const selected = recipientResults.find(
                            (r) => r.id === Number(val)
                          );
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
                              <SelectItem key={r.id} value={String(r.id)}>
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
        </div>

        {/* Shipping Information Section */}
        <Card className="bg-white border border-gray-100 shadow-sm mb-4">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-4">
              <FaTruck className="text-primary" />
              <span className="font-medium">Shipping information:</span>
            </div>

            {/* First Row */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
              {renderSelect(
                "Delivery Time",
                "Select delivery time",
                deliveryTimes
              )}
              {renderSelect(
                "Payment Methods",
                "Select payment method",
                paymentMethods
              )}
              {renderSelect(
                "Delivery Status",
                "Select delivery status",
                deliveryStatuses
              )}
              {renderSelect(
                "Shipping Mode",
                "Select shipping mode",
                shippingModes
              )}
            </div>

            {/* Second Row */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {renderSelect(
                "Type of Packaging",
                "Select packaging type",
                packagingTypes
              )}
              {renderSelect(
                "Courier Company",
                "Select courier company",
                courierCompanies
              )}
              {renderSelect(
                "Service Mode",
                "Select service mode",
                serviceModes
              )}
            </div>
          </CardContent>
        </Card>

        {/* Package Information Section */}
        <Card className="bg-white border border-gray-100 shadow-sm mb-4">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-4">
              <FaBoxOpen className="text-primary" />
              <span className="font-medium">Package Information</span>
              <span className="ml-auto flex items-center gap-2">
                <Label className="mr-2">Manual rate</Label>
                <Input type="checkbox" className="w-4 h-4" />
                <Button type="button" className="bg-blue-500 ml-4">
                  [s] Add shipping fee
                </Button>
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm border border-gray-200">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-2 py-1 border">Amount</th>
                    <th className="px-2 py-1 border">Package Description</th>
                    <th className="px-2 py-1 border">Weight</th>
                    <th className="px-2 py-1 border">Length</th>
                    <th className="px-2 py-1 border">Width</th>
                    <th className="px-2 py-1 border">Height</th>
                    <th className="px-2 py-1 border">Weight Vol.</th>
                    <th className="px-2 py-1 border">Fixed charge</th>
                    <th className="px-2 py-1 border">DecValue</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border px-2 py-1">
                      <Input value={form.amount} className="w-12" readOnly />
                    </td>
                    <td className="border px-2 py-1">
                      <Input
                        value={form.packageDescription}
                        placeholder="Package Description"
                        className="w-40"
                        onChange={handleChange}
                      />
                    </td>
                    <td className="border px-2 py-1">
                      <Input
                        value={form.weight}
                        className="w-16"
                        onChange={handleChange}
                      />
                    </td>
                    <td className="border px-2 py-1">
                      <Input
                        value={form.length}
                        className="w-16"
                        onChange={handleChange}
                      />
                    </td>
                    <td className="border px-2 py-1">
                      <Input
                        value={form.width}
                        className="w-16"
                        onChange={handleChange}
                      />
                    </td>
                    <td className="border px-2 py-1">
                      <Input
                        value={form.height}
                        className="w-16"
                        onChange={handleChange}
                      />
                    </td>
                    <td className="border px-2 py-1">
                      <Input
                        value={form.weightVol}
                        className="w-16"
                        onChange={handleChange}
                      />
                    </td>
                    <td className="border px-2 py-1">
                      <Input
                        value={form.fixedCharge}
                        className="w-16"
                        onChange={handleChange}
                      />
                    </td>
                    <td className="border px-2 py-1">
                      <Input
                        value={form.decValue}
                        className="w-16"
                        onChange={handleChange}
                      />
                    </td>
                  </tr>
                </tbody>
              </table>
              <div className="flex items-center gap-2 mt-2">
                <span className="font-medium">TOTALS</span>
                <span className="ml-auto">0.00</span>
              </div>
              <Button type="button" variant="outline" className="mt-2">
                + Add Box or Packages
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Rate & Taxes Information Section */}
        <Card className="bg-white border border-gray-100 shadow-sm mb-4">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-4">
              <FaFileInvoice className="text-primary" />
              <span className="font-medium">Rate & Taxes information</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <Label>Price kg</Label>
                <Input
                  value={form.price}
                  className="w-full"
                  onChange={handleChange}
                />
              </div>
              <div>
                <Label>Discount %</Label>
                <Input
                  value={form.discount}
                  className="w-full"
                  onChange={handleChange}
                />
              </div>
              <div>
                <Label>Value assured</Label>
                <Input
                  value={form.valueAssured}
                  className="w-full"
                  onChange={handleChange}
                />
              </div>
              <div>
                <Label>Shipping Insurance %</Label>
                <Input
                  value={form.insurance}
                  className="w-full"
                  onChange={handleChange}
                />
              </div>
              <div>
                <Label>Customs Duties %</Label>
                <Input
                  value={form.customs}
                  className="w-full"
                  onChange={handleChange}
                />
              </div>
              <div>
                <Label>Tax %</Label>
                <Input
                  value={form.tax}
                  className="w-full"
                  onChange={handleChange}
                />
              </div>
              <div>
                <Label>Declared value %</Label>
                <Input
                  value={form.declaredValue}
                  className="w-full"
                  onChange={handleChange}
                />
              </div>
              <div>
                <Label>Reissue</Label>
                <Input
                  value={form.reissue}
                  className="w-full"
                  onChange={handleChange}
                />
              </div>
              <div>
                <Label>Fixed charge</Label>
                <Input
                  value={form.fixedCharge}
                  className="w-full"
                  onChange={handleChange}
                />
              </div>
              <div className="col-span-2 flex flex-col justify-end">
                <div className="flex items-center gap-4 mt-4">
                  <span className="font-medium">Subtotal</span>
                  <span className="text-green-600">$ 0.00</span>
                  <span className="font-medium ml-8">TOTAL</span>
                  <span className="text-green-600">$ 0.00</span>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-4 mt-6">
              <Button type="button" className="bg-blue-500">
                Price list calculation
              </Button>
              <Button type="submit" className="bg-green-500">
                Saveeeee
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </motion.div>
  );
};

export default AddShipmentPage;
