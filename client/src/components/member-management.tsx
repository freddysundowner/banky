import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { RefreshButton } from "@/components/refresh-button";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { getErrorMessage } from "@/lib/error-utils";
import { 
  Users, 
  Plus, 
  Pencil, 
  Trash2, 
  ArrowLeft, 
  User, 
  MapPin, 
  Heart, 
  Briefcase, 
  Building2, 
  FileText,
  Eye,
  Download,
  CheckCircle,
  XCircle,
  Upload,
  Camera,
  File,
  Image,
  Shield,
  X,
  Search,
  ChevronLeft,
  ChevronRight,
  Smartphone,
  Activity,
  Clock,
  WifiOff,
  Loader2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import type { Member, Branch } from "@shared/tenant-types";
import { useResourcePermissions, RESOURCES } from "@/hooks/use-resource-permissions";
import { useCurrency } from "@/hooks/use-currency";
import MemberStatementPage from "./member-statement-page";

interface MemberManagementProps {
  organizationId: string;
}

const memberSchema = z.object({
  // Personal Information
  first_name: z.string().min(1, "First name is required"),
  middle_name: z.string().optional(),
  last_name: z.string().min(1, "Last name is required"),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().min(1, "Phone is required"),
  phone_secondary: z.string().optional(),
  id_type: z.string().optional(),
  id_number: z.string().optional(),
  kra_pin: z.string().optional(),
  date_of_birth: z.string().optional(),
  gender: z.string().optional(),
  marital_status: z.string().optional(),
  nationality: z.string().optional(),
  
  // Address Information
  address: z.string().optional(),
  postal_code: z.string().optional(),
  city: z.string().optional(),
  county: z.string().optional(),
  country: z.string().optional(),
  
  // Next of Kin 1
  next_of_kin_name: z.string().optional(),
  next_of_kin_phone: z.string().optional(),
  next_of_kin_relationship: z.string().optional(),
  next_of_kin_id_number: z.string().optional(),
  next_of_kin_address: z.string().optional(),
  
  // Next of Kin 2
  next_of_kin_2_name: z.string().optional(),
  next_of_kin_2_phone: z.string().optional(),
  next_of_kin_2_relationship: z.string().optional(),
  
  // Employment Information
  employment_status: z.string().optional(),
  employer_name: z.string().optional(),
  employer_address: z.string().optional(),
  employer_phone: z.string().optional(),
  occupation: z.string().optional(),
  monthly_income: z.string().optional(),
  employment_date: z.string().optional(),
  
  // Bank Details
  bank_name: z.string().optional(),
  bank_branch: z.string().optional(),
  bank_account_number: z.string().optional(),
  bank_account_name: z.string().optional(),
  
  // Membership Details
  branch_id: z.string().optional(),
  membership_type: z.string().optional(),
  registration_fee_paid: z.string().optional(),
  share_capital: z.string().optional(),
});

type MemberFormData = z.infer<typeof memberSchema>;

type ViewMode = "list" | "new" | "edit" | "view" | "statement";

const kenyanCounties = [
  "Baringo", "Bomet", "Bungoma", "Busia", "Elgeyo-Marakwet", "Embu", "Garissa",
  "Homa Bay", "Isiolo", "Kajiado", "Kakamega", "Kericho", "Kiambu", "Kilifi",
  "Kirinyaga", "Kisii", "Kisumu", "Kitui", "Kwale", "Laikipia", "Lamu", "Machakos",
  "Makueni", "Mandera", "Marsabit", "Meru", "Migori", "Mombasa", "Murang'a",
  "Nairobi", "Nakuru", "Nandi", "Narok", "Nyamira", "Nyandarua", "Nyeri", "Samburu",
  "Siaya", "Taita-Taveta", "Tana River", "Tharaka-Nithi", "Trans-Nzoia", "Turkana",
  "Uasin Gishu", "Vihiga", "Wajir", "West Pokot"
];

const kenyanBanks = [
  "Kenya Commercial Bank (KCB)", "Equity Bank", "Co-operative Bank", "Absa Bank Kenya",
  "Standard Chartered Bank", "NCBA Bank", "I&M Bank", "Diamond Trust Bank", "Family Bank",
  "Stanbic Bank", "Bank of Africa", "National Bank of Kenya", "Prime Bank", "Sidian Bank",
  "Victoria Commercial Bank", "Guardian Bank", "Gulf African Bank", "First Community Bank",
  "Credit Bank", "Consolidated Bank", "Development Bank of Kenya", "Citibank"
];

const documentTypes = [
  { value: "passport_photo", label: "Passport Photo", icon: Camera },
  { value: "id_front", label: "ID Card (Front)", icon: FileText },
  { value: "id_back", label: "ID Card (Back)", icon: FileText },
  { value: "signature", label: "Signature", icon: FileText },
  { value: "proof_of_address", label: "Proof of Address", icon: MapPin },
  { value: "payslip", label: "Payslip", icon: File },
  { value: "bank_statement", label: "Bank Statement", icon: Building2 },
  { value: "other", label: "Other Document", icon: File },
];

interface MemberDocument {
  id: string;
  document_type: string;
  document_type_label: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  description: string | null;
  is_verified: boolean;
  verified_at: string | null;
  created_at: string;
}

function MemberDocumentsSection({ organizationId, memberId }: { organizationId: string; memberId: string }) {
  const { toast } = useToast();
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [uploadDocType, setUploadDocType] = useState("");
  const [uploadDescription, setUploadDescription] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const { data: documents, isLoading } = useQuery<MemberDocument[]>({
    queryKey: ["/api/organizations", organizationId, "members", memberId, "documents"],
    queryFn: async () => {
      const res = await fetch(`/api/organizations/${organizationId}/members/${memberId}/documents`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch documents");
      return res.json();
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async ({ file, documentType, description }: { file: File; documentType: string; description: string }) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("document_type", documentType);
      formData.append("description", description);
      
      const res = await fetch(`/api/organizations/${organizationId}/members/${memberId}/documents`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to upload document");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations", organizationId, "members", memberId, "documents"] });
      setShowUploadDialog(false);
      setSelectedFile(null);
      setUploadDocType("");
      setUploadDescription("");
      setPreviewUrl(null);
      toast({ title: "Document uploaded successfully" });
    },
    onError: (error: unknown) => {
      toast({ title: "Failed to upload document", description: getErrorMessage(error), variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (documentId: string) => {
      const res = await fetch(`/api/organizations/${organizationId}/members/${memberId}/documents/${documentId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete document");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations", organizationId, "members", memberId, "documents"] });
      toast({ title: "Document deleted" });
    },
    onError: () => {
      toast({ title: "Failed to delete document", variant: "destructive" });
    },
  });

  const verifyMutation = useMutation({
    mutationFn: async (documentId: string) => {
      const res = await fetch(`/api/organizations/${organizationId}/members/${memberId}/documents/${documentId}/verify`, {
        method: "PUT",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to verify document");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations", organizationId, "members", memberId, "documents"] });
      toast({ title: "Document verified" });
    },
    onError: () => {
      toast({ title: "Failed to verify document", variant: "destructive" });
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      if (file.type.startsWith("image/")) {
        const url = URL.createObjectURL(file);
        setPreviewUrl(url);
      } else {
        setPreviewUrl(null);
      }
    }
  };

  const handleUpload = () => {
    if (!selectedFile || !uploadDocType) return;
    uploadMutation.mutate({
      file: selectedFile,
      documentType: uploadDocType,
      description: uploadDescription,
    });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getDocumentIcon = (docType: string, mimeType: string) => {
    if (mimeType?.startsWith("image/")) return Image;
    const found = documentTypes.find(d => d.value === docType);
    return found?.icon || File;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Documents & ID Copies
          </CardTitle>
          <Button size="sm" onClick={() => setShowUploadDialog(true)} data-testid="button-upload-document">
            <Upload className="h-4 w-4 mr-1" />
            Upload
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : documents && documents.length > 0 ? (
          <div className="space-y-3">
            {documents.map((doc) => {
              const IconComponent = getDocumentIcon(doc.document_type, doc.mime_type);
              return (
                <div key={doc.id} className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 bg-muted/50 rounded-lg" data-testid={`document-item-${doc.id}`}>
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2 bg-background rounded-lg shrink-0">
                      <IconComponent className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{doc.document_type_label}</div>
                      <div className="text-sm text-muted-foreground truncate">{doc.file_name}</div>
                      <div className="text-xs text-muted-foreground">{formatFileSize(doc.file_size)}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-auto">
                    {doc.is_verified ? (
                      <Badge variant="default" className="gap-1">
                        <Shield className="h-3 w-3" />
                        Verified
                      </Badge>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => verifyMutation.mutate(doc.id)}
                        disabled={verifyMutation.isPending}
                        data-testid={`button-verify-${doc.id}`}
                      >
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Verify
                      </Button>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => window.open(`/api/organizations/${organizationId}/members/${memberId}/documents/${doc.id}/file`, "_blank")}
                      data-testid={`button-view-${doc.id}`}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <a 
                      href={`/api/organizations/${organizationId}/members/${memberId}/documents/${doc.id}/file?download=1`} 
                      download
                    >
                      <Button
                        size="icon"
                        variant="ghost"
                        data-testid={`button-download-${doc.id}`}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </a>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => deleteMutation.mutate(doc.id)}
                      disabled={deleteMutation.isPending}
                      data-testid={`button-delete-${doc.id}`}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-6 text-muted-foreground">
            <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No documents uploaded yet</p>
            <p className="text-sm">Upload ID copies, passport photos, and other documents</p>
          </div>
        )}
      </CardContent>

      <Dialog open={showUploadDialog} onOpenChange={(open) => {
        if (!open) {
          setSelectedFile(null);
          setUploadDocType("");
          setUploadDescription("");
          setPreviewUrl(null);
        }
        setShowUploadDialog(open);
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Upload Document</DialogTitle>
            <DialogDescription>
              Upload a document or ID copy for this member
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Document Type <span className="text-destructive">*</span></label>
              <Select value={uploadDocType} onValueChange={setUploadDocType}>
                <SelectTrigger data-testid="select-document-type">
                  <SelectValue placeholder="Select document type..." />
                </SelectTrigger>
                <SelectContent>
                  {documentTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Select File <span className="text-destructive">*</span></label>
              <Input
                type="file"
                accept="image/*,.pdf,.doc,.docx"
                onChange={handleFileSelect}
                data-testid="input-file-upload"
              />
              <p className="text-xs text-muted-foreground">Accepted: Images, PDF, Word documents. Max 5MB.</p>
            </div>

            {previewUrl && (
              <div className="relative">
                <img src={previewUrl} alt="Preview" className="w-full h-40 object-contain rounded-lg bg-muted" />
                <Button
                  size="sm"
                  variant="secondary"
                  className="absolute top-2 right-2"
                  onClick={() => {
                    setSelectedFile(null);
                    setPreviewUrl(null);
                  }}
                  data-testid="button-remove-preview"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium">Description (Optional)</label>
              <Input
                value={uploadDescription}
                onChange={(e) => setUploadDescription(e.target.value)}
                placeholder="Add a note about this document..."
                data-testid="input-document-description"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowUploadDialog(false)} data-testid="button-cancel-upload">
              Cancel
            </Button>
            <Button
              onClick={handleUpload}
              disabled={!selectedFile || !uploadDocType || uploadMutation.isPending}
              data-testid="button-confirm-upload"
            >
              {uploadMutation.isPending ? "Uploading..." : "Upload Document"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export default function MemberManagement({ organizationId }: MemberManagementProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const { currency, symbol, formatAmount } = useCurrency(organizationId);
  const { canWrite, hasPermission } = useResourcePermissions(organizationId, RESOURCES.MEMBERS);
  const canActivate = hasPermission("members:activate");
  const canSuspend = hasPermission("members:suspend");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [deleting, setDeleting] = useState<Member | null>(null);
  const [idConflict, setIdConflict] = useState<{
    member_name: string;
    member_number: string;
    status: string;
    pendingData: any;
  } | null>(null);
  const [activeTab, setActiveTab] = useState("personal");
  const [branchFilter, setBranchFilter] = useState<string>("all");
  const [memberSearch, setMemberSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [memberPage, setMemberPage] = useState(1);
  const MEMBERS_PER_PAGE = 20;
  const [showMobileSessions, setShowMobileSessions] = useState(false);
  const [showMobileActivateDialog, setShowMobileActivateDialog] = useState(false);
  const [mobileActivateResult, setMobileActivateResult] = useState<{
    activation_code: string;
    expires_hours: number;
    sms_sent: boolean;
    member_phone: string;
  } | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(memberSearch);
    }, 400);
    return () => clearTimeout(timer);
  }, [memberSearch]);

  // Determine if user can see multiple branches (admin/owner have no branch restriction)
  const userBranchId = (user as any)?.branchId;
  const userRole = (user as any)?.role;
  const canSeeAllBranches = !userBranchId || userRole === 'admin' || userRole === 'owner';

  interface PaginatedMembers {
    items: Member[];
    total: number;
    page: number;
    per_page: number;
    total_pages: number;
  }

  const { data: membersData, isLoading } = useQuery<PaginatedMembers>({
    queryKey: ["/api/organizations", organizationId, "members", branchFilter, debouncedSearch, memberPage],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (branchFilter && branchFilter !== "all") {
        params.append("branch_id", branchFilter);
      }
      if (debouncedSearch.trim()) {
        params.append("search", debouncedSearch.trim());
      }
      params.append("page", memberPage.toString());
      params.append("per_page", MEMBERS_PER_PAGE.toString());
      const url = `/api/organizations/${organizationId}/members?${params.toString()}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch members");
      return res.json();
    },
  });

  const members = membersData?.items;
  const totalMembers = membersData?.total || 0;
  const totalPages = membersData?.total_pages || 0;

  const { data: branches } = useQuery<Branch[]>({
    queryKey: ["/api/organizations", organizationId, "branches"],
    queryFn: async () => {
      const res = await fetch(`/api/organizations/${organizationId}/branches`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch branches");
      return res.json();
    },
  });

  useEffect(() => {
    if (branches && branches.length === 1) {
      setBranchFilter(branches[0].id);
    }
  }, [branches]);

  const { data: organization } = useQuery<{ id: string; name: string; email?: string; phone?: string; address?: string }>({
    queryKey: ["/api/organizations", organizationId],
    queryFn: async () => {
      const res = await fetch(`/api/organizations/${organizationId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch organization");
      return res.json();
    },
  });

  const { data: mobileActivity, isLoading: mobileActivityLoading } = useQuery<{
    mobile_banking_active: boolean;
    mobile_device_id: string | null;
    activation_pending: boolean;
    activation_expires_at: string | null;
    sessions: Array<{
      id: string;
      device_id: string;
      device_name: string | null;
      ip_address: string | null;
      login_at: string | null;
      last_active: string | null;
      is_active: boolean;
      logout_at: string | null;
    }>;
  }>({
    queryKey: ["/api/mobile/admin", organizationId, "members", selectedMember?.id, "activity"],
    queryFn: async () => {
      const res = await fetch(
        `/api/mobile/admin/${organizationId}/members/${selectedMember!.id}/activity`,
        { credentials: "include" }
      );
      if (!res.ok) throw new Error("Failed to fetch mobile activity");
      return res.json();
    },
    enabled: viewMode === "view" && !!selectedMember,
  });

  const form = useForm<MemberFormData>({
    resolver: zodResolver(memberSchema),
    defaultValues: {
      first_name: "",
      middle_name: "",
      last_name: "",
      email: "",
      phone: "",
      phone_secondary: "",
      id_type: "",
      id_number: "",
      kra_pin: "",
      date_of_birth: "",
      gender: "",
      marital_status: "",
      nationality: "Kenyan",
      address: "",
      postal_code: "",
      city: "",
      county: "",
      country: "Kenya",
      next_of_kin_name: "",
      next_of_kin_phone: "",
      next_of_kin_relationship: "",
      next_of_kin_id_number: "",
      next_of_kin_address: "",
      next_of_kin_2_name: "",
      next_of_kin_2_phone: "",
      next_of_kin_2_relationship: "",
      employment_status: "",
      employer_name: "",
      employer_address: "",
      employer_phone: "",
      occupation: "",
      monthly_income: "",
      employment_date: "",
      bank_name: "",
      bank_branch: "",
      bank_account_number: "",
      bank_account_name: "",
      branch_id: "",
      membership_type: "ordinary",
      registration_fee_paid: "",
      share_capital: "",
    },
  });

  const hasOnlyOneBranch = branches && branches.length === 1;

  useEffect(() => {
    if (hasOnlyOneBranch && !form.getValues("branch_id")) {
      form.setValue("branch_id", branches[0].id);
    }
  }, [hasOnlyOneBranch, branches, form]);

  const createMutation = useMutation({
    mutationFn: async (data: MemberFormData) => {
      const submitData = { ...data };
      if (!canSeeAllBranches && userBranchId) {
        submitData.branch_id = userBranchId;
      }
      if (hasOnlyOneBranch && !submitData.branch_id) {
        submitData.branch_id = branches[0].id;
      }
      if (canSeeAllBranches && !submitData.branch_id) {
        throw new Error("Please select a branch");
      }
      const res = await apiRequest("POST", `/api/organizations/${organizationId}/members`, submitData);
      return res.json();
    },
    onSuccess: (newMember) => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations", organizationId, "members"] });
      toast({ title: "Success", description: "Member registered successfully. You can continue filling other tabs." });
      // Switch to edit mode with the newly created member so user can fill other tabs
      if (newMember) {
        setSelectedMember(newMember);
        setViewMode("edit");
        // Populate form with the new member data
        form.reset({
          first_name: newMember.first_name || "",
          middle_name: newMember.middle_name || "",
          last_name: newMember.last_name || "",
          email: newMember.email || "",
          phone: newMember.phone || "",
          phone_secondary: newMember.phone_secondary || "",
          id_type: newMember.id_type || "",
          id_number: newMember.id_number || "",
          kra_pin: newMember.kra_pin || "",
          date_of_birth: newMember.date_of_birth || "",
          gender: newMember.gender || "",
          marital_status: newMember.marital_status || "",
          nationality: newMember.nationality || "",
          address: newMember.address || "",
          postal_code: newMember.postal_code || "",
          city: newMember.city || "",
          county: newMember.county || "",
          country: newMember.country || "",
          next_of_kin_name: newMember.next_of_kin_name || "",
          next_of_kin_phone: newMember.next_of_kin_phone || "",
          next_of_kin_relationship: newMember.next_of_kin_relationship || "",
          next_of_kin_id_number: newMember.next_of_kin_id_number || "",
          next_of_kin_address: newMember.next_of_kin_address || "",
          next_of_kin_2_name: newMember.next_of_kin_2_name || "",
          next_of_kin_2_phone: newMember.next_of_kin_2_phone || "",
          next_of_kin_2_relationship: newMember.next_of_kin_2_relationship || "",
          next_of_kin_2_id_number: newMember.next_of_kin_2_id_number || "",
          next_of_kin_2_address: newMember.next_of_kin_2_address || "",
          employer_name: newMember.employer_name || "",
          employer_address: newMember.employer_address || "",
          employer_phone: newMember.employer_phone || "",
          job_title: newMember.job_title || "",
          employment_type: newMember.employment_type || "",
          monthly_income: newMember.monthly_income || "",
          branch_id: newMember.branch_id || "",
          notes: newMember.notes || "",
        });
      }
    },
    onError: (error: unknown) => {
      toast({ title: "Failed to create member", description: getErrorMessage(error), variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: MemberFormData) => {
      const res = await apiRequest("PATCH", `/api/organizations/${organizationId}/members/${selectedMember!.id}`, data);
      return res.json();
    },
    onSuccess: (updatedMember) => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations", organizationId, "members"] });
      toast({ title: "Success", description: "Member updated successfully" });
      // Stay on current view, just update the selected member data
      if (updatedMember) {
        setSelectedMember(updatedMember);
      }
    },
    onError: (error: unknown) => {
      toast({ title: "Failed to update member", description: getErrorMessage(error), variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/organizations/${organizationId}/members/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations", organizationId, "members"] });
      toast({ title: "Success", description: "Member deleted successfully" });
      setDeleting(null);
    },
    onError: (error: unknown) => {
      toast({ title: "Failed to delete member", description: getErrorMessage(error), variant: "destructive" });
    },
  });

  const activateMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("PUT", `/api/organizations/${organizationId}/members/${id}/activate`);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations", organizationId, "members"] });
      setSelectedMember(data);
      toast({ title: "Success", description: "Member account activated successfully" });
    },
    onError: (error: unknown) => {
      toast({ title: "Failed to activate member", description: getErrorMessage(error), variant: "destructive" });
    },
  });

  const suspendMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("PUT", `/api/organizations/${organizationId}/members/${id}/suspend`);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations", organizationId, "members"] });
      setSelectedMember(data);
      toast({ title: "Success", description: "Member account suspended" });
    },
    onError: (error: unknown) => {
      toast({ title: "Failed to suspend member", description: getErrorMessage(error), variant: "destructive" });
    },
  });

  const activateMobileMutation = useMutation({
    mutationFn: async (memberId: string) => {
      const res = await apiRequest("POST", `/api/mobile/admin/${organizationId}/members/${memberId}/activate`);
      return res.json();
    },
    onSuccess: (data) => {
      setMobileActivateResult(data);
      queryClient.invalidateQueries({ queryKey: ["/api/mobile/admin", organizationId, "members", selectedMember?.id, "activity"] });
    },
    onError: (error: unknown) => {
      toast({ title: "Failed to activate mobile banking", description: getErrorMessage(error), variant: "destructive" });
    },
  });

  const deactivateMobileMutation = useMutation({
    mutationFn: async (memberId: string) => {
      const res = await apiRequest("DELETE", `/api/mobile/admin/${organizationId}/members/${memberId}/deactivate-mobile`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/mobile/admin", organizationId, "members", selectedMember?.id, "activity"] });
      if (selectedMember) {
        setSelectedMember({ ...selectedMember, mobile_banking_active: false, mobile_device_id: null });
      }
      toast({ title: "Mobile banking deactivated", description: "Member will need to re-activate to use the app." });
    },
    onError: (error: unknown) => {
      toast({ title: "Failed to deactivate mobile banking", description: getErrorMessage(error), variant: "destructive" });
    },
  });

  const resetForm = () => {
    form.reset({
      first_name: "",
      middle_name: "",
      last_name: "",
      email: "",
      phone: "",
      phone_secondary: "",
      id_type: "",
      id_number: "",
      kra_pin: "",
      date_of_birth: "",
      gender: "",
      marital_status: "",
      nationality: "Kenyan",
      address: "",
      postal_code: "",
      city: "",
      county: "",
      country: "Kenya",
      next_of_kin_name: "",
      next_of_kin_phone: "",
      next_of_kin_relationship: "",
      next_of_kin_id_number: "",
      next_of_kin_address: "",
      next_of_kin_2_name: "",
      next_of_kin_2_phone: "",
      next_of_kin_2_relationship: "",
      employment_status: "",
      employer_name: "",
      employer_address: "",
      employer_phone: "",
      occupation: "",
      monthly_income: "",
      employment_date: "",
      bank_name: "",
      bank_branch: "",
      bank_account_number: "",
      bank_account_name: "",
      branch_id: "",
      membership_type: "ordinary",
      registration_fee_paid: "",
      share_capital: "",
    });
    setSelectedMember(null);
    setActiveTab("personal");
  };

  const handleNewMember = () => {
    resetForm();
    setViewMode("new");
  };

  const handleEditMember = (member: Member) => {
    setSelectedMember(member);
    form.reset({
      first_name: member.first_name || "",
      middle_name: member.middle_name || "",
      last_name: member.last_name || "",
      email: member.email || "",
      phone: member.phone || "",
      phone_secondary: member.phone_secondary || "",
      id_type: member.id_type || "",
      id_number: member.id_number || "",
      kra_pin: member.kra_pin || "",
      date_of_birth: member.date_of_birth || "",
      gender: member.gender || "",
      marital_status: member.marital_status || "",
      nationality: member.nationality || "Kenyan",
      address: member.address || "",
      postal_code: member.postal_code || "",
      city: member.city || "",
      county: member.county || "",
      country: member.country || "Kenya",
      next_of_kin_name: member.next_of_kin_name || "",
      next_of_kin_phone: member.next_of_kin_phone || "",
      next_of_kin_relationship: member.next_of_kin_relationship || "",
      next_of_kin_id_number: member.next_of_kin_id_number || "",
      next_of_kin_address: member.next_of_kin_address || "",
      next_of_kin_2_name: member.next_of_kin_2_name || "",
      next_of_kin_2_phone: member.next_of_kin_2_phone || "",
      next_of_kin_2_relationship: member.next_of_kin_2_relationship || "",
      employment_status: member.employment_status || "",
      employer_name: member.employer_name || "",
      employer_address: member.employer_address || "",
      employer_phone: member.employer_phone || "",
      occupation: member.occupation || "",
      monthly_income: member.monthly_income || "",
      employment_date: member.employment_date || "",
      bank_name: member.bank_name || "",
      bank_branch: member.bank_branch || "",
      bank_account_number: member.bank_account_number || "",
      bank_account_name: member.bank_account_name || "",
      branch_id: member.branch_id || "",
      membership_type: member.membership_type || "ordinary",
      registration_fee_paid: member.registration_fee_paid || "",
      share_capital: member.share_capital || "",
    });
    setViewMode("edit");
  };

  const handleViewMember = (member: Member) => {
    setSelectedMember(member);
    setViewMode("view");
  };

  const transformFormData = (data: MemberFormData) => ({
    ...data,
    email: data.email || null,
    middle_name: data.middle_name || null,
    phone_secondary: data.phone_secondary || null,
    id_type: data.id_type || null,
    id_number: data.id_number || null,
    kra_pin: data.kra_pin || null,
    date_of_birth: data.date_of_birth || null,
    gender: data.gender || null,
    marital_status: data.marital_status || null,
    nationality: data.nationality || null,
    address: data.address || null,
    postal_code: data.postal_code || null,
    city: data.city || null,
    county: data.county || null,
    country: data.country || null,
    next_of_kin_name: data.next_of_kin_name || null,
    next_of_kin_phone: data.next_of_kin_phone || null,
    next_of_kin_relationship: data.next_of_kin_relationship || null,
    next_of_kin_id_number: data.next_of_kin_id_number || null,
    next_of_kin_address: data.next_of_kin_address || null,
    next_of_kin_2_name: data.next_of_kin_2_name || null,
    next_of_kin_2_phone: data.next_of_kin_2_phone || null,
    next_of_kin_2_relationship: data.next_of_kin_2_relationship || null,
    employment_status: data.employment_status || null,
    employer_name: data.employer_name || null,
    employer_address: data.employer_address || null,
    employer_phone: data.employer_phone || null,
    occupation: data.occupation || null,
    monthly_income: data.monthly_income ? parseFloat(data.monthly_income) : null,
    employment_date: data.employment_date || null,
    bank_name: data.bank_name || null,
    bank_branch: data.bank_branch || null,
    bank_account_number: data.bank_account_number || null,
    bank_account_name: data.bank_account_name || null,
    branch_id: data.branch_id || null,
    membership_type: data.membership_type || null,
    registration_fee_paid: data.registration_fee_paid ? parseFloat(data.registration_fee_paid) : null,
    share_capital: data.share_capital ? parseFloat(data.share_capital) : null,
  });

  const submitMember = (transformedData: any) => {
    if (viewMode === "edit" && selectedMember) {
      updateMutation.mutate(transformedData);
    } else {
      createMutation.mutate(transformedData);
    }
  };

  const handleSubmit = async (data: MemberFormData) => {
    const transformedData = transformFormData(data);
    const idNumber = transformedData.id_number;
    
    if (idNumber) {
      const isEditing = viewMode === "edit" && selectedMember;
      const currentIdNumber = isEditing ? selectedMember?.id_number : null;
      
      if (idNumber !== currentIdNumber) {
        try {
          const excludeParam = isEditing ? `?exclude_member_id=${selectedMember!.id}` : "";
          const res = await fetch(
            `/api/organizations/${organizationId}/members/check-id/${encodeURIComponent(idNumber)}${excludeParam}`,
            { credentials: "include" }
          );
          if (res.ok) {
            const result = await res.json();
            if (result.conflict) {
              if (!result.can_proceed) {
                toast({
                  title: "Duplicate ID Number",
                  description: `A member with ID number '${idNumber}' already exists (${result.member_name} - ${result.member_number}, Status: ${result.status})`,
                  variant: "destructive",
                });
                return;
              }
              setIdConflict({
                member_name: result.member_name,
                member_number: result.member_number,
                status: result.status,
                pendingData: transformedData,
              });
              return;
            }
          }
        } catch {
          // If check fails, proceed - backend will still validate
        }
      }
    }
    
    submitMember(transformedData);
  };

  const handleBack = () => {
    resetForm();
    setViewMode("list");
  };

  const downloadAccountStatement = async (member: Member) => {
    try {
      const res = await fetch(`/api/organizations/${organizationId}/reports/member-statement/${member.id}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch statement");
      const data = await res.json();
      
      const escapeCSV = (val: any) => {
        const str = String(val ?? "-");
        if (str.includes(",") || str.includes('"') || str.includes("\n")) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };
      const safeParse = (val: any) => {
        const parsed = parseFloat(String(val || "0"));
        return isNaN(parsed) ? 0 : parsed;
      };
      
      const lines = [
        "MEMBER ACCOUNT STATEMENT",
        "",
        `Member Number: ${data.member?.member_number || "-"}`,
        `Name: ${data.member?.name || "-"}`,
        `Phone: ${data.member?.phone || "-"}`,
        `Email: ${data.member?.email || "-"}`,
        "",
        `Period: ${data.period?.start_date || "-"} to ${data.period?.end_date || "-"}`,
        "",
        "ACCOUNT BALANCES",
        `Savings: ${symbol} ${safeParse(data.balances?.savings).toLocaleString()}`,
        `Shares: ${symbol} ${safeParse(data.balances?.shares).toLocaleString()}`,
        `Deposits: ${symbol} ${safeParse(data.balances?.deposits).toLocaleString()}`,
        `Total Loan Outstanding: ${symbol} ${safeParse(data.balances?.total_loan_outstanding).toLocaleString()}`,
        "",
        "TRANSACTION HISTORY",
        "Date,Type,Account,Amount,Balance,Reference,Description",
        ...(data.transactions || []).map((t: any) => 
          [
            new Date(t.date).toLocaleDateString(),
            escapeCSV(t.type),
            escapeCSV(t.account),
            safeParse(t.amount),
            safeParse(t.balance_after),
            escapeCSV(t.reference),
            escapeCSV(t.description),
          ].join(",")
        ),
        "",
        "LOANS SUMMARY",
        "Loan Number,Amount,Status,Outstanding,Disbursed Date",
        ...(data.loans_summary || []).map((l: any) =>
          [
            escapeCSV(l.loan_number),
            safeParse(l.amount),
            escapeCSV(l.status),
            safeParse(l.outstanding),
            escapeCSV(l.disbursed_at),
          ].join(",")
        ),
        "",
        `Generated: ${new Date().toLocaleString()}`,
      ];
      
      const csv = lines.join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `account-statement-${data.member?.member_number || "unknown"}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      
      toast({ title: "Downloaded", description: "Account statement downloaded successfully" });
    } catch (error) {
      toast({ title: "Error", description: "Failed to download statement", variant: "destructive" });
    }
  };

  const downloadBlankForm = (formType: "membership" | "loan") => {
    const formContent = formType === "membership" 
      ? generateMembershipForm()
      : generateLoanForm();
    
    const blob = new Blob([formContent], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `blank_${formType}_form.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast({ title: "Downloaded", description: `Blank ${formType} form downloaded successfully` });
  };

  const generateMembershipForm = () => {
    const orgName = organization?.name || "SACCO / MICROFINANCE";
    const orgEmail = organization?.email || "";
    const orgPhone = organization?.phone || "";
    const orgAddress = organization?.address || "";
    
    return `<!DOCTYPE html>
<html>
<head>
  <title>Membership Application Form - ${orgName}</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
    .org-header { text-align: center; margin-bottom: 20px; border-bottom: 3px solid #333; padding-bottom: 15px; }
    .org-name { font-size: 24px; font-weight: bold; margin-bottom: 5px; text-transform: uppercase; }
    .org-details { font-size: 12px; color: #555; }
    h1 { text-align: center; margin-top: 10px; font-size: 18px; }
    h2 { background: #f0f0f0; padding: 8px; margin-top: 20px; }
    .row { display: flex; margin-bottom: 10px; }
    .field { flex: 1; margin-right: 15px; }
    .field:last-child { margin-right: 0; }
    label { display: block; font-weight: bold; margin-bottom: 3px; font-size: 12px; }
    .line { border-bottom: 1px solid #333; min-height: 25px; }
    .checkbox-group { display: flex; gap: 20px; }
    .checkbox { display: flex; align-items: center; gap: 5px; }
    .box { width: 15px; height: 15px; border: 1px solid #333; }
    .signature-area { display: flex; justify-content: space-between; margin-top: 40px; }
    .signature-box { text-align: center; width: 200px; }
    .signature-line { border-top: 1px solid #333; margin-top: 50px; padding-top: 5px; }
    .form-number { text-align: right; font-size: 11px; color: #666; }
    @media print { body { margin: 0; padding: 10px; } }
  </style>
</head>
<body>
  <div class="org-header">
    <div class="org-name">${orgName}</div>
    <div class="org-details">
      ${orgAddress ? orgAddress + "<br>" : ""}
      ${orgPhone ? "Tel: " + orgPhone : ""} ${orgEmail ? " | Email: " + orgEmail : ""}
    </div>
  </div>
  
  <h1>MEMBERSHIP APPLICATION FORM</h1>
  <div class="form-number">Form No: _________________ Date: _________________</div>
  
  <h2>Section A: Personal Information</h2>
  <div class="row">
    <div class="field"><label>First Name</label><div class="line"></div></div>
    <div class="field"><label>Middle Name</label><div class="line"></div></div>
    <div class="field"><label>Last Name</label><div class="line"></div></div>
  </div>
  <div class="row">
    <div class="field"><label>Date of Birth</label><div class="line"></div></div>
    <div class="field">
      <label>Gender</label>
      <div class="checkbox-group">
        <div class="checkbox"><div class="box"></div> Male</div>
        <div class="checkbox"><div class="box"></div> Female</div>
      </div>
    </div>
    <div class="field"><label>Marital Status</label><div class="line"></div></div>
  </div>
  <div class="row">
    <div class="field"><label>ID Type (National ID/Passport/Alien ID)</label><div class="line"></div></div>
    <div class="field"><label>ID Number</label><div class="line"></div></div>
    <div class="field"><label>KRA PIN</label><div class="line"></div></div>
  </div>
  <div class="row">
    <div class="field"><label>Phone Number (Primary)</label><div class="line"></div></div>
    <div class="field"><label>Phone Number (Secondary)</label><div class="line"></div></div>
    <div class="field"><label>Email Address</label><div class="line"></div></div>
  </div>
  <div class="row">
    <div class="field"><label>Nationality</label><div class="line"></div></div>
  </div>

  <h2>Section B: Address Information</h2>
  <div class="row">
    <div class="field" style="flex:2"><label>Physical Address</label><div class="line"></div></div>
    <div class="field"><label>P.O. Box</label><div class="line"></div></div>
  </div>
  <div class="row">
    <div class="field"><label>City/Town</label><div class="line"></div></div>
    <div class="field"><label>County</label><div class="line"></div></div>
    <div class="field"><label>Country</label><div class="line"></div></div>
  </div>

  <h2>Section C: Next of Kin (Primary)</h2>
  <div class="row">
    <div class="field"><label>Full Name</label><div class="line"></div></div>
    <div class="field"><label>Relationship</label><div class="line"></div></div>
    <div class="field"><label>Phone Number</label><div class="line"></div></div>
  </div>
  <div class="row">
    <div class="field"><label>ID Number</label><div class="line"></div></div>
    <div class="field" style="flex:2"><label>Address</label><div class="line"></div></div>
  </div>

  <h2>Section D: Next of Kin (Secondary)</h2>
  <div class="row">
    <div class="field"><label>Full Name</label><div class="line"></div></div>
    <div class="field"><label>Relationship</label><div class="line"></div></div>
    <div class="field"><label>Phone Number</label><div class="line"></div></div>
  </div>

  <h2>Section E: Employment Information</h2>
  <div class="row">
    <div class="field">
      <label>Employment Status</label>
      <div class="checkbox-group">
        <div class="checkbox"><div class="box"></div> Employed</div>
        <div class="checkbox"><div class="box"></div> Self-Employed</div>
        <div class="checkbox"><div class="box"></div> Business</div>
        <div class="checkbox"><div class="box"></div> Retired</div>
      </div>
    </div>
  </div>
  <div class="row">
    <div class="field"><label>Employer/Business Name</label><div class="line"></div></div>
    <div class="field"><label>Occupation/Position</label><div class="line"></div></div>
  </div>
  <div class="row">
    <div class="field" style="flex:2"><label>Employer Address</label><div class="line"></div></div>
    <div class="field"><label>Employer Phone</label><div class="line"></div></div>
  </div>
  <div class="row">
    <div class="field"><label>Monthly Income (${currency})</label><div class="line"></div></div>
    <div class="field"><label>Employment/Start Date</label><div class="line"></div></div>
  </div>

  <h2>Section F: Bank Details</h2>
  <div class="row">
    <div class="field"><label>Bank Name</label><div class="line"></div></div>
    <div class="field"><label>Branch</label><div class="line"></div></div>
  </div>
  <div class="row">
    <div class="field"><label>Account Number</label><div class="line"></div></div>
    <div class="field"><label>Account Name</label><div class="line"></div></div>
  </div>

  <h2>Section G: Membership Details</h2>
  <div class="row">
    <div class="field"><label>Branch (Office)</label><div class="line"></div></div>
    <div class="field"><label>Registration Fee (${currency})</label><div class="line"></div></div>
    <div class="field"><label>Share Capital (${currency})</label><div class="line"></div></div>
  </div>
  <div class="row">
    <div class="field">
      <label>Membership Type</label>
      <div class="checkbox-group">
        <div class="checkbox"><div class="box"></div> Ordinary</div>
        <div class="checkbox"><div class="box"></div> Premium</div>
        <div class="checkbox"><div class="box"></div> Corporate</div>
      </div>
    </div>
  </div>

  <h2>Declaration</h2>
  <p style="font-size:12px">I hereby declare that all the information provided above is true and accurate to the best of my knowledge. I agree to abide by the rules and regulations of the organization.</p>

  <div class="signature-area">
    <div class="signature-box">
      <div class="signature-line">Applicant's Signature</div>
    </div>
    <div class="signature-box">
      <div class="signature-line">Date</div>
    </div>
    <div class="signature-box">
      <div class="signature-line">Official Use Only</div>
    </div>
  </div>
</body>
</html>`;
  };

  const generateLoanForm = () => {
    const orgName = organization?.name || "SACCO / MICROFINANCE";
    const orgEmail = organization?.email || "";
    const orgPhone = organization?.phone || "";
    const orgAddress = organization?.address || "";
    
    return `<!DOCTYPE html>
<html>
<head>
  <title>Loan Application Form - ${orgName}</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
    .org-header { text-align: center; margin-bottom: 20px; border-bottom: 3px solid #333; padding-bottom: 15px; }
    .org-name { font-size: 24px; font-weight: bold; margin-bottom: 5px; text-transform: uppercase; }
    .org-details { font-size: 12px; color: #555; }
    h1 { text-align: center; margin-top: 10px; font-size: 18px; }
    h2 { background: #f0f0f0; padding: 8px; margin-top: 20px; }
    .row { display: flex; margin-bottom: 10px; }
    .field { flex: 1; margin-right: 15px; }
    .field:last-child { margin-right: 0; }
    label { display: block; font-weight: bold; margin-bottom: 3px; font-size: 12px; }
    .line { border-bottom: 1px solid #333; min-height: 25px; }
    .checkbox-group { display: flex; gap: 20px; }
    .checkbox { display: flex; align-items: center; gap: 5px; }
    .box { width: 15px; height: 15px; border: 1px solid #333; }
    .signature-area { display: flex; justify-content: space-between; margin-top: 40px; }
    .signature-box { text-align: center; width: 200px; }
    .signature-line { border-top: 1px solid #333; margin-top: 50px; padding-top: 5px; }
    .large-field { min-height: 60px; }
    .form-number { text-align: right; font-size: 11px; color: #666; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    th, td { border: 1px solid #333; padding: 8px; text-align: left; }
    th { background: #f0f0f0; }
    @media print { body { margin: 0; padding: 10px; } }
  </style>
</head>
<body>
  <div class="org-header">
    <div class="org-name">${orgName}</div>
    <div class="org-details">
      ${orgAddress ? orgAddress + "<br>" : ""}
      ${orgPhone ? "Tel: " + orgPhone : ""} ${orgEmail ? " | Email: " + orgEmail : ""}
    </div>
  </div>
  
  <h1>LOAN APPLICATION FORM</h1>
  <div class="form-number">Form No: _________________ Date: _________________</div>

  <h2>Section A: Applicant Information</h2>
  <div class="row">
    <div class="field"><label>Member Number</label><div class="line"></div></div>
    <div class="field"><label>Full Name</label><div class="line"></div></div>
    <div class="field"><label>ID Number</label><div class="line"></div></div>
  </div>
  <div class="row">
    <div class="field"><label>Phone Number</label><div class="line"></div></div>
    <div class="field"><label>Email</label><div class="line"></div></div>
    <div class="field"><label>Branch</label><div class="line"></div></div>
  </div>

  <h2>Section B: Loan Details</h2>
  <div class="row">
    <div class="field"><label>Loan Amount Requested (${currency})</label><div class="line"></div></div>
    <div class="field"><label>Repayment Period (Months)</label><div class="line"></div></div>
  </div>
  <div class="row">
    <div class="field" style="flex:1"><label>Purpose of Loan</label><div class="line large-field"></div></div>
  </div>

  <h2>Section C: Disbursement Method</h2>
  <div class="row">
    <div class="field">
      <label>Preferred Method</label>
      <div class="checkbox-group">
        <div class="checkbox"><div class="box"></div> M-Pesa</div>
        <div class="checkbox"><div class="box"></div> Bank Transfer</div>
        <div class="checkbox"><div class="box"></div> Cash</div>
        <div class="checkbox"><div class="box"></div> Cheque</div>
      </div>
    </div>
  </div>
  <div class="row">
    <div class="field"><label>M-Pesa Number (if applicable)</label><div class="line"></div></div>
    <div class="field"><label>Bank Account Number (if applicable)</label><div class="line"></div></div>
  </div>

  <h2>Section D: Guarantor Information</h2>
  <table>
    <tr>
      <th>No.</th>
      <th>Full Name</th>
      <th>Member Number</th>
      <th>ID Number</th>
      <th>Phone</th>
      <th>Amount Guaranteed (${currency})</th>
      <th>Signature</th>
    </tr>
    <tr><td>1</td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
    <tr><td>2</td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
    <tr><td>3</td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
  </table>

  <h2>Section E: Security/Collateral (if applicable)</h2>
  <div class="row">
    <div class="field"><label>Type of Security</label><div class="line"></div></div>
    <div class="field"><label>Estimated Value (${currency})</label><div class="line"></div></div>
  </div>
  <div class="row">
    <div class="field"><label>Description</label><div class="line large-field"></div></div>
  </div>

  <h2>Declaration</h2>
  <p style="font-size:12px">I/We hereby apply for the loan stated above and declare that all information provided is true and accurate. I/We understand and agree to the terms and conditions of the loan and undertake to repay the loan as per the agreed schedule.</p>

  <div class="signature-area">
    <div class="signature-box">
      <div class="signature-line">Applicant's Signature</div>
    </div>
    <div class="signature-box">
      <div class="signature-line">Date</div>
    </div>
  </div>

  <h2 style="margin-top: 40px;">Official Use Only</h2>
  <div class="row">
    <div class="field"><label>Loan Officer</label><div class="line"></div></div>
    <div class="field"><label>Date Received</label><div class="line"></div></div>
    <div class="field"><label>Application Number</label><div class="line"></div></div>
  </div>
  <div class="row">
    <div class="field">
      <label>Decision</label>
      <div class="checkbox-group">
        <div class="checkbox"><div class="box"></div> Approved</div>
        <div class="checkbox"><div class="box"></div> Rejected</div>
        <div class="checkbox"><div class="box"></div> Pending</div>
      </div>
    </div>
    <div class="field"><label>Approved Amount (${currency})</label><div class="line"></div></div>
  </div>
  <div class="row">
    <div class="field"><label>Comments</label><div class="line large-field"></div></div>
  </div>
  <div class="signature-area">
    <div class="signature-box">
      <div class="signature-line">Approved By</div>
    </div>
    <div class="signature-box">
      <div class="signature-line">Date</div>
    </div>
  </div>
</body>
</html>`;
  };

  // List View
  if (viewMode === "list") {
    return (
      <div className="space-y-4 sm:space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
              <Users className="h-5 w-5 sm:h-6 sm:w-6 shrink-0" />
              <span className="truncate">Members</span>
            </h2>
            <p className="text-muted-foreground text-sm">
              {totalMembers} registered member{totalMembers !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="flex gap-2 shrink-0 flex-wrap">
            <RefreshButton organizationId={organizationId} />
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => downloadBlankForm("membership")}
              data-testid="button-download-membership-form"
            >
              <Download className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Membership Form</span>
              <span className="sm:hidden">Member</span>
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => downloadBlankForm("loan")}
              data-testid="button-download-loan-form"
            >
              <Download className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Loan Form</span>
              <span className="sm:hidden">Loan</span>
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                window.open(`/api/organizations/${organizationId}/export/members`, '_blank');
              }}
              data-testid="button-export-members"
            >
              <Download className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Export CSV</span>
              <span className="sm:hidden">CSV</span>
            </Button>
            {canWrite && (
              <Button onClick={handleNewMember} data-testid="button-new-member">
                <Plus className="h-4 w-4 mr-1" />
                <span className="hidden sm:inline">Register Member</span>
                <span className="sm:hidden">Register</span>
              </Button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, phone, member #, ID..."
              value={memberSearch}
              onChange={(e) => { setMemberSearch(e.target.value); setMemberPage(1); }}
              className="pl-9"
            />
          </div>
          {memberSearch && (
            <Button variant="ghost" size="sm" onClick={() => { setMemberSearch(""); setMemberPage(1); }}>
              Clear
            </Button>
          )}
          {canSeeAllBranches && branches && branches.length > 1 && (
            <Select value={branchFilter} onValueChange={(v) => { setBranchFilter(v); setMemberPage(1); }}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All Branches" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Branches</SelectItem>
                {branches.map((branch) => (
                  <SelectItem key={branch.id} value={branch.id}>
                    {branch.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {isLoading ? (
          <Card>
            <CardContent className="p-4 sm:p-6">
              <Skeleton className="h-48 w-full" />
            </CardContent>
          </Card>
        ) : members && members.length > 0 ? (
          <Card>
            <div className="overflow-x-auto -mx-0 sm:-mx-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member #</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead className="hidden md:table-cell">Phone</TableHead>
                    <TableHead className="hidden lg:table-cell">ID Number</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((member) => (
                    <TableRow key={member.id}>
                      <TableCell className="font-medium">{member.member_number}</TableCell>
                      <TableCell>
                        <div>
                          {member.first_name} {member.middle_name || ""} {member.last_name}
                        </div>
                        <div className="text-sm text-muted-foreground md:hidden">{member.phone}</div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">{member.phone}</TableCell>
                      <TableCell className="hidden lg:table-cell">{member.id_number || "-"}</TableCell>
                      <TableCell>
                        <Badge variant={member.status === "active" ? "default" : "secondary"}>
                          {member.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleViewMember(member)}
                            data-testid={`button-view-member-${member.id}`}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {canWrite && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEditMember(member)}
                              data-testid={`button-edit-member-${member.id}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}
                          {canWrite && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeleting(member)}
                              data-testid={`button-delete-member-${member.id}`}
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-t">
                <p className="text-sm text-muted-foreground">
                  Showing {(memberPage - 1) * MEMBERS_PER_PAGE + 1}-{Math.min(memberPage * MEMBERS_PER_PAGE, totalMembers)} of {totalMembers} members
                </p>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setMemberPage(p => Math.max(1, p - 1))}
                    disabled={memberPage <= 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(p => p === 1 || p === totalPages || Math.abs(p - memberPage) <= 1)
                    .map((p, idx, arr) => (
                      <span key={p}>
                        {idx > 0 && arr[idx - 1] !== p - 1 && <span className="px-1 text-muted-foreground">...</span>}
                        <Button
                          variant={p === memberPage ? "default" : "outline"}
                          size="sm"
                          className="w-8 h-8 p-0"
                          onClick={() => setMemberPage(p)}
                        >
                          {p}
                        </Button>
                      </span>
                    ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setMemberPage(p => Math.min(totalPages, p + 1))}
                    disabled={memberPage >= totalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </Card>
        ) : memberSearch ? (
          <Card>
            <CardContent className="p-8 sm:p-12 text-center">
              <Search className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Results Found</h3>
              <p className="text-muted-foreground mb-4">
                No members match "{memberSearch}"
              </p>
              <Button variant="outline" onClick={() => { setMemberSearch(""); setMemberPage(1); }}>
                Clear Search
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-8 sm:p-12 text-center">
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Members Yet</h3>
              <p className="text-muted-foreground mb-4">
                Start by registering your first member
              </p>
              {canWrite && (
                <Button onClick={handleNewMember} data-testid="button-new-member-empty">
                  <Plus className="h-4 w-4 mr-2" />
                  Register Member
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        <AlertDialog open={!!deleting} onOpenChange={() => setDeleting(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Member</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete {deleting?.first_name} {deleting?.last_name}? 
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleting && deleteMutation.mutate(deleting.id)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={!!idConflict} onOpenChange={() => setIdConflict(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Duplicate ID Number Found</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-3">
                  <p>
                    Another member already has this ID number, but their account is currently <Badge variant="secondary" className="mx-1">{idConflict?.status}</Badge>.
                  </p>
                  <div className="rounded-md border p-3 space-y-1 text-sm">
                    <p><span className="font-medium">Name:</span> {idConflict?.member_name}</p>
                    <p><span className="font-medium">Member No:</span> {idConflict?.member_number}</p>
                    <p><span className="font-medium">Status:</span> {idConflict?.status}</p>
                  </div>
                  <p>
                    Do you want to proceed with saving this member using the same ID number?
                  </p>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="button-cancel-id-conflict">Cancel</AlertDialogCancel>
              <AlertDialogAction
                data-testid="button-confirm-id-conflict"
                onClick={() => {
                  if (idConflict?.pendingData) {
                    submitMember(idConflict.pendingData);
                  }
                  setIdConflict(null);
                }}
              >
                Proceed
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  if (viewMode === "statement" && selectedMember) {
    return (
      <MemberStatementPage
        organizationId={organizationId}
        memberId={selectedMember.id}
        onBack={() => setViewMode("view")}
      />
    );
  }

  // View Mode
  if (viewMode === "view" && selectedMember) {
    const member = selectedMember;
    return (
      <div className="space-y-4 sm:space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Button variant="ghost" size="icon" onClick={handleBack} data-testid="button-back">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-0">
              <h2 className="text-xl sm:text-2xl font-bold truncate">
                {member.first_name} {member.middle_name || ""} {member.last_name}
              </h2>
              <p className="text-muted-foreground">Member #{member.member_number}</p>
            </div>
          </div>
          <div className="flex gap-2 shrink-0 flex-wrap">
            <Badge 
              variant={member.status === "active" ? "default" : member.status === "suspended" ? "destructive" : "secondary"} 
              className="capitalize"
            >
              {member.status}
            </Badge>
            {mobileActivity?.mobile_banking_active ? (
              <Badge variant="outline" className="gap-1 border-green-500 text-green-600 dark:text-green-400" data-testid="badge-mobile-active">
                <Smartphone className="h-3 w-3" />
                Mobile Active
              </Badge>
            ) : mobileActivity?.activation_pending ? (
              <Badge variant="outline" className="gap-1 border-amber-500 text-amber-600 dark:text-amber-400" data-testid="badge-mobile-pending">
                <Clock className="h-3 w-3" />
                Mobile Pending
              </Badge>
            ) : null}
            {member.status === "pending" && canActivate && (
              <Button 
                variant="default" 
                onClick={() => activateMutation.mutate(member.id)}
                disabled={activateMutation.isPending}
                data-testid="button-activate-member"
              >
                <CheckCircle className="h-4 w-4 mr-1" />
                {activateMutation.isPending ? "Activating..." : "Activate"}
              </Button>
            )}
            {member.status === "active" && canSuspend && (
              <Button 
                variant="outline" 
                onClick={() => suspendMutation.mutate(member.id)}
                disabled={suspendMutation.isPending}
                data-testid="button-suspend-member"
              >
                <XCircle className="h-4 w-4 mr-1" />
                {suspendMutation.isPending ? "Suspending..." : "Suspend"}
              </Button>
            )}
            {member.status === "suspended" && canActivate && (
              <Button 
                variant="default" 
                onClick={() => activateMutation.mutate(member.id)}
                disabled={activateMutation.isPending}
                data-testid="button-reactivate-member"
              >
                <CheckCircle className="h-4 w-4 mr-1" />
                {activateMutation.isPending ? "Activating..." : "Reactivate"}
              </Button>
            )}
            <Button 
              variant="outline" 
              onClick={() => setViewMode("statement")}
              data-testid="button-view-statement"
            >
              <Eye className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">View Statement</span>
            </Button>
            <Button 
              variant="outline" 
              onClick={async () => {
                try {
                  const res = await fetch(`/api/organizations/${organizationId}/members/${member.id}/statement/pdf`, {
                    credentials: "include",
                  });
                  if (!res.ok) throw new Error("Failed to download PDF");
                  const blob = await res.blob();
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `statement-${member.member_number || "member"}.pdf`;
                  a.click();
                  URL.revokeObjectURL(url);
                  toast({ title: "Downloaded", description: "PDF statement downloaded successfully" });
                } catch (error) {
                  toast({ title: "Error", description: "Failed to download PDF statement", variant: "destructive" });
                }
              }}
              data-testid="button-download-pdf-statement"
            >
              <Download className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">PDF</span>
            </Button>
            {canWrite && (
              <Button variant="outline" onClick={() => handleEditMember(member)} data-testid="button-edit-view">
                <Pencil className="h-4 w-4 mr-1" />
                Edit
              </Button>
            )}
            {canWrite && member.status === "active" && !mobileActivity?.mobile_banking_active && (
              <Button
                variant="outline"
                onClick={() => { setMobileActivateResult(null); setShowMobileActivateDialog(true); }}
                disabled={activateMobileMutation.isPending}
                data-testid="button-activate-mobile"
                className="border-blue-500 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950"
              >
                <Smartphone className="h-4 w-4 mr-1" />
                <span className="hidden sm:inline">Activate Mobile Banking</span>
                <span className="sm:hidden">Mobile</span>
              </Button>
            )}
            {canWrite && mobileActivity?.mobile_banking_active && (
              <Button
                variant="outline"
                onClick={() => deactivateMobileMutation.mutate(member.id)}
                disabled={deactivateMobileMutation.isPending}
                data-testid="button-deactivate-mobile"
                className="border-red-400 text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
              >
                {deactivateMobileMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <WifiOff className="h-4 w-4 mr-1" />
                )}
                <span className="hidden sm:inline">Disable Mobile</span>
              </Button>
            )}
          </div>
        </div>

        <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <User className="h-4 w-4" />
                Personal Information
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 grid-cols-1 sm:grid-cols-2">
              <div><div className="text-sm text-muted-foreground">Full Name</div><div className="font-medium">{member.first_name} {member.middle_name || ""} {member.last_name}</div></div>
              <div><div className="text-sm text-muted-foreground">Phone</div><div className="font-medium">{member.phone}</div></div>
              <div><div className="text-sm text-muted-foreground">Email</div><div className="font-medium truncate">{member.email || "-"}</div></div>
              <div><div className="text-sm text-muted-foreground">ID Type</div><div className="font-medium capitalize">{member.id_type?.replace("_", " ") || "-"}</div></div>
              <div><div className="text-sm text-muted-foreground">ID Number</div><div className="font-medium">{member.id_number || "-"}</div></div>
              <div><div className="text-sm text-muted-foreground">KRA PIN</div><div className="font-medium">{member.kra_pin || "-"}</div></div>
              <div><div className="text-sm text-muted-foreground">Date of Birth</div><div className="font-medium">{member.date_of_birth || "-"}</div></div>
              <div><div className="text-sm text-muted-foreground">Gender</div><div className="font-medium capitalize">{member.gender || "-"}</div></div>
              <div><div className="text-sm text-muted-foreground">Marital Status</div><div className="font-medium capitalize">{member.marital_status || "-"}</div></div>
              <div><div className="text-sm text-muted-foreground">Nationality</div><div className="font-medium">{member.nationality || "-"}</div></div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Address Information
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 grid-cols-1 sm:grid-cols-2">
              <div className="sm:col-span-2"><div className="text-sm text-muted-foreground">Physical Address</div><div className="font-medium">{member.address || "-"}</div></div>
              <div><div className="text-sm text-muted-foreground">Postal Code</div><div className="font-medium">{member.postal_code || "-"}</div></div>
              <div><div className="text-sm text-muted-foreground">City</div><div className="font-medium">{member.city || "-"}</div></div>
              <div><div className="text-sm text-muted-foreground">County</div><div className="font-medium">{member.county || "-"}</div></div>
              <div><div className="text-sm text-muted-foreground">Country</div><div className="font-medium">{member.country || "-"}</div></div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Heart className="h-4 w-4" />
                Next of Kin
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="font-medium mb-2">Primary Next of Kin</div>
                <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 text-sm">
                  <div><span className="text-muted-foreground">Name:</span> {member.next_of_kin_name || "-"}</div>
                  <div><span className="text-muted-foreground">Relationship:</span> {member.next_of_kin_relationship || "-"}</div>
                  <div><span className="text-muted-foreground">Phone:</span> {member.next_of_kin_phone || "-"}</div>
                  <div><span className="text-muted-foreground">ID Number:</span> {member.next_of_kin_id_number || "-"}</div>
                </div>
              </div>
              {member.next_of_kin_2_name && (
                <div>
                  <div className="font-medium mb-2">Secondary Next of Kin</div>
                  <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 text-sm">
                    <div><span className="text-muted-foreground">Name:</span> {member.next_of_kin_2_name}</div>
                    <div><span className="text-muted-foreground">Relationship:</span> {member.next_of_kin_2_relationship || "-"}</div>
                    <div><span className="text-muted-foreground">Phone:</span> {member.next_of_kin_2_phone || "-"}</div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Briefcase className="h-4 w-4" />
                Employment Information
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 grid-cols-1 sm:grid-cols-2">
              <div><div className="text-sm text-muted-foreground">Employment Status</div><div className="font-medium capitalize">{member.employment_status?.replace("_", " ") || "-"}</div></div>
              <div><div className="text-sm text-muted-foreground">Occupation</div><div className="font-medium">{member.occupation || "-"}</div></div>
              <div><div className="text-sm text-muted-foreground">Employer</div><div className="font-medium">{member.employer_name || "-"}</div></div>
              <div><div className="text-sm text-muted-foreground">Monthly Income</div><div className="font-medium">{member.monthly_income ? `${symbol} ${Number(member.monthly_income).toLocaleString()}` : "-"}</div></div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Bank Details
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 grid-cols-1 sm:grid-cols-2">
              <div><div className="text-sm text-muted-foreground">Bank Name</div><div className="font-medium">{member.bank_name || "-"}</div></div>
              <div><div className="text-sm text-muted-foreground">Branch</div><div className="font-medium">{member.bank_branch || "-"}</div></div>
              <div><div className="text-sm text-muted-foreground">Account Number</div><div className="font-medium">{member.bank_account_number || "-"}</div></div>
              <div><div className="text-sm text-muted-foreground">Account Name</div><div className="font-medium">{member.bank_account_name || "-"}</div></div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Account Balances
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 grid-cols-1 sm:grid-cols-3">
              <div className="text-center p-3 bg-muted rounded-lg">
                <div className="text-sm text-muted-foreground">Savings</div>
                <div className="text-lg font-bold">{symbol} {Number(member.savings_balance || 0).toLocaleString()}</div>
                {Number(member.savings_pending || 0) > 0 && (
                  <div className="text-xs text-amber-600">+ {symbol} {Number(member.savings_pending).toLocaleString()} pending</div>
                )}
              </div>
              <div className="text-center p-3 bg-muted rounded-lg">
                <div className="text-sm text-muted-foreground">Shares</div>
                <div className="text-lg font-bold">{symbol} {Number(member.shares_balance || 0).toLocaleString()}</div>
                {Number(member.shares_pending || 0) > 0 && (
                  <div className="text-xs text-amber-600">+ {symbol} {Number(member.shares_pending).toLocaleString()} pending</div>
                )}
              </div>
              <div className="text-center p-3 bg-muted rounded-lg">
                <div className="text-sm text-muted-foreground">Deposits</div>
                <div className="text-lg font-bold">{symbol} {Number(member.deposits_balance || 0).toLocaleString()}</div>
                {Number(member.deposits_pending || 0) > 0 && (
                  <div className="text-xs text-amber-600">+ {symbol} {Number(member.deposits_pending).toLocaleString()} pending</div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card data-testid="card-mobile-banking">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Smartphone className="h-4 w-4" />
                Mobile Banking
              </CardTitle>
              {mobileActivity?.mobile_banking_active ? (
                <Badge variant="outline" className="gap-1 border-green-500 text-green-600 dark:text-green-400">
                  <Smartphone className="h-3 w-3" />
                  Active
                </Badge>
              ) : mobileActivity?.activation_pending ? (
                <Badge variant="outline" className="gap-1 border-amber-500 text-amber-600 dark:text-amber-400">
                  <Clock className="h-3 w-3" />
                  Activation Pending
                </Badge>
              ) : (
                <Badge variant="outline" className="gap-1 text-muted-foreground">
                  <WifiOff className="h-3 w-3" />
                  Not Activated
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {mobileActivityLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : (
              <div className="space-y-4">
                {mobileActivity?.mobile_banking_active && (
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <div className="text-muted-foreground">Status</div>
                      <div className="font-medium text-green-600">Active</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Device Bound</div>
                      <div className="font-medium">{mobileActivity.mobile_device_id ? "Yes" : "No"}</div>
                    </div>
                  </div>
                )}
                {mobileActivity?.activation_pending && !mobileActivity.mobile_banking_active && (
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg text-sm">
                    <div className="font-medium text-amber-700 dark:text-amber-400 mb-1">Activation code sent</div>
                    <div className="text-muted-foreground">
                      Member has an activation code valid until{" "}
                      {mobileActivity.activation_expires_at
                        ? new Date(mobileActivity.activation_expires_at).toLocaleString()
                        : "—"}
                      . Member should open the app and enter the code to complete setup.
                    </div>
                  </div>
                )}
                {!mobileActivity?.mobile_banking_active && !mobileActivity?.activation_pending && canWrite && (
                  <div className="text-sm text-muted-foreground">
                    Mobile banking is not enabled for this member. Click{" "}
                    <button
                      className="text-blue-600 underline cursor-pointer"
                      onClick={() => { setMobileActivateResult(null); setShowMobileActivateDialog(true); }}
                    >
                      Activate Mobile Banking
                    </button>{" "}
                    to send the member an activation code.
                  </div>
                )}

                {mobileActivity && mobileActivity.sessions.length > 0 && (
                  <div>
                    <button
                      className="text-sm font-medium flex items-center gap-1 w-full text-left hover:text-foreground/80 transition-colors"
                      onClick={() => setShowMobileSessions(!showMobileSessions)}
                      data-testid="button-toggle-mobile-sessions"
                    >
                      <Activity className="h-4 w-4" />
                      Recent Activity
                      <span className="ml-1 text-muted-foreground text-xs">({mobileActivity.sessions.length})</span>
                      <span className="ml-auto text-muted-foreground text-xs">{showMobileSessions ? "Hide" : "Show"}</span>
                    </button>
                    {showMobileSessions && (
                      <div className="space-y-2 mt-2">
                        {mobileActivity.sessions.map((session) => (
                          <div
                            key={session.id}
                            className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 p-2 bg-muted/50 rounded-lg text-sm"
                            data-testid={`mobile-session-${session.id}`}
                          >
                            <div className="flex items-center gap-2">
                              <Smartphone className={`h-3 w-3 ${session.is_active ? "text-green-500" : "text-muted-foreground"}`} />
                              <div>
                                <span className="font-medium">{session.device_name || "Mobile Device"}</span>
                                {session.ip_address && (
                                  <span className="text-muted-foreground"> · {session.ip_address}</span>
                                )}
                              </div>
                            </div>
                            <div className="text-muted-foreground text-xs flex items-center gap-1 ml-5 sm:ml-0">
                              <Clock className="h-3 w-3" />
                              {session.login_at
                                ? new Date(session.login_at).toLocaleString()
                                : "—"}
                              {session.is_active && (
                                <Badge variant="outline" className="ml-1 text-xs border-green-400 text-green-600 py-0">Active</Badge>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {mobileActivity && mobileActivity.sessions.length === 0 && mobileActivity.mobile_banking_active && (
                  <div className="text-sm text-muted-foreground">No login sessions recorded yet.</div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <MemberDocumentsSection organizationId={organizationId} memberId={member.id} />

        <AlertDialog open={showMobileActivateDialog} onOpenChange={setShowMobileActivateDialog}>
          <AlertDialogContent>
            {!mobileActivateResult ? (
              <>
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2">
                    <Smartphone className="h-5 w-5 text-blue-600" />
                    Activate Mobile Banking
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    This will generate a one-time activation code for{" "}
                    <strong>{member.first_name} {member.last_name}</strong> and send it to their registered phone number.
                    The code will be valid for 12 hours. The member will use it to set up the mobile app.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel data-testid="button-cancel-mobile-activate">Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => activateMobileMutation.mutate(member.id)}
                    disabled={activateMobileMutation.isPending}
                    data-testid="button-confirm-mobile-activate"
                  >
                    {activateMobileMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      "Generate & Send Code"
                    )}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </>
            ) : (
              <>
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    Activation Code Ready
                  </AlertDialogTitle>
                  <AlertDialogDescription asChild>
                    <div className="space-y-3">
                      <p>
                        {mobileActivateResult.sms_sent
                          ? `An SMS with the activation code has been sent to ${mobileActivateResult.member_phone}.`
                          : "SMS could not be sent. Please share the code below with the member manually."}
                      </p>
                      <div className="p-4 bg-muted rounded-lg text-center">
                        <div className="text-xs text-muted-foreground mb-1">One-time activation code</div>
                        <div className="text-3xl font-bold tracking-widest font-mono text-blue-600" data-testid="text-activation-code">
                          {mobileActivateResult.activation_code}
                        </div>
                        <div className="text-xs text-muted-foreground mt-2">
                          Valid for {mobileActivateResult.expires_hours} hours
                        </div>
                      </div>
                      <p className="text-sm">
                        The member should open the BankyKit app and enter this code along with their account number to complete setup.
                      </p>
                    </div>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogAction
                    onClick={() => { setShowMobileActivateDialog(false); setMobileActivateResult(null); }}
                    data-testid="button-close-activation-result"
                  >
                    Done
                  </AlertDialogAction>
                </AlertDialogFooter>
              </>
            )}
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  // Form View (New/Edit)
  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={handleBack} data-testid="button-back">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="text-xl sm:text-2xl font-bold">
            {viewMode === "edit" ? "Edit Member" : "Register New Member"}
          </h2>
          <p className="text-muted-foreground">
            {viewMode === "edit" ? `Editing ${selectedMember?.first_name} ${selectedMember?.last_name}` : "Complete the membership application form"}
          </p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)}>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
              <TabsList className="mb-4 w-max sm:w-auto">
                <TabsTrigger value="personal" className="gap-1">
                  <User className="h-4 w-4 hidden sm:block" />
                  Personal
                </TabsTrigger>
                <TabsTrigger value="address" className="gap-1">
                  <MapPin className="h-4 w-4 hidden sm:block" />
                  Address
                </TabsTrigger>
                <TabsTrigger value="nextofkin" className="gap-1">
                  <Heart className="h-4 w-4 hidden sm:block" />
                  Next of Kin
                </TabsTrigger>
                <TabsTrigger value="employment" className="gap-1">
                  <Briefcase className="h-4 w-4 hidden sm:block" />
                  Employment
                </TabsTrigger>
                <TabsTrigger value="bank" className="gap-1">
                  <Building2 className="h-4 w-4 hidden sm:block" />
                  Bank
                </TabsTrigger>
                <TabsTrigger value="membership" className="gap-1">
                  <FileText className="h-4 w-4 hidden sm:block" />
                  Membership
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="personal">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Personal Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField control={form.control} name="branch_id" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Branch {canSeeAllBranches && <span className="text-destructive">*</span>}</FormLabel>
                      {hasOnlyOneBranch ? (
                        <div className="text-sm p-2 bg-muted rounded">
                          {branches[0].name}
                        </div>
                      ) : canSeeAllBranches ? (
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-branch">
                              <SelectValue placeholder="Select branch (required)" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {branches?.map(branch => (
                              <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <div className="text-sm text-muted-foreground p-2 bg-muted rounded">
                          {branches?.find(b => b.id === userBranchId)?.name || "Your assigned branch"}
                        </div>
                      )}
                      <FormMessage />
                    </FormItem>
                  )} />

                  <div className="grid gap-4 sm:grid-cols-3">
                    <FormField control={form.control} name="first_name" render={({ field }) => (
                      <FormItem>
                        <FormLabel>First Name *</FormLabel>
                        <FormControl><Input {...field} data-testid="input-first-name" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="middle_name" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Middle Name</FormLabel>
                        <FormControl><Input {...field} data-testid="input-middle-name" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="last_name" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Last Name *</FormLabel>
                        <FormControl><Input {...field} data-testid="input-last-name" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField control={form.control} name="phone" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone Number *</FormLabel>
                        <FormControl><Input {...field} placeholder="+254..." data-testid="input-phone" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="phone_secondary" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Secondary Phone</FormLabel>
                        <FormControl><Input {...field} data-testid="input-phone-secondary" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>

                  <FormField control={form.control} name="email" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email Address</FormLabel>
                      <FormControl><Input type="email" {...field} data-testid="input-email" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <div className="grid gap-4 sm:grid-cols-3">
                    <FormField control={form.control} name="id_type" render={({ field }) => (
                      <FormItem>
                        <FormLabel>ID Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-id-type">
                              <SelectValue placeholder="Select ID type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="national_id">National ID</SelectItem>
                            <SelectItem value="passport">Passport</SelectItem>
                            <SelectItem value="alien_id">Alien ID</SelectItem>
                            <SelectItem value="military_id">Military ID</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="id_number" render={({ field }) => (
                      <FormItem>
                        <FormLabel>ID Number</FormLabel>
                        <FormControl><Input {...field} data-testid="input-id-number" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="kra_pin" render={({ field }) => (
                      <FormItem>
                        <FormLabel>KRA PIN</FormLabel>
                        <FormControl><Input {...field} placeholder="A00..." data-testid="input-kra-pin" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>

                  <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
                    <FormField control={form.control} name="date_of_birth" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date of Birth</FormLabel>
                        <FormControl><Input type="date" {...field} data-testid="input-dob" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="gender" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Gender</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-gender">
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="male">Male</SelectItem>
                            <SelectItem value="female">Female</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="marital_status" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Marital Status</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-marital-status">
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="single">Single</SelectItem>
                            <SelectItem value="married">Married</SelectItem>
                            <SelectItem value="divorced">Divorced</SelectItem>
                            <SelectItem value="widowed">Widowed</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="nationality" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nationality</FormLabel>
                        <FormControl><Input {...field} data-testid="input-nationality" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="address">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5" />
                    Address Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField control={form.control} name="address" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Physical Address</FormLabel>
                      <FormControl><Textarea {...field} rows={2} data-testid="input-address" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField control={form.control} name="postal_code" render={({ field }) => (
                      <FormItem>
                        <FormLabel>P.O. Box</FormLabel>
                        <FormControl><Input {...field} placeholder="00100" data-testid="input-postal-code" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="city" render={({ field }) => (
                      <FormItem>
                        <FormLabel>City/Town</FormLabel>
                        <FormControl><Input {...field} data-testid="input-city" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField control={form.control} name="county" render={({ field }) => (
                      <FormItem>
                        <FormLabel>County</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-county">
                              <SelectValue placeholder="Select county" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {kenyanCounties.map(county => (
                              <SelectItem key={county} value={county}>{county}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="country" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Country</FormLabel>
                        <FormControl><Input {...field} data-testid="input-country" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="nextofkin">
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Heart className="h-5 w-5" />
                      Primary Next of Kin
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <FormField control={form.control} name="next_of_kin_name" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Full Name</FormLabel>
                          <FormControl><Input {...field} data-testid="input-nok-name" /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="next_of_kin_relationship" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Relationship</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-nok-relationship">
                                <SelectValue placeholder="Select relationship" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="spouse">Spouse</SelectItem>
                              <SelectItem value="parent">Parent</SelectItem>
                              <SelectItem value="child">Child</SelectItem>
                              <SelectItem value="sibling">Sibling</SelectItem>
                              <SelectItem value="relative">Other Relative</SelectItem>
                              <SelectItem value="friend">Friend</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <FormField control={form.control} name="next_of_kin_phone" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone Number</FormLabel>
                          <FormControl><Input {...field} data-testid="input-nok-phone" /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="next_of_kin_id_number" render={({ field }) => (
                        <FormItem>
                          <FormLabel>ID Number</FormLabel>
                          <FormControl><Input {...field} data-testid="input-nok-id" /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>
                    <FormField control={form.control} name="next_of_kin_address" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Address</FormLabel>
                        <FormControl><Textarea {...field} rows={2} data-testid="input-nok-address" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Heart className="h-5 w-5" />
                      Secondary Next of Kin (Optional)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-3">
                      <FormField control={form.control} name="next_of_kin_2_name" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Full Name</FormLabel>
                          <FormControl><Input {...field} data-testid="input-nok2-name" /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="next_of_kin_2_relationship" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Relationship</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-nok2-relationship">
                                <SelectValue placeholder="Select" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="spouse">Spouse</SelectItem>
                              <SelectItem value="parent">Parent</SelectItem>
                              <SelectItem value="child">Child</SelectItem>
                              <SelectItem value="sibling">Sibling</SelectItem>
                              <SelectItem value="relative">Other Relative</SelectItem>
                              <SelectItem value="friend">Friend</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="next_of_kin_2_phone" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone Number</FormLabel>
                          <FormControl><Input {...field} data-testid="input-nok2-phone" /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="employment">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Briefcase className="h-5 w-5" />
                    Employment Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField control={form.control} name="employment_status" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Employment Status</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-employment-status">
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="employed">Employed</SelectItem>
                            <SelectItem value="self_employed">Self Employed</SelectItem>
                            <SelectItem value="business">Business Owner</SelectItem>
                            <SelectItem value="unemployed">Unemployed</SelectItem>
                            <SelectItem value="retired">Retired</SelectItem>
                            <SelectItem value="student">Student</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="occupation" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Occupation / Position</FormLabel>
                        <FormControl><Input {...field} data-testid="input-occupation" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField control={form.control} name="employer_name" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Employer / Business Name</FormLabel>
                        <FormControl><Input {...field} data-testid="input-employer-name" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="employer_phone" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Employer Phone</FormLabel>
                        <FormControl><Input {...field} data-testid="input-employer-phone" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>

                  <FormField control={form.control} name="employer_address" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Employer Address</FormLabel>
                      <FormControl><Textarea {...field} rows={2} data-testid="input-employer-address" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField control={form.control} name="monthly_income" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Monthly Income ({currency})</FormLabel>
                        <FormControl><Input type="number" {...field} data-testid="input-monthly-income" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="employment_date" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Employment Start Date</FormLabel>
                        <FormControl><Input type="date" {...field} data-testid="input-employment-date" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="bank">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5" />
                    Bank Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField control={form.control} name="bank_name" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Bank Name</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-bank-name">
                              <SelectValue placeholder="Select bank" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {kenyanBanks.map(bank => (
                              <SelectItem key={bank} value={bank}>{bank}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="bank_branch" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Bank Branch</FormLabel>
                        <FormControl><Input {...field} data-testid="input-bank-branch" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField control={form.control} name="bank_account_number" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Account Number</FormLabel>
                        <FormControl><Input {...field} data-testid="input-bank-account-number" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="bank_account_name" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Account Name</FormLabel>
                        <FormControl><Input {...field} data-testid="input-bank-account-name" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="membership">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Membership Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField control={form.control} name="membership_type" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Membership Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-membership-type">
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="ordinary">Ordinary</SelectItem>
                            <SelectItem value="premium">Premium</SelectItem>
                            <SelectItem value="corporate">Corporate</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField control={form.control} name="registration_fee_paid" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Registration Fee ({currency})</FormLabel>
                        <FormControl><Input type="number" {...field} data-testid="input-registration-fee" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="share_capital" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Share Capital ({currency})</FormLabel>
                        <FormControl><Input type="number" {...field} data-testid="input-share-capital" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <div className="flex justify-between mt-6">
            <Button type="button" variant="outline" onClick={handleBack} data-testid="button-cancel">
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={createMutation.isPending || updateMutation.isPending}
              data-testid="button-submit"
            >
              {createMutation.isPending || updateMutation.isPending 
                ? "Saving..." 
                : viewMode === "edit" ? "Update Member" : "Register Member"
              }
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
