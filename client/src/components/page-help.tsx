import { HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface ContentSection {
  heading: string;
  body: string;
}

interface PageHelpProps {
  title: string;
  items?: string[];
  content?: ContentSection[];
  tip?: string;
}

export function PageHelp({ title, items, content, tip }: PageHelpProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-foreground"
          data-testid="button-page-help"
        >
          <HelpCircle className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-76 text-sm" align="end">
        <p className="font-semibold text-sm mb-2">{title}</p>
        {content && content.length > 0 ? (
          <div className="space-y-2.5 mb-3">
            {content.map((section, i) => (
              <div key={i}>
                <p className="text-xs font-medium text-foreground">{section.heading}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{section.body}</p>
              </div>
            ))}
          </div>
        ) : items && items.length > 0 ? (
          <ul className="space-y-1.5 mb-3">
            {items.map((item, i) => (
              <li key={i} className="flex gap-2 text-xs text-muted-foreground leading-relaxed">
                <span className="text-primary font-bold mt-0.5 shrink-0">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        ) : null}
        {tip && (
          <div className="bg-muted rounded-md px-3 py-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Tip: </span>{tip}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
