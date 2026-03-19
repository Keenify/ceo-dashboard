"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Mail } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(false);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Use production URL in production, current origin in development
      const isProduction = process.env.NODE_ENV === 'production';
      const redirectUrl = isProduction 
        ? 'https://www.zackywacky.net/reset-password'
        : `${window.location.origin}/reset-password`;
      
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl,
      });

      if (error) {
        throw error;
      }

      setEmailSent(true);
    } catch (error: any) {
      setError(error.message || "An error occurred while sending reset email");
    } finally {
      setLoading(false);
    }
  };

  if (emailSent) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="w-full max-w-md space-y-8 rounded-lg border border-border bg-card p-8 shadow-sm">
          <div className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/20">
              <Mail className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <h1 className="mt-4 text-2xl font-bold text-foreground">Check your email</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              We've sent a password reset link to
            </p>
            <p className="font-semibold text-foreground">{email}</p>
          </div>

          <div className="rounded-md bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-4">
            <div className="text-sm text-blue-800 dark:text-blue-200">
              <p className="font-medium">Instructions:</p>
              <ul className="mt-2 list-disc list-inside space-y-1">
                <li>Check your email inbox</li>
                <li>Click the "Reset Password" link</li>
                <li>Create a new password</li>
                <li>Sign in with your new password</li>
              </ul>
            </div>
          </div>

          <div className="space-y-4">
            <Button
              variant="outline"
              onClick={() => setEmailSent(false)}
              className="w-full"
            >
              Send another email
            </Button>
            
            <Link href="/login">
              <Button variant="ghost" className="w-full">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to sign in
              </Button>
            </Link>
          </div>

          <p className="text-xs text-center text-muted-foreground">
            Didn't receive the email? Check your spam folder or try again with a different email address.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-md space-y-8 rounded-lg border border-border bg-card p-8 shadow-sm">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-foreground">Forgot password?</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            No worries, we'll send you reset instructions
          </p>
        </div>

        <form onSubmit={handleResetPassword} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="Enter your email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              Enter the email address associated with your account
            </p>
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={loading}
          >
            {loading ? "Sending..." : "Send reset instructions"}
          </Button>
        </form>

        {error && (
          <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <Link href="/login">
          <Button variant="ghost" className="w-full">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to sign in
          </Button>
        </Link>

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