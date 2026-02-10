import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Volume2, Building2, ArrowLeft, LogOut } from "lucide-react";

interface QueueDisplayBoardProps {
  organizationId: string;
  organizationName?: string;
  branchId?: string;
  branchName?: string;
  isAdmin?: boolean;
  onBack?: () => void;
  onLogout?: () => void;
}

interface ServingTicket {
  ticket_number: string;
  service_category: string;
  counter_number: string;
  teller_name: string | null;
  teller_number: string | null;
  called_at: string | null;
}

// Main 4 service categories
const MAIN_CATEGORIES = [
  { id: "transactions", label: "Transactions", color: "bg-green-500" },
  { id: "loans", label: "Loans", color: "bg-purple-500" },
  { id: "account_opening", label: "Account Opening", color: "bg-teal-500" },
  { id: "inquiries", label: "Inquiries", color: "bg-orange-500" },
];

// Map legacy service types to main categories
const LEGACY_TO_MAIN: Record<string, string> = {
  deposits: "transactions",
  withdrawals: "transactions",
  loan_payments: "transactions",
};

const SERVICE_COLORS: Record<string, string> = {
  transactions: "bg-green-500",
  loans: "bg-purple-500",
  account_opening: "bg-teal-500",
  inquiries: "bg-orange-500",
  deposits: "bg-green-500",
  withdrawals: "bg-green-500",
  loan_payments: "bg-green-500",
};

const SERVICE_LABELS: Record<string, string> = {
  transactions: "Transactions",
  loans: "Loans",
  account_opening: "Account Opening",
  inquiries: "Inquiries",
  deposits: "Transactions",
  withdrawals: "Transactions", 
  loan_payments: "Transactions",
};

