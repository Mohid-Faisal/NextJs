"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Country, State, City } from "country-state-city";
import { motion } from "framer-motion";

interface UpdateCustomerAddressDialogProps {
  triggerLabel?: string;
  customerId?: number;
  currentAddress?: string;
  currentCity?: string;
  currentState?: string;
  currentCountry?: string;
  currentZip?: string;
  onSuccess?: () => void;
}

const UpdateCustomerAddressDialog = ({
  triggerLabel = "Update Address",
  customerId,
  currentAddress = "",
  currentCity = "",
  currentState = "",
  currentCountry = "",
  currentZip = "",
  onSuccess
}: UpdateCustomerAddressDialogProps) => {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    address: currentAddress,
    city: currentCity,
    state: currentState,
    country: currentCountry,
    zip: currentZip,
  });

  const [selectedCountry, setSelectedCountry] = useState<string>(currentCountry);
  const [selectedState, setSelectedState] = useState<string>(currentState);
  const [selectedCity, setSelectedCity] = useState<string>(currentCity);
  const [states, setStates] = useState<any[]>([]);
  const [cities, setCities] = useState<any[]>([]);

  const countries = Country.getAllCountries();

  useEffect(() => {
    if (selectedCountry) {
      const fetchedStates = State.getStatesOfCountry(selectedCountry);
      setStates(fetchedStates);
      if (!selectedState) {
        setSelectedState("");
        setSelectedCity("");
        setCities([]);
      }
    }
  }, [selectedCountry, selectedState]);

  useEffect(() => {
    if (selectedCountry && selectedState) {
      const fetchedCities = City.getCitiesOfState(
        selectedCountry,
        selectedState
      );
      setCities(fetchedCities);
      if (!selectedCity) {
        setSelectedCity("");
      }
    }
  }, [selectedState, selectedCountry, selectedCity]);

  const handleSubmit = async () => {
    if (!customerId) {
      toast.error("No customer selected");
      return;
    }

    try {
      const response = await fetch(`/api/customers/${customerId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          Address: form.address,
          City: form.city,
          State: form.state,
          Country: form.country,
          Zip: form.zip,
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success("Customer address updated successfully!");
        setOpen(false);
        if (onSuccess) {
          onSuccess();
        }
      } else {
        toast.error(data.message || "Failed to update customer address");
      }
    } catch (error) {
      console.error("Error updating customer address:", error);
      toast.error("Error updating customer address");
    }
  };

  const handleChange = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" className="bg-blue-500 text-white hover:bg-blue-600 border-blue-500">
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full"
        >
          <DialogHeader>
            <DialogTitle className="text-2xl text-center mb-4">Update Customer Address</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Address */}
            <div className="space-y-1.5">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                value={form.address}
                onChange={(e) => handleChange("address", e.target.value)}
                placeholder="Enter address"
              />
            </div>

            {/* Country, State, City */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="country">Country</Label>
                <Select
                  onValueChange={(value) => {
                    handleChange("country", value);
                    setSelectedCountry(value);
                    handleChange("state", "");
                    handleChange("city", "");
                    setSelectedState("");
                    setSelectedCity("");
                  }}
                  value={form.country}
                >
                  <SelectTrigger id="country" className="w-full">
                    <SelectValue placeholder="Select a country" />
                  </SelectTrigger>
                  <SelectContent>
                    {countries.map((country) => (
                      <SelectItem key={country.isoCode} value={country.isoCode}>
                        {country.name} ({country.isoCode})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="state">State/Province</Label>
                <Select
                  onValueChange={(value) => {
                    handleChange("state", value);
                    setSelectedState(value);
                    handleChange("city", "");
                    setSelectedCity("");
                  }}
                  value={form.state}
                  disabled={!form.country}
                >
                  <SelectTrigger id="state" className="w-full">
                    <SelectValue placeholder="Select a state/Provinces" />
                  </SelectTrigger>
                  <SelectContent>
                    {states.map((state) => (
                      <SelectItem key={state.isoCode} value={state.isoCode}>
                        {state.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="city">City</Label>
                <Select
                  onValueChange={(value) => {
                    handleChange("city", value);
                    setSelectedCity(value);
                  }}
                  value={form.city}
                  disabled={!form.state}
                >
                  <SelectTrigger id="city" className="w-full">
                    <SelectValue placeholder="Select a city" />
                  </SelectTrigger>
                  <SelectContent>
                    {cities.map((city) => (
                      <SelectItem key={city.name} value={city.name}>
                        {city.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Zip Code */}
            <div className="space-y-1.5">
              <Label htmlFor="zip">ZIP/Postal Code</Label>
              <Input
                id="zip"
                value={form.zip}
                onChange={(e) => handleChange("zip", e.target.value)}
                placeholder="Enter ZIP code"
              />
            </div>

            <div className="flex justify-end gap-4 pt-4">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)} className="text-sm px-4">
                Cancel
              </Button>
              <Button type="button" onClick={handleSubmit} className="text-sm px-4">
                Update Address
              </Button>
            </div>
          </div>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
};

export default UpdateCustomerAddressDialog;
