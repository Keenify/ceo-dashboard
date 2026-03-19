"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sparkles, Activity, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import ManifestationSection from "@/components/manifestation/ManifestationSection";
import FlyWheelSection from "@/components/manifestation/FlyWheelSection";

export default function ManifestationPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("manifestation");

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

  const handleDownloadPDF = () => {
    window.print();
  };

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center">Loading...</div>;
  }

  return (
    <>
      <style jsx global>{`
        @media print {
          .no-print {
            display: none !important;
          }
          .print-break-inside-avoid {
            break-inside: avoid;
          }
          .print-break-before {
            break-before: page;
          }
          body {
            -webkit-print-color-adjust: exact;
            color-adjust: exact;
            margin: 0 !important;
            padding: 0 !important;
          }
          /* Page settings for optimal centering */
          @page {
            margin: 0.5in !important;
          }
          /* Scale content to fit one page - different for portrait vs landscape */
          html {
            zoom: 0.75 !important; /* Default for landscape */
          }
          @media print and (orientation: portrait) {
            html {
              zoom: 0.95 !important; /* Maximize for portrait */
            }
          }
          /* Perfect horizontal and vertical centering */
          html, body {
            height: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            display: flex !important;
            justify-content: center !important;
            align-items: center !important;
          }
          .container {
            max-width: 7.5in !important;
            width: 7.5in !important;
            margin: 0 !important;
            padding: 0.15in !important;
            transform: none !important;
            position: relative !important;
          }
          /* Prevent page breaks */
          * {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          /* Balanced spacing for better readability */
          .space-y-8 > * + * {
            margin-top: 0.4rem !important;
          }
          .space-y-6 > * + * {
            margin-top: 0.3rem !important;
          }
          .space-y-4 > * + * {
            margin-top: 0.2rem !important;
          }
          .space-y-3 > * + * {
            margin-top: 0.15rem !important;
          }
          /* Better card padding for readability */
          .p-4 {
            padding: 0.4rem !important;
          }
          .p-6 {
            padding: 0.5rem !important;
          }
          /* Compact but readable font sizes */
          .text-3xl {
            font-size: 1.2rem !important;
            line-height: 1.1 !important;
          }
          .text-2xl {
            font-size: 1.1rem !important;
            line-height: 1.1 !important;
          }
          .text-xl {
            font-size: 1rem !important;
            line-height: 1.1 !important;
          }
          .text-lg {
            font-size: 0.9rem !important;
            line-height: 1.1 !important;
          }
          .text-sm {
            font-size: 0.8rem !important;
            line-height: 1 !important;
          }
          /* Force all grids to work in print */
          .grid {
            display: grid !important;
          }
          /* Override responsive behavior - force 2 columns minimum */
          .grid[class*="md:grid-cols-2"] {
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 0.3rem !important;
          }
          /* Override responsive behavior - force 4 columns */
          .grid[class*="lg:grid-cols-4"] {
            grid-template-columns: repeat(4, 1fr) !important;
            gap: 0.4rem !important;
          }
          /* Specific class targeting */
          .manifestation-bottom-grid {
            display: grid !important;
            grid-template-columns: repeat(4, 1fr) !important;
            gap: 0.4rem !important;
          }
          /* Force any remaining grids */
          div[class*="grid-cols"] {
            display: grid !important;
          }
          /* Minimal margins for sections */
          .mb-8 {
            margin-bottom: 0.4rem !important;
          }
          .py-8 {
            padding-top: 0.3rem !important;
            padding-bottom: 0.3rem !important;
          }
          .mb-4 {
            margin-bottom: 0.2rem !important;
          }
          /* Minimal arrow spacing */
          .-mt-0, .-mb-4 {
            margin: 0 !important;
          }
          /* Compact card header spacing */
          .py-2 {
            padding-top: 0.25rem !important;
            padding-bottom: 0.25rem !important;
          }
          /* Better list item spacing for readability */
          .space-y-3 li, .space-y-4 li {
            margin-bottom: 0.2rem !important;
          }
          /* Extra spacing for bottom grid items */
          .manifestation-bottom-grid .space-y-3 li {
            margin-bottom: 0.25rem !important;
            padding: 0.1rem 0 !important;
          }
          /* Compact numbered circles */
          .w-8.h-8, .w-7.h-7 {
            width: 1.25rem !important;
            height: 1.25rem !important;
            font-size: 0.7rem !important;
          }
          /* Ensure proper text wrapping in print */
          span, div {
            word-wrap: break-word !important;
            overflow-wrap: break-word !important;
          }
          /* Center title section */
          .text-center {
            text-align: center !important;
          }
        }
      `}</style>
      
      <div className="container mx-auto py-8 max-w-6xl relative">

        <Tabs defaultValue="manifestation" value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="mb-4">
            <TabsList className="w-full flex justify-center h-12 border-none bg-none no-print">
              <TabsTrigger 
                value="manifestation" 
                className={cn(
                  "flex-1 max-w-[240px] rounded-none border-b-2 border-transparent px-6 py-3 text-sm font-medium data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                )}
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Manifestation
              </TabsTrigger>
              <TabsTrigger 
                value="flywheel" 
                className={cn(
                  "flex-1 max-w-[240px] rounded-none border-b-2 border-transparent px-6 py-3 text-sm font-medium data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                )}
              >
                <Activity className="w-4 h-4 mr-2" />
                Fly Wheel
              </TabsTrigger>
            </TabsList>
          </div>
          
          <TabsContent value="manifestation" className="mt-4 focus-visible:outline-none focus-visible:ring-0">
            {user && <ManifestationSection userId={user.id} />}
          </TabsContent>
          
          <TabsContent value="flywheel" className="mt-4 focus-visible:outline-none focus-visible:ring-0 print-break-before">
            {user && <FlyWheelSection userId={user.id} />}
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}