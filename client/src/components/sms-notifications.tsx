import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { RefreshButton } from "@/components/refresh-button";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useFeatures } from "@/hooks/use-features";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useAppDialog } from "@/hooks/use-app-dialog";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { MessageSquare, Plus, Send, FileText, AlertCircle, Users, Loader2 } from "lucide-react";
import { useResourcePermissions, RESOURCES } from "@/hooks/use-resource-permissions";
import { useCurrency } from "@/hooks/use-currency";

interface SMSNotificationsProps {
  organizationId: string;
}

interface SMSMessage {
  id: string;
  notification_type: string;
  recipient_phone: string;
  recipient_name?: string;
  message: string;
  status: string;
  sent_at?: string;
  created_at: string;
}

interface SMSTemplate {
  id: string;
  name: string;
  template_type: string;
  message_template: string;
  is_active: boolean;
}

interface Member {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
}

const smsSchema = z.object({
  recipient_phone: z.string().min(10, "Phone number is required"),
  recipient_name: z.string().optional(),
  message: z.string().min(1, "Message is required").max(160, "Message must be 160 characters or less"),
  notification_type: z.string().default("custom"),
});

const templateSchema = z.object({
  name: z.string().min(1, "Template name is required"),
  template_type: z.string().min(1, "Template type is required"),
  message_template: z.string().min(1, "Message template is required"),
});

const bulkSMSSchema = z.object({
  recipient_group: z.string().min(1, "Please select a recipient group"),
  message: z.string().min(1, "Message is required").max(320, "Message must be 320 characters or less"),
  template_id: z.string().optional(),
});

type SMSFormData = z.infer<typeof smsSchema>;
type TemplateFormData = z.infer<typeof templateSchema>;
type BulkSMSFormData = z.infer<typeof bulkSMSSchema>;

