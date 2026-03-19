"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle, Eye, EyeOff, Lock } from "lucide-react";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isValidSession, setIsValidSession] = useState<boolean | null>(null);
  
  const router = useRouter();

  useEffect(() => {
    const checkSession = async (attempt = 1, maxAttempts = 10) => {
      // Check URL search params for direct verification calls
      const searchParams = new URLSearchParams(window.location.search);
      const verifyToken = searchParams.get('token');
      const verifyType = searchParams.get('type');
      
      // If we have verification params, this is a direct call from email
      if (verifyToken && verifyType === 'recovery') {
        try {
          // For recovery tokens, we need to use exchangeCodeForSession or handle differently
          // First, try to get the session which should be established by the verification endpoint
          await new Promise(resolve => setTimeout(resolve, 500)); // Wait a bit for session to establish
          
          const { data: { session }, error } = await supabase.auth.getSession();
          
          if (session?.user?.aud === 'recovery') {
            setIsValidSession(true);
            return;
          }
          
          // If no recovery session, manually try to refresh auth state
          const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
          
          if (refreshData?.session?.user?.aud === 'recovery') {
            setIsValidSession(true);
            return;
          }
          
          setIsValidSession(false);
          return;
          
        } catch (err) {
          setIsValidSession(false);
          return;
        }
      }
      
      // Check if we have recovery tokens in URL hash
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const tokenType = hashParams.get('type');
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');
      
      if (tokenType === 'recovery' && accessToken) {
        setIsValidSession(true);
        return;
      }
      
      // Check current session for recovery audience
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (session?.user?.aud === 'recovery') {
        setIsValidSession(true);
        return;
      }
      
      // If we have an authenticated session on the first attempt, sign out and retry
      if (session?.user && session.user.aud === 'authenticated' && attempt === 1) {
        await supabase.auth.signOut();
        setTimeout(() => checkSession(attempt + 1, maxAttempts), 1000);
        return;
      }
      
      // If we have no session or still authenticated after signout, wait for recovery session
      if (attempt < maxAttempts) {
        setTimeout(() => checkSession(attempt + 1, maxAttempts), 1000);
        return;
      }
      
      setIsValidSession(false);
    };

    checkSession();

    // Prevent navigation away from this page during password reset
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = 'Are you sure you want to leave? Your password reset will be cancelled.';
    };

    const handlePopState = (e: PopStateEvent) => {
      e.preventDefault();
      // Push the current state back to prevent navigation
      window.history.pushState(null, '', window.location.href);
    };

    // Add event listeners
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('popstate', handlePopState);
    
    // Push initial state to prevent back navigation
    window.history.pushState(null, '', window.location.href);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  const validatePassword = () => {
    if (password.length < 6) {
      return "Password must be at least 6 characters long";
    }
    if (password !== confirmPassword) {
      return "Passwords do not match";
    }
    return null;
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const validationError = validatePassword();
    if (validationError) {
      setError(validationError);
      setLoading(false);
      return;
    }

    try {
      // First, ensure we have a valid session by setting it from URL tokens if needed
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');
      const tokenType = hashParams.get('type');
      
      if (tokenType === 'recovery' && accessToken && refreshToken) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken
        });
        
        if (sessionError) {
          // Continue anyway, maybe the session is already set
        }
      }

      const { error } = await supabase.auth.updateUser({
        password: password
      });

      if (error) {
        throw error;
      }

      setSuccess(true);
      
      // Sign out the user to end the recovery session
      await supabase.auth.signOut();
      
      // Redirect to login page after 3 seconds
      setTimeout(() => {
        router.push("/login");
        router.refresh();
      }, 3000);
      
    } catch (error: any) {
      setError(error.message || "An error occurred while updating password");
    } finally {
      setLoading(false);
    }
  };

  // Loading state while checking session
  if (isValidSession === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="w-full max-w-md space-y-8 rounded-lg border border-border bg-card p-8 shadow-sm">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-sm text-muted-foreground">Verifying reset link...</p>
          </div>
        </div>
      </div>
    );
  }

  // Invalid session (user didn't come from email link)
  if (!isValidSession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="w-full max-w-md space-y-8 rounded-lg border border-border bg-card p-8 shadow-sm">
          <div className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20">
              <Lock className="h-8 w-8 text-red-600 dark:text-red-400" />
            </div>
            <h1 className="mt-4 text-2xl font-bold text-foreground">Invalid or expired link</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              The password reset link is invalid or has expired
            </p>
          </div>

          <div className="space-y-4">
            <Link href="/forgot-password">
              <Button className="w-full">
                Request new reset link
              </Button>
            </Link>
            
            <Link href="/login">
              <Button variant="ghost" className="w-full">
                Back to sign in
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Success state
  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="w-full max-w-md space-y-8 rounded-lg border border-border bg-card p-8 shadow-sm">
          <div className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/20">
              <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <h1 className="mt-4 text-2xl font-bold text-foreground">Password updated!</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Your password has been successfully updated
            </p>
          </div>

          <div className="rounded-md bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-4">
            <div className="text-sm text-green-800 dark:text-green-200">
              <p>You will be redirected to the sign-in page in a few seconds...</p>
            </div>
          </div>

          <Button 
            onClick={async () => {
              await supabase.auth.signOut();
              router.push("/login");
              router.refresh();
            }}
            className="w-full"
          >
            Continue to sign in
          </Button>
        </div>
      </div>
    );
  }

  // Reset password form
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-md space-y-8 rounded-lg border border-border bg-card p-8 shadow-sm">


        <div className="text-center">
          <h1 className="text-3xl font-bold text-foreground">Set new password</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Please enter your new password below
          </p>
        </div>

        <form onSubmit={handleResetPassword} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="password">New Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter new password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="pr-10"
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 pr-3 flex items-center"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4 text-gray-400" />
                ) : (
                  <Eye className="h-4 w-4 text-gray-400" />
                )}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Must be at least 6 characters long
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm New Password</Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="pr-10"
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 pr-3 flex items-center"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                {showConfirmPassword ? (
                  <EyeOff className="h-4 w-4 text-gray-400" />
                ) : (
                  <Eye className="h-4 w-4 text-gray-400" />
                )}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={loading}
          >
            {loading ? "Updating..." : "Update password"}
          </Button>
        </form>

        {error && (
          <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="text-center text-sm text-muted-foreground">
          <p>
            Remember your password?{" "}
            <Link href="/login" className="text-primary hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
} 