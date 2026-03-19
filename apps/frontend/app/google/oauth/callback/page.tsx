"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import { supabase } from "@/lib/supabase";

function GoogleOAuthCallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"loading" | "error" | "success">("loading");
  const [message, setMessage] = useState("Processing your Google Calendar connection...");

  useEffect(() => {
    const code = searchParams.get("code");
    const error = searchParams.get("error");

    if (error) {
      setStatus("error");
      setMessage("Failed to connect your Google Calendar. Please try again.");
      setTimeout(() => router.push("/settings"), 3000);
      return;
    }

    if (!code) {
      setStatus("error");
      setMessage("No authorization code received. Please try again.");
      setTimeout(() => router.push("/settings"), 3000);
      return;
    }

    const exchangeCode = async () => {
      try {
        // Get current user to get the user ID
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        
        if (userError || !user) {
          throw new Error("Authentication required");
        }

        // Get the exact redirect URI that was used (important for OAuth)
        const redirectUri = `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/google/oauth/callback`;
        console.log(`Using redirect URI: ${redirectUri}`);
        
        // Call the FastAPI backend instead of Next.js API route
        const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000"}/user-google-tokens/google/oauth/exchange?user_id=${user.id}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ 
            code,
            redirect_uri: redirectUri
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          console.error("Exchange error details:", errorData);
          
          // Special handling for 400 errors which might be from Google
          if (response.status === 400) {
            console.error("Google OAuth error - code might be expired or already used");
            throw new Error(errorData.detail || "Failed to exchange code. The authorization might have expired.");
          } else {
            throw new Error(errorData.detail || "Failed to exchange code for tokens");
          }
        }

        setStatus("success");
        setMessage("Successfully connected your Google Calendar!");
        
        // Redirect to settings with integrations tab active
        setTimeout(() => router.push("/settings?tab=integrations"), 2000);
      } catch (error) {
        console.error("Error exchanging code:", error);
        setStatus("error");
        setMessage("Failed to complete Google Calendar integration. Please try again.");
        setTimeout(() => router.push("/settings"), 3000);
      }
    };

    exchangeCode();
  }, [searchParams, router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-card rounded-lg border border-border p-8 shadow-lg">
        <div className="flex flex-col items-center text-center space-y-4">
          {status === "loading" && (
            <div className="w-12 h-12 border-4 border-t-primary border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin mb-4"></div>
          )}
          
          {status === "success" && (
            <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-8 h-8">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          )}
          
          {status === "error" && (
            <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-8 h-8">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
          )}
          
          <h2 className="text-2xl font-bold">
            {status === "loading" ? "Connecting..." : 
             status === "success" ? "Connected!" : 
             "Connection Failed"}
          </h2>
          
          <p className="text-muted-foreground">{message}</p>
          
          {status === "error" && (
            <button
              onClick={() => router.push("/settings")}
              className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
            >
              Return to Settings
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function GoogleOAuthCallback() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><p>Loading...</p></div>}>
      <GoogleOAuthCallbackInner />
    </Suspense>
  );
} 