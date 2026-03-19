"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { IkigaiDiagram, type IkigaiDiagramRef } from "@/components/ikigai/IkigaiDiagram";
import { Button } from "@/components/ui/button";
import { RotateCcw, CheckCircle2, Printer } from "lucide-react";
import { toast } from "sonner";
import { useIkigai, type IkigaiData, type IkigaiSection } from "./services/useIkigai";

const defaultIkigaiData: IkigaiData = {
  mission: {
    title: "",
    description: ""
  },
  passion: {
    title: "",
    description: ""
  },
  profession: {
    title: "",
    description: ""
  },
  vocation: {
    title: "",
    description: ""
  }
};

export default function IkigaiPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [ikigaiData, setIkigaiData] = useState<IkigaiData>(defaultIkigaiData);
  const [extendedIkigaiData, setExtendedIkigaiData] = useState<any>(null);
  const [currentIkigaiId, setCurrentIkigaiId] = useState<string | null>(null);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const router = useRouter();
  const ikigaiDiagramRef = useRef<IkigaiDiagramRef>(null);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const maxAutoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const currentDataRef = useRef<any>(null);
  const autoSaveStatusRef = useRef<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const lastSaveDataRef = useRef<string>('');

  const { 
    fetchUserIkigai, 
    upsertIkigai, 
    loading: apiLoading, 
    error: apiError 
  } = useIkigai();

  useEffect(() => {
    const getUser = async () => {
      const { data, error } = await supabase.auth.getUser();
      
      if (error || !data?.user) {
        router.push("/login");
        return;
      }
      
      setUser(data.user);
      await loadIkigaiData(data.user.id);
      setLoading(false);
    };

    getUser();
  }, [router]);

  // Cleanup auto-save timeouts on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
      if (maxAutoSaveTimeoutRef.current) {
        clearTimeout(maxAutoSaveTimeoutRef.current);
      }
    };
  }, []);

  // Auto-save when component unmounts if there are unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        // Show warning to user about unsaved changes
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [hasUnsavedChanges]);

  const loadIkigaiData = async (userId: string) => {
    try {
      const ikigai = await fetchUserIkigai(userId);
      if (ikigai && ikigai.ikigai_data) {
        // Map the backend data structure to our frontend structure
        const mappedData: IkigaiData = {
          mission: {
            title: ikigai.ikigai_data.mission?.title || "",
            description: ikigai.ikigai_data.mission?.description || ""
          },
          passion: {
            title: ikigai.ikigai_data.passion?.title || "",
            description: ikigai.ikigai_data.passion?.description || ""
          },
          profession: {
            title: ikigai.ikigai_data.profession?.title || "",
            description: ikigai.ikigai_data.profession?.description || ""
          },
          vocation: {
            title: ikigai.ikigai_data.vocation?.title || "",
            description: ikigai.ikigai_data.vocation?.description || ""
          }
        };
        
        // Also prepare the extended data structure
        const extendedMappedData = {
          ...mappedData,
          love: {
            title: ikigai.ikigai_data.love?.title || "",
            description: ikigai.ikigai_data.love?.description || ""
          },
          good_at: {
            title: ikigai.ikigai_data.good_at?.title || "",
            description: ikigai.ikigai_data.good_at?.description || ""
          },
          world_needs: {
            title: ikigai.ikigai_data.world_needs?.title || "",
            description: ikigai.ikigai_data.world_needs?.description || ""
          },
          paid_for: {
            title: ikigai.ikigai_data.paid_for?.title || "",
            description: ikigai.ikigai_data.paid_for?.description || ""
          },
          ikigai: {
            title: ikigai.ikigai_data.ikigai?.title || "",
            description: ikigai.ikigai_data.ikigai?.description || ""
          }
        };
        
        setIkigaiData(mappedData);
        setExtendedIkigaiData(extendedMappedData);
        setCurrentIkigaiId(ikigai.id);
      } else {
        // No ikigai found, keep defaults
        setIkigaiData(defaultIkigaiData);
        setExtendedIkigaiData(null);
        setCurrentIkigaiId(null);
      }
    } catch (error) {
      // On error, fallback to localStorage as backup
      const saved = localStorage.getItem(`ikigai_${userId}`);
      if (saved) {
        try {
          const parsedData = JSON.parse(saved);
          // Ensure the loaded data matches our current structure
          if (parsedData.mission && parsedData.passion && parsedData.profession && parsedData.vocation) {
            setIkigaiData(parsedData);
            setExtendedIkigaiData(parsedData);
          }
        } catch (parseError) {
          // Failed to parse localStorage data, use defaults
        }
      }
    }
  };

  const saveIkigaiData = useCallback(async () => {
    if (!user) {
      return;
    }
    
    setAutoSaveStatus('saving');
    autoSaveStatusRef.current = 'saving';
    
    try {
      // Use current data from ref to avoid stale closure issues
      const dataToSave = currentDataRef.current || extendedIkigaiData || ikigaiData;
      
      const result = await upsertIkigai(user.id, dataToSave);
      
      if (result) {
        setCurrentIkigaiId(result.id);
        // Also save to localStorage as backup
        localStorage.setItem(`ikigai_${user.id}`, JSON.stringify(dataToSave));
        setAutoSaveStatus('saved');
        autoSaveStatusRef.current = 'saved';
        setHasUnsavedChanges(false);
        
        // Reset the last save data ref so future changes are detected
        lastSaveDataRef.current = JSON.stringify(dataToSave);
        
        // Clear any remaining timeouts since save completed
        if (autoSaveTimeoutRef.current) {
          clearTimeout(autoSaveTimeoutRef.current);
          autoSaveTimeoutRef.current = null;
        }
        if (maxAutoSaveTimeoutRef.current) {
          clearTimeout(maxAutoSaveTimeoutRef.current);
          maxAutoSaveTimeoutRef.current = null;
        }
        
        // Reset status after 2 seconds
        setTimeout(() => {
          setAutoSaveStatus('idle');
          autoSaveStatusRef.current = 'idle';
        }, 5000);
      } else {
        throw new Error("Failed to save ikigai - no result returned");
      }
    } catch (error) {
      // Fallback to localStorage - still consider this as "saved" since we have the data
      const dataToSave = currentDataRef.current || extendedIkigaiData || ikigaiData;
      localStorage.setItem(`ikigai_${user.id}`, JSON.stringify(dataToSave));
      
      // Mark as saved since localStorage backup worked
      setAutoSaveStatus('saved');
      autoSaveStatusRef.current = 'saved';
      setHasUnsavedChanges(false);  
      
      // Reset the last save data ref for fallback save too
      lastSaveDataRef.current = JSON.stringify(dataToSave);
      
      // Clear any remaining timeouts since save completed (even in error case)
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
        autoSaveTimeoutRef.current = null;
      }
      if (maxAutoSaveTimeoutRef.current) {
        clearTimeout(maxAutoSaveTimeoutRef.current);
        maxAutoSaveTimeoutRef.current = null;
      }
      
      // Show error status briefly, then mark as idle
      setTimeout(() => {
        setAutoSaveStatus('error');
        autoSaveStatusRef.current = 'error';
        setTimeout(() => {
          setAutoSaveStatus('idle'); 
          autoSaveStatusRef.current = 'idle';
        }, 2000);
      }, 1000);
    }
  }, [user, extendedIkigaiData, ikigaiData, upsertIkigai]);

  // Auto-save functionality with debouncing and maximum delay
  const triggerAutoSave = useCallback(() => {
    // Prevent triggering if already saving
    if (autoSaveStatusRef.current === 'saving') {
      return;
    }
    
    // Check if data actually changed compared to last save attempt
    const currentDataString = JSON.stringify(currentDataRef.current);
    if (currentDataString === lastSaveDataRef.current) {
      return;
    }
    
    lastSaveDataRef.current = currentDataString;
    
    setHasUnsavedChanges(true);
    
    // Set max timeout only if not already set (ensures save within 5 seconds max)
    if (!maxAutoSaveTimeoutRef.current) {
      maxAutoSaveTimeoutRef.current = setTimeout(() => {
        // Clear normal timeout since we're saving now
        if (autoSaveTimeoutRef.current) {
          clearTimeout(autoSaveTimeoutRef.current);
          autoSaveTimeoutRef.current = null;
        }
        maxAutoSaveTimeoutRef.current = null;
        
        if (autoSaveStatusRef.current !== 'saving') {
          saveIkigaiData();
        }
      }, 5000);
    }
    
    // Clear and reset normal timeout (this gets reset on each change)
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }
    
    // Set new timeout for auto-save
    autoSaveTimeoutRef.current = setTimeout(() => {
      // Clear max timeout since we're saving now
      if (maxAutoSaveTimeoutRef.current) {
        clearTimeout(maxAutoSaveTimeoutRef.current);
        maxAutoSaveTimeoutRef.current = null;
      }
      
      if (autoSaveStatusRef.current !== 'saving') {
        saveIkigaiData();
      }
    }, 500);
  }, [saveIkigaiData]);

  const resetIkigaiData = () => {
    // Clear any pending auto-save timeouts
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
      autoSaveTimeoutRef.current = null;
    }
    if (maxAutoSaveTimeoutRef.current) {
      clearTimeout(maxAutoSaveTimeoutRef.current);
      maxAutoSaveTimeoutRef.current = null;
    }
    
    setIkigaiData(defaultIkigaiData);
    setExtendedIkigaiData(null);
    setCurrentIkigaiId(null);
    setHasUnsavedChanges(false);
    setAutoSaveStatus('idle');
    ikigaiDiagramRef.current?.resetData();
    toast.info("Ikigai data reset");
    
    // Clear localStorage as well
    if (user) {
      localStorage.removeItem(`ikigai_${user.id}`);
    }
    
    // Trigger auto-save to save the reset state
    triggerAutoSave();
  };

  const updateIkigaiSection = (section: keyof IkigaiData, field: 'title' | 'description', value: string) => {
    setIkigaiData(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value
      }
    }));
    // Don't trigger auto-save here - it will be triggered from handleExtendedDataChange
    // triggerAutoSave();
  };

  const handleExtendedDataChange = useCallback((data: any) => {
    // Check if this is actually new data (avoid triggering auto-save for same data)
    const currentData = currentDataRef.current;
    const isDataActuallyDifferent = JSON.stringify(currentData) !== JSON.stringify(data);
    
    if (!isDataActuallyDifferent) {
      return;
    }
    
    // Update the ref with current data
    currentDataRef.current = data;
    
    setExtendedIkigaiData(data);
    // Update the basic ikigai data as well
    setIkigaiData({
      mission: data.mission || { title: "", description: "" },
      passion: data.passion || { title: "", description: "" },
      profession: data.profession || { title: "", description: "" },
      vocation: data.vocation || { title: "", description: "" }
    });
    
    triggerAutoSave();
  }, [triggerAutoSave]);

  // Keep currentDataRef in sync with extendedIkigaiData
  useEffect(() => {
    if (extendedIkigaiData) {
      currentDataRef.current = extendedIkigaiData;
    }
  }, [extendedIkigaiData]);

  // Keep autoSaveStatusRef in sync with autoSaveStatus
  useEffect(() => {
    autoSaveStatusRef.current = autoSaveStatus;
  }, [autoSaveStatus]);

  // Initial auto-save setup
  useEffect(() => {
    // Trigger auto-save on component unmount if there are unsaved changes
    return () => {
      if (hasUnsavedChanges && autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
        // Try to save immediately on unmount (but this might not complete if page is closing)
        if (user) {
          const dataToSave = currentDataRef.current || extendedIkigaiData || ikigaiData;
          localStorage.setItem(`ikigai_${user.id}`, JSON.stringify(dataToSave));
        }
      }
    };
  }, [hasUnsavedChanges, user, extendedIkigaiData, ikigaiData]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>Loading your Ikigai...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          /* Hide EVERYTHING first, then show only what we want */
          * {
            visibility: hidden !important;
          }
          
          /* Show only our diagram content */
          .print-diagram,
          .print-diagram *,
          .print-diagram * * {
            visibility: visible !important;
          }
          
          /* Reset body and html completely */
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            width: 100vw !important;
            height: 100vh !important;
            overflow: hidden !important;
            scrollbar-width: none !important;
            -ms-overflow-style: none !important;
            background: white !important;
          }
          
          html::-webkit-scrollbar,
          body::-webkit-scrollbar {
            display: none !important;
            width: 0 !important;
            height: 0 !important;
          }
          
          /* Hide all possible UI elements */
          nav, header, aside, footer, main,
          .sidebar, .header, .navbar, .navigation,
          .app-header, .top-bar, .app-bar, .menu,
          .breadcrumb, .toolbar, .menubar,
          [role="navigation"], [role="banner"], [role="complementary"],
          [data-testid*="header"], [data-testid*="nav"],
          [class*="header"], [class*="nav"], [class*="sidebar"],
          [class*="menu"], [class*="toolbar"], [class*="app-"],
          .print-hide {
            display: none !important;
            visibility: hidden !important;
          }
          
          /* Remove all scrollbars globally */
          * {
            scrollbar-width: none !important;
            -ms-overflow-style: none !important;
            overflow: visible !important;
          }
          
          *::-webkit-scrollbar {
            display: none !important;
            width: 0 !important;
            height: 0 !important;
            background: transparent !important;
          }
          
          /* Page setup */
          @page {
            margin: 0 !important;
            padding: 0 !important;
            size: landscape;
          }
          
          /* Main print container */
          .print-diagram {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 100vw !important;
            height: 100vh !important;
            margin: 0 !important;
            padding: 0 !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            background: white !important;
            z-index: 999999 !important;
            overflow: visible !important;
            
            /* 🎯 DIAGRAM SIZE CONTROL - Change this scale value */
            transform: scale(1.5) !important;
            transform-origin: center !important;
          }
          
          .print-diagram > div {
            width: 100% !important;
            height: 100% !important;
            overflow: visible !important;
            position: relative !important;
          }
          
          /* Form elements styling - Clean integrated appearance */
          .print-diagram input,
          .print-diagram textarea {
            border: none !important;
            background: transparent !important;
            color: black !important;
            font-family: Arial, sans-serif !important;
            overflow: visible !important;
            scrollbar-width: none !important;
            -ms-overflow-style: none !important;
            position: relative !important;
            z-index: 30 !important;
            display: block !important;
            width: 100% !important;
            box-sizing: border-box !important;
            outline: none !important;
          }
          
          .print-diagram input {
            font-size: 14px !important;
            font-weight: bold !important;
            text-align: left !important;
            margin: -20px 0px 0px 0px !important;
            padding: 0px !important;
            line-height: 1.2 !important;
            flex-shrink: 0 !important;
            height: auto !important;
          }
          
          .print-diagram textarea {
            font-size: 12px !important;
            text-align: left !important;
            margin: 0px !important;
            padding: 0px !important;
            resize: none !important;
            line-height: 1.2 !important;
            flex-shrink: 0 !important;
            height: auto !important;
            min-height: 20px !important;
          }
          
          /* Individual textarea margin adjustments for each container */
          /* 1st: Love (160px wide) */
          .print-diagram .ikigai-print-text-field:nth-child(1) textarea {
            margin: 0px 0px 0px -72px !important;
          }
          
          /* 2nd: Good At (140px wide) */
          .print-diagram .ikigai-print-text-field:nth-child(2) textarea {
            margin: 0px 0px 0px -61px !important;
          }
          
          /* 3rd: World Needs (140px wide) */
          .print-diagram .ikigai-print-text-field:nth-child(3) textarea {
            margin: 0px 0px 0px -61px !important;
          }
          
          /* 4th: Paid For (160px wide) */
          .print-diagram .ikigai-print-text-field:nth-child(4) textarea {
            margin: 0px 0px 0px -72px !important;
          }
          
          /* 5th: Passion (100px wide) */
          .print-diagram .ikigai-print-text-field:nth-child(5) textarea {
            margin: 0px 0px 0px -45px !important;
          }
          
          /* 6th: Mission (100px wide, now left-positioned) */
          .print-diagram .ikigai-print-text-field:nth-child(6) textarea {
            margin: 0px 0px 0px -45px !important;
          }
          
          /* 7th: Profession (100px wide) */
          .print-diagram .ikigai-print-text-field:nth-child(7) textarea {
            margin: 0px 0px 0px -45px !important;
          }
          
          /* 8th: Vocation (100px wide, now left-positioned) */
          .print-diagram .ikigai-print-text-field:nth-child(8) textarea {
            margin: 0px 0px 0px -45px !important;
          }
          
          /* 9th: Ikigai (80px wide) */
          .print-diagram .ikigai-print-text-field:nth-child(9) textarea {
            margin: 0px 0px 0px -2px !important;
          }
          
          .print-diagram .ikigai-print-region-label {
            text-decoration: underline !important;
            text-decoration-thickness: 1px !important;
            text-underline-offset: 1px !important;
          }
          
          .print-diagram input::-webkit-scrollbar,
          .print-diagram textarea::-webkit-scrollbar {
            display: none !important;
          }
          
          /* Ensure the page container is properly positioned */
          .print-page-container {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 100vw !important;
            height: 100vh !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
            background: white !important;
          }
        }
      `}</style>
      
      <form 
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          return false;
        }}
        className="mx-auto max-w-7xl print-page-container"
      >
        {/* Header - Screen Version */}
        <div className="mb-8 text-center print-hide">
          <h1 className="text-4xl font-bold text-foreground mb-4">
            Discover Your Ikigai
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Ikigai is a Japanese concept meaning "reason for being." 
            Explore the four essential elements that create purpose and fulfillment in life.
          </p>
        </div>

        {/* Auto-save Status & Reset Button */}
        <div className="flex justify-center items-center gap-4 mb-8 relative z-50 print-hide">
          {/* Auto-save Status Indicator */}
          <div className="flex items-center gap-2 text-sm">
            {autoSaveStatus === 'saving' && (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                <span className="text-blue-600">Auto-saving...</span>
              </>
            )}
            {autoSaveStatus === 'saved' && (
              <>
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span className="text-green-600">Auto-saved</span>
              </>
            )}
            {autoSaveStatus === 'error' && (
              <>
                <div className="h-4 w-4 rounded-full bg-red-600"></div>
                <span className="text-red-600">Save failed (saved locally)</span>
              </>
            )}
            {hasUnsavedChanges && autoSaveStatus === 'idle' && (
              <>
                <div className="h-2 w-2 rounded-full bg-orange-500"></div>
                <span className="text-orange-600">Changes pending...</span>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handlePrint();
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-md font-medium border transition-colors bg-blue-600 text-white border-blue-600 hover:bg-blue-700 cursor-pointer"
            style={{ zIndex: 1000 }}
          >
            <Printer className="h-4 w-4" />
            Print PDF
          </button>
          
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              resetIkigaiData();
            }}
            disabled={apiLoading || autoSaveStatus === 'saving'}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-md font-medium border transition-colors
              ${(apiLoading || autoSaveStatus === 'saving')
                ? 'bg-gray-100 text-gray-400 border-gray-300 cursor-not-allowed'
                : 'bg-white text-gray-900 border-gray-300 hover:bg-gray-50 cursor-pointer'
              }
            `}
            style={{ 
              pointerEvents: (apiLoading || autoSaveStatus === 'saving') ? 'none' : 'auto',
              zIndex: 1000 
            }}
          >
            <RotateCcw className="h-4 w-4" />
            Reset
          </button>
        </div>

        {/* Error Display */}
        {apiError && (
          <div className="mb-4 p-3 rounded-md bg-destructive/10 text-destructive text-sm text-center print-hide">
            API Error: {apiError.message}
          </div>
        )}

        {/* Ikigai Diagram */}
        <div className="print-diagram">
          <IkigaiDiagram 
            ikigaiData={extendedIkigaiData || ikigaiData}
            onUpdateSection={updateIkigaiSection}
            onExtendedDataChange={handleExtendedDataChange}
            ref={ikigaiDiagramRef}
          />
        </div>

        {/* Instructions */}
        <div className="mt-12 text-center print-hide">
          <div className="bg-card p-6 rounded-lg border max-w-5xl mx-auto">
            <h3 className="text-xl font-semibold mb-4">Interactive Ikigai Venn Diagram</h3>
            <div className="grid grid-cols-3 gap-4 text-sm text-muted-foreground mb-6 max-w-4xl mx-auto">
              {/* Top Row */}
              <div className="p-3 bg-background/50 rounded">
                <strong className="text-purple-600">Passion:</strong> Love + Skills (what you enjoy doing well)
              </div>
              <div className="p-3 bg-background/50 rounded">
                <strong className="text-blue-600">What You Love:</strong> Your passions, interests, and what energizes you
              </div>
              <div className="p-3 bg-background/50 rounded">
                <strong className="text-purple-600">Mission:</strong> Love + World Needs (purposeful work)
              </div>
              
              {/* Middle Row */}
              <div className="p-3 bg-background/50 rounded">
                <strong className="text-blue-600">What You're Good At:</strong> Your skills, talents, and natural abilities
              </div>
              <div className="p-3 bg-gradient-to-br from-blue-50 to-purple-50 rounded border-2 border-green-200">
                <strong className="text-green-700">Your Ikigai:</strong> The center intersection - your reason for being
              </div>
              <div className="p-3 bg-background/50 rounded">
                <strong className="text-blue-600">What the World Needs:</strong> Problems to solve and value to create
              </div>
              
              {/* Bottom Row */}
              <div className="p-3 bg-background/50 rounded">
                <strong className="text-purple-600">Profession:</strong> Skills + Market Value (sustainable career)
              </div>
              <div className="p-3 bg-background/50 rounded">
                <strong className="text-blue-600">What You Can Be Paid For:</strong> Market opportunities and economic value
              </div>
              <div className="p-3 bg-background/50 rounded">
                <strong className="text-purple-600">Vocation:</strong> World Needs + Paid For (calling to serve)
              </div>
            </div>
            <p className="text-sm">
              Click on any region in the diagram to edit its content. Your Ikigai lies at the intersection of all four elements. 
              When aligned, they create a life of purpose, satisfaction, and meaning. Each editable area represents a different 
              aspect of your journey toward finding your ikigai.
            </p>
          </div>
        </div>
      </form>
    </div>
  );
}
