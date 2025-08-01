"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Country, State, City } from "country-state-city";

const RecipientsPage = () => {
  const router = useRouter();
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

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const res = await fetch("/api/add-recipients", {
      method: "POST",
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
    } else {
      toast.error(data.message);
    }
  };

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

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-5xl mx-auto px-4 mt-10"
    >
      <Card className="w-full bg-white border border-gray-100 shadow-sm rounded-2xl">
        <CardContent className="p-8">
          <h1 className="text-2xl font-semibold text-primary mb-6 text-center">
            Add Recipient
          </h1>

          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                  required
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
                  required
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
                  required
                />
              </div>
            </div>

            {/* Country, State, City */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
                        {country.name}
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

            {/* Zip, Address & Active Status */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
              {/* Zip Code */}
              <div className="space-y-1.5">
                <Label htmlFor="zip">Zip Code</Label>
                <Input
                  id="zip"
                  name="zip"
                  value={form.zip}
                  onChange={handleChange}
                />
              </div>

              {/* Address */}
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
              <Button
                type="button"
                variant="ghost"
                onClick={() => router.back()}
              >
                Close
              </Button>
              <Button type="submit">Save</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default RecipientsPage;
