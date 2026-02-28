import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
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
import { useAppDialog } from "@/hooks/use-app-dialog";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { getErrorMessage } from "@/lib/error-utils";
import { ArrowLeft, Building2, User, Users, Mail, IdCard, Shield, FileUp, Trash2, Upload, FileText, CheckCircle } from "lucide-react";
import type { Branch } from "@shared/tenant-types";

interface AddStaffPageProps {
  organizationId: string;
  onBack: () => void;
}

interface RoleData {
  id: string;
  name: string;
  description: string;
  is_system: boolean;
  permissions: string[];
}

const staffSchema = z.object({
  first_name: z.string().min(1, "First name is required"),
  last_name: z.string().min(1, "Last name is required"),
  username: z.string().min(1, "Username is required").regex(/^[a-zA-Z0-9._-]+$/, "Username can only contain letters, numbers, dots, underscores, and hyphens"),
  secondary_email: z.string().email("Valid email is required").optional().or(z.literal("")),
  phone: z.string().optional(),
  password: z.string().min(6, "Password is required (min 6 characters)"),
  role: z.string().default("staff"),
  branch_id: z.string().min(1, "Branch is required"),
  national_id: z.string().min(1, "National ID is required"),
  date_of_birth: z.string().min(1, "Date of birth is required"),
  gender: z.string().optional(),
  next_of_kin_name: z.string().optional(),
  next_of_kin_phone: z.string().optional(),
  next_of_kin_relationship: z.string().optional(),
});

type StaffFormData = z.infer<typeof staffSchema>;

interface StaffDocumentData {
  id: string;
  document_type: string;
  document_type_label: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  description: string | null;
  is_verified: boolean;
  created_at: string;
}

const STAFF_DOCUMENT_TYPES = [
  { value: "passport_photo", label: "Passport Photo" },
  { value: "id_front", label: "ID Card (Front)" },
  { value: "id_back", label: "ID Card (Back)" },
  { value: "cv_resume", label: "CV / Resume" },
  { value: "academic_certificate", label: "Academic Certificate" },
  { value: "professional_certificate", label: "Professional Certificate" },
  { value: "appointment_letter", label: "Appointment Letter" },
  { value: "contract", label: "Employment Contract" },
  { value: "kra_pin", label: "KRA PIN Certificate" },
  { value: "good_conduct", label: "Good Conduct Certificate" },
  { value: "other", label: "Other Document" },
];

