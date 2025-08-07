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
    <div className="p-6 md:p-10 max-w-4xl mx-auto space-y-8 bg-white dark:bg-card">
      <motion.h1
        className="text-3xl font-bold mb-4 text-foreground"
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" placeholder="Enter your name" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" placeholder="Enter your email" />
              </div>
              <div className="col-span-full">
                <Button>Save Changes</Button>
              </div>
            </div>
          ),
        },
        {
          title: "Change Password",
          content: (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="current">Current Password</Label>
                <Input id="current" type="password" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new">New Password</Label>
                <Input id="new" type="password" />
              </div>
              <div className="col-span-full">
                <Button variant="secondary">Update Password</Button>
              </div>
            </div>
          ),
        },
        {
          title: "Notifications",
          content: (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Email Alerts</Label>
                  <p className="text-sm text-muted-foreground">
                    Receive updates via email
                  </p>
                </div>
                <Switch 
                  checked={emailAlerts} 
                  onCheckedChange={setEmailAlerts}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>SMS Alerts</Label>
                  <p className="text-sm text-muted-foreground">
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
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Theme</Label>
                  <p className="text-sm text-muted-foreground">
                    Choose your preferred theme
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant={theme === "light" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setTheme("light")}
                  >
                    Light
                  </Button>
                  <Button
                    variant={theme === "dark" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setTheme("dark")}
                  >
                    Dark
                  </Button>
                  <Button
                    variant={theme === "system" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setTheme("system")}
                  >
                    System
                  </Button>
                </div>
              </div>
              <div className="text-sm text-muted-foreground">
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
              <CardTitle>{section.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">{section.content}</CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}
