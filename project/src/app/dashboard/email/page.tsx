"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Send, Users, Mail, User, Building2, Search, Filter, Plus, Trash2, Edit3, Eye, Copy, Download, Upload, Settings, History, BarChart3 } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  status: string;
}

interface EmailTemplate {
  id: number;
  name: string;
  subject: string;
  body: string;
  category: string;
}

const EmailPage = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<Set<number>>(new Set());
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [emailType, setEmailType] = useState<'single' | 'bulk'>('single');
  const [searchTerm, setSearchTerm] = useState("");
  const [filterRole, setFilterRole] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [showTemplates, setShowTemplates] = useState(false);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [emailHistory, setEmailHistory] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [templateVariables, setTemplateVariables] = useState<{[key: string]: string}>({});

  // Fetch users and templates from API
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Get token from cookies
        const token = document.cookie
          .split("; ")
          .find((row) => row.startsWith("token="))
          ?.split("=")[1];

        if (token) {
          // Fetch users
          const usersResponse = await fetch("/api/email/users", {
            headers: {
              "Authorization": `Bearer ${token}`
            }
          });

          if (usersResponse.ok) {
            const usersData = await usersResponse.json();
            setUsers(usersData.data.users);
          }

          // Fetch templates
          const templatesResponse = await fetch("/api/email/templates", {
            headers: {
              "Authorization": `Bearer ${token}`
            }
          });

          if (templatesResponse.ok) {
            const templatesData = await templatesResponse.json();
            setTemplates(templatesData.data);
          }
        }
      } catch (error) {
        console.error("Error fetching data:", error);
        toast.error("Failed to load users and templates");
      }
    };

    fetchData();
  }, []);

  // Add some sample users if none exist (for demo purposes)
  useEffect(() => {
    if (users.length === 0) {
      const sampleUsers = [
        { id: 1, name: "John Doe", email: "john@example.com", role: "Customer", status: "Active" },
        { id: 2, name: "Jane Smith", email: "jane@example.com", role: "Vendor", status: "Active" },
        { id: 3, name: "Bob Johnson", email: "bob@example.com", role: "Customer", status: "Inactive" },
        { id: 4, name: "Alice Brown", email: "alice@example.com", role: "Vendor", status: "Active" },
        { id: 5, name: "Charlie Wilson", email: "charlie@example.com", role: "Customer", status: "Active" },
      ];
      setUsers(sampleUsers);
    }
  }, [users.length]);

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = !filterRole || user.role === filterRole;
    const matchesStatus = !filterStatus || user.status === filterStatus;
    
    return matchesSearch && matchesRole && matchesStatus;
  });

  const handleUserSelection = (userId: number) => {
    const newSelection = new Set(selectedUsers);
    if (newSelection.has(userId)) {
      newSelection.delete(userId);
    } else {
      newSelection.add(userId);
    }
    setSelectedUsers(newSelection);
  };

  const handleSelectAll = () => {
    if (selectedUsers.size === filteredUsers.length) {
      setSelectedUsers(new Set());
    } else {
      setSelectedUsers(new Set(filteredUsers.map(user => user.id)));
    }
  };

  const handleTemplateSelect = (template: EmailTemplate) => {
    setSelectedTemplate(template);
    setEmailSubject(template.subject);
    setEmailBody(template.body);
    setShowTemplates(false);
  };

  const processTemplateVariables = (text: string, userData?: any) => {
    if (!text) return '';
    
    let processedText = text;
    const user = userData || {};
    
    // Replace common placeholders
    const placeholders = {
      '{{name}}': user.name || '{{name}}',
      '{{email}}': user.email || '{{email}}',
      '{{role}}': user.role || '{{role}}',
      '{{status}}': user.status || '{{status}}',
      '{{company}}': user.company || '{{company}}',
      '{{date}}': new Date().toLocaleDateString(),
      '{{time}}': new Date().toLocaleTimeString(),
    };

    Object.entries(placeholders).forEach(([placeholder, value]) => {
      processedText = processedText.replace(new RegExp(placeholder, 'g'), value);
    });

    return processedText;
  };

  const handlePreviewEmail = () => {
    if (selectedUsers.size === 0) {
      toast.error("Please select at least one recipient to preview");
      return;
    }
    setShowPreview(true);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard!");
  };

  const handleSendEmail = async () => {
    if (selectedUsers.size === 0) {
      toast.error("Please select at least one recipient");
      return;
    }

    if (!emailSubject.trim()) {
      toast.error("Please enter an email subject");
      return;
    }

    if (!emailBody.trim()) {
      toast.error("Please enter an email body");
      return;
    }

    setIsLoading(true);

    try {
      // Get token from cookies
      const token = document.cookie
        .split("; ")
        .find((row) => row.startsWith("token="))
        ?.split("=")[1];

      if (!token) {
        toast.error("Authentication required. Please log in again.");
        return;
      }

      // Prepare recipients data
      const recipients = users
        .filter(user => selectedUsers.has(user.id))
        .map(user => ({ id: user.id, email: user.email }));

      // Send email via API
      const response = await fetch("/api/email/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          recipients,
          subject: emailSubject,
          body: emailBody,
          emailType: emailType
        })
      });

      if (response.ok) {
        const result = await response.json();
        toast.success(result.message);
        
        // Reset form
        setSelectedUsers(new Set());
        setEmailSubject("");
        setEmailBody("");
        setSelectedTemplate(null);
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || "Failed to send email");
      }
    } catch (error) {
      console.error("Error sending email:", error);
      toast.error("Failed to send email. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const getSelectedUsersInfo = () => {
    const selected = users.filter(user => selectedUsers.has(user.id));
    return {
      count: selected.length,
      emails: selected.map(user => user.email).join(", "),
      roles: [...new Set(selected.map(user => user.role))]
    };
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800 p-3 sm:p-4 md:p-6">
      <div className="max-w-[95%] xl:max-w-[98%] 2xl:max-w-[99%] mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-6 md:mb-8"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Mail className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-800 dark:text-white">
                  Email Management
                </h1>
                <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300">
                  Send customized emails to your users, customers, and vendors
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowHistory(true)}
                className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                <History className="w-4 h-4" />
                History
              </button>
              <Link
                href="/dashboard/email/templates"
                className="flex items-center gap-2 px-3 py-2 text-sm bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
              >
                <Settings className="w-4 h-4" />
                Templates
              </Link>
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Email Composition Panel */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="xl:col-span-2"
          >
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-800 dark:text-white">
                  Compose Email
                </h2>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handlePreviewEmail}
                    className="flex items-center gap-2 px-3 py-2 text-sm bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-lg hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors"
                  >
                    <Eye className="w-4 h-4" />
                    Preview
                  </button>
                  <button
                    onClick={() => setShowTemplates(!showTemplates)}
                    className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  >
                    <Edit3 className="w-4 h-4" />
                    Templates
                  </button>
                </div>
              </div>

              {/* Email Type Selection */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Email Type
                </label>
                <div className="flex gap-3">
                  <button
                    onClick={() => setEmailType('single')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      emailType === 'single'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    Single Email
                  </button>
                  <button
                    onClick={() => setEmailType('bulk')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      emailType === 'bulk'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    Bulk Email
                  </button>
                </div>
              </div>

              {/* Recipients Info */}
              {selectedUsers.size > 0 && (
                <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="w-4 h-4 text-blue-600" />
                    <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
                      {getSelectedUsersInfo().count} recipient(s) selected
                    </span>
                  </div>
                  <div className="text-sm text-blue-700 dark:text-blue-300">
                    <div className="mb-1">
                      <strong>Emails:</strong> {getSelectedUsersInfo().emails}
                    </div>
                    <div>
                      <strong>Roles:</strong> {getSelectedUsersInfo().roles.join(", ")}
                    </div>
                  </div>
                </div>
              )}

              {/* Email Subject */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Subject *
                </label>
                <input
                  type="text"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  placeholder="Enter email subject..."
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                />
              </div>

              {/* Template Variables */}
              {selectedTemplate && (
                <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
                    Template Variables
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {['{{name}}', '{{email}}', '{{role}}', '{{status}}', '{{company}}', '{{date}}', '{{time}}'].map((variable) => (
                      <button
                        key={variable}
                        onClick={() => copyToClipboard(variable)}
                        className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-700 transition-colors"
                      >
                        {variable}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Email Body */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Message *
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => copyToClipboard(emailBody)}
                      className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                    >
                      <Copy className="w-3 h-3" />
                      Copy
                    </button>
                  </div>
                </div>
                <textarea
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                  placeholder="Enter your message here... You can use {{name}}, {{email}}, {{role}}, {{status}} as placeholders"
                  rows={8}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors resize-none"
                />
                <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  Available placeholders: {'{name}'}, {'{email}'}, {'{role}'}, {'{status}'}, {'{company}'}, {'{date}'}, {'{time}'}
                </div>
              </div>

              {/* Send Button */}
              <button
                onClick={handleSendEmail}
                disabled={isLoading || selectedUsers.size === 0}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <Send className="w-5 h-5" />
                )}
                {isLoading ? "Sending..." : `Send Email${selectedUsers.size > 0 ? ` (${selectedUsers.size})` : ""}`}
              </button>
            </div>
          </motion.div>

          {/* User Selection Panel */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="xl:col-span-1"
          >
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-800 dark:text-white">
                  Select Recipients
                </h2>
                <button
                  onClick={handleSelectAll}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
                >
                  {selectedUsers.size === filteredUsers.length ? "Deselect All" : "Select All"}
                </button>
              </div>

              {/* Search and Filters */}
              <div className="mb-6 space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search users..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={filterRole}
                    onChange={(e) => setFilterRole(e.target.value)}
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                  >
                    <option value="">All Roles</option>
                    <option value="Customer">Customer</option>
                    <option value="Vendor">Vendor</option>
                    <option value="User">User</option>
                  </select>

                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                  >
                    <option value="">All Status</option>
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>

              {/* Users List */}
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {filteredUsers.map((user) => (
                  <div
                    key={user.id}
                    className={`p-3 rounded-lg border cursor-pointer transition-all duration-200 ${
                      selectedUsers.has(user.id)
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                    }`}
                    onClick={() => handleUserSelection(user.id)}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={selectedUsers.has(user.id)}
                        onChange={() => handleUserSelection(user.id)}
                        className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="w-8 h-8 bg-gray-200 dark:bg-gray-600 rounded-full flex items-center justify-center">
                            <User className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                              {user.name}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                              {user.email}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <span className={`px-2 py-1 rounded-full ${
                            user.role === 'Customer' 
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                              : user.role === 'Vendor'
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                              : 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
                          }`}>
                            {user.role}
                          </span>
                          <span className={`px-2 py-1 rounded-full ${
                            user.status === 'Active'
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                              : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                          }`}>
                            {user.status}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {filteredUsers.length === 0 && (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <Users className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                  <p>No users found</p>
                  <p className="text-sm">Try adjusting your search or filters</p>
                </div>
              )}
            </div>
          </motion.div>
        </div>

        {/* Email Preview Modal */}
        {showPreview && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
            onClick={() => setShowPreview(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white">
                  Email Preview
                </h2>
                <button
                  onClick={() => setShowPreview(false)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
                <div className="space-y-6">
                  <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <h3 className="font-semibold text-gray-800 dark:text-white mb-2">Recipients ({selectedUsers.size})</h3>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {users.filter(user => selectedUsers.has(user.id)).map(user => user.email).join(", ")}
                    </div>
                  </div>
                  
                  <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <h3 className="font-semibold text-gray-800 dark:text-white mb-2">Subject</h3>
                    <div className="text-sm text-gray-600 dark:text-gray-400">{emailSubject}</div>
                  </div>

                  <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <h3 className="font-semibold text-gray-800 dark:text-white mb-2">Message Preview</h3>
                    <div className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
                      {processTemplateVariables(emailBody, users.find(user => selectedUsers.has(user.id)) || {})}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Email History Modal */}
        {showHistory && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
            onClick={() => setShowHistory(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white">
                  Email History
                </h2>
                <button
                  onClick={() => setShowHistory(false)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
                <div className="text-center py-12">
                  <BarChart3 className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                    Email History Coming Soon
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    Track your email campaigns and view delivery statistics
                  </p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Email Templates Modal */}
        {showTemplates && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
            onClick={() => setShowTemplates(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white">
                  Email Templates
                </h2>
                <button
                  onClick={() => setShowTemplates(false)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {templates.map((template) => (
                    <div
                      key={template.id}
                      className="p-4 border border-gray-200 dark:border-gray-600 rounded-lg hover:border-blue-300 dark:hover:border-blue-600 cursor-pointer transition-colors"
                      onClick={() => handleTemplateSelect(template)}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          template.category === 'Welcome' 
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                            : template.category === 'Shipment'
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                            : 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400'
                        }`}>
                          {template.category}
                        </span>
                      </div>
                      <h3 className="font-medium text-gray-900 dark:text-white mb-2">
                        {template.name}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        {template.subject}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-500 line-clamp-3">
                        {template.body}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default EmailPage;
