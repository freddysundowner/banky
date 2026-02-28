import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAppDialog } from "@/hooks/use-app-dialog";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { 
  Banknote, 
  HelpCircle, 
  FileText, 
  UserPlus,
  Clock,
  Building2,
  ArrowLeft,
  LogOut
} from "lucide-react";

interface TicketingKioskProps {
  organizationId: string;
  organizationName?: string;
  branchId?: string;
  branchName?: string;
  isAdmin?: boolean;
  onBack?: () => void;
  onLogout?: () => void;
}

const SERVICE_TYPES = [
  { id: "transactions", label: "Transactions", description: "Deposits, Withdrawals, Loan Payments", prefix: "T", icon: Banknote, color: "bg-green-500 hover:bg-green-600" },
  { id: "loans", label: "Loans", description: "Loan Applications & Inquiries", prefix: "L", icon: FileText, color: "bg-purple-500 hover:bg-purple-600" },
  { id: "account_opening", label: "Account Opening", description: "New Member Registration", prefix: "A", icon: UserPlus, color: "bg-teal-500 hover:bg-teal-600" },
  { id: "inquiries", label: "Inquiries", description: "General Questions", prefix: "I", icon: HelpCircle, color: "bg-orange-500 hover:bg-orange-600" },
];

export function TicketingKiosk({ organizationId, organizationName, branchId: propBranchId, branchName: propBranchName, isAdmin, onBack, onLogout }: TicketingKioskProps) {
  const { toast } = useAppDialog();
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(propBranchId || null);

  const { data: branches } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["/api/organizations", organizationId, "branches"],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/organizations/${organizationId}/branches`);
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    },
    enabled: !propBranchId,
  });

  useEffect(() => {
    if (!propBranchId && branches && branches.length === 1 && !selectedBranchId) {
      setSelectedBranchId(branches[0].id);
    }
  }, [branches, propBranchId]);

  const branchId = propBranchId || selectedBranchId;
  const branchName = propBranchName || branches?.find(b => b.id === selectedBranchId)?.name;

  const createTicketMutation = useMutation({
    mutationFn: async (serviceType: string) => {
      const response = await apiRequest("POST", `/api/organizations/${organizationId}/queue-tickets`, {
        branch_id: branchId,
        service_category: serviceType,
        priority: 0
      });
      return await response.json() as { ticket_number: string; service_category: string; ahead_in_queue: number };
    },
    onSuccess: (data) => {
      // Auto-print and return to buttons
      const serviceLabel = SERVICE_TYPES.find(s => s.id === data.service_category)?.label || data.service_category;
      const printContent = `
        <html>
          <head>
            <title>Queue Ticket</title>
            <style>
              body { font-family: Arial, sans-serif; text-align: center; padding: 20px; }
              .ticket { border: 2px dashed #333; padding: 30px; max-width: 300px; margin: 0 auto; }
              .ticket-number { font-size: 72px; font-weight: bold; margin: 20px 0; }
              .service { font-size: 24px; color: #666; margin-bottom: 20px; }
              .date { font-size: 12px; margin-top: 20px; }
            </style>
          </head>
          <body>
            <div class="ticket">
              <div class="service">${serviceLabel}</div>
              <div class="ticket-number">${data.ticket_number}</div>
              <div class="date">${new Date().toLocaleString()}</div>
            </div>
          </body>
        </html>
      `;
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(printContent);
        printWindow.document.close();
        printWindow.print();
      }
      // Stay on buttons - no need to show ticket screen
    },
    onError: () => {
      toast({ title: "Failed to generate ticket", variant: "destructive" });
    },
  });

  if (createTicketMutation.isPending) {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center p-4">
        <Card className="w-full max-w-sm sm:max-w-md text-center">
          <CardContent className="p-8 sm:p-12 space-y-4 sm:space-y-6">
            <div className="animate-spin h-12 w-12 sm:h-16 sm:w-16 border-4 border-primary border-t-transparent rounded-full mx-auto" />
            <h2 className="text-2xl sm:text-3xl font-bold text-primary">Please wait...</h2>
            <p className="text-base sm:text-lg text-muted-foreground">Generating your ticket</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!branchId) {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center p-4">
        <Card className="w-full max-w-sm sm:max-w-md">
          <CardContent className="p-6 sm:p-8 space-y-4 sm:space-y-6 text-center">
            <Building2 className="h-12 w-12 sm:h-16 sm:w-16 mx-auto text-primary" />
            <h1 className="text-xl sm:text-2xl font-bold">Select Branch</h1>
            <p className="text-sm sm:text-base text-muted-foreground">Please select a branch to continue</p>
            <Select onValueChange={(value) => setSelectedBranchId(value)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a branch" />
              </SelectTrigger>
              <SelectContent>
                {branches?.map((branch) => (
                  <SelectItem key={branch.id} value={branch.id}>
                    {branch.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-primary/10 to-primary/5 flex flex-col z-50">
      <div className="border-b bg-card/80 backdrop-blur">
        <div className="flex items-center justify-between p-2 px-3">
          <div className="w-16 sm:w-20">
            {isAdmin && onBack ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={onBack}
                className="h-8 px-2 text-xs"
              >
                <ArrowLeft className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                <span className="hidden sm:inline">Back</span>
              </Button>
            ) : null}
          </div>
          <div className="flex-1 text-center py-2 sm:py-3">
            <h1 className="text-base sm:text-xl md:text-2xl font-bold text-primary">Welcome to {organizationName || "Our Organization"}</h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">Select a service for your queue ticket</p>
          </div>
          <div className="w-16 sm:w-20 flex justify-end">
            {!isAdmin && onLogout ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={onLogout}
                className="h-8 px-2 text-xs"
              >
                <LogOut className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                <span className="hidden sm:inline">Logout</span>
              </Button>
            ) : null}
          </div>
        </div>
      </div>
      
      <div className="flex-1 p-4 sm:p-6 md:p-8 flex items-center justify-center overflow-y-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 md:gap-6 max-w-3xl w-full">
          {SERVICE_TYPES.map((service) => {
            const Icon = service.icon;
            return (
              <button
                key={service.id}
                onClick={() => createTicketMutation.mutate(service.id)}
                disabled={createTicketMutation.isPending}
                className={`${service.color} text-white rounded-xl sm:rounded-2xl p-4 sm:p-6 md:p-8 flex flex-col items-center justify-center gap-2 sm:gap-3 transition-all transform hover:scale-105 active:scale-95 shadow-lg disabled:opacity-50 min-h-[120px] sm:min-h-[160px] md:min-h-[200px]`}
              >
                <Icon className="h-8 w-8 sm:h-10 sm:w-10 md:h-14 md:w-14" />
                <span className="text-lg sm:text-xl md:text-2xl font-bold">{service.label}</span>
                <span className="text-xs sm:text-sm opacity-90 text-center">{service.description}</span>
              </button>
            );
          })}
        </div>
      </div>
      
      <div className="p-4 text-center text-muted-foreground text-sm border-t bg-card/80 backdrop-blur">
        <Clock className="h-4 w-4 inline-block mr-2" />
        {new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}
      </div>
    </div>
  );
}
