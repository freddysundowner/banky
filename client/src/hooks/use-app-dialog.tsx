import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import {
  AlertDialog, AlertDialogAction, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type DialogMessage = {
  title: string;
  description?: string;
  variant?: "default" | "destructive";
};

type AppDialogContextType = {
  toast: (msg: DialogMessage) => void;
};

const AppDialogContext = createContext<AppDialogContextType>({ toast: () => {} });

export function AppDialogProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<DialogMessage[]>([]);

  const toast = useCallback((msg: DialogMessage) => {
    setQueue(q => [...q, msg]);
  }, []);

  const current = queue[0];

  const handleClose = () => setQueue(q => q.slice(1));

  return (
    <AppDialogContext.Provider value={{ toast }}>
      {children}
      <AlertDialog open={!!current} onOpenChange={o => { if (!o) handleClose(); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className={current?.variant === "destructive" ? "text-destructive" : ""}>
              {current?.title}
            </AlertDialogTitle>
            {current?.description && (
              <AlertDialogDescription>{current.description}</AlertDialogDescription>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={handleClose}>OK</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppDialogContext.Provider>
  );
}

export function useAppDialog() {
  return useContext(AppDialogContext);
}