export default function AddStaffPage({ organizationId, onBack }: AddStaffPageProps) {
  const { toast } = useAppDialog();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [createdStaffId, setCreatedStaffId] = useState<string | null>(null);
  const [pendingFiles, setPendingFiles] = useState<Array<{ file: File; documentType: string; description: string }>>([]);
  const [selectedDocType, setSelectedDocType] = useState("");
  const [docDescription, setDocDescription] = useState("");
  const [uploadedDocs, setUploadedDocs] = useState<StaffDocumentData[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const userBranchId = (user as any)?.branchId;
  const userRole = (user as any)?.role;
  const canSeeAllBranches = !userBranchId || userRole === 'admin' || userRole === 'owner';

  const { data: branches } = useQuery<Branch[]>({
    queryKey: ["/api/organizations", organizationId, "branches"],
    queryFn: async () => {
      const res = await fetch(`/api/organizations/${organizationId}/branches`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch branches");
      return res.json();
    },
  });

  const { data: roles } = useQuery<RoleData[]>({
    queryKey: ["/api/organizations", organizationId, "roles"],
    queryFn: async () => {
      const res = await fetch(`/api/organizations/${organizationId}/roles`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch roles");
      return res.json();
    },
  });

  const { data: organization } = useQuery<{ id: string; name: string }>({
    queryKey: ["/api/organizations", organizationId],
    queryFn: async () => {
      const res = await fetch(`/api/organizations/${organizationId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch organization");
      return res.json();
    },
  });

  const orgDomain = organization?.name?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'organization';

  const form = useForm<StaffFormData>({
    resolver: zodResolver(staffSchema),
    defaultValues: {
      first_name: "",
      last_name: "",
      username: "",
      secondary_email: "",
      phone: "",
      password: "",
      role: "staff",
      branch_id: userBranchId || "",
      national_id: "",
      date_of_birth: "",
      gender: "",
      next_of_kin_name: "",
      next_of_kin_phone: "",
      next_of_kin_relationship: "",
    },
  });

  useEffect(() => {
    if (!canSeeAllBranches && userBranchId) {
      form.setValue("branch_id", userBranchId);
    }
  }, [userBranchId, canSeeAllBranches]);

  useEffect(() => {
    if (branches && branches.length === 1 && !form.getValues("branch_id")) {
      form.setValue("branch_id", branches[0].id);
    }
  }, [branches, form]);

  const pendingFilesRef = useRef(pendingFiles);
  pendingFilesRef.current = pendingFiles;

  const createMutation = useMutation({
    mutationFn: async (data: StaffFormData) => {
      const submitData = { ...data };
      if (!canSeeAllBranches && userBranchId) {
        submitData.branch_id = userBranchId;
      }
      const res = await apiRequest("POST", `/api/organizations/${organizationId}/staff`, submitData);
      return res.json();
    },
    onSuccess: (staffData: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations", organizationId, "staff"] });
      const filesToUpload = [...pendingFilesRef.current];
      if (filesToUpload.length > 0) {
        setCreatedStaffId(staffData.id);
        uploadPendingDocuments(staffData.id, filesToUpload);
      } else {
        toast({ title: "Staff member added", description: "The new staff member has been registered successfully." });
        onBack();
      }
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: getErrorMessage(error), variant: "destructive" });
    },
  });

  const addFileToQueue = (file: File) => {
    if (!selectedDocType) {
      toast({ title: "Select document type", description: "Please select a document type before adding a file.", variant: "destructive" });
      return;
    }
    setPendingFiles(prev => [...prev, { file, documentType: selectedDocType, description: docDescription }]);
    setSelectedDocType("");
    setDocDescription("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeFileFromQueue = (index: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== index));
  };

  const uploadPendingDocuments = async (staffId: string, filesToUpload: Array<{ file: File; documentType: string; description: string }>) => {
    setIsUploading(true);
    const uploaded: StaffDocumentData[] = [];
    for (const item of filesToUpload) {
      try {
        const formData = new FormData();
        formData.append("file", item.file);
        formData.append("document_type", item.documentType);
        if (item.description) formData.append("description", item.description);
        const res = await fetch(`/api/organizations/${organizationId}/staff/${staffId}/documents`, {
          method: "POST",
          body: formData,
          credentials: "include",
        });
        if (res.ok) {
          const doc = await res.json();
          uploaded.push(doc);
        }
      } catch (e) {
        console.error("Failed to upload document:", e);
      }
    }
    setUploadedDocs(uploaded);
    setIsUploading(false);
    setPendingFiles([]);
    const failCount = filesToUpload.length - uploaded.length;
    toast({
      title: "Staff member added",
      description: failCount > 0
        ? `Staff created. ${uploaded.length} documents uploaded, ${failCount} failed.`
        : `Staff created with ${uploaded.length} documents uploaded successfully.`,
    });
    onBack();
  };

  const handleSubmit = (data: StaffFormData) => {
    createMutation.mutate(data);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold">Add New Staff Member</h1>
            <p className="text-muted-foreground">Register a new staff member to your organization</p>
          </div>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                <CardTitle>Basic Information</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField control={form.control} name="first_name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>First Name <span className="text-destructive">*</span></FormLabel>
                    <FormControl><Input {...field} placeholder="Enter first name" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="last_name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Last Name <span className="text-destructive">*</span></FormLabel>
                    <FormControl><Input {...field} placeholder="Enter last name" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-primary" />
                <CardTitle>Contact Details</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField control={form.control} name="username" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Work Email <span className="text-destructive">*</span></FormLabel>
                    <FormControl>
                      <div className="flex">
                        <Input {...field} placeholder="username" className="rounded-r-none" />
                        <span className="inline-flex items-center px-3 bg-muted border border-l-0 border-input rounded-r-md text-sm text-muted-foreground">
                          @{orgDomain}.com
                        </span>
                      </div>
                    </FormControl>
                    <FormDescription>This will be their login email</FormDescription>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="phone" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone Number</FormLabel>
                    <FormControl><Input {...field} placeholder="e.g., 0712345678" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <FormField control={form.control} name="secondary_email" render={({ field }) => (
                <FormItem>
                  <FormLabel>Personal Email (Optional)</FormLabel>
                  <FormControl><Input {...field} type="email" placeholder="Personal email for payslip CC" /></FormControl>
                  <FormDescription>Payslip emails will be CC'd to this address</FormDescription>
                  <FormMessage />
                </FormItem>
              )} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                <CardTitle>Security</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <FormField control={form.control} name="password" render={({ field }) => (
                <FormItem>
                  <FormLabel>Login Password <span className="text-destructive">*</span></FormLabel>
                  <FormControl><Input {...field} type="password" placeholder="Minimum 6 characters" /></FormControl>
                  <FormDescription>This password allows the staff member to log into the system</FormDescription>
                  <FormMessage />
                </FormItem>
              )} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <IdCard className="h-5 w-5 text-primary" />
                <CardTitle>Personal Information</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField control={form.control} name="national_id" render={({ field }) => (
                  <FormItem>
                    <FormLabel>National ID Number <span className="text-destructive">*</span></FormLabel>
                    <FormControl><Input {...field} placeholder="e.g., 12345678" /></FormControl>
                    <FormDescription>Used as payslip PDF password</FormDescription>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="date_of_birth" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date of Birth <span className="text-destructive">*</span></FormLabel>
                    <FormControl><Input {...field} type="date" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField control={form.control} name="gender" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Gender</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ""}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Select gender" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                <CardTitle>Next of Kin</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField control={form.control} name="next_of_kin_name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl><Input {...field} placeholder="Next of kin full name" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="next_of_kin_phone" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone Number</FormLabel>
                    <FormControl><Input {...field} placeholder="Phone number" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField control={form.control} name="next_of_kin_relationship" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Relationship</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ""}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Select relationship" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="spouse">Spouse</SelectItem>
                        <SelectItem value="parent">Parent</SelectItem>
                        <SelectItem value="sibling">Sibling</SelectItem>
                        <SelectItem value="child">Child</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                <CardTitle>Assignment</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField control={form.control} name="role" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role <span className="text-destructive">*</span></FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {(roles || []).map((role) => (
                          <SelectItem key={role.name} value={role.name}>
                            {role.name.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                {!(branches && branches.length === 1) && (
                <FormField control={form.control} name="branch_id" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Branch <span className="text-destructive">*</span></FormLabel>
                    {canSeeAllBranches ? (
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger><SelectValue placeholder="Select branch" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {branches?.map((branch) => (
                            <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="text-sm text-muted-foreground p-3 bg-muted rounded-md border">
                        {branches?.find(b => b.id === userBranchId)?.name || "Your assigned branch"}
                      </div>
                    )}
                    <FormMessage />
                  </FormItem>
                )} />
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <FileUp className="h-5 w-5 text-primary" />
                <CardTitle>Documents</CardTitle>
              </div>
              <CardDescription>Upload staff documents such as ID copies, certificates, and contracts. Files will be uploaded when you register the staff member.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-medium">Document Type</label>
                  <Select value={selectedDocType} onValueChange={setSelectedDocType}>
                    <SelectTrigger className="mt-1.5">
                      <SelectValue placeholder="Select document type" />
                    </SelectTrigger>
                    <SelectContent>
                      {STAFF_DOCUMENT_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Description (Optional)</label>
                  <Input
                    className="mt-1.5"
                    value={docDescription}
                    onChange={(e) => setDocDescription(e.target.value)}
                    placeholder="Brief description"
                  />
                </div>
              </div>
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept=".jpg,.jpeg,.png,.gif,.pdf,.doc,.docx"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) addFileToQueue(file);
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={!selectedDocType}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Choose File
                </Button>
                <p className="text-xs text-muted-foreground mt-1">Supported: JPG, PNG, PDF, DOC. Max 5MB per file.</p>
              </div>

              {pendingFiles.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Queued Documents ({pendingFiles.length})</p>
                  {pendingFiles.map((item, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                      <div className="flex items-center gap-3 min-w-0">
                        <FileText className="h-4 w-4 text-primary flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{item.file.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {STAFF_DOCUMENT_TYPES.find(t => t.value === item.documentType)?.label} · {formatFileSize(item.file.size)}
                          </p>
                        </div>
                      </div>
                      <Button type="button" variant="ghost" size="icon" onClick={() => removeFileFromQueue(index)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex justify-end gap-4">
            <Button type="button" variant="outline" onClick={onBack}>
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending || isUploading}>
              {isUploading ? "Uploading Documents..." : createMutation.isPending ? "Registering..." : "Register Staff Member"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
