"use client";

import { useEffect, useState, useLayoutEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useRouter, useSearchParams } from "next/navigation";
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
  const searchParams = useSearchParams();
  const recipientId = searchParams.get("id");
  const isEditMode = !!recipientId;
  
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

  const [selectedCountry, setSelectedCountry] = useState<string>("");
  const [selectedState, setSelectedState] = useState<string>("");
  const [selectedCity, setSelectedCity] = useState<string>("");

  const [states, setStates] = useState<any[]>([]);
  const [cities, setCities] = useState<any[]>([]);
  const [isLoadingRecipient, setIsLoadingRecipient] = useState(false);
  const [recipientDataLoaded, setRecipientDataLoaded] = useState(false);

  const countries = Country.getAllCountries();

  // Load states when country is selected
  useEffect(() => {
    if (selectedCountry) {
      const fetchedStates = State.getStatesOfCountry(selectedCountry);
      setStates(fetchedStates);
    } else if (!isEditMode) {
      // Only clear states if not in edit mode
      setStates([]);
    }
  }, [selectedCountry, isEditMode]);

  // Load cities when state is selected
  useEffect(() => {
    if (selectedCountry && selectedState) {
      const fetchedCities = City.getCitiesOfState(selectedCountry, selectedState);
      setCities(fetchedCities);
    } else if (!isEditMode && !selectedState) {
      // Only clear cities if not in edit mode and state is not selected
      setCities([]);
    }
  }, [selectedState, selectedCountry, isEditMode]);

  // Fetch recipient data when in edit mode
  useEffect(() => {
    const fetchRecipient = async () => {
      if (recipientId) {
        setIsLoadingRecipient(true);
        setRecipientDataLoaded(false);
        try {
          const res = await fetch(`/api/recipients/${recipientId}`);
          const data = await res.json();
          
          if (data.recipient) {
            const recipient = data.recipient;
            const country = recipient.Country || "";
            const state = recipient.State || "";
            const city = recipient.City || "";
            
            // Set form data first
            setForm({
              companyname: recipient.CompanyName || "",
              personname: recipient.PersonName || "",
              email: recipient.Email || "",
              phone: recipient.Phone || "",
              country: country,
              state: state,
              city: city,
              zip: recipient.Zip || "",
              address: recipient.Address || "",
            });
            
            // In edit mode, load states and cities synchronously
            if (country) {
              // Set country first - this will trigger the useEffect to load states
              setSelectedCountry(country);
              
              // Wait a bit for states to load, then set selectedState
              setTimeout(() => {
                const fetchedStates = State.getStatesOfCountry(country);
                if (state && fetchedStates.length > 0) {
                  // Verify state exists in loaded states
                  const stateExists = fetchedStates.some(s => s.isoCode === state);
                  if (stateExists) {
                    setSelectedState(state);
                    
                    // Wait a bit for cities to load, then set selectedCity
                    setTimeout(() => {
                      const fetchedCities = City.getCitiesOfState(country, state);
                      if (city && fetchedCities.length > 0) {
                        // Verify city exists in loaded cities
                        const cityExists = fetchedCities.some(c => c.name === city);
                        if (cityExists) {
                          setSelectedCity(city);
                        }
                      }
                      setRecipientDataLoaded(true);
                      setIsLoadingRecipient(false);
                    }, 100);
                  } else {
                    setRecipientDataLoaded(true);
                    setIsLoadingRecipient(false);
                  }
                } else {
                  setRecipientDataLoaded(true);
                  setIsLoadingRecipient(false);
                }
              }, 100);
            } else {
              setRecipientDataLoaded(true);
              setIsLoadingRecipient(false);
            }
          }
        } catch (error) {
          console.error("Error fetching recipient:", error);
          toast.error("Failed to load recipient data");
          setRecipientDataLoaded(true);
          setIsLoadingRecipient(false);
        }
      }
    };

    fetchRecipient();
  }, [recipientId]);

  // Sync selectedState with form.state when states are loaded (fallback mechanism for edit mode)
  useEffect(() => {
    if (isEditMode && states.length > 0 && form.state) {
      const stateExists = states.some(s => s.isoCode === form.state);
      if (stateExists && selectedState !== form.state) {
        setSelectedState(form.state);
      }
    }
  }, [states, form.state, selectedState, isEditMode]);

  // Sync selectedCity with form.city when cities are loaded (fallback mechanism for edit mode)
  useEffect(() => {
    if (isEditMode && cities.length > 0 && form.city) {
      const cityExists = cities.some(c => c.name === form.city);
      if (cityExists && selectedCity !== form.city) {
        setSelectedCity(form.city);
      }
    }
  }, [cities, form.city, selectedCity, isEditMode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const url = isEditMode ? `/api/recipients/${recipientId}` : "/api/add-recipients";
    const method = isEditMode ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(form),
    });

    const data = await res.json();

    if (data.success) {
      toast.success(isEditMode ? "Recipient updated successfully!" : "Recipient added successfully!");
      if (!isEditMode) {
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
      }
    } else {
      toast.error(data.message);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-5xl mx-auto px-4 mt-10"
    >
      <Card className="w-full bg-white border border-gray-100 shadow-sm rounded-2xl">
        <CardContent className="p-8">
          <h1 className="text-2xl font-semibold text-primary mb-6 text-center">
            {isEditMode ? "Edit Recipient" : "Add Recipient"}
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
                  autoFocus
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
                    setSelectedCity(""); // Clear city when state changes
                    setCities([]); // Clear cities when state changes
                  }}
                  value={states.length > 0 && selectedState ? selectedState : form.state}
                  disabled={!form.country || isLoadingRecipient}
                >
                  <SelectTrigger id="state" className="w-full">
                    <SelectValue placeholder={isLoadingRecipient ? "Loading..." : "Select a state/Provinces"} />
                  </SelectTrigger>
                  <SelectContent>
                    {states.map((state) => (
                      <SelectItem key={state.isoCode} value={state.isoCode}>
                        {state.name} ({state.isoCode})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="city">City</Label>
                <Select
                  onValueChange={(value) => {
                    setForm((prev) => ({ ...prev, city: value }));
                    setSelectedCity(value);
                  }}
                  value={cities.length > 0 && selectedCity ? selectedCity : form.city}
                  disabled={(!selectedState && !form.state) || isLoadingRecipient}
                >
                  <SelectTrigger id="city" className="w-full">
                    <SelectValue placeholder={isLoadingRecipient ? "Loading..." : "Select a city"} />
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
                Back
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
