"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function AuthCallback() {
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'unauthorized'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Check if this is a recovery flow first - if so, redirect immediately without processing
        const urlParams = new URLSearchParams(window.location.hash.substring(1));
        const tokenType = urlParams.get('type');
        
        if (tokenType === 'recovery') {
          // This is a password reset flow, redirect immediately to reset-password page
          const currentHash = window.location.hash;
          window.location.href = `/reset-password${currentHash}`;
          return;
        }

        // Get the auth data from the URL hash
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Auth error:', error);
          setStatus('error');
          setMessage('Authentication failed. Please try again.');
          return;
        }

        if (data.session?.user) {
          const userEmail = data.session.user.email;
          const user = data.session.user;
          
          if (!userEmail) {
            setStatus('error');
            setMessage('No email found in your account.');
            return;
          }

          // Check if this is a Google OAuth authentication
          const isGoogleAuth = user.app_metadata?.provider === 'google' || 
                              user.identities?.some(identity => identity.provider === 'google');

          if (isGoogleAuth) {
            // Allow any Google OAuth user to access the application
            setStatus('success');
            setMessage('Successfully authenticated! Redirecting...');
            
            // Redirect to dashboard after a brief success message
            setTimeout(() => {
              router.push('/dashboard');
            }, 1500);
          } else {
            // For non-Google auth methods, check authorization
            // Check if user email exists in your users table or admin list
            const { data: userData, error: userError } = await supabase
              .from('users') // Replace with your actual table name
              .select('email')
              .eq('email', userEmail)
              .single();

            // Alternative: Check against admin emails array
            const ADMIN_EMAILS = [
              'tanengkeen@gmail.com',
              'czy199162@gmail.com', 
              'ethankiau@gmail.com',
              'ianlim5@gmail.com',
              'eng@autolabkit.com',
              'ethankiau0@gmail.com',
              'leonchan.tkg@gmail.com'
            ];

            const isAuthorized = userData || ADMIN_EMAILS.includes(userEmail);

            if (isAuthorized) {
              setStatus('success');
              setMessage('Successfully authenticated! Redirecting...');
              
              // Redirect to dashboard after a brief success message
              setTimeout(() => {
                router.push('/dashboard');
              }, 1500);
            } else {
              // Sign out the user since they're not authorized
              await supabase.auth.signOut();
              setStatus('unauthorized');
              setMessage(`Access denied. Email ${userEmail} is not authorized to access this application.`);
            }
          }
        } else {
          setStatus('error');
          setMessage('No user session found.');
        }
      } catch (err) {
        console.error('Callback error:', err);
        setStatus('error');
        setMessage('An unexpected error occurred.');
      }
    };

    handleAuthCallback();
  }, [router]);

  const handleReturnToLogin = () => {
    router.push('/login');
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-md space-y-6 rounded-lg border border-border bg-card p-8 shadow-sm text-center">
        {status === 'loading' && (
          <>
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="text-muted-foreground">Verifying your account...</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="rounded-full h-12 w-12 bg-green-100 mx-auto flex items-center justify-center">
              <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-foreground">Welcome!</h2>
            <p className="text-muted-foreground">{message}</p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="rounded-full h-12 w-12 bg-red-100 mx-auto flex items-center justify-center">
              <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-foreground">Authentication Failed</h2>
            <p className="text-muted-foreground">{message}</p>
            <button
              onClick={handleReturnToLogin}
              className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
            >
              Return to Login
            </button>
          </>
        )}

        {status === 'unauthorized' && (
          <>
            <div className="rounded-full h-12 w-12 bg-yellow-100 mx-auto flex items-center justify-center">
              <svg className="h-6 w-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-foreground">Access Denied</h2>
            <p className="text-muted-foreground">{message}</p>
            <button
              onClick={handleReturnToLogin}
              className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
            >
              Return to Login
            </button>
          </>
        )}
      </div>
    </div>
  );
} 