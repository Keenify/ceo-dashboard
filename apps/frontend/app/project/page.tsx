"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, FolderOpen, Clock } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function ProjectPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data?.user) {
        router.push("/login");
        return;
      }
      setLoading(false);
    };

    checkAuth();
  }, [router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

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

      {/* Upcoming message */}
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-73px)] text-center px-6">
        <div className="flex flex-col items-center gap-4 max-w-md">
          <div className="p-4 bg-sky-500/10 rounded-full">
            <Clock className="h-10 w-10 text-sky-500" />
          </div>
          <h2 className="text-2xl font-semibold">Coming Soon</h2>
          <p className="text-muted-foreground">
            Project management is currently being rebuilt. Check back soon for
            an improved experience.
          </p>
        </div>
      </div>
    </div>
  );
}
