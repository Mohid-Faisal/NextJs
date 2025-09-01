"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Plus, Edit3, Trash2, Mail, Search, Filter, Save, X, Copy, Eye, Download, Upload, Star, Clock } from "lucide-react";
import { toast } from "sonner";

interface EmailTemplate {
  id: number;
  name: string;
  subject: string;
  body: string;
  category: string;
  createdAt?: string;
  isDefault?: boolean;
  usageCount?: number;
  lastUsed?: string;
}

const EmailTemplatesPage = () => {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    subject: "",
    body: "",
    category: ""
  });
  const [isLoading, setIsLoading] = useState(false);

  // Enhanced categories
  const categories = [
    "Welcome", 
    "Shipment", 
    "Payment", 
    "Notification", 
    "Marketing", 
    "Follow-up",
    "Reminder",
    "Thank You",
    "Announcement",
    "Other"
  ];

  // Fetch templates
  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const token = document.cookie
          .split("; ")
          .find((row) => row.startsWith("token="))
          ?.split("=")[1];

        if (token) {
          const response = await fetch("/api/email/templates", {
            headers: {
              "Authorization": `Bearer ${token}`
            }
          });

          if (response.ok) {
            const data = await response.json();
            setTemplates(data.data || []);
          } else {
            console.error("Failed to fetch templates:", response.status);
          }
        } else {
          console.log("No authentication token found");
        }
      } catch (error) {
        console.error("Error fetching templates:", error);
      }
    };

    fetchTemplates();
  }, []);

  // Add sample templates if none exist (for demo purposes)
  useEffect(() => {
    if (templates.length === 0) {
      const sampleTemplates = [
        {
          id: 1,
          name: "Welcome Email",
          subject: "Welcome to Our Service!",
          body: "Dear {{name}},\n\nWelcome to our platform! We're excited to have you on board.\n\nBest regards,\nThe Team",
          category: "Welcome",
          createdAt: new Date().toISOString(),
          usageCount: 5,
          lastUsed: new Date().toISOString()
        },
        {
          id: 2,
          name: "Shipment Update",
          subject: "Your Shipment Status Update",
          body: "Dear {{name}},\n\nYour shipment {{tracking_id}} has been updated.\n\nCurrent Status: {{status}}\n\nThank you for choosing our service.\n\nBest regards,\nThe Team",
          category: "Shipment",
          createdAt: new Date().toISOString(),
          usageCount: 12,
          lastUsed: new Date(Date.now() - 86400000).toISOString()
        },
        {
          id: 3,
          name: "Payment Reminder",
          subject: "Payment Reminder",
          body: "Dear {{name}},\n\nThis is a friendly reminder that payment for invoice {{invoice_number}} is due.\n\nAmount: {{amount}}\nDue Date: {{due_date}}\n\nPlease process the payment at your earliest convenience.\n\nBest regards,\nThe Team",
          category: "Payment",
          createdAt: new Date().toISOString(),
          usageCount: 8,
          lastUsed: new Date(Date.now() - 172800000).toISOString()
        }
      ];
      setTemplates(sampleTemplates);
    }
  }, [templates.length]);

  const filteredTemplates = templates.filter(template => {
    const matchesSearch = template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         template.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         template.body.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = !filterCategory || template.category === filterCategory;
    
    return matchesSearch && matchesCategory;
  });

  const handleCreateTemplate = async () => {
    console.log("Creating template with formData:", formData);
    
    // Validate form data
    if (!formData || !formData.name || !formData.subject || !formData.body || !formData.category) {
      toast.error("Please fill in all fields");
      return;
    }

    if (!formData.name.trim() || !formData.subject.trim() || !formData.body.trim() || !formData.category.trim()) {
      toast.error("Please fill in all fields");
      return;
    }

    setIsLoading(true);

    try {
      const token = document.cookie
        .split("; ")
        .find((row) => row.startsWith("token="))
        ?.split("=")[1];

      // For demo purposes, create template locally if no token
      if (!token) {
        try {
          console.log("Creating template locally, templates:", templates);
          const maxId = templates.length > 0 ? Math.max(...templates.map(t => t.id)) : 0;
          console.log("Max ID:", maxId);
          
          const newTemplate = {
            id: maxId + 1,
            name: formData.name.trim(),
            subject: formData.subject.trim(),
            body: formData.body.trim(),
            category: formData.category.trim(),
            createdAt: new Date().toISOString(),
            usageCount: 0
          };
          
          console.log("New template:", newTemplate);
          setTemplates([...templates, newTemplate]);
          toast.success("Template created successfully (demo mode)");
          setShowCreateForm(false);
          resetForm();
        } catch (error) {
          console.error("Error creating template locally:", error);
          toast.error("Failed to create template");
        } finally {
          setIsLoading(false);
        }
        return;
      }

      const response = await fetch("/api/email/templates", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        const result = await response.json();
        toast.success("Template created successfully");
        setTemplates([...templates, result.data]);
        setShowCreateForm(false);
        resetForm();
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || "Failed to create template");
      }
    } catch (error) {
      console.error("Error creating template:", error);
      toast.error("Failed to create template. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditTemplate = (template: EmailTemplate) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      subject: template.subject,
      body: template.body,
      category: template.category
    });
    setShowCreateForm(true);
  };

  const handleUpdateTemplate = async () => {
    if (!editingTemplate) return;

    setIsLoading(true);

    try {
      const token = document.cookie
        .split("; ")
        .find((row) => row.startsWith("token="))
        ?.split("=")[1];

      if (!token) {
        toast.error("Authentication required");
        return;
      }

      const response = await fetch(`/api/email/templates`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          id: editingTemplate.id,
          ...formData
        })
      });

      if (response.ok) {
        toast.success("Template updated successfully");
        setTemplates(templates.map(t => t.id === editingTemplate.id ? { ...t, ...formData } : t));
        setShowCreateForm(false);
        setEditingTemplate(null);
        resetForm();
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || "Failed to update template");
      }
    } catch (error) {
      console.error("Error updating template:", error);
      toast.error("Failed to update template");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteTemplate = async (templateId: number) => {
    if (!confirm("Are you sure you want to delete this template?")) return;

    try {
      const token = document.cookie
        .split("; ")
        .find((row) => row.startsWith("token="))
        ?.split("=")[1];

      if (!token) {
        toast.error("Authentication required");
        return;
      }

      const response = await fetch(`/api/email/templates?id=${templateId}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });

      if (response.ok) {
        toast.success("Template deleted successfully");
        setTemplates(templates.filter(t => t.id !== templateId));
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || "Failed to delete template");
      }
    } catch (error) {
      console.error("Error deleting template:", error);
      toast.error("Failed to delete template");
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      subject: "",
      body: "",
      category: ""
    });
  };

  const handleCancel = () => {
    setShowCreateForm(false);
    setEditingTemplate(null);
    resetForm();
  };

  const handleDuplicateTemplate = (template: EmailTemplate) => {
    setFormData({
      name: `${template.name} (Copy)`,
      subject: template.subject,
      body: template.body,
      category: template.category
    });
    setShowCreateForm(true);
  };

  const handleExportTemplate = (template: EmailTemplate) => {
    const dataStr = JSON.stringify(template, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = `${template.name.replace(/\s+/g, '_')}_template.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    
    toast.success("Template exported successfully!");
  };

  const handleImportTemplate = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const template = JSON.parse(e.target?.result as string);
            setFormData({
              name: template.name,
              subject: template.subject,
              body: template.body,
              category: template.category
            });
            setShowCreateForm(true);
            toast.success("Template imported successfully!");
          } catch (error) {
            toast.error("Invalid template file");
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
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
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Mail className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-800 dark:text-white">
                  Email Templates
                </h1>
                <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300">
                  Manage your email templates for consistent communication
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleImportTemplate}
                className="flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                <Upload className="w-4 h-4" />
                Import
              </button>
              <button
                onClick={() => {
                  try {
                    console.log("New Template button clicked");
                    setShowCreateForm(true);
                  } catch (error) {
                    console.error("Error in New Template button:", error);
                  }
                }}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                New Template
              </button>
            </div>
          </div>
        </motion.div>

        {/* Search and Filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="mb-6"
        >
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search templates..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                />
              </div>

              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
              >
                <option value="">All Categories</option>
                {categories.map(category => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>

              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {filteredTemplates.length} template(s)
                </span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Templates Grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {filteredTemplates.map((template, index) => (
            <motion.div
              key={template.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 * index }}
              className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-6 hover:shadow-xl transition-all duration-300"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-2">
                    {template.name}
                  </h3>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    template.category === 'Welcome' 
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                      : template.category === 'Shipment'
                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                      : template.category === 'Payment'
                      ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400'
                      : 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
                  }`}>
                    {template.category}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleDuplicateTemplate(template)}
                    className="p-2 text-gray-600 dark:text-gray-400 hover:text-green-600 dark:hover:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/30 rounded-lg transition-colors"
                    title="Duplicate template"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleExportTemplate(template)}
                    className="p-2 text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/30 rounded-lg transition-colors"
                    title="Export template"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleEditTemplate(template)}
                    className="p-2 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                    title="Edit template"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteTemplate(template.id)}
                    className="p-2 text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                    title="Delete template"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Subject:</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{template.subject}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Content:</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-3">
                    {template.body}
                  </p>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
                <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>Created: {template.createdAt ? new Date(template.createdAt).toLocaleDateString() : 'Unknown'}</span>
                  </div>
                  {template.usageCount !== undefined && (
                    <div className="flex items-center gap-1">
                      <Star className="w-3 h-3" />
                      <span>Used {template.usageCount} times</span>
                    </div>
                  )}
                </div>
                {template.lastUsed && (
                  <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Last used: {new Date(template.lastUsed).toLocaleDateString()}
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </motion.div>

        {filteredTemplates.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-12"
          >
            <Mail className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              No templates found
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              {searchTerm || filterCategory ? "Try adjusting your search or filters" : "Create your first email template to get started"}
            </p>
          </motion.div>
        )}

        {/* Create/Edit Template Modal */}
        {showCreateForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
            onClick={handleCancel}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white">
                  {editingTemplate ? 'Edit Template' : 'Create New Template'}
                </h2>
                <button
                  onClick={handleCancel}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <X className="w-6 h-6 text-gray-500" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Template Name *
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Enter template name..."
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Category *
                    </label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                    >
                      <option value="">Select category</option>
                      {categories.map(category => (
                        <option key={category} value={category}>{category}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Subject *
                    </label>
                    <input
                      type="text"
                      value={formData.subject}
                      onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                      placeholder="Enter email subject..."
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Email Body *
                    </label>
                    <textarea
                      value={formData.body}
                      onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                      placeholder="Enter email body... You can use {{name}}, {{email}}, {{company}} as placeholders"
                      rows={8}
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors resize-none"
                    />
                    <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                      Available placeholders: {`{{name}}, {{email}}, {{role}}, {{status}}`}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 mt-8">
                  <button
                    onClick={handleCancel}
                    className="px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      try {
                        console.log("Submit button clicked, editingTemplate:", editingTemplate);
                        if (editingTemplate) {
                          handleUpdateTemplate();
                        } else {
                          handleCreateTemplate();
                        }
                      } catch (error) {
                        console.error("Error in submit button:", error);
                      }
                    }}
                    disabled={isLoading}
                    className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                  >
                    {isLoading ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    {isLoading ? "Saving..." : (editingTemplate ? "Update Template" : "Create Template")}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default EmailTemplatesPage;
