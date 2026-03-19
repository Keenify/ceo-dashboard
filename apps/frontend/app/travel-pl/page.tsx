"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Toaster } from "@/components/ui/toast";
import TravelPLSection from "@/components/travel-pl/travel-pl";

export default function TravelPLPage() {
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

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center">Loading...</div>;
  }

  return (
    <div className="p-6">
      <div className="text-center mb-6">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100">Travel P&L</h1>
        <p className="text-lg text-gray-600 dark:text-gray-400 mt-2">Track your travel expenses and profit/loss by destination</p>
      </div>
      
      {user && <TravelPLSection userId={user.id} />}
      <Toaster />
    </div>
  );
} 