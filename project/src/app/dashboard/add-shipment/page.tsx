"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import AddCustomerDialog from "@/components/AddCustomerDialog";
import AddRecipientDialog from "@/components/AddRecipientDialog";
import UpdateCustomerAddressDialog from "@/components/UpdateCustomerAddressDialog";
import UpdateRecipientAddressDialog from "@/components/UpdateRecipientAddressDialog";
import { useRouter, useSearchParams } from "next/navigation";
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
  FaTrash,
} from "react-icons/fa";
import { Switch } from "@/components/ui/switch";
import { Country, State } from "country-state-city";

// Add type for sender/recipient
interface Party {
  id: number;
  Company: string;
  Address: string;
  Country: string;
  State: string;
  City: string;
  Zip: string;
}

// Add type for package/box
interface Package {
  id: string;
  amount: number;
  packageDescription: string;
  weight: number;
  length: number;
  width: number;
  height: number;
  weightVol: number;
  fixedCharge: number;
  decValue: number;
}

const AddShipmentPage = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("id");

  const [senderQuery, setSenderQuery] = useState("");
  const [recipientQuery, setRecipientQuery] = useState("");
  const [senderResults, setSenderResults] = useState<Party[]>([]);
  const [recipientResults, setRecipientResults] = useState<Party[]>([]);
  const [selectedSender, setSelectedSender] = useState<Party | null>(null);
  const [selectedRecipient, setSelectedRecipient] = useState<Party | null>(
    null
  );

  // Refs for search inputs
  const senderSearchRef = useRef<HTMLInputElement>(null);
  const recipientSearchRef = useRef<HTMLInputElement>(null);

  // State to track dropdown open status
  const [senderDropdownOpen, setSenderDropdownOpen] = useState(false);
  const [recipientDropdownOpen, setRecipientDropdownOpen] = useState(false);

  // State for packages/boxes
  const [packages, setPackages] = useState<Package[]>([
    {
      id: "1",
      amount: 1,
      packageDescription: "",
      weight: 0,
      length: 0,
      width: 0,
      height: 0,
      weightVol: 0,
      fixedCharge: 0,
      decValue: 0,
    },
  ]);

  // Focus search input when sender dropdown opens
  useEffect(() => {
    if (senderDropdownOpen && senderSearchRef.current) {
      setTimeout(() => {
        senderSearchRef.current?.focus();
      }, 100);
    }
  }, [senderDropdownOpen]);

  // Fetch agencies and offices
  useEffect(() => {
    const fetchAgenciesAndOffices = async () => {
      try {
        const [agenciesRes, officesRes] = await Promise.all([
          fetch("/api/agencies"),
          fetch("/api/offices"),
        ]);

        if (agenciesRes.ok) {
          const agenciesData = await agenciesRes.json();
          setAgencies(
            agenciesData.map((agency: any) => ({
              id: agency.id,
              name: agency.name,
              code: agency.code,
            }))
          );
        }

        if (officesRes.ok) {
          const officesData = await officesRes.json();
          setOffices(
            officesData.map((office: any) => ({
              id: office.id,
              name: office.name,
              code: office.code,
            }))
          );
        }
      } catch (error) {
        console.error("Failed to fetch agencies and offices:", error);
      }
    };

    fetchAgenciesAndOffices();
  }, []);

  // Focus search input when recipient dropdown opens
  useEffect(() => {
    if (recipientDropdownOpen && recipientSearchRef.current) {
      setTimeout(() => {
        recipientSearchRef.current?.focus();
      }, 100);
    }
  }, [recipientDropdownOpen]);

  // Calculate totals
  const totals = useMemo(() => {
    return packages.reduce(
      (acc, pkg) => {
        // For total weight, pick the higher value between weight and weightVol for each package
        const packageWeight = Math.max(pkg.weight, pkg.weightVol);

        return {
          amount: acc.amount + pkg.amount,
          weight: acc.weight + packageWeight, // Use the higher value for total weight
          weightVol: acc.weightVol + pkg.weightVol,
          fixedCharge: acc.fixedCharge + pkg.fixedCharge,
          decValue: acc.decValue + pkg.decValue,
        };
      },
      {
        amount: 0,
        weight: 0,
        weightVol: 0,
        fixedCharge: 0,
        decValue: 0,
      }
    );
  }, [packages]);

  // Add new package/box
  const addPackage = () => {
    const newPackage: Package = {
      id: Date.now().toString(),
      amount: 1,
      packageDescription: "",
      weight: 0,
      length: 0,
      width: 0,
      height: 0,
      weightVol: 0,
      fixedCharge: 0,
      decValue: 0,
    };
    setPackages([...packages, newPackage]);
  };

  // Remove package/box
  const removePackage = (id: string) => {
    if (packages.length > 1) {
      setPackages(packages.filter((pkg) => pkg.id !== id));
    }
  };

  // Update package
  const updatePackage = (id: string, field: keyof Package, value: any) => {
    setPackages(
      packages.map((pkg) => {
        if (pkg.id === id) {
          const updatedPackage = { ...pkg, [field]: value };

          // Auto-calculate weight volume when length, width, or height changes
          if (field === "length" || field === "width" || field === "height") {
            const { length, width, height } = updatedPackage;
            if (length > 0 && width > 0 && height > 0) {
              // Calculate weight volume: (length * width * height) / 5000, then round up to nearest 0.5
              const rawWeightVol = (length * width * height) / 5000;
              const calculatedWeightVol = Math.ceil(rawWeightVol * 2) / 2;
              updatedPackage.weightVol = calculatedWeightVol;
            }
          }

          return updatedPackage;
        }
        return pkg;
      })
    );
  };

  // Calculate rate when manual rate is off
  const calculateRate = async () => {
    if (!form.manualRate) {
      try {
        // Get recipient country from selected recipient
        if (!selectedRecipient || !selectedRecipient.Country) {
          toast.error("Please select a recipient with a valid country");
          return;
        }

        const recipientCountry = selectedRecipient.Country;
        let recipientCountryName: string;

        // Use the country code directly as the country name
        recipientCountryName = recipientCountry;
        console.log(`Using country code '${recipientCountry}' as country name`);

        // Validate required form fields
        if (!form.vendor || !form.serviceMode) {
          toast.error("Please select both vendor and service mode");
          return;
        }

        if (totals.weight <= 0) {
          toast.error("Please add package weight information");
          return;
        }

        // Prepare the request payload with all required data including fuel surcharge, discount, and profit percentage
        const requestPayload = {
          weight: totals.weight, // Total weight from packages
          vendor: form.vendor, // Selected vendor
          serviceMode: form.serviceMode, // Selected service mode
          destination: recipientCountryName, // Recipient country name as destination
          fuelSurcharge: parseFloat(form.fuelSurcharge) || 0, // Fuel surcharge from form
          discount: parseFloat(form.discount) || 0, // Discount from form
          profitPercentage: parseFloat(form.profitPercentage) || 0, // Profit percentage from form
          packaging: form.packaging, // Packaging type (used as docType)
        };

        console.log("Rate calculation request payload:", requestPayload);
        console.log("Additional context:", {
          totalWeight: totals.weight,
          selectedVendor: form.vendor,
          selectedServiceMode: form.serviceMode,
          recipientCountryCode: recipientCountry,
          recipientCountryName: recipientCountryName,
          recipientCompany: selectedRecipient?.Company,
          recipientAddress: selectedRecipient?.Address,
          fuelSurcharge: form.fuelSurcharge,
          discount: form.discount,
        });

        const response = await fetch("/api/rates/calc", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestPayload),
        });

        if (response.ok) {
          const data = await response.json();
          console.log("Rate calculation API response:", data);

          if (data.success && data.price) {
            // Calculate profit-adjusted price
            const basePrice = data.originalCost;
            const finalPrice = data.totalCost;
            const profitPercentage = data.profitPercentage;
            const fixedCharge = data.fixedCharge || 0;
            const vendorPrice = data.vendorPrice || 0;

            // Calculate ceiling values (rounded up)
            const ceilingBasePrice = Math.ceil(basePrice);
            const ceilingFinalPrice = Math.ceil(finalPrice);
            const ceilingProfitAmount = ceilingFinalPrice - ceilingBasePrice;

            // Update the form with the ceiling final price, fixed charge, and vendor price
            setForm((prev) => ({
              ...prev,
              price: ceilingFinalPrice.toString(),
              fixedCharge: fixedCharge.toString(),
              vendorPrice: vendorPrice.toString(),
            }));

            // Store the backend-calculated values with ceiling profit applied
            setCalculatedValues({
              subtotal: ceilingFinalPrice,
              total: data.totalCost
                ? Math.ceil(data.totalCost)
                : ceilingFinalPrice,
              vendorPrice: vendorPrice,
            });

            const profitMessage =
              profitPercentage > 0
                ? ` (includes ${profitPercentage}% profit: +$${ceilingProfitAmount.toFixed(
                    2
                  )})`
                : "";
            const fixedChargeMessage = fixedCharge > 0 ? `, Fixed Charge: $${fixedCharge.toFixed(2)}` : "";
            const vendorPriceMessage = vendorPrice > 0 ? `, Vendor Price: $${vendorPrice.toFixed(2)}` : "";
            toast.success(
              `Rate calculated successfully! Original: $${ceilingBasePrice.toFixed(
                2
              )}, Final: $${ceilingFinalPrice.toFixed(2)}${profitMessage}${fixedChargeMessage}${vendorPriceMessage}`
            );
          } else {
            toast.error(data.error || "Failed to calculate rate");
          }
        } else {
          const errorData = await response.json();
          console.error("Rate calculation API error:", errorData);
          toast.error(errorData.error || "Failed to calculate rate");
        }
      } catch (error) {
        console.error("Error calculating rate:", error);
        toast.error("Error calculating rate");
      }
    } else {
      toast.info("Manual rate is enabled. Please enter the price manually.");
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      const endpoints = [
        { fn: setDeliveryStatuses, url: "/api/settings/deliveryStatus" },
        { fn: setShippingModes, url: "/api/settings/shippingMode" },
        { fn: setPackagingTypes, url: "/api/settings/packagingType" },
        { fn: setVendors, url: "/api/vendors?limit=all" },
      ];

      for (const { fn, url } of endpoints) {
        try {
          const res = await fetch(url);
          const data = await res.json();

          // Handle vendors API response differently
          if (url.includes("/api/vendors")) {
            if (!data.vendors || !Array.isArray(data.vendors)) {
              toast.error("Invalid vendors data received from server");
              return;
            }
            const vendorOptions = data.vendors.map((vendor: any) => ({
              id: vendor.id.toString(),
              name: vendor.CompanyName,
            }));
            fn(vendorOptions);
          } else {
            // Validate data is an array
            if (!Array.isArray(data)) {
              toast.error(
                `Invalid data format received from ${url.split("/").pop()}`
              );
              return;
            }
            fn(data);
          }
        } catch (error) {
          console.error(`Error fetching data from ${url}:`, error);
          toast.error(
            `Failed to load ${url.split("/").pop()} data. Please try again.`
          );
        }
      }

      // Fetch vendor services separately
      try {
        const vendorServiceRes = await fetch("/api/settings/vendorService");
        const vendorServiceData = await vendorServiceRes.json();

        if (vendorServiceData && Array.isArray(vendorServiceData)) {
          setAllVendorServices(vendorServiceData);

          // Extract unique services from vendor services for initial load
          const uniqueServices = new Map();
          vendorServiceData.forEach((item: any) => {
            if (item.service && !uniqueServices.has(item.service)) {
              uniqueServices.set(item.service, {
                id: item.service,
                name: item.service,
              });
            }
          });
          setServiceModes(Array.from(uniqueServices.values()));
        }
      } catch (error) {
        console.error("Error fetching vendor services:", error);
        toast.error("Failed to load vendor services data. Please try again.");
      }
    };

    fetchData();
  }, []);

  // Fetch senders
  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      if (senderQuery.length >= 2) {
        fetch(`/api/search/customers?query=${encodeURIComponent(senderQuery)}`)
          .then((res) => res.json())
          .then((data) => {
            console.log("Sender search results:", data);
            if (!Array.isArray(data)) {
              toast.error("Invalid sender search results");
              return;
            }
            setSenderResults(data);
          })
          .catch((error) => {
            console.error("Error fetching senders:", error);
            toast.error("Failed to search senders");
          });
      } else {
        setSenderResults([]);
      }
    }, 300); // Debounce

    return () => clearTimeout(delayDebounce);
  }, [senderQuery]);

  // Fetch recipients
  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      if (recipientQuery.length >= 2) {
        fetch(
          `/api/search/recipients?query=${encodeURIComponent(recipientQuery)}`
        )
          .then((res) => res.json())
          .then((data) => {
            console.log("Recipient search results:", data);
            if (!Array.isArray(data)) {
              toast.error("Invalid recipient search results");
              return;
            }
            setRecipientResults(data);
          })
          .catch((error) => {
            console.error("Error fetching recipients:", error);
            toast.error("Failed to search recipients");
          });
      } else {
        setRecipientResults([]);
      }
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [recipientQuery]);

  // Types
  type Option = { id: string; name: string; code?: string };

  const [deliveryStatuses, setDeliveryStatuses] = useState<Option[]>([]);
  const [shippingModes, setShippingModes] = useState<Option[]>([]);
  const [packagingTypes, setPackagingTypes] = useState<Option[]>([]);
  const [vendors, setVendors] = useState<Option[]>([]);
  const [serviceModes, setServiceModes] = useState<Option[]>([]);
  const [allVendorServices, setAllVendorServices] = useState<any[]>([]);
  const [agencies, setAgencies] = useState<Option[]>([]);
  const [offices, setOffices] = useState<Option[]>([]);

  const [form, setForm] = useState({
    shipmentDate: new Date().toLocaleDateString("en-CA"), // Default to today's date in local timezone
    trackingId: "",
    referenceNumber: "", // Add reference number field
    invoiceNumber: "", // Add invoice number field
    agency: "PSS", // Default to PSS
    office: "LHE", // Default to LHE
    senderName: "",
    senderAddress: "",
    recipientName: "",
    recipientAddress: "",
    deliveryStatus: "",
    shippingMode: "",
    packaging: "",
    vendor: "",
    serviceMode: "",
    amount: 1,
    packageDescription: "",
    weight: 0,
    length: 0,
    width: 0,
    height: 0,
    weightVol: 0,
    fixedCharge: 0,
    decValue: 0,
    price: "0",
    discount: "0",
    fuelSurcharge: "0",
    insurance: "0",
    customs: "0",
    tax: "0",
    declaredValue: "0",
    reissue: "0",
    profitPercentage: "0",
    manualRate: false,
  });

  // Store backend-calculated values
  const [calculatedValues, setCalculatedValues] = useState({
    subtotal: 0,
    total: 0,
    vendorPrice: 0,
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  // Filter services based on selected vendor
  const filterServicesByVendor = (vendorName: string) => {
    if (!vendorName) {
      // If no vendor selected, show all services
      const uniqueServices = new Map();
      allVendorServices.forEach((item: any) => {
        if (item.service && !uniqueServices.has(item.service)) {
          uniqueServices.set(item.service, {
            id: item.service,
            name: item.service,
          });
        }
      });
      setServiceModes(Array.from(uniqueServices.values()));
      return;
    }

    // Filter services for the selected vendor
    const vendorServices = allVendorServices.filter(
      (item: any) => item.vendor === vendorName
    );

    const uniqueServices = new Map();
    vendorServices.forEach((item: any) => {
      if (item.service && !uniqueServices.has(item.service)) {
        uniqueServices.set(item.service, {
          id: item.service,
          name: item.service,
        });
      }
    });
    setServiceModes(Array.from(uniqueServices.values()));
  };

  const handleSelect = (name: string, value: string) => {
    console.log("handleSelect called:", { name, value });
    setForm((prev) => {
      const newForm = { ...prev, [name]: value };
      console.log("Updated form state:", newForm);
      return newForm;
    });

    // If vendor is selected, filter services
    if (name === "vendor") {
      const selectedVendor = vendors.find((v) => v.name === value);
      if (selectedVendor) {
        filterServicesByVendor(value);
        // Clear service mode when vendor changes
        setForm((prev) => ({ ...prev, serviceMode: "" }));
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate required fields
    if (!form.trackingId || form.trackingId.trim() === "") {
      toast.error("Please enter a tracking ID");
      return;
    }

    if (!selectedRecipient || !selectedRecipient.Country) {
      toast.error("Please select a recipient with a valid country");
      return;
    }

    // Get destination from recipient's country
    const destination = selectedRecipient.Country;

    // Prepare all collected data
    const shipmentData = {
      // Basic form data with tracking ID and destination
      ...form,
      destination: destination,

      // Package information
      packages: packages,
      packageTotals: totals,

      // Selected sender and recipient data
      selectedSender: selectedSender,
      selectedRecipient: selectedRecipient,

      // Calculated values from backend
      calculatedValues: calculatedValues,

      // Additional metadata
      submissionTimestamp: new Date().toISOString(),
      shipmentDate: new Date(form.shipmentDate).toISOString(), // Use selected shipment date
      totalPackages: packages.length,
      totalWeight: totals.weight,
      totalWeightVol: totals.weightVol,
    };

    console.log("Sending complete shipment data to backend:", shipmentData);
    console.log("Tracking ID:", form.trackingId);
    console.log("Destination (Recipient Country):", destination);

    const isEditing = Boolean(editId);
    const res = await fetch(
      isEditing ? "/api/update-shipment" : "/api/add-shipment",
      {
        method: isEditing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isEditing ? { id: Number(editId), ...shipmentData } : shipmentData
        ),
      }
    );

    const data = await res.json();
    console.log("Backend response:", data);

    if (data.success) {
      toast.success(
        isEditing
          ? "Shipment updated successfully!"
          : "Shipment added successfully!"
      );
      console.log("Shipment saved successfully with data:", data.receivedData);
      if (!isEditing) {
        setForm({
          shipmentDate: new Date().toLocaleDateString("en-CA"),
          trackingId: "",
          invoiceNumber: "",
          referenceNumber: "",
          agency: "PSS",
          office: "LHE",
          senderName: "",
          senderAddress: "",
          recipientName: "",
          recipientAddress: "",
          deliveryStatus: "",
          shippingMode: "",
          packaging: "",
          vendor: "",
          serviceMode: "",
          amount: 1,
          packageDescription: "",
          weight: 0,
          length: 0,
          width: 0,
          height: 0,
          weightVol: 0,
          fixedCharge: 0,
          decValue: 0,
          price: "0",
          discount: "0",
          fuelSurcharge: "0",
          insurance: "0",
          customs: "0",
          tax: "0",
          declaredValue: "0",
          reissue: "0",
          profitPercentage: "0",
          manualRate: false,
        });
        // Reset calculated values
        setCalculatedValues({
          subtotal: 0,
          total: 0,
          vendorPrice: 0,
        });
        // Redirect to shipments page after successful addition
        router.push("/dashboard/shipments");
      }
    } else {
      toast.error(data.message || "Failed to add shipment.");
    }
  };

  // Prefill in edit mode
  useEffect(() => {
    const loadForEdit = async () => {
      if (!editId) return;
      try {
        const res = await fetch(`/api/shipments/${editId}`);
        const data = await res.json();
        if (res.ok && data.shipment) {
          const s = data.shipment;

          // Create a complete form state object with all the data
          const completeFormData = {
            shipmentDate: s.shipmentDate
              ? new Date(s.shipmentDate).toISOString().slice(0, 10)
              : new Date().toLocaleDateString("en-CA"),
            trackingId: s.trackingId || "",
            invoiceNumber: s.invoiceNumber || "",
            referenceNumber: s.referenceNumber || "",
            agency: s.agency || "",
            office: s.office || "",
            senderName: s.senderName || "",
            senderAddress: s.senderAddress || "",
            recipientName: s.recipientName || "",
            recipientAddress: s.recipientAddress || "",
            deliveryStatus: s.deliveryStatus || "",
            shippingMode: s.shippingMode || "",
            packaging: s.packaging || "",
            vendor: s.vendor || "",
            serviceMode: s.serviceMode || "",
            amount: s.amount || 1,
            packageDescription: s.packageDescription || "",
            weight: s.weight || 0,
            length: s.length || 0,
            width: s.width || 0,
            height: s.height || 0,
            weightVol: s.weightVol || 0,
            fixedCharge: s.fixedCharge || 0,
            decValue: s.decValue || 0,
            price: s.price || 0,
            discount: s.discount || 0,
            fuelSurcharge: s.fuelSurcharge || 0,
            insurance: s.insurance || 0,
            customs: s.customs || 0,
            tax: s.tax || 0,
            declaredValue: s.declaredValue || 0,
            reissue: s.reissue || 0,
            profitPercentage: s.profitPercentage || "0",
            manualRate: s.manualRate || false,
          };

          // Set the complete form state at once
          setForm(completeFormData);

          // Prefill selected sender/recipient if you have embedded data (keeping simple here)
          // Packages and calculated values stored as JSON strings in DB; parse if available
          try {
            if (s.packages) {
              const parsed =
                typeof s.packages === "string"
                  ? JSON.parse(s.packages)
                  : s.packages;
              if (Array.isArray(parsed)) setPackages(parsed);
            }
            if (s.calculatedValues) {
              const parsedCalc =
                typeof s.calculatedValues === "string"
                  ? JSON.parse(s.calculatedValues)
                  : s.calculatedValues;
              if (parsedCalc && typeof parsedCalc === "object") {
                setCalculatedValues(parsedCalc);
              }
            } else {
                          // If no calculated values, set them based on the price from the database
            const price = parseFloat(s.price) || 0;
            setCalculatedValues({
              subtotal: price,
              total: price,
              vendorPrice: 0,
            });
            }
          } catch (e) {
            console.error("Failed to parse stored JSON fields", e);
            // Fallback: set calculated values based on price
            const price = parseFloat(s.price) || 0;
            setCalculatedValues({
              subtotal: price,
              total: price,
              vendorPrice: 0,
            });
          }

          // Fetch complete sender and recipient data from database
          if (s.senderName) {
            setSenderQuery(s.senderName);
            try {
              const senderRes = await fetch(
                `/api/search/customers?query=${encodeURIComponent(
                  s.senderName
                )}`
              );
              const senderData = await senderRes.json();
              if (Array.isArray(senderData) && senderData.length > 0) {
                // Find the exact match for the sender name
                const exactSender = senderData.find(
                  (sender: Party) => sender.Company === s.senderName
                );
                if (exactSender) {
                  setSelectedSender(exactSender);
                } else {
                  // Fallback: create a mock sender object if exact match not found
                  const mockSender: Party = {
                    id: 0,
                    Company: s.senderName,
                    Address: s.senderAddress || "",
                    Country: "",
                    State: "",
                    City: "",
                    Zip: "",
                  };
                  setSelectedSender(mockSender);
                }
              } else {
                // Fallback: create a mock sender object if no data found
                const mockSender: Party = {
                  id: 0,
                  Company: s.senderName,
                  Address: s.senderAddress || "",
                  Country: "",
                  State: "",
                  City: "",
                  Zip: "",
                };
                setSelectedSender(mockSender);
              }
            } catch (error) {
              console.error("Error fetching sender data:", error);
              // Fallback: create a mock sender object
              const mockSender: Party = {
                id: 0,
                Company: s.senderName,
                Address: s.senderAddress || "",
                Country: "",
                State: "",
                City: "",
                Zip: "",
              };
              setSelectedSender(mockSender);
            }
          }

          if (s.recipientName) {
            setRecipientQuery(s.recipientName);
            try {
              const recipientRes = await fetch(
                `/api/search/recipients?query=${encodeURIComponent(
                  s.recipientName
                )}`
              );
              const recipientData = await recipientRes.json();
              if (Array.isArray(recipientData) && recipientData.length > 0) {
                // Find the exact match for the recipient name
                const exactRecipient = recipientData.find(
                  (recipient: Party) => recipient.Company === s.recipientName
                );
                if (exactRecipient) {
                  setSelectedRecipient(exactRecipient);
                } else {
                  // Fallback: create a mock recipient object if exact match not found
                  const mockRecipient: Party = {
                    id: 0,
                    Company: s.recipientName,
                    Address: s.recipientAddress || "",
                    Country: s.destination || "",
                    State: "",
                    City: "",
                    Zip: "",
                  };
                  setSelectedRecipient(mockRecipient);
                }
              } else {
                // Fallback: create a mock recipient object if no data found
                const mockRecipient: Party = {
                  id: 0,
                  Company: s.recipientName,
                  Address: s.recipientAddress || "",
                  Country: s.destination || "",
                  State: "",
                  City: "",
                  Zip: "",
                };
                setSelectedRecipient(mockRecipient);
              }
            } catch (error) {
              console.error("Error fetching recipient data:", error);
              // Fallback: create a mock recipient object
              const mockRecipient: Party = {
                id: 0,
                Company: s.recipientName,
                Address: s.recipientAddress || "",
                Country: s.destination || "",
                State: "",
                City: "",
                Zip: "",
              };
              setSelectedRecipient(mockRecipient);
            }
          }

          // Filter services based on vendor if vendor is set
          if (s.vendor) {
            filterServicesByVendor(s.vendor);
          }

          // Set select values directly in the form state to ensure proper pre-filling
          setForm((prev) => ({
            ...prev,
            agency: s.agency || prev.agency,
            office: s.office || prev.office,
            deliveryStatus: s.deliveryStatus || prev.deliveryStatus,
            shippingMode: s.shippingMode || prev.shippingMode,
            packaging: s.packaging || prev.packaging,
            vendor: s.vendor || prev.vendor,
            serviceMode: s.serviceMode || prev.serviceMode,
          }));
        }
      } catch (e) {
        console.error("Failed to load shipment for edit", e);
      }
    };
    loadForEdit();
  }, [
    editId,
    deliveryStatuses.length,
    shippingModes.length,
    packagingTypes.length,
    vendors.length,
    serviceModes.length,
  ]);

  // Helper function to format full address
  const formatFullAddress = (party: Party | null) => {
    if (!party) return "";

    // Check if party has any address data
    if (!party.Address && !party.City && !party.State && !party.Country) {
      return "";
    }

    // Get full country name
    let countryName = party.Country;
    if (party.Country && party.Country.length === 2) {
      const country = Country.getCountryByCode(party.Country);
      if (country) {
        countryName = country.name;
      }
    }

    // Get full state/province name
    let stateName = party.State;
    if (party.State && party.Country) {
      const state = State.getStateByCodeAndCountry(party.State, party.Country);
      if (state) {
        stateName = state.name;
      }
    }

    const parts = [party.Address, party.City, stateName, countryName].filter(
      (part) => part && part.trim() !== ""
    );

    return parts.join(", ");
  };

  const renderSelect = (
    label: string,
    placeholder: string,
    options: Option[],
    value: string,
    onValueChange: (value: string) => void
  ) => (
    <div>
      <Label className="mb-2 block">{label}</Label>
      <Select value={value} onValueChange={onValueChange}>
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full px-2 sm:px-4 lg:px-6 xl:px-8 py-4 sm:py-6 text-foreground h-[calc(100vh-64px)] overflow-y-auto transition-all duration-300 ease-in-out"
    >
      <form onSubmit={handleSubmit}>
        {/* Record shipment header */}
        <div className="flex items-center gap-2 mb-4 sm:mb-6">
          <FaBoxOpen className="text-lg sm:text-xl text-primary" />
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-semibold">Add shipment</h1>
        </div>

        {/* Shipment Info Section */}
        <div className="mb-4 sm:mb-6">
          {/* Shipment Information Card */}
          <Card className="bg-white dark:bg-background border border-border shadow-sm">
            <CardContent className="p-3 sm:p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
                {/* List of Agencies */}
                <div className="flex flex-col gap-2">
                  <Label className="text-sm font-medium mb-1">
                    Branch / Agencies
                  </Label>
                  <Select
                    onValueChange={(value) => handleSelect("agency", value)}
                    value={form.agency}
                  >
                    <SelectTrigger className="bg-muted w-full">
                      <SelectValue placeholder="Select agency" />
                    </SelectTrigger>
                    <SelectContent>
                      {agencies.map((agency) => (
                        <SelectItem
                          key={agency.id}
                          value={agency.code || agency.id}
                        >
                          {agency.code || agency.id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Office of Origin */}
                <div className="flex flex-col gap-2">
                  <Label className="text-sm font-medium mb-1">
                    Office of Origin
                  </Label>
                  <Select
                    onValueChange={(value) => handleSelect("office", value)}
                    value={form.office}
                  >
                    <SelectTrigger className="bg-muted w-full">
                      <SelectValue placeholder="Select office" />
                    </SelectTrigger>
                    <SelectContent>
                      {offices.map((office) => (
                        <SelectItem
                          key={office.id}
                          value={office.code || office.id}
                        >
                          {office.code || office.id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {/* Shipment Date */}
                <div className="flex flex-col gap-2">
                  <Label className="text-sm font-medium mb-1">
                    Shipment Date
                  </Label>
                  <Input
                    id="shipmentDate"
                    name="shipmentDate"
                    type="date"
                    value={form.shipmentDate}
                    onChange={handleChange}
                    required
                    className="bg-muted"
                  />
                </div>

                {/* Invoice/Receipt Number */}
                <div className="flex flex-col gap-2">
                  <Label className="text-sm font-medium mb-1">Booking #</Label>
                  <Input
                    id="invoiceNumber"
                    name="invoiceNumber"
                    value={form.invoiceNumber}
                    readOnly
                    className="bg-muted"
                    placeholder="Auto-generated"
                  />
                </div>
                {/* Reference Number */}
                <div className="flex flex-col gap-2">
                  <Label className="text-sm font-medium mb-1">Reference #</Label>
                  <Input
                    id="referenceNumber"
                    name="referenceNumber"
                    value={form.referenceNumber}
                    onChange={handleChange}
                    required
                    className="bg-muted"
                    placeholder="Enter reference"
                  />
                </div>


                {/* Tracking ID */}
                <div className="flex flex-col gap-2">
                  <Label className="text-sm font-medium mb-1">Tracking #</Label>
                  <Input
                    id="trackingId"
                    name="trackingId"
                    value={form.trackingId}
                    onChange={handleChange}
                    required
                    className="bg-muted"
                    placeholder="Enter tracking"
                  />
                </div>

              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sender/Recipient Info Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 mb-4 sm:mb-6">
          {/* Sender Card */}
          <Card className="bg-card border border-border shadow-sm">
            <CardContent className="p-3 sm:p-4 lg:p-6">
              {/* Header */}
              <div className="flex items-center gap-2 mb-4">
                <FaInfoCircle className="text-primary" />
                <span className="font-medium">Sender Information</span>
              </div>

              <div className="space-y-6">
                {/* Sender Name with Add Button */}
                <div className="flex flex-col text-foreground">
                  <Label className="mb-2">Sender/Customer</Label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <Select
                        value={selectedSender?.Company || ""}
                        onValueChange={(value) => {
                          const sender = senderResults.find(
                            (s) => s.Company === value
                          );
                          if (sender) {
                            setSelectedSender(sender);
                            setSenderQuery(sender.Company);
                            setForm((prev) => ({
                              ...prev,
                              senderName: sender.Company,
                              senderAddress: sender.Address,
                            }));
                          } else {
                            // Clear sender data when no sender is selected
                            setSelectedSender(null);
                            setSenderQuery("");
                            setForm((prev) => ({
                              ...prev,
                              senderName: "",
                              senderAddress: "",
                            }));
                          }
                        }}
                        onOpenChange={setSenderDropdownOpen}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Search sender name..." />
                        </SelectTrigger>
                        <SelectContent>
                          <div className="p-2">
                            <Input
                              ref={senderSearchRef}
                              placeholder="Search sender..."
                              value={senderQuery}
                              onChange={(e) => setSenderQuery(e.target.value)}
                              className="mb-2"
                            />
                            {Array.isArray(senderResults) &&
                              senderResults.length > 0 && (
                                <div className="max-h-60 overflow-y-auto">
                                  {senderResults.map((s) => (
                                    <SelectItem key={s.id} value={s.Company}>
                                      {s.Company}
                                    </SelectItem>
                                  ))}
                                </div>
                              )}
                            {senderQuery.length > 0 &&
                              senderQuery.length < 2 && (
                                <div className="px-2 py-1 text-muted-foreground text-sm">
                                  Type at least 2 characters
                                </div>
                              )}
                            {senderQuery.length >= 2 &&
                              Array.isArray(senderResults) &&
                              senderResults.length === 0 && (
                                <div className="px-2 py-1 text-muted-foreground text-sm">
                                  No matches found
                                </div>
                              )}
                          </div>
                        </SelectContent>
                      </Select>
                    </div>
                    <AddCustomerDialog
                      triggerLabel="+"
                      onSuccess={() => {
                        // Refresh sender search results
                        if (senderQuery.length >= 2) {
                          fetch(
                            `/api/search/customers?query=${encodeURIComponent(
                              senderQuery
                            )}`
                          )
                            .then((res) => res.json())
                            .then((data) => {
                              if (Array.isArray(data)) {
                                setSenderResults(data);
                              }
                            })
                            .catch((error) => {
                              console.error("Error refreshing senders:", error);
                            });
                        }
                      }}
                    />
                  </div>
                </div>

                {/* Sender Address */}
                <div className="flex flex-col text-foreground">
                  <Label className="mb-2">Sender/Customer Address</Label>
                  <div className="flex gap-2">
                    <Input
                      value={formatFullAddress(selectedSender)}
                      readOnly
                      placeholder="Sender address"
                      className="flex-1 bg-muted"
                    />
                    {selectedSender ? (
                      <UpdateCustomerAddressDialog
                        triggerLabel="+"
                        customerId={selectedSender.id}
                        currentAddress={selectedSender.Address}
                        currentCity={selectedSender.City}
                        currentState={selectedSender.State}
                        currentCountry={selectedSender.Country}
                        currentZip={selectedSender.Zip}
                        onSuccess={() => {
                          // Refresh sender search results and update selected sender
                          if (senderQuery.length >= 2) {
                            fetch(
                              `/api/search/customers?query=${encodeURIComponent(
                                senderQuery
                              )}`
                            )
                              .then((res) => res.json())
                              .then((data) => {
                                if (Array.isArray(data)) {
                                  setSenderResults(data);
                                  // Update the selected sender with new data
                                  const updatedSender = data.find(
                                    (s) => s.id === selectedSender.id
                                  );
                                  if (updatedSender) {
                                    setSelectedSender(updatedSender);
                                  }
                                }
                              })
                              .catch((error) => {
                                console.error(
                                  "Error refreshing senders:",
                                  error
                                );
                              });
                          }
                        }}
                      />
                    ) : (
                      <AddCustomerDialog
                        triggerLabel="+"
                        onSuccess={() => {
                          // Refresh sender search results
                          if (senderQuery.length >= 2) {
                            fetch(
                              `/api/search/customers?query=${encodeURIComponent(
                                senderQuery
                              )}`
                            )
                              .then((res) => res.json())
                              .then((data) => {
                                if (Array.isArray(data)) {
                                  setSenderResults(data);
                                }
                              })
                              .catch((error) => {
                                console.error(
                                  "Error refreshing senders:",
                                  error
                                );
                              });
                          }
                        }}
                      />
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recipient Card */}
          <Card className="bg-card border border-border shadow-sm">
            <CardContent className="p-3 sm:p-4 lg:p-6">
              {/* Header */}
              <div className="flex items-center gap-2 mb-4">
                <FaInfoCircle className="text-primary" />
                <span className="font-medium">Recipient Information</span>
              </div>

              <div className="space-y-6">
                {/* Recipient Name with Add Button */}
                <div className="flex flex-col text-foreground">
                  <Label className="mb-2">Recipient/Client</Label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <Select
                        value={selectedRecipient?.Company || ""}
                        onValueChange={(value) => {
                          const recipient = recipientResults.find(
                            (r) => r.Company === value
                          );
                          if (recipient) {
                            setSelectedRecipient(recipient);
                            setRecipientQuery(recipient.Company);
                            setForm((prev) => ({
                              ...prev,
                              recipientName: recipient.Company,
                              recipientAddress: recipient.Address,
                            }));
                          } else {
                            // Clear recipient data when no recipient is selected
                            setSelectedRecipient(null);
                            setRecipientQuery("");
                            setForm((prev) => ({
                              ...prev,
                              recipientName: "",
                              recipientAddress: "",
                            }));
                          }
                        }}
                        onOpenChange={setRecipientDropdownOpen}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Search recipient name..." />
                        </SelectTrigger>
                        <SelectContent>
                          <div className="p-2">
                            <Input
                              ref={recipientSearchRef}
                              placeholder="Search recipient..."
                              value={recipientQuery}
                              onChange={(e) =>
                                setRecipientQuery(e.target.value)
                              }
                              className="mb-2"
                            />
                            {Array.isArray(recipientResults) &&
                              recipientResults.length > 0 && (
                                <div className="max-h-60 overflow-y-auto">
                                  {recipientResults.map((r) => (
                                    <SelectItem key={r.id} value={r.Company}>
                                      {r.Company}
                                    </SelectItem>
                                  ))}
                                </div>
                              )}
                            {recipientQuery.length > 0 &&
                              recipientQuery.length < 2 && (
                                <div className="px-2 py-1 text-muted-foreground text-sm">
                                  Type at least 2 characters
                                </div>
                              )}
                            {recipientQuery.length >= 2 &&
                              Array.isArray(recipientResults) &&
                              recipientResults.length === 0 && (
                                <div className="px-2 py-1 text-muted-foreground text-sm">
                                  No matches found
                                </div>
                              )}
                          </div>
                        </SelectContent>
                      </Select>
                    </div>
                    <AddRecipientDialog
                      triggerLabel="+"
                      onSuccess={() => {
                        // Refresh recipient search results
                        if (recipientQuery.length >= 2) {
                          fetch(
                            `/api/search/recipients?query=${encodeURIComponent(
                              recipientQuery
                            )}`
                          )
                            .then((res) => res.json())
                            .then((data) => {
                              if (Array.isArray(data)) {
                                setRecipientResults(data);
                              }
                            })
                            .catch((error) => {
                              console.error(
                                "Error refreshing recipients:",
                                error
                              );
                            });
                        }
                      }}
                    />
                  </div>
                </div>

                {/* Recipient Address */}
                <div className="flex flex-col text-foreground">
                  <Label className="mb-2">Recipient/Client Address</Label>
                  <div className="flex gap-2">
                    <Input
                      value={formatFullAddress(selectedRecipient)}
                      readOnly
                      placeholder="Recipient address"
                      className="flex-1 bg-muted"
                    />
                    {selectedRecipient ? (
                      <UpdateRecipientAddressDialog
                        triggerLabel="+"
                        recipientId={selectedRecipient.id}
                        currentAddress={selectedRecipient.Address}
                        currentCity={selectedRecipient.City}
                        currentState={selectedRecipient.State}
                        currentCountry={selectedRecipient.Country}
                        currentZip={selectedRecipient.Zip}
                        onSuccess={() => {
                          // Refresh recipient search results and update selected recipient
                          if (recipientQuery.length >= 2) {
                            fetch(
                              `/api/search/recipients?query=${encodeURIComponent(
                                recipientQuery
                              )}`
                            )
                              .then((res) => res.json())
                              .then((data) => {
                                if (Array.isArray(data)) {
                                  setRecipientResults(data);
                                  // Update the selected recipient with new data
                                  const updatedRecipient = data.find(
                                    (r) => r.id === selectedRecipient.id
                                  );
                                  if (updatedRecipient) {
                                    setSelectedRecipient(updatedRecipient);
                                  }
                                }
                              })
                              .catch((error) => {
                                console.error(
                                  "Error refreshing recipients:",
                                  error
                                );
                              });
                          }
                        }}
                      />
                    ) : (
                      <AddRecipientDialog
                        triggerLabel="+"
                        onSuccess={() => {
                          // Refresh recipient search results
                          if (recipientQuery.length >= 2) {
                            fetch(
                              `/api/search/recipients?query=${encodeURIComponent(
                                recipientQuery
                              )}`
                            )
                              .then((res) => res.json())
                              .then((data) => {
                                if (Array.isArray(data)) {
                                  setRecipientResults(data);
                                }
                              })
                              .catch((error) => {
                                console.error(
                                  "Error refreshing recipients:",
                                  error
                                );
                              });
                          }
                        }}
                      />
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Shipping Information Section */}
        <Card className="bg-card border border-border shadow-sm mb-4">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-4">
              <FaTruck className="text-primary" />
              <span className="font-medium">Shipping information:</span>
            </div>

            {/* All selects in one row */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              {renderSelect(
                "Shipping Mode",
                "Select shipping mode",
                shippingModes,
                form.shippingMode,
                (value) => handleSelect("shippingMode", value)
              )}
              {renderSelect(
                "Type of Packaging",
                "Select packaging type",
                packagingTypes,
                form.packaging,
                (value) => handleSelect("packaging", value)
              )}
              {renderSelect(
                "Vendor",
                "Select vendor",
                vendors,
                form.vendor,
                (value) => handleSelect("vendor", value)
              )}
              {renderSelect(
                "Service Mode",
                "Select service mode",
                serviceModes,
                form.serviceMode,
                (value) => handleSelect("serviceMode", value)
              )}
              {renderSelect(
                "Status",
                "Select status",
                deliveryStatuses,
                form.deliveryStatus,
                (value) => handleSelect("deliveryStatus", value)
              )}
            </div>
          </CardContent>
        </Card>

        {/* Package Information Section */}
        <Card className="bg-card border border-border shadow-sm mb-4 sm:mb-6">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 mb-4">
              <FaBoxOpen className="text-primary" />
              <span className="font-medium">Package Information</span>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs sm:text-sm border border-border">
                <thead>
                  <tr className="bg-muted">
                    <th className="py-1 px-1 sm:px-2 border border-border text-center">
                      <span className="hidden sm:inline">Pieces</span>
                      <span className="sm:hidden">Pcs</span>
                    </th>
                    <th className="border border-border px-1 sm:px-2">
                      <span className="hidden sm:inline">Package Description</span>
                      <span className="sm:hidden">Desc</span>
                    </th>
                    <th className="py-1 px-1 sm:px-2 border border-border text-center">
                      <span className="hidden sm:inline">Weight</span>
                      <span className="sm:hidden">W</span>
                    </th>
                    <th className="py-1 px-1 sm:px-2 border border-border text-center">
                      <span className="hidden sm:inline">Length</span>
                      <span className="sm:hidden">L</span>
                    </th>
                    <th className="py-1 px-1 sm:px-2 border border-border text-center">
                      <span className="hidden sm:inline">Width</span>
                      <span className="sm:hidden">W</span>
                    </th>
                    <th className="py-1 px-1 sm:px-2 border border-border text-center">
                      <span className="hidden sm:inline">Height</span>
                      <span className="sm:hidden">H</span>
                    </th>
                    <th className="py-1 px-1 sm:px-2 border border-border text-center">
                      <span className="hidden sm:inline">Weight Vol.</span>
                      <span className="sm:hidden">Vol</span>
                    </th>
                    <th className="px-1 sm:px-2 py-1 border border-border text-center">
                      <span className="hidden sm:inline">DecValue</span>
                      <span className="sm:hidden">Val</span>
                    </th>
                    <th className="px-1 sm:px-2 py-1 border border-border text-center">
                      <span className="hidden sm:inline">Action</span>
                      <span className="sm:hidden">A</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {packages.map((pkg) => (
                    <tr key={pkg.id}>
                      <td className="border border-border py-1 text-center">
                        <div className="flex justify-center">
                          <Input
                            value={pkg.amount}
                            onChange={(e) =>
                              updatePackage(
                                pkg.id,
                                "amount",
                                parseInt(e.target.value) || 0
                              )
                            }
                            className="w-12 text-center"
                          />
                        </div>
                      </td>
                      <td className="border border-border py-1 text-center">
                        <div className="flex justify-center">
                          <Input
                            value={pkg.packageDescription}
                            placeholder="Package Description"
                            onChange={(e) =>
                              updatePackage(
                                pkg.id,
                                "packageDescription",
                                e.target.value
                              )
                            }
                            className="w-50 text-center"
                          />
                        </div>
                      </td>
                      <td className="border border-border py-1 text-center">
                        <div className="flex justify-center">
                          <Input
                            type="number"
                            step="0.5"
                            min="0"
                            value={pkg.weight}
                            onChange={(e) =>
                              updatePackage(
                                pkg.id,
                                "weight",
                                parseFloat(e.target.value) || 0
                              )
                            }
                            className="w-16 text-center"
                          />
                        </div>
                      </td>
                      <td className="border border-border py-1 text-center">
                        <div className="flex justify-center">
                          <Input
                            value={pkg.length}
                            onChange={(e) =>
                              updatePackage(
                                pkg.id,
                                "length",
                                parseFloat(e.target.value) || 0
                              )
                            }
                            className="w-16 text-center"
                          />
                        </div>
                      </td>
                      <td className="border border-border py-1 text-center">
                        <div className="flex justify-center">
                          <Input
                            value={pkg.width}
                            onChange={(e) =>
                              updatePackage(
                                pkg.id,
                                "width",
                                parseFloat(e.target.value) || 0
                              )
                            }
                            className="w-16 text-center"
                          />
                        </div>
                      </td>
                      <td className="border border-border py-1 text-center">
                        <div className="flex justify-center">
                          <Input
                            value={pkg.height}
                            onChange={(e) =>
                              updatePackage(
                                pkg.id,
                                "height",
                                parseFloat(e.target.value) || 0
                              )
                            }
                            className="w-16 text-center"
                          />
                        </div>
                      </td>
                      <td className="border border-border py-1 text-center">
                        <div className="flex justify-center">
                          <Input
                            value={pkg.weightVol}
                            readOnly
                            className="w-16 bg-muted text-center"
                            title="Auto-calculated: (L × W × H) ÷ 5000, rounded up"
                          />
                        </div>
                      </td>

                      <td className="border border-border py-1 text-center">
                        <div className="flex justify-center">
                          <Input
                            value={pkg.decValue}
                            onChange={(e) =>
                              updatePackage(
                                pkg.id,
                                "decValue",
                                parseFloat(e.target.value) || 0
                              )
                            }
                            className="w-16 text-center"
                          />
                        </div>
                      </td>
                      <td className="border border-border px-2 py-1 text-center">
                        {packages.length > 1 && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => removePackage(pkg.id)}
                            className="text-red-500 hover:text-red-700"
                          >
                            <FaTrash className="w-3 h-3" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex items-center gap-2 mt-2">
                <span className="font-medium">TOTALS</span>
                <span className="ml-auto">
                  Amount: {totals.amount} | Weight: {totals.weight} | Weight
                  Vol: {totals.weightVol} | DecValue: {totals.decValue}
                </span>
              </div>
              <Button
                type="button"
                variant="outline"
                className="mt-2 w-full sm:w-auto"
                onClick={addPackage}
              >
                <span className="hidden sm:inline">+ Add Box or Packages</span>
                <span className="sm:hidden">+ Add Package</span>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Rate & Taxes Information Section */}
        <Card className="bg-card border border-border shadow-sm mb-4 sm:mb-6">
          <CardContent className="p-3 sm:p-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 mb-4">
              <div className="flex items-center gap-2">
                <FaFileInvoice className="text-primary" />
                <span className="font-medium">Rate & Taxes information</span>
              </div>
              <span className="flex items-center gap-2 ml-0 sm:ml-auto">
                <Label className="mr-2 text-sm font-medium">Manual Rate</Label>
                <Switch
                  checked={form.manualRate}
                  onCheckedChange={(checked) => {
                    setForm((prev) => ({ ...prev, manualRate: !!checked }));
                    if (!checked) {
                      calculateRate();
                    }
                  }}
                  className="data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                />
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <div>
                <Label className="mb-2 block">Price kg</Label>
                <Input
                  name="price"
                  value={form.price}
                  className="w-full"
                  onChange={handleChange}
                />
              </div>
              <div>
                <Label className="mb-2 block">Discount %</Label>
                <Input
                  name="discount"
                  value={form.discount}
                  className="w-full"
                  onChange={handleChange}
                />
              </div>
              <div>
                <Label className="mb-2 block">Fuel surcharge</Label>
                <Input
                  name="fuelSurcharge"
                  value={form.fuelSurcharge}
                  className="w-full"
                  onChange={handleChange}
                />
              </div>
              <div>
                <Label className="mb-2 block">Shipping Insurance %</Label>
                <Input
                  name="insurance"
                  value={form.insurance}
                  className="w-full"
                  onChange={handleChange}
                />
              </div>
              <div>
                <Label className="mb-2 block">Customs Duties %</Label>
                <Input
                  name="customs"
                  value={form.customs}
                  className="w-full"
                  onChange={handleChange}
                />
              </div>
              <div>
                <Label className="mb-2 block">Tax %</Label>
                <Input
                  name="tax"
                  value={form.tax}
                  className="w-full"
                  onChange={handleChange}
                />
              </div>
              <div>
                <Label className="mb-2 block">Declared value %</Label>
                <Input
                  name="declaredValue"
                  value={form.declaredValue}
                  className="w-full"
                  onChange={handleChange}
                />
              </div>
              <div>
                <Label className="mb-2 block">Reissue</Label>
                <Input
                  name="reissue"
                  value={form.reissue}
                  className="w-full"
                  onChange={handleChange}
                />
              </div>
              <div>
                <Label className="mb-2 block">
                  Fixed charge <span className="text-xs text-gray-500">(Auto-calculated)</span>
                </Label>
                <Input
                  name="fixedCharge"
                  value={form.fixedCharge}
                  className="w-full bg-gray-50 cursor-not-allowed"
                  readOnly
                  disabled
                />
              </div>
              <div>
                <Label className="mb-2 block">Profit %</Label>
                <Input
                  name="profitPercentage"
                  value={form.profitPercentage}
                  className="w-full"
                  onChange={handleChange}
                  placeholder="0"
                />
              </div>
              <div className="col-span-1 sm:col-span-2 flex flex-col justify-end">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 mt-4">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Subtotal</span>
                    <span className="text-green-600">
                      PKR{" "}
                      {calculatedValues.subtotal > 0
                        ? calculatedValues.subtotal.toFixed(2)
                        : "0.00"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">TOTAL</span>
                    <span className="text-green-600">
                      PKR{" "}
                      {calculatedValues.total > 0
                        ? calculatedValues.total.toFixed(2)
                        : "0.00"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row justify-end gap-3 sm:gap-4 mt-4 sm:mt-6">
              <Button
                type="button"
                className="bg-blue-500 w-full sm:w-auto"
                onClick={calculateRate}
              >
                Price list calculation
              </Button>
              <Button type="submit" className="bg-green-500 w-full sm:w-auto">
                Save
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </motion.div>
  );
};

export default AddShipmentPage;
