import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { DialogTitle } from "@/components/ui/dialog";
import { Search, Users, FileText, Banknote, BarChart3, Settings, HelpCircle } from "lucide-react";

interface GlobalSearchProps {
  organizationId: string | null;
  onNavigate: (section: string) => void;
}

interface MemberResult {
  id: string;
  first_name: string;
  last_name: string;
  member_number: string;
  status: string;
}

interface LoanResult {
  id: string;
  loan_number: string;
  status: string;
  amount: number;
  member_name?: string;
}

const QUICK_LINKS = [
  { label: "Members", section: "members", icon: Users, shortcut: "G M" },
  { label: "Loan Applications", section: "loans", icon: FileText, shortcut: "G L" },
  { label: "Transactions", section: "transactions", icon: Banknote, shortcut: "G T" },
  { label: "Analytics", section: "analytics", icon: BarChart3, shortcut: "G A" },
  { label: "Settings", section: "settings", icon: Settings, shortcut: "G S" },
];

export function GlobalSearch({ organizationId, onNavigate }: GlobalSearchProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const { data: memberResults } = useQuery<{ items: MemberResult[] }>({
    queryKey: ["/api/organizations", organizationId, "members", "search", debouncedQuery],
    queryFn: async () => {
      const res = await fetch(
        `/api/organizations/${organizationId}/members?search=${encodeURIComponent(debouncedQuery)}&per_page=5`,
        { credentials: "include" }
      );
      if (!res.ok) return { items: [] };
      return res.json();
    },
    enabled: !!organizationId && debouncedQuery.length >= 2,
  });

  const { data: loanResults } = useQuery<{ items: LoanResult[] }>({
    queryKey: ["/api/organizations", organizationId, "loans", "search", debouncedQuery],
    queryFn: async () => {
      const res = await fetch(
        `/api/organizations/${organizationId}/loans?search=${encodeURIComponent(debouncedQuery)}&per_page=5`,
        { credentials: "include" }
      );
      if (!res.ok) return { items: [] };
      return res.json();
    },
    enabled: !!organizationId && debouncedQuery.length >= 2,
  });

  const go = useCallback(
    (section: string) => {
      onNavigate(section);
      setOpen(false);
      setQuery("");
    },
    [onNavigate]
  );

  const isSearching = debouncedQuery.length >= 2;
  const members = memberResults?.items ?? [];
  const loans = loanResults?.items ?? [];

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="h-7 gap-1.5 text-xs text-muted-foreground hidden sm:flex items-center"
        onClick={() => setOpen(true)}
        data-testid="button-global-search"
      >
        <Search className="h-3 w-3" />
        <span>Search</span>
        <CommandShortcut className="ml-2">⌘K</CommandShortcut>
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 sm:hidden"
        onClick={() => setOpen(true)}
        data-testid="button-global-search-mobile"
      >
        <Search className="h-4 w-4" />
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <VisuallyHidden>
          <DialogTitle>Search</DialogTitle>
        </VisuallyHidden>
        <CommandInput
          placeholder="Search members, loans, or navigate..."
          value={query}
          onValueChange={setQuery}
          data-testid="input-global-search"
        />
        <CommandList>
          {!isSearching && (
            <CommandGroup heading="Quick Navigation">
              {QUICK_LINKS.map((link) => (
                <CommandItem
                  key={link.section}
                  onSelect={() => go(link.section)}
                  data-testid={`search-nav-${link.section}`}
                >
                  <link.icon className="h-4 w-4 text-muted-foreground" />
                  <span>{link.label}</span>
                  <CommandShortcut>{link.shortcut}</CommandShortcut>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {isSearching && members.length === 0 && loans.length === 0 && (
            <CommandEmpty>
              No results found for &ldquo;{debouncedQuery}&rdquo;
            </CommandEmpty>
          )}

          {isSearching && members.length > 0 && (
            <>
              <CommandGroup heading="Members">
                {members.map((m) => (
                  <CommandItem
                    key={m.id}
                    onSelect={() => go("members")}
                    data-testid={`search-member-${m.id}`}
                  >
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <div className="flex flex-col">
                      <span className="font-medium">{m.first_name} {m.last_name}</span>
                      <span className="text-xs text-muted-foreground">{m.member_number}</span>
                    </div>
                    <span className="ml-auto text-xs text-muted-foreground capitalize">{m.status}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
              {loans.length > 0 && <CommandSeparator />}
            </>
          )}

          {isSearching && loans.length > 0 && (
            <CommandGroup heading="Loans">
              {loans.map((l) => (
                <CommandItem
                  key={l.id}
                  onSelect={() => go("loans")}
                  data-testid={`search-loan-${l.id}`}
                >
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <div className="flex flex-col">
                    <span className="font-medium">{l.loan_number}</span>
                    {l.member_name && (
                      <span className="text-xs text-muted-foreground">{l.member_name}</span>
                    )}
                  </div>
                  <span className="ml-auto text-xs text-muted-foreground capitalize">{l.status?.replace(/_/g, " ")}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          <CommandSeparator />
          <CommandGroup heading="Help">
            <CommandItem onSelect={() => go("settings")} data-testid="search-nav-help">
              <HelpCircle className="h-4 w-4 text-muted-foreground" />
              <span>Go to Settings</span>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
