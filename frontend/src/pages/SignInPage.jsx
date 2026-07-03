import { SignIn } from "@clerk/clerk-react";
import { Gauge } from "lucide-react";

export function SignInPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-8">
      <div className="flex items-center gap-2">
        <div className="h-9 w-9 rounded-lg bg-accent/15 flex items-center justify-center">
          <Gauge className="h-5 w-5 text-accent" />
        </div>
        <span className="font-display font-semibold text-xl tracking-tight">Throttle</span>
      </div>
      <SignIn
        appearance={{
          variables: { colorPrimary: "#6ee7c8", colorBackground: "#12141b", colorText: "#e6e9ef" },
        }}
      />
    </div>
  );
}
