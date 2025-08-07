"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

type ShipmentInfoProps = {
  form: any;
  isChecked: boolean;
  setIsChecked: (checked: boolean) => void;
  handleChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleSelect: (field: string, value: string) => void;
  selectItems: React.ReactNode;
};

export default function ShipmentInfoSection({
  form,
  isChecked,
  setIsChecked,
  handleChange,
  handleSelect,
  selectItems,
}: ShipmentInfoProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
      {/* Left Section: Shipping Prefix + AWB */}
      <Card className="bg-card border border-border shadow-sm">
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
                  className="text-sm text-muted-foreground"
                >
                  Country code
                </Label>

                {!isChecked ? (
                  <Input
                    className="w-24 bg-muted text-center border-none"
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
              <Label className="text-sm font-medium mb-1">Tracking ID</Label>
              <Input
                value={form.awbNumber}
                className="bg-muted"
                onChange={handleChange}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Right Section: List of Agencies + Office of origin */}
      <Card className="bg-card border border-border shadow-sm">
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
                <SelectTrigger className="bg-muted w-full">
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
                <SelectTrigger className="bg-muted w-full">
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
  );
}