export default function SMSNotifications({ organizationId }: SMSNotificationsProps) {
  const { toast } = useAppDialog();
  const { symbol } = useCurrency(organizationId);
  const [showSMSDialog, setShowSMSDialog] = useState(false);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [bulkSMSResult, setBulkSMSResult] = useState<{ sent: number; failed: number } | null>(null);
  const { canWrite } = useResourcePermissions(organizationId, RESOURCES.SMS);
  const { hasFeature } = useFeatures(organizationId);
  const canBulkSMS = hasFeature("bulk_sms");

  const { data: messages, isLoading: messagesLoading, isError: messagesError } = useQuery<SMSMessage[]>({
    queryKey: ["/api/organizations", organizationId, "sms"],
    queryFn: async () => {
      const res = await fetch(`/api/organizations/${organizationId}/sms`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch SMS messages");
      return res.json();
    },
  });

  const { data: templates, isLoading: templatesLoading } = useQuery<SMSTemplate[]>({
    queryKey: ["/api/organizations", organizationId, "sms", "templates"],
    queryFn: async () => {
      const res = await fetch(`/api/organizations/${organizationId}/sms/templates`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch templates");
      return res.json();
    },
  });

  const { data: members } = useQuery<Member[]>({
    queryKey: ["/api/organizations", organizationId, "members"],
    queryFn: async () => {
      const res = await fetch(`/api/organizations/${organizationId}/members`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch members");
      return res.json();
    },
  });

  const smsForm = useForm<SMSFormData>({
    resolver: zodResolver(smsSchema),
    defaultValues: {
      recipient_phone: "",
      recipient_name: "",
      message: "",
      notification_type: "custom",
    },
  });

  const templateForm = useForm<TemplateFormData>({
    resolver: zodResolver(templateSchema),
    defaultValues: {
      name: "",
      template_type: "payment_reminder",
      message_template: "",
    },
  });

  const bulkSMSForm = useForm<BulkSMSFormData>({
    resolver: zodResolver(bulkSMSSchema),
    defaultValues: {
      recipient_group: "",
      message: "",
      template_id: "",
    },
  });

  const selectedTemplateId = bulkSMSForm.watch("template_id");
  const selectedTemplate = templates?.find(t => t.id === selectedTemplateId);

  const applyTemplate = (templateId: string) => {
    const template = templates?.find(t => t.id === templateId);
    if (template) {
      bulkSMSForm.setValue("message", template.message_template);
    }
  };

  const sendSMSMutation = useMutation({
    mutationFn: async (data: SMSFormData) => {
      return apiRequest("POST", `/api/organizations/${organizationId}/sms`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations", organizationId, "sms"] });
      setShowSMSDialog(false);
      smsForm.reset();
      toast({ title: "SMS sent successfully" });
    },
    onError: () => {
      toast({ title: "Failed to send SMS", variant: "destructive" });
    },
  });

  const createTemplateMutation = useMutation({
    mutationFn: async (data: TemplateFormData) => {
      return apiRequest("POST", `/api/organizations/${organizationId}/sms/templates`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations", organizationId, "sms", "templates"] });
      setShowTemplateDialog(false);
      templateForm.reset();
      toast({ title: "Template created successfully" });
    },
    onError: () => {
      toast({ title: "Failed to create template", variant: "destructive" });
    },
  });

  const seedTemplatesMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/organizations/${organizationId}/sms/templates/seed-defaults`);
      return response.json();
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations", organizationId, "sms", "templates"] });
      toast({ 
        title: "Default templates created", 
        description: `Created ${result.created} templates, ${result.skipped} already existed` 
      });
    },
    onError: () => {
      toast({ title: "Failed to create default templates", variant: "destructive" });
    },
  });

  const sendBulkSMSMutation = useMutation({
    mutationFn: async (data: BulkSMSFormData) => {
      const response = await apiRequest("POST", `/api/organizations/${organizationId}/sms/bulk`, {
        recipient_type: data.recipient_group,
        message: data.message,
      });
      return response.json();
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations", organizationId, "sms"] });
      setBulkSMSResult({ sent: result.sent_count, failed: result.failed_count });
      toast({ 
        title: "Bulk SMS sent", 
        description: `Sent: ${result.sent_count}, Failed: ${result.failed_count}` 
      });
    },
    onError: () => {
      toast({ title: "Failed to send bulk SMS", variant: "destructive" });
    },
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "sent": return "default";
      case "pending": return "secondary";
      case "failed": return "destructive";
      default: return "outline";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold" data-testid="text-sms-title">SMS Notifications</h1>
          <p className="text-muted-foreground">Send and manage SMS messages</p>
        </div>
        <div className="flex items-center gap-2">
          <RefreshButton organizationId={organizationId} />
          {canWrite && (
            <div className="flex gap-2 shrink-0">
              <Button variant="outline" onClick={() => setShowTemplateDialog(true)} data-testid="button-add-template" className="shrink-0">
                <FileText className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">New Template</span>
                <span className="sm:hidden">New</span>
              </Button>
              <Button onClick={() => setShowSMSDialog(true)} data-testid="button-send-sms" className="shrink-0">
                <Send className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Send SMS</span>
                <span className="sm:hidden">Send</span>
              </Button>
            </div>
          )}
        </div>
      </div>

      <Tabs defaultValue="compose" className="w-full">
        <TabsList>
          <TabsTrigger value="compose" className="gap-2">
            <Send className="h-4 w-4" />
            <span className="hidden sm:inline">Compose</span>
            <span className="sm:hidden">Send</span>
          </TabsTrigger>
          <TabsTrigger value="messages" className="gap-2">
            <MessageSquare className="h-4 w-4" />
            <span className="hidden sm:inline">History</span>
            <span className="sm:hidden">Hist</span>
          </TabsTrigger>
          <TabsTrigger value="templates" className="gap-2">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Templates</span>
            <span className="sm:hidden">Tpls</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="compose" className="mt-6">
          {!canBulkSMS ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Bulk SMS Not Available</h3>
                <p className="text-muted-foreground max-w-md">
                  Bulk SMS functionality is not included in your current plan. 
                  Please upgrade to the Professional plan or higher to access this feature.
                </p>
              </CardContent>
            </Card>
          ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Compose Message</CardTitle>
                <CardDescription>Send SMS to a group of members</CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...bulkSMSForm}>
                  <form onSubmit={bulkSMSForm.handleSubmit((data) => sendBulkSMSMutation.mutate(data))} className="space-y-4">
                    <FormField
                      control={bulkSMSForm.control}
                      name="recipient_group"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Recipients</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-recipient-group">
                                <SelectValue placeholder="Select recipient group" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="all_members">All Members</SelectItem>
                              <SelectItem value="active_loans">Members with Active Loans</SelectItem>
                              <SelectItem value="overdue_loans">Members with Overdue Loans</SelectItem>
                              <SelectItem value="pending_payments">Members with Pending Payments</SelectItem>
                              <SelectItem value="recent_deposits">Members with Recent Deposits</SelectItem>
                              <SelectItem value="recent_withdrawals">Members with Recent Withdrawals</SelectItem>
                              <SelectItem value="new_members">New Members (Last 30 Days)</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {templates && templates.length > 0 && (
                      <FormField
                        control={bulkSMSForm.control}
                        name="template_id"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Use Template (Optional)</FormLabel>
                            <Select 
                              onValueChange={(value) => {
                                field.onChange(value);
                                if (value) applyTemplate(value);
                              }} 
                              value={field.value}
                            >
                              <FormControl>
                                <SelectTrigger data-testid="select-template">
                                  <SelectValue placeholder="Select a template" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="">No template</SelectItem>
                                {templates.map((t) => (
                                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}

                    <FormField
                      control={bulkSMSForm.control}
                      name="message"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Message ({320 - (field.value?.length || 0)} chars left)</FormLabel>
                          <FormControl>
                            <Textarea 
                              {...field} 
                              placeholder="Type your message here... Use placeholders like {{name}}, {{amount}}, {{due_date}}"
                              className="resize-none min-h-[120px]"
                              data-testid="input-bulk-message" 
                            />
                          </FormControl>
                          <p className="text-xs text-muted-foreground mt-1">
                            Available placeholders: {"{{name}}"}, {"{{member_number}}"}, {"{{phone}}"}, {"{{amount}}"}, {"{{due_date}}"}
                          </p>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Button 
                      type="submit" 
                      className="w-full" 
                      disabled={sendBulkSMSMutation.isPending}
                      data-testid="button-send-bulk"
                    >
                      {sendBulkSMSMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        <>
                          <Send className="mr-2 h-4 w-4" />
                          Send to Group
                        </>
                      )}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
                <CardDescription>Common SMS scenarios</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3">
                  <Button 
                    variant="outline" 
                    className="justify-start h-auto py-3"
                    onClick={() => {
                      bulkSMSForm.setValue("recipient_group", "overdue_loans");
                      bulkSMSForm.setValue("message", `Dear {{name}}, your loan payment of ${symbol} {{amount}} is overdue. Please make payment immediately to avoid penalties. Thank you.`);
                    }}
                  >
                    <div className="text-left">
                      <div className="font-medium flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-destructive" />
                        Overdue Payment Reminder
                      </div>
                      <p className="text-xs text-muted-foreground font-normal">Send to members with overdue loans</p>
                    </div>
                  </Button>

                  <Button 
                    variant="outline" 
                    className="justify-start h-auto py-3"
                    onClick={() => {
                      bulkSMSForm.setValue("recipient_group", "pending_payments");
                      bulkSMSForm.setValue("message", `Dear {{name}}, your loan payment of ${symbol} {{amount}} is due on {{due_date}}. Please ensure timely payment. Thank you for banking with us.`);
                    }}
                  >
                    <div className="text-left">
                      <div className="font-medium flex items-center gap-2">
                        <MessageSquare className="h-4 w-4 text-yellow-500" />
                        Payment Due Reminder
                      </div>
                      <p className="text-xs text-muted-foreground font-normal">Send to members with upcoming payments</p>
                    </div>
                  </Button>

                  <Button 
                    variant="outline" 
                    className="justify-start h-auto py-3"
                    onClick={() => {
                      bulkSMSForm.setValue("recipient_group", "all_members");
                      bulkSMSForm.setValue("message", "Dear {{name}}, this is a reminder from your sacco. For inquiries, please contact us. Thank you for your continued membership.");
                    }}
                  >
                    <div className="text-left">
                      <div className="font-medium flex items-center gap-2">
                        <Users className="h-4 w-4 text-primary" />
                        General Announcement
                      </div>
                      <p className="text-xs text-muted-foreground font-normal">Send to all members</p>
                    </div>
                  </Button>

                  <Button 
                    variant="outline" 
                    className="justify-start h-auto py-3"
                    onClick={() => {
                      bulkSMSForm.setValue("recipient_group", "new_members");
                      bulkSMSForm.setValue("message", "Welcome to our Sacco, {{name}}! Your member number is {{member_number}}. We're excited to have you. For any assistance, please contact us.");
                    }}
                  >
                    <div className="text-left">
                      <div className="font-medium flex items-center gap-2">
                        <Users className="h-4 w-4 text-green-500" />
                        Welcome New Members
                      </div>
                      <p className="text-xs text-muted-foreground font-normal">Send to members who joined recently</p>
                    </div>
                  </Button>

                  <Button 
                    variant="outline" 
                    className="justify-start h-auto py-3"
                    onClick={() => {
                      bulkSMSForm.setValue("recipient_group", "recent_deposits");
                      bulkSMSForm.setValue("message", `Dear {{name}}, your deposit of ${symbol} {{amount}} has been received and credited to your account. Thank you for saving with us.`);
                    }}
                  >
                    <div className="text-left">
                      <div className="font-medium flex items-center gap-2">
                        <MessageSquare className="h-4 w-4 text-green-600" />
                        Deposit Confirmation
                      </div>
                      <p className="text-xs text-muted-foreground font-normal">Thank members for recent deposits</p>
                    </div>
                  </Button>

                  <Button 
                    variant="outline" 
                    className="justify-start h-auto py-3"
                    onClick={() => {
                      bulkSMSForm.setValue("recipient_group", "recent_withdrawals");
                      bulkSMSForm.setValue("message", `Dear {{name}}, your withdrawal of ${symbol} {{amount}} has been processed. Your new balance will reflect shortly. Thank you for banking with us.`);
                    }}
                  >
                    <div className="text-left">
                      <div className="font-medium flex items-center gap-2">
                        <MessageSquare className="h-4 w-4 text-blue-500" />
                        Withdrawal Notification
                      </div>
                      <p className="text-xs text-muted-foreground font-normal">Notify members about withdrawals</p>
                    </div>
                  </Button>
                </div>

                {bulkSMSResult && (
                  <div className="mt-4 p-4 bg-muted rounded-lg">
                    <h4 className="font-medium mb-2">Last Bulk SMS Result</h4>
                    <div className="flex gap-4 text-sm">
                      <span className="text-green-600">Sent: {bulkSMSResult.sent}</span>
                      <span className="text-destructive">Failed: {bulkSMSResult.failed}</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
          )}
        </TabsContent>

        <TabsContent value="messages" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Message History</CardTitle>
              <CardDescription>All SMS notifications sent</CardDescription>
            </CardHeader>
            <CardContent>
              {messagesLoading ? (
                <Skeleton className="h-48" />
              ) : messagesError ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <AlertCircle className="h-12 w-12 text-destructive mb-4" />
                  <h3 className="font-medium">Failed to load messages</h3>
                  <p className="text-sm text-muted-foreground">Please try again later</p>
                </div>
              ) : messages && messages.length > 0 ? (
                <div className="overflow-x-auto -mx-6 px-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Recipient</TableHead>
                      <TableHead className="hidden sm:table-cell">Phone</TableHead>
                      <TableHead className="hidden md:table-cell">Type</TableHead>
                      <TableHead className="hidden lg:table-cell">Message</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="hidden sm:table-cell">Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {messages.map((msg) => (
                      <TableRow key={msg.id}>
                        <TableCell>
                          <div>{msg.recipient_name || "-"}</div>
                          <div className="text-xs text-muted-foreground sm:hidden">{msg.recipient_phone}</div>
                        </TableCell>
                        <TableCell className="font-mono text-sm hidden sm:table-cell">{msg.recipient_phone}</TableCell>
                        <TableCell className="hidden md:table-cell">
                          <Badge variant="outline" className="capitalize">{msg.notification_type}</Badge>
                        </TableCell>
                        <TableCell className="max-w-xs truncate hidden lg:table-cell">{msg.message}</TableCell>
                        <TableCell>
                          <Badge variant={getStatusColor(msg.status)} className="capitalize">{msg.status}</Badge>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">{new Date(msg.created_at).toLocaleDateString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="font-medium">No messages yet</h3>
                  <p className="text-sm text-muted-foreground mb-4">Send your first SMS notification</p>
                  <Button onClick={() => setShowSMSDialog(true)}>
                    <Send className="mr-2 h-4 w-4" />
                    Send SMS
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="templates" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Message Templates</CardTitle>
              <CardDescription>Reusable SMS templates</CardDescription>
            </CardHeader>
            <CardContent>
              {templatesLoading ? (
                <Skeleton className="h-48" />
              ) : templates && templates.length > 0 ? (
                <div className="overflow-x-auto -mx-6 px-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead className="hidden sm:table-cell">Type</TableHead>
                      <TableHead className="hidden md:table-cell">Template</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {templates.map((template) => (
                      <TableRow key={template.id}>
                        <TableCell className="font-medium">
                          <div>{template.name}</div>
                          <div className="text-xs text-muted-foreground sm:hidden capitalize">{template.template_type.replace("_", " ")}</div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <Badge variant="outline" className="capitalize">{template.template_type.replace("_", " ")}</Badge>
                        </TableCell>
                        <TableCell className="max-w-md truncate hidden md:table-cell">{template.message_template}</TableCell>
                        <TableCell>
                          <Badge variant={template.is_active ? "default" : "secondary"}>
                            {template.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="font-medium">No templates yet</h3>
                  <p className="text-sm text-muted-foreground mb-4">Create default templates or add your own</p>
                  <div className="flex gap-2">
                    <Button onClick={() => seedTemplatesMutation.mutate()} disabled={seedTemplatesMutation.isPending}>
                      {seedTemplatesMutation.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Plus className="mr-2 h-4 w-4" />
                      )}
                      Create Default Templates
                    </Button>
                    <Button variant="outline" onClick={() => setShowTemplateDialog(true)}>
                      <Plus className="mr-2 h-4 w-4" />
                      Custom Template
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={showSMSDialog} onOpenChange={setShowSMSDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send SMS</DialogTitle>
            <DialogDescription>Send a notification to a member</DialogDescription>
          </DialogHeader>
          <Form {...smsForm}>
            <form onSubmit={smsForm.handleSubmit((data) => sendSMSMutation.mutate(data))} className="space-y-4">
              <FormField
                control={smsForm.control}
                name="recipient_phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone Number</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="+254700000000" data-testid="input-phone" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={smsForm.control}
                name="recipient_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Recipient Name (Optional)</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="John Doe" data-testid="input-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={smsForm.control}
                name="message"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Message ({160 - (field.value?.length || 0)} chars left)</FormLabel>
                    <FormControl>
                      <Textarea {...field} placeholder="Your message..." className="resize-none" data-testid="input-message" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowSMSDialog(false)}>Cancel</Button>
                <Button type="submit" disabled={sendSMSMutation.isPending} data-testid="button-submit-sms">
                  {sendSMSMutation.isPending ? "Sending..." : "Send SMS"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={showTemplateDialog} onOpenChange={setShowTemplateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Template</DialogTitle>
            <DialogDescription>Create a reusable SMS template</DialogDescription>
          </DialogHeader>
          <Form {...templateForm}>
            <form onSubmit={templateForm.handleSubmit((data) => createTemplateMutation.mutate(data))} className="space-y-4">
              <FormField
                control={templateForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Template Name</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Payment Reminder" data-testid="input-template-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={templateForm.control}
                name="template_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-template-type">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="payment_reminder">Payment Reminder</SelectItem>
                        <SelectItem value="overdue_notice">Overdue Notice</SelectItem>
                        <SelectItem value="loan_approved">Loan Approved</SelectItem>
                        <SelectItem value="loan_disbursed">Loan Disbursed</SelectItem>
                        <SelectItem value="welcome">Welcome</SelectItem>
                        <SelectItem value="custom">Custom</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={templateForm.control}
                name="message_template"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Message Template</FormLabel>
                    <FormControl>
                      <Textarea {...field} placeholder="Dear {name}, your payment of {amount} is due..." className="resize-none" data-testid="input-template-message" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowTemplateDialog(false)}>Cancel</Button>
                <Button type="submit" disabled={createTemplateMutation.isPending} data-testid="button-submit-template">
                  {createTemplateMutation.isPending ? "Creating..." : "Create Template"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