export function QueueDisplayBoard({ organizationId, organizationName, branchId: propBranchId, branchName: propBranchName, isAdmin, onBack, onLogout }: QueueDisplayBoardProps) {
  const [lastAnnounced, setLastAnnounced] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(propBranchId || null);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

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

  interface DisplayData {
    serving: ServingTicket[];
    waiting: { ticket_number: string; service_category: string }[];
    waiting_counts?: Record<string, number>;
    recent_completed: { ticket_number: string; service_category: string }[];
    timestamp: string;
  }

  const { data: displayData } = useQuery<DisplayData>({
    queryKey: ["/api/organizations", organizationId, "queue-display", branchId],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/organizations/${organizationId}/queue-display?branch_id=${branchId}`);
      return await response.json();
    },
    refetchInterval: 3000,
    enabled: !!branchId,
  });

  // Compute waiting counts from waiting array
  const waitingCounts: Record<string, number> = {};
  if (displayData?.waiting) {
    displayData.waiting.forEach(ticket => {
      const category = ticket.service_category;
      waitingCounts[category] = (waitingCounts[category] || 0) + 1;
    });
  } else if (displayData?.waiting_counts) {
    Object.assign(waitingCounts, displayData.waiting_counts);
  }

  useEffect(() => {
    if (displayData?.serving && displayData.serving.length > 0) {
      const latestTicket = displayData.serving[0];
      const ticketKey = `${latestTicket.ticket_number}-${latestTicket.called_at}`;
      
      if (ticketKey !== lastAnnounced && latestTicket.called_at) {
        announceTicket(latestTicket);
        setLastAnnounced(ticketKey);
      }
    }
  }, [displayData, lastAnnounced]);

  const announceTicket = (ticket: ServingTicket) => {
    if ('speechSynthesis' in window) {
      // Spell out each digit as a word for maximum clarity
      const digitWords: Record<string, string> = {
        '0': 'zero', '1': 'one', '2': 'two', '3': 'three', '4': 'four',
        '5': 'five', '6': 'six', '7': 'seven', '8': 'eight', '9': 'nine'
      };
      
      // Format: "T. one. two. three." with periods for natural pauses
      const ticketSpoken = ticket.ticket_number.split('').map(char => 
        digitWords[char] || char
      ).join('. ');
      
      // Get just the counter number (remove prefix like ST)
      const counterFull = ticket.teller_number || ticket.counter_number || "1";
      const counterNum = counterFull.replace(/[^0-9]/g, '') || counterFull;
      
      // Speak the announcement twice for clarity
      const message = `Ticket number. ${ticketSpoken}. Counter. ${counterNum}. ... Ticket number. ${ticketSpoken}. Counter. ${counterNum}.`;
      
      const utterance = new SpeechSynthesisUtterance(message);
      utterance.rate = 0.4; // Even slower
      utterance.pitch = 1.0;
      utterance.volume = 1;
      
      // Try to find a clear English voice
      const voices = window.speechSynthesis.getVoices();
      const englishVoice = voices.find(v => 
        v.lang.startsWith('en-') && v.name.includes('Google')
      ) || voices.find(v => v.lang.startsWith('en'));
      if (englishVoice) {
        utterance.voice = englishVoice;
      }
      
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    }
  };

  const serving = displayData?.serving || [];

  if (!branchId) {
    return (
      <div className="fixed inset-0 bg-slate-900 flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-slate-800 border-slate-700">
          <CardContent className="p-8 space-y-6 text-center">
            <Building2 className="h-16 w-16 mx-auto text-primary" />
            <h1 className="text-2xl font-bold text-white">Select Branch</h1>
            <p className="text-slate-400">Please select a branch to display queue</p>
            <Select onValueChange={(value) => setSelectedBranchId(value)}>
              <SelectTrigger className="w-full bg-slate-700 border-slate-600 text-white">
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
    <div className="fixed inset-0 bg-slate-900 text-white flex flex-col overflow-hidden z-50">
      <div className="flex items-center justify-between p-2 px-3 sm:p-3 sm:px-4 bg-primary">
        <div className="w-16 sm:w-20">
          {isAdmin && onBack ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={onBack}
              className="h-8 px-2 text-xs text-white hover:bg-white/20"
            >
              <ArrowLeft className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
              <span className="hidden sm:inline">Back</span>
            </Button>
          ) : null}
        </div>
        <div className="flex-1 text-center">
          <h1 className="text-base sm:text-xl md:text-2xl font-bold">{organizationName || "Queue Display"}</h1>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          {!isAdmin && onLogout && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onLogout}
              className="h-8 px-2 text-xs text-white hover:bg-white/20"
            >
              <LogOut className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          )}
          <Volume2 className="h-4 w-4 sm:h-5 sm:w-5 animate-pulse" />
          <span className="text-sm sm:text-base font-mono">
            {currentTime.toLocaleTimeString()}
          </span>
        </div>
      </div>

      <div className="flex-1 p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-xl font-semibold text-slate-300">Now Serving</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {serving.length === 0 ? (
              <div className="col-span-2 text-center py-12 text-slate-500 text-xl">
                No customers currently being served
              </div>
            ) : (
              serving.map((ticket: ServingTicket, index: number) => (
                <div
                  key={`${ticket.ticket_number}-${index}`}
                  className={`rounded-xl p-6 ${SERVICE_COLORS[ticket.service_category] || 'bg-slate-700'} ${index === 0 ? 'ring-4 ring-yellow-400 animate-pulse' : ''}`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="text-sm opacity-80 uppercase tracking-wide">
                        {SERVICE_LABELS[ticket.service_category] || ticket.service_category}
                      </div>
                      <div className="text-5xl font-bold mt-2">
                        {ticket.ticket_number}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm opacity-80">Counter</div>
                      <div className="text-4xl font-bold">
                        {ticket.teller_number || ticket.counter_number || "-"}
                      </div>
                    </div>
                  </div>
                  {ticket.teller_name && (
                    <div className="mt-4 text-sm opacity-80">
                      Served by: {ticket.teller_name}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="space-y-4">
          {(() => {
            const totalWaiting = Object.values(waitingCounts).reduce((a: number, b: any) => a + (b || 0), 0);
            const servicesWithCount = MAIN_CATEGORIES.filter((category) => {
              let count = waitingCounts[category.id] || 0;
              if (category.id === "transactions") {
                count += (waitingCounts["deposits"] || 0) + 
                         (waitingCounts["withdrawals"] || 0) + 
                         (waitingCounts["loan_payments"] || 0);
              }
              return count > 0;
            });

            if (totalWaiting === 0) {
              return (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="text-6xl mb-4">✓</div>
                  <h2 className="text-2xl font-semibold text-slate-300 mb-2">All Clear</h2>
                  <p className="text-slate-500">No customers currently waiting</p>
                </div>
              );
            }

            return (
              <>
                <h2 className="text-xl font-semibold text-slate-300">Waiting</h2>
                <div className="space-y-3">
                  {MAIN_CATEGORIES.map((category) => {
                    let count = waitingCounts[category.id] || 0;
                    if (category.id === "transactions") {
                      count += (waitingCounts["deposits"] || 0) + 
                               (waitingCounts["withdrawals"] || 0) + 
                               (waitingCounts["loan_payments"] || 0);
                    }
                    if (count === 0) return null;
                    return (
                      <div 
                        key={category.id}
                        className={`rounded-lg p-4 flex items-center justify-between ${category.color} bg-opacity-30`}
                      >
                        <span className="font-medium">{category.label}</span>
                        <span className="text-2xl font-bold">{count}</span>
                      </div>
                    );
                  })}
                </div>
                
                <div className="mt-8 pt-4 border-t border-slate-700">
                  <div className="text-sm text-slate-400 mb-2">Total Waiting</div>
                  <div className="text-4xl font-bold text-primary">{totalWaiting}</div>
                </div>
              </>
            );
          })()}
        </div>
      </div>

      <div className="p-4 bg-slate-800 text-center text-slate-400">
        <div className="text-lg">{currentTime.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
      </div>
    </div>
  );
}
