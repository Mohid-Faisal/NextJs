"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { motion, Variants } from "framer-motion";
import { useTheme } from "next-themes";

const fadeInUp = {
  hidden: { opacity: 0, y: 40 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.1,
      duration: 0.5,
      ease: "easeOut",
    },
  }),
};

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [smsAlerts, setSmsAlerts] = useState(false);

  return (
    <div className="p-4 sm:p-6 lg:p-8 xl:p-10 w-full bg-white dark:bg-zinc-900 transition-all duration-300 ease-in-out ml-0 lg:ml-0">
      <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6 lg:space-y-8 bg-white dark:bg-card">
        <motion.h1
          className="text-2xl sm:text-3xl font-bold mb-3 sm:mb-4 text-foreground"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          Settings
        </motion.h1>

        {[
          {
            title: "Profile",
            content: (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-xs sm:text-sm">Name</Label>
                  <Input id="name" placeholder="Enter your name" className="text-xs sm:text-sm" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-xs sm:text-sm">Email</Label>
                  <Input id="email" placeholder="Enter your email" className="text-xs sm:text-sm" />
                </div>
                <div className="col-span-full">
                  <Button className="w-full sm:w-auto">Save Changes</Button>
                </div>
              </div>
            ),
          },
          {
            title: "Change Password",
            content: (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                <div className="space-y-2">
                  <Label htmlFor="current" className="text-xs sm:text-sm">Current Password</Label>
                  <Input id="current" type="password" className="text-xs sm:text-sm" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new" className="text-xs sm:text-sm">New Password</Label>
                  <Input id="new" type="password" className="text-xs sm:text-sm" />
                </div>
                <div className="col-span-full">
                  <Button variant="secondary" className="w-full sm:w-auto">Update Password</Button>
                </div>
              </div>
            ),
          },
          {
            title: "Notifications",
            content: (
              <div className="space-y-4 sm:space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-0">
                  <div>
                    <Label className="text-xs sm:text-sm">Email Alerts</Label>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      Receive updates via email
                    </p>
                  </div>
                  <Switch 
                    checked={emailAlerts} 
                    onCheckedChange={setEmailAlerts}
                  />
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-0">
                  <div>
                    <Label className="text-xs sm:text-sm">SMS Alerts</Label>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      Receive updates via text
                    </p>
                  </div>
                  <Switch 
                    checked={smsAlerts} 
                    onCheckedChange={setSmsAlerts}
                  />
                </div>
              </div>
            ),
          },
          {
            title: "Appearance",
            content: (
              <div className="space-y-4 sm:space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-0">
                  <div>
                    <Label className="text-xs sm:text-sm">Theme</Label>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      Choose your preferred theme
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-2">
                    <Button
                      variant={theme === "light" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setTheme("light")}
                      className="w-full sm:w-auto"
                    >
                      Light
                    </Button>
                    <Button
                      variant={theme === "dark" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setTheme("dark")}
                      className="w-full sm:w-auto"
                    >
                      Dark
                    </Button>
                    <Button
                      variant={theme === "system" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setTheme("system")}
                      className="w-full sm:w-auto"
                    >
                      System
                    </Button>
                  </div>
                </div>
                <div className="text-xs sm:text-sm text-muted-foreground">
                  Current theme: <span className="font-medium capitalize">{theme}</span>
                </div>
              </div>
            ),
          },
        ].map((section, i) => (
          <motion.div
            key={i}
            custom={i}
            initial="hidden"
            animate="visible"
            variants={fadeInUp as Variants}
          >
            <Card>
              <CardHeader>
                <CardTitle className="text-lg sm:text-xl">{section.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 sm:space-y-4">{section.content}</CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
