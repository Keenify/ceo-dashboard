"use client"; // Add if client-side interactions might be needed later

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Toaster } from "@/components/ui/toast";
import { Landmark, TrendingUp } from "lucide-react"; // Add TrendingUp icon
import { cn } from "@/lib/utils";
import NetWorthSection from "@/components/personal-finance/net-worth/net-worth";
import CashFlowSection from "@/components/personal-finance/cash-flow/cash-flow";

export default function PersonalFinancePage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("networth"); // Default tab

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
    <div className="py-8"> {/* Removed container and mx-auto */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="mb-4"> {/* Removed border-b here too */}
          <TabsList className="w-full flex justify-center h-12 border-none bg-none">
            <TabsTrigger 
              value="networth" 
              className={cn(
                "flex-1 rounded-none border-b-2 border-transparent px-4 py-3 text-sm font-medium data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
              )}
            >
              <Landmark className="w-4 h-4 mr-2" />
              Net Worth
            </TabsTrigger>
            <TabsTrigger 
              value="cash-flow" 
              className={cn(
                "flex-1 rounded-none border-b-2 border-transparent px-4 py-3 text-sm font-medium data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
              )}
            >
              <TrendingUp className="w-4 h-4 mr-2" />
              Cash Flow
            </TabsTrigger>
          </TabsList>
        </div>
        
        <TabsContent value="networth" className="mt-4 focus-visible:outline-none focus-visible:ring-0">
          {/* Pass userId if NetWorthSection needs it: userId={user.id} */}
          {user && <NetWorthSection userId={user.id} />}
        </TabsContent>
        
        <TabsContent value="cash-flow" className="mt-4 focus-visible:outline-none focus-visible:ring-0">
          {/* Pass userId if CashFlowSection needs it: userId={user.id} */}
          {user && <CashFlowSection userId={user.id} />}
        </TabsContent>
      </Tabs>
      
      <Toaster />
    </div>
  );
}
