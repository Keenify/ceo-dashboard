"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Terminal } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

function SettingsPageInner() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmittingPassword, setIsSubmittingPassword] = useState(false);
  const [isSubmittingName, setIsSubmittingName] = useState(false);
  const [isGoogleConnected, setIsGoogleConnected] = useState(false);
  const [isGoogleStatusLoading, setIsGoogleStatusLoading] = useState(false);
  const [isDisconnectingGoogle, setIsDisconnectingGoogle] = useState(false);
  const [activeTab, setActiveTab] = useState("profile");
  const router = useRouter();
  const searchParams = useSearchParams();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [displayName, setDisplayName] = useState("");

  // Google OAuth config
  const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!;
  const REDIRECT_URI = `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/google/oauth/callback`;
  const SCOPE = "https://www.googleapis.com/auth/calendar";
  const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

  useEffect(() => {
    // Check URL for tab parameter
    const tabParam = searchParams.get("tab");
    if (tabParam && ["profile", "security", "integrations"].includes(tabParam)) {
      setActiveTab(tabParam);
    }

    const getUser = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data?.user) {
        router.push("/login");
        return;
      }
      setUser(data.user);
      setDisplayName(data.user.user_metadata?.display_name || "");
      
      // Check Google connection status from backend
      await checkGoogleConnectionStatus(data.user.id);
      
      setLoading(false);
    };
    getUser();
  }, [searchParams, router]);

  const checkGoogleConnectionStatus = async (userId: string) => {
    setIsGoogleStatusLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/user-google-tokens/google/status?user_id=${userId}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setIsGoogleConnected(data.connected);
      } else {
        console.error("Failed to check Google connection status");
      }
    } catch (error) {
      console.error("Error checking Google connection:", error);
    } finally {
      setIsGoogleStatusLoading(false);
    }
  };

  const handleUpdatePassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    setError(null);

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    setIsSubmittingPassword(true);

    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (updateError) {
      setError(updateError.message);
    } else {
      setMessage("Password updated successfully!");
      setNewPassword("");
      setConfirmPassword("");
    }
    setIsSubmittingPassword(false);
  };

  const handleUpdateDisplayName = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    setError(null);
    const newName = displayName.trim();
    if (!newName) {
        setError("Display name cannot be empty.");
        return;
    }
    if (newName === (user?.user_metadata?.display_name || "")) {
        setMessage("Display name is already set to this value.");
        return;
    }

    setIsSubmittingName(true);
    const { data: updatedUserData, error: updateError } = await supabase.auth.updateUser({
      data: { display_name: newName }
    });

    if (updateError) {
      setError(updateError.message);
    } else {
      setMessage("Display name updated successfully!");
      setUser(updatedUserData.user);
    }
    setIsSubmittingName(false);
  };

  const handleConnectGoogle = () => {
    const params = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      response_type: "code",
      access_type: "offline",
      prompt: "consent",
      scope: SCOPE,
    });

    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  };

  const handleDisconnectGoogle = async () => {
    if (!user) return;
    
    try {
      setMessage(null);
      setError(null);
      setIsDisconnectingGoogle(true);
      
      const response = await fetch(`${BACKEND_URL}/user-google-tokens/google/disconnect?user_id=${user.id}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        }
      });
      
      if (response.ok) {
        setIsGoogleConnected(false);
        setMessage("Google Calendar disconnected successfully!");
      } else {
        const errorData = await response.json();
        setError(errorData.detail || "Failed to disconnect Google Calendar. Please try again.");
      }
    } catch (error) {
      console.error("Error disconnecting Google Calendar:", error);
      setError("An error occurred while disconnecting Google Calendar.");
    } finally {
      setIsDisconnectingGoogle(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-2xl space-y-8">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-3xl font-bold">Settings</h1>
        </div>

        {message && (
          <Alert className="mb-6 border-green-500">
            <Terminal className="h-4 w-4" />
            <AlertTitle className="text-green-700">Success!</AlertTitle>
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        )}
        {error && (
          <Alert variant="destructive" className="mb-6">
            <Terminal className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue={activeTab} className="w-full">
          <TabsList className="w-full">
            <TabsTrigger className="flex-1" value="profile">Profile</TabsTrigger>
            <TabsTrigger className="flex-1" value="security">Security</TabsTrigger>
            <TabsTrigger className="flex-1" value="integrations">Integrations</TabsTrigger>
          </TabsList>
          
          <TabsContent value="profile" className="mt-6">
            <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
              <h2 className="mb-4 text-xl font-semibold">Profile Information</h2>
              <form onSubmit={handleUpdateDisplayName} className="space-y-4">
                <div>
                  <Label htmlFor="displayName">Display Name</Label>
                  <Input
                    id="displayName"
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Your Name"
                  />
                </div>
                <Button type="submit" disabled={isSubmittingName}>
                  {isSubmittingName ? "Saving..." : "Save Display Name"}
                </Button>
              </form>
            </div>
          </TabsContent>
          
          <TabsContent value="security" className="mt-6">
            <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
              <h2 className="mb-4 text-xl font-semibold">Change Password</h2>
              <form onSubmit={handleUpdatePassword} className="space-y-4">
                <div>
                  <Label htmlFor="newPassword">New Password</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                </div>
                <div>
                  <Label htmlFor="confirmPassword">Confirm New Password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                </div>
                <Button type="submit" disabled={isSubmittingPassword}>
                  {isSubmittingPassword ? "Updating..." : "Update Password"}
                </Button>
              </form>
            </div>
          </TabsContent>
          
          <TabsContent value="integrations" className="mt-6">
            <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
              <h2 className="mb-6 text-xl font-semibold">Integrations</h2>
              
              <div className="space-y-8">
                {/* Google Calendar Integration Card */}
                <div className="relative overflow-hidden rounded-xl border border-gray-100 bg-gradient-to-br from-white to-gray-50 p-6 shadow-sm transition-all hover:shadow-md dark:border-gray-800 dark:from-gray-900 dark:to-gray-950">
                  <div className="flex items-start">
                    <div className="mr-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
                        <path fill="#4285F4" d="M12 24c6.624 0 12-5.376 12-12s-5.376-12-12-12S0 5.376 0 12s5.376 12 12 12z"/>
                        <path fill="#fff" d="M16 12.23c0-.28-.02-.55-.07-.81H12v1.55h2.24c-.1.52-.39.97-.83 1.26v1.04h1.34c.79-.72 1.25-1.79 1.25-3.04z"/>
                        <path fill="#fff" d="M12 16.46c1.11 0 2.04-.37 2.73-1l-1.34-1.04c-.37.25-.83.39-1.39.39-.96 0-1.78-.65-2.07-1.52H8.9v1.08c.61 1.21 1.85 2.09 3.1 2.09z"/>
                        <path fill="#fff" d="M9.93 13.29c-.15-.46-.15-.95 0-1.4V10.8H8.9c-.61 1.21-.61 2.63 0 3.84l1.03-1.35z"/>
                        <path fill="#fff" d="M12 10.58c.53 0 1.01.18 1.38.53l1.18-1.18C13.85 9.33 12.95 9 12 9c-1.26 0-2.5.87-3.1 2.09l1.03 1.05c.29-.87 1.11-1.56 2.07-1.56z"/>
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-medium text-foreground">Google Calendar</h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Sync your calendar events, create meetings and manage your schedule directly from the dashboard.
                      </p>
                    </div>
                  </div>
                  
                  <div className="mt-6">
                    {isGoogleStatusLoading ? (
                      <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-t-primary border-r-transparent border-b-transparent border-l-transparent"></div>
                        <span>Checking connection status...</span>
                      </div>
                    ) : isGoogleConnected ? (
                      <div className="space-y-4">
                        <div className="flex items-center space-x-2">
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-green-100 text-green-600 dark:bg-green-900/30">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="h-4 w-4">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                          <span className="text-sm font-medium text-green-600 dark:text-green-400">Connected to Google Calendar</span>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <Button 
                            onClick={handleDisconnectGoogle}
                            variant="outline"
                            size="sm"
                            className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
                            disabled={isDisconnectingGoogle}
                          >
                            {isDisconnectingGoogle ? (
                              <>
                                <div className="mr-2 h-3 w-3 animate-spin rounded-full border-2 border-t-current border-r-transparent border-b-transparent border-l-transparent"></div>
                                Disconnecting...
                              </>
                            ) : (
                              <>
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="mr-1 h-4 w-4">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                                Disconnect
                              </>
                            )}
                          </Button>
                          
                          <Button 
                            variant="ghost"
                            size="sm"
                            className="text-muted-foreground hover:text-foreground"
                            onClick={() => window.open("https://calendar.google.com", "_blank")}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="mr-1 h-4 w-4">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                            Open Google Calendar
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button 
                        onClick={handleConnectGoogle}
                        className="group flex items-center space-x-2 bg-[#4285F4] text-white hover:bg-[#3367d6]"
                      >
                        <div className="rounded bg-white p-1">
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16">
                            <path fill="#4285F4" d="M12 24c6.624 0 12-5.376 12-12s-5.376-12-12-12S0 5.376 0 12s5.376 12 12 12z"/>
                            <path fill="#fff" d="M16 12.23c0-.28-.02-.55-.07-.81H12v1.55h2.24c-.1.52-.39.97-.83 1.26v1.04h1.34c.79-.72 1.25-1.79 1.25-3.04z"/>
                            <path fill="#fff" d="M12 16.46c1.11 0 2.04-.37 2.73-1l-1.34-1.04c-.37.25-.83.39-1.39.39-.96 0-1.78-.65-2.07-1.52H8.9v1.08c.61 1.21 1.85 2.09 3.1 2.09z"/>
                            <path fill="#fff" d="M9.93 13.29c-.15-.46-.15-.95 0-1.4V10.8H8.9c-.61 1.21-.61 2.63 0 3.84l1.03-1.35z"/>
                            <path fill="#fff" d="M12 10.58c.53 0 1.01.18 1.38.53l1.18-1.18C13.85 9.33 12.95 9 12 9c-1.26 0-2.5.87-3.1 2.09l1.03 1.05c.29-.87 1.11-1.56 2.07-1.56z"/>
                          </svg>
                        </div>
                        <span>Connect Google Calendar</span>
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="ml-1 h-4 w-4 transition-all duration-200 group-hover:translate-x-1">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                        </svg>
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><p>Loading...</p></div>}>
      <SettingsPageInner />
    </Suspense>
  );
} 