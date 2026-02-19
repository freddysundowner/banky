import { useState, useEffect, useRef } from "react";
import { Building2, Database, Shield, CheckCircle2, Loader2, Settings } from "lucide-react";

interface SetupStep {
  label: string;
  icon: typeof Building2;
  duration: number;
}

const FULL_SETUP_STEPS: SetupStep[] = [
  { label: "Creating your organization", icon: Building2, duration: 1200 },
  { label: "Provisioning secure database", icon: Database, duration: 2000 },
  { label: "Configuring security settings", icon: Shield, duration: 1500 },
  { label: "Finalizing setup", icon: CheckCircle2, duration: 1000 },
];

const FINALIZE_STEPS: SetupStep[] = [
  { label: "Saving your preferences", icon: Settings, duration: 800 },
  { label: "Configuring workspace", icon: Database, duration: 1200 },
  { label: "Finalizing setup", icon: CheckCircle2, duration: 800 },
];

interface OrgSetupProgressProps {
  orgName: string;
  ready?: boolean;
  mode?: "full" | "finalize";
  onComplete: () => void;
}

export function OrgSetupProgress({ orgName, ready = false, mode = "full", onComplete }: OrgSetupProgressProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [animationDone, setAnimationDone] = useState(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const steps = mode === "full" ? FULL_SETUP_STEPS : FINALIZE_STEPS;

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;

    const advanceStep = (step: number) => {
      if (step < steps.length) {
        setCurrentStep(step);
        timeout = setTimeout(() => advanceStep(step + 1), steps[step].duration);
      } else {
        setAnimationDone(true);
      }
    };

    advanceStep(0);

    return () => clearTimeout(timeout);
  }, [steps.length]);

  useEffect(() => {
    if (animationDone && ready) {
      setCompleted(true);
      const timeout = setTimeout(() => onCompleteRef.current(), 800);
      return () => clearTimeout(timeout);
    }
  }, [animationDone, ready]);

  const heading = mode === "full"
    ? (completed ? "All Set!" : "Setting Up Your Organization")
    : (completed ? "You're All Set!" : "Finishing Up");

  const subtext = completed
    ? `${orgName} is ready to go`
    : mode === "full"
    ? `Preparing ${orgName} for you`
    : "Just a moment while we finalize everything";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
      <div className="w-full max-w-md mx-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary mx-auto mb-6">
          <Building2 className="h-8 w-8 text-primary-foreground" />
        </div>

        <h1 className="text-2xl font-bold mb-1">{heading}</h1>
        <p className="text-muted-foreground mb-10 text-sm">{subtext}</p>

        <div className="space-y-3 text-left mb-10">
          {steps.map((step, index) => {
            const StepIcon = step.icon;
            const isActive = currentStep === index && !completed;
            const isDone = currentStep > index || completed;
            const isWaiting = animationDone && !ready && index === steps.length - 1;

            return (
              <div
                key={index}
                className={`flex items-center gap-3 p-3 rounded-lg transition-all duration-300 ${
                  isActive || isWaiting
                    ? "bg-primary/5 border border-primary/20"
                    : isDone
                    ? "opacity-60"
                    : "opacity-30"
                }`}
              >
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors duration-300 ${
                    isDone && !isWaiting
                      ? "bg-primary/10 text-primary"
                      : isActive || isWaiting
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {isDone && !isWaiting ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : isActive || isWaiting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <StepIcon className="h-4 w-4" />
                  )}
                </div>
                <span
                  className={`text-sm font-medium transition-colors duration-300 ${
                    isActive || isWaiting
                      ? "text-foreground"
                      : "text-muted-foreground"
                  }`}
                >
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>

        <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
          <div
            className="bg-primary h-full rounded-full transition-all duration-500 ease-out"
            style={{
              width: completed
                ? "100%"
                : `${((currentStep + (animationDone ? 1 : 0)) / steps.length) * 100}%`,
            }}
          />
        </div>
      </div>
    </div>
  );
}
