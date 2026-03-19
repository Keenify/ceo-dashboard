"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, FolderOpen, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { usePlanka } from "./services/usePlanka";

export default function ProjectPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [isOnboarded, setIsOnboarded] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const { onboardUserByEmail, loading: onboardingLoading, error: onboardingError } = usePlanka();

  useEffect(() => {
    const initializeUser = async () => {
      setInitializing(true);
      
      const { data, error } = await supabase.auth.getUser();
      
      if (error || !data?.user) {
        router.push("/login");
        return;
      }
      
      setUser(data.user);
      setInitializing(false);
      
      // Auto-onboard user to Planka
      if (data.user.email) {
        try {
          console.log("Onboarding user to Planka:", data.user.email);
          const result = await onboardUserByEmail(data.user.email);
          console.log("Onboarding result:", result);
          
          if (result?.status === "success" || result?.status === "exists" || result?.status === "user_exists") {
            console.log("User successfully onboarded, showing iframe");
            setIsOnboarded(true);
          } else {
            console.error("Onboarding failed with status:", result?.status);
          }
        } catch (error) {
          console.error("Failed to onboard user to Planka:", error);
        }
      }
    };

    initializeUser();
  }, [router, onboardUserByEmail]);

  if (initializing) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <p>Loading project workspace...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>Redirecting to login...</p>
      </div>
    );
  }

  if (onboardingLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <p>Setting up your project workspace...</p>
        </div>
      </div>
    );
  }

  if (onboardingError && !isOnboarded) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="mx-auto max-w-4xl">
          <div className="mb-8 flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </button>
          </div>

          <div className="text-center py-16">
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-8 max-w-2xl mx-auto">
              <h2 className="text-2xl font-semibold text-destructive mb-4">
                Setup Error
              </h2>
              <p className="text-muted-foreground mb-6">
                Failed to set up your project workspace: {onboardingError.message}
              </p>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show iframe if user is onboarded OR if there's no onboarding error (fallback)
  if ((isOnboarded || !onboardingError) && user.email) {
    // Use direct proxy connection for better WebSocket support
    const iframeUrl = `${process.env.NEXT_PUBLIC_PLANKA_PROXY_URL}/planka-login?email=${encodeURIComponent(user.email)}`;
    
    return (
      <div className="min-h-screen bg-background">
        {/* Header bar */}
        <div className="bg-card border-b p-4 flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </button>
          <div className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5 text-sky-500" />
            <h1 className="text-lg font-semibold">Project Management</h1>
          </div>
        </div>

        {/* Planka iframe */}
        <div className="h-[calc(100vh-73px)]">
          <iframe
            src={iframeUrl}
            className="w-full h-full border-0"
            title="Planka Project Management"
            sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-top-navigation"
            onError={(e) => {
              console.error('Iframe loading error:', e);
            }}
          />
        </div>
      </div>
    );
  }

  // This should not be reached with the improved logic above
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        <p>Preparing workspace...</p>
      </div>
    </div>
  );
}
