"use client";

import React, { useEffect, useState } from 'react';
import { AIJournalDashboard } from '@/components/ai-journal/AIJournalDashboard';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Loader2 } from 'lucide-react';

export default function AIJournalPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const getUser = async () => {
      setLoading(true);
      const { data, error } = await supabase.auth.getUser();
      
      if (error || !data?.user) {
        router.push("/login");
        return;
      }
      
      setUser(data.user);
      setLoading(false);
    };

    getUser();
  }, [router]);

  if (loading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading Let Me In...</span>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <AIJournalDashboard userId={user.id} />
    </div>
  );
} 