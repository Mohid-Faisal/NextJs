// components/AddCustomerDialog.tsx

"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Country, State, City } from "country-state-city";

const AddRecipientDialog = ({ triggerLabel = "Add Recipient", onSuccess }: { triggerLabel?: string, onSuccess?: () => void }) => {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    companyname: "",
    personname: "",
    email: "",
    phone: "",
    country: "",
    state: "",
    city: "",
    zip: "",
    address: "",
  });

  const [selectedCountry, setSelectedCountry] = useState<string>("");
  const [selectedState, setSelectedState] = useState<string>("");
  const [selectedCity, setSelectedCity] = useState<string>("");
  const [states, setStates] = useState<any[]>([]);
  const [cities, setCities] = useState<any[]>([]);

  const countries = Country.getAllCountries();

  useEffect(() => {
    if (selectedCountry) {
      const fetchedStates = State.getStatesOfCountry(selectedCountry);
      setStates(fetchedStates);
      setSelectedState("");
      setSelectedCity("");
      setCities([]);
    }
  }, [selectedCountry]);

  useEffect(() => {
    if (selectedCountry && selectedState) {
      const fetchedCities = City.getCitiesOfState(
        selectedCountry,
        selectedState
      );
      setCities(fetchedCities);
      setSelectedCity("");
    }
  }, [selectedState, selectedCountry]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleRecipient = async (e: React.FormEvent) => {
    e.preventDefault();

    const res = await fetch("/api/add-recipients", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(form),
    });

    const data = await res.json();

    if (data.success) {
      toast.success("Recipient added successfully!");
      setForm({
        companyname: "",
        personname: "",
        email: "",
        phone: "",
        country: "",
        state: "",
        city: "",
        zip: "",
        address: "",
      });
      setSelectedCountry("");
      setSelectedState("");
      setSelectedCity("");
      setStates([]);
      setCities([]);
      setOpen(false); // Close dialog after successful submission
      if (onSuccess) {
        onSuccess(); // Call the callback to refresh the list
      }
    } else {
      toast.error(data.message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" className="bg-blue-500 text-white hover:bg-blue-600 border-blue-500">
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent size="4xl" className="max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full"
        >
          <DialogHeader>
            <DialogTitle className="text-2xl text-center mb-4">Add Recipient</DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleRecipient} className="space-y-6">
            {/* Basic Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="companyname">Company Name</Label>
                <Input
                  id="companyname"
                  name="companyname"
                  value={form.companyname}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="personname">Person Name</Label>
                <Input
                  id="personname"
                  name="personname"
                  value={form.personname}
                  onChange={handleChange}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                  placeholder="0301 2345678"
                />
              </div>
            </div>

            {/* Country, State, City */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="country">Country</Label>
                <Select
                  onValueChange={(value) => {
                    setForm({ ...form, country: value, state: "", city: "" });
                    setSelectedCountry(value);
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
                    setForm({ ...form, state: value, city: "" });
                    setSelectedState(value);
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
                  onValueChange={(value) =>
                    setForm((prev) => ({ ...prev, city: value }))
                  }
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

            {/* Zip, Address */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="zip">Zip Code</Label>
                <Input
                  id="zip"
                  name="zip"
                  value={form.zip}
                  onChange={handleChange}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  name="address"
                  value={form.address}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="flex justify-end gap-4 pt-4">
              <Button type="reset" variant="ghost" className="text-sm px-4">
                Cancel
              </Button>
              <Button type="button" onClick={handleRecipient} className="text-sm px-4">
                Add Recipient
              </Button>
            </div>
          </form>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
};

export default AddRecipientDialog;
