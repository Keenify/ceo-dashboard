"use client";

import React, { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronDown, ChevronUp, Plus, Download, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  useManifestation,
  ManifestationResponse,
  TargetItem,
  CourageItem,
} from "@/app/manifestation/services/useManifestation";
import { toast } from "@/components/ui/toast";

export interface ManifestationSectionProps {
  userId: string;
}

export const ManifestationSection: React.FC<ManifestationSectionProps> = ({
  userId,
}) => {
  const {
    addManifestation,
    fetchManifestations,
    updateManifestation,
    exportPDF,
    loading,
    error,
  } = useManifestation();

  const [manifestationData, setManifestationData] =
    useState<ManifestationResponse | null>(null);

  // Form state
  const [strongLifeChanges, setStrongLifeChanges] = useState<string[]>(
    Array(5).fill("")
  );
  const [bigTargets, setBigTargets] = useState<TargetItem[]>(
    Array(5).fill(null).map(() => ({ text: "", completed: false }))
  );
  const [topValues, setTopValues] = useState<string[]>(Array(5).fill(""));
  const [nonNegotiables, setNonNegotiables] = useState<string[]>(
    Array(5).fill("")
  );
  const [lifeRules, setLifeRules] = useState<string[]>(Array(5).fill(""));
  const [rituals, setRituals] = useState<string[]>(Array(5).fill(""));
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // State for new fields
  const [year, setYear] = useState<number>(new Date().getFullYear()); // Default to current year
  const [theme, setTheme] = useState<string>("");
  const [courageList, setCourageList] = useState<CourageItem[]>(
    Array(5).fill(null).map(() => ({ text: "", completed: false }))
  );

  // Auto-resize textarea function
  const autoResizeTextarea = (textarea: HTMLTextAreaElement) => {
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
  };

  // Auto-resize all textareas when entering edit mode or data loads
  useEffect(() => {
    if (isEditing) {
      const timer = setTimeout(() => {
        const textareas = document.querySelectorAll('textarea');
        textareas.forEach(textarea => {
          if (textarea instanceof HTMLTextAreaElement) {
            autoResizeTextarea(textarea);
          }
        });
      }, 50); // Small delay to ensure textareas are rendered
      
      return () => clearTimeout(timer);
    }
  }, [isEditing, manifestationData]);

  // Helper function to normalize data from backend
  const normalizeTargetItem = (item: string | TargetItem): TargetItem => {
    if (typeof item === 'string') {
      return { text: item, completed: false };
    }
    return item;
  };

  const normalizeCourageItem = (item: string | CourageItem): CourageItem => {
    if (typeof item === 'string') {
      return { text: item, completed: false };
    }
    return item;
  };

  // Fetch data
  useEffect(() => {
    const loadData = async () => {
      if (!userId) return;

      const data = await fetchManifestations(userId);

      if (data && data.length > 0) {
        const manifestation = data[0]; // Get the most recent one
        setManifestationData(manifestation);

        // Set form fields
        setStrongLifeChanges(
          manifestation.strong_life_changes
            .concat(Array(5).fill(""))
            .slice(0, 5)
        );
        
        // Handle big_targets with proper normalization
        const normalizedBigTargets = manifestation.big_targets
          .map(normalizeTargetItem)
          .concat(Array(5).fill(null).map(() => ({ text: "", completed: false })))
          .slice(0, 5);
        setBigTargets(normalizedBigTargets);
        
        setTopValues(
          manifestation.top_values.concat(Array(5).fill("")).slice(0, 5)
        );
        setNonNegotiables(
          manifestation.non_negotiables.concat(Array(5).fill("")).slice(0, 5)
        );
        setLifeRules(
          manifestation.life_rules.concat(Array(5).fill("")).slice(0, 5)
        );
        setRituals(manifestation.rituals.concat(Array(5).fill("")).slice(0, 5));
        
        // Set new fields
        setYear(manifestation.year || new Date().getFullYear());
        setTheme(manifestation.theme || "");
        
        // Handle courage_list with proper normalization
        const normalizedCourageList = manifestation.courage_list
          .map(normalizeCourageItem)
          .concat(Array(5).fill(null).map(() => ({ text: "", completed: false })))
          .slice(0, 5);
        setCourageList(normalizedCourageList);
      } else {
        // If no data, ensure editing is enabled by default?
        // Or set defaults and allow user to click edit
        setIsEditing(true); // Let's start in edit mode if no data exists
      }
    };

    loadData();
  }, [userId, fetchManifestations]);

  // Handle input change for regular string arrays
  const handleInputChange = (
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    index: number,
    value: string
  ) => {
    setter((prev) => {
      const newArray = [...prev];
      newArray[index] = value;
      return newArray;
    });
  };

  // Handle input change for big targets
  const handleBigTargetChange = (index: number, value: string) => {
    setBigTargets((prev) => {
      const newArray = [...prev];
      newArray[index] = { ...newArray[index], text: value };
      return newArray;
    });
  };

  // Handle input change for courage list
  const handleCourageListChange = (index: number, value: string) => {
    setCourageList((prev) => {
      const newArray = [...prev];
      newArray[index] = { ...newArray[index], text: value };
      return newArray;
    });
  };

  // Save data
  const handleSave = async () => {
    setIsSaving(true);

    // Filter out empty values and prepare payload
    const payload = {
      strong_life_changes: strongLifeChanges.filter(
        (item) => item.trim() !== ""
      ),
      big_targets: bigTargets.filter((item) => item.text.trim() !== ""),
      top_values: topValues.filter((item) => item.trim() !== ""),
      non_negotiables: nonNegotiables.filter((item) => item.trim() !== ""),
      life_rules: lifeRules.filter((item) => item.trim() !== ""),
      rituals: rituals.filter((item) => item.trim() !== ""),
      user_id: userId,
      year: year,
      theme: theme.trim(),
      courage_list: courageList.filter((item) => item.text.trim() !== ""),
    };

    try {
      let result;

      if (manifestationData?.id) {
        // Update existing
        result = await updateManifestation(
          manifestationData.id,
          userId,
          payload
        );
      } else {
        // Create new
        result = await addManifestation(payload);
      }

      if (result) {
        setManifestationData(result);
        setIsEditing(false);
        toast.success("Your manifestation has been saved successfully!");
      } else {
        toast.error("Failed to save manifestation. Please try again.");
      }
    } catch (err) {
      console.error("Error saving manifestation data:", err);
      toast.error("An error occurred while saving. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  // Download PDF function
  const handleDownloadPDF = async () => {
    try {
      await exportPDF(userId);
    } catch (err) {
      toast.error("Failed to download PDF. Please try again.");
    }
  };

  // Toggle completion status for Big 5 targets
  const toggleBigTargetCompletion = async (index: number) => {
    setBigTargets(prev => {
      const newArray = [...prev];
      newArray[index] = { ...newArray[index], completed: !newArray[index].completed };
      return newArray;
    });

    // Auto-save the completion status
    if (manifestationData?.id) {
      const updatedTargets = [...bigTargets];
      updatedTargets[index] = { ...updatedTargets[index], completed: !updatedTargets[index].completed };
      
      try {
        await updateManifestation(manifestationData.id, userId, {
          big_targets: updatedTargets.filter((item) => item.text.trim() !== ""),
        });
      } catch (err) {
        console.error("Error saving big target completion:", err);
        // Revert the change if save failed
        setBigTargets(prev => {
          const revertArray = [...prev];
          revertArray[index] = { ...revertArray[index], completed: !revertArray[index].completed };
          return revertArray;
        });
      }
    }
  };

  // Toggle completion status for Courage List
  const toggleCourageListCompletion = async (index: number) => {
    setCourageList(prev => {
      const newArray = [...prev];
      newArray[index] = { ...newArray[index], completed: !newArray[index].completed };
      return newArray;
    });

    // Auto-save the completion status
    if (manifestationData?.id) {
      const updatedCourageList = [...courageList];
      updatedCourageList[index] = { ...updatedCourageList[index], completed: !updatedCourageList[index].completed };
      
      try {
        await updateManifestation(manifestationData.id, userId, {
          courage_list: updatedCourageList.filter((item) => item.text.trim() !== ""),
        });
      } catch (err) {
        console.error("Error saving courage list completion:", err);
        // Revert the change if save failed
        setCourageList(prev => {
          const revertArray = [...prev];
          revertArray[index] = { ...revertArray[index], completed: !revertArray[index].completed };
          return revertArray;
        });
      }
    }
  };

  return (
    <div className="space-y-8">
      {/* Title and Subtitle with Edit Button */}
      <div className="mb-8 relative">
        {isEditing ? (
          <div className="flex flex-col items-center gap-2 mb-4">
            <Input
              type="number"
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value, 10) || new Date().getFullYear())}
              className="w-28 text-2xl font-bold text-center"
            />
            <Textarea
              value={theme}
              onChange={(e) => {
                setTheme(e.target.value);
                autoResizeTextarea(e.target);
              }}
              placeholder="Enter your theme..."
              className="text-xl font-medium text-center w-full max-w-5xl resize-none overflow-hidden"
              rows={1}
            />
          </div>
        ) : (
          <div className="text-center max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-primary">
              {year} Theme
            </h2>
            <p className="text-lg text-muted-foreground mt-1 break-words">
              {theme || "(No theme set)"}
            </p>
          </div>
        )}

        <Button
          variant="outline"
          className="absolute right-0 top-0 no-print"
          onClick={() => setIsEditing(!isEditing)}
          disabled={isSaving}
        >
          {isEditing ? "Cancel" : "Edit"}
        </Button>

        {isEditing && (
          <Button
            className="absolute right-20 top-0 no-print"
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? "Saving..." : "Save"}
          </Button>
        )}

        {!isEditing && (
          <Button
            variant="outline"
            className="absolute right-16 top-0 no-print"
            onClick={handleDownloadPDF}
            title="Download as PDF"
          >
            <Download className="w-4 h-4 mr-2" />
            PDF
          </Button>
        )}
      </div>

      {/* First Row: Life Changes and Targets with Up Arrows coming from TOP VALUES */}
      <div className="relative">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Strong 5 Life Changes */}
          <Card className="border rounded-lg overflow-hidden print-break-inside-avoid">
            <CardHeader className="p-0">
              <div className="bg-slate-700 text-white text-center py-2 font-medium">
                STRONG 5 LIFE CHANGES
              </div>
            </CardHeader>
            <CardContent className="p-4">
              <ul className="space-y-3">
                {Array.from({ length: 5 }).map((_, index) => (
                  <li
                    key={`life-change-${index}`}
                    className="flex items-start"
                  >
                    <div className="w-8 h-8 rounded-full border border-gray-400 flex items-center justify-center mr-2 flex-shrink-0 mt-0.5">
                      {index + 1}
                    </div>
                    {isEditing ? (
                      <Textarea
                        value={strongLifeChanges[index] || ""}
                        onChange={(e) => {
                          handleInputChange(
                            setStrongLifeChanges,
                            index,
                            e.target.value
                          );
                          autoResizeTextarea(e.target);
                        }}
                        placeholder="Enter a life change..."
                        className="text-sm resize-none overflow-hidden"
                        rows={1}
                      />
                    ) : (
                      <span className="text-gray-700 dark:text-gray-300 break-words">
                        {strongLifeChanges[index] || ""}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* Big 5 Targets */}
          <Card className="border rounded-lg overflow-hidden print-break-inside-avoid">
            <CardHeader className="p-0">
              <div className="bg-orange-400 text-white text-center py-2 font-medium">
                BIG 5
              </div>
            </CardHeader>
            <CardContent className="p-4">
              <ul className="space-y-3">
                {Array.from({ length: 5 }).map((_, index) => (
                  <li key={`target-${index}`} className="flex items-start">
                    <div className="w-8 h-8 rounded-full border border-orange-300 flex items-center justify-center mr-2 flex-shrink-0 mt-0.5">
                      {index + 1}
                    </div>
                    {isEditing ? (
                      <Textarea
                        value={bigTargets[index].text || ""}
                        onChange={(e) => {
                          handleBigTargetChange(index, e.target.value);
                          autoResizeTextarea(e.target);
                        }}
                        placeholder="Enter a target..."
                        className="text-sm resize-none overflow-hidden"
                        rows={1}
                      />
                    ) : (
                      <div className="flex items-start flex-grow">
                        <span 
                          className={`text-gray-700 dark:text-gray-300 flex-grow break-words pr-2 ${
                            bigTargets[index].completed ? 'line-through text-gray-400 dark:text-gray-500' : ''
                          }`}
                        >
                          {bigTargets[index].text || ""}
                        </span>
                        {bigTargets[index].text && (
                          <button
                            onClick={() => toggleBigTargetCompletion(index)}
                            className={`ml-2 w-6 h-6 rounded border-2 flex items-center justify-center transition-colors no-print flex-shrink-0 ${
                              bigTargets[index].completed 
                                ? 'bg-green-500 border-green-500 text-white' 
                                : 'border-gray-300 hover:border-green-400'
                            }`}
                          >
                            {bigTargets[index].completed && <Check size={14} />}
                          </button>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Second Row: Top Values (Full Width) */}
      <div>
        {/* Two arrows pointing up to Life Changes and Targets */}
        <div className="flex justify-between px-12 md:px-28 -mt-0 mb-0 relative z-10">
          <div className="text-amber-500 bg-amber-50 dark:bg-amber-950/20 rounded-full p-1 shadow-md">
            <ChevronUp size={32} strokeWidth={3} />
          </div>
          <div className="text-amber-500 bg-amber-50 dark:bg-amber-950/20 rounded-full p-1 shadow-md">
            <ChevronUp size={32} strokeWidth={3} />
          </div>
        </div>

        <Card className="border rounded-lg overflow-hidden border-gray-300 mt-0 print-break-inside-avoid">
          <CardHeader className="p-0">
            <div className="bg-slate-800 text-white text-center py-2 font-medium">
              TOP 5 VALUES
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <ul className="space-y-4">
              {Array.from({ length: 5 }).map((_, index) => (
                <li key={`value-${index}`} className="flex items-start">
                  <div className="w-8 h-8 rounded-full bg-slate-800 text-white flex items-center justify-center mr-3 flex-shrink-0 mt-0.5">
                    {index + 1}
                  </div>
                  <div className="flex-grow pb-1">
                    {isEditing ? (
                      <Textarea
                        value={topValues[index] || ""}
                        onChange={(e) => {
                          handleInputChange(setTopValues, index, e.target.value);
                          autoResizeTextarea(e.target);
                        }}
                        placeholder="Enter a value..."
                        className="text-sm border-none focus-visible:ring-0 resize-none overflow-hidden"
                        rows={1}
                      />
                    ) : (
                      <span className="text-gray-700 dark:text-gray-300 break-words">
                        {topValues[index] || ""}
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Four arrows pointing to each section below */}
        <div className="grid grid-cols-4 gap-4 px-4 md:px-8 -mb-4 relative z-10 manifestation-arrows">
          {/* Arrow 1 (Non-Negotiables) */}
          <div className="flex justify-center arrow-container">
            <div className="text-amber-500 bg-amber-50 dark:bg-amber-950/20 rounded-full p-1 shadow-md w-min">
              <ChevronDown size={32} strokeWidth={3} />
            </div>
          </div>
          {/* Arrow 2 (Life Rules) */}
          <div className="flex justify-center arrow-container">
            <div className="text-amber-500 bg-amber-50 dark:bg-amber-950/20 rounded-full p-1 shadow-md w-min">
              <ChevronDown size={32} strokeWidth={3} />
            </div>
          </div>
          {/* Arrow 3 (Rituals) */}
          <div className="flex justify-center arrow-container">
            <div className="text-amber-500 bg-amber-50 dark:bg-amber-950/20 rounded-full p-1 shadow-md w-min">
              <ChevronDown size={32} strokeWidth={3} />
            </div>
          </div>
          {/* Arrow 4 (Courage List) */}
          <div className="flex justify-center arrow-container">
            <div className="text-amber-500 bg-amber-50 dark:bg-amber-950/20 rounded-full p-1 shadow-md w-min">
              <ChevronDown size={32} strokeWidth={3} />
            </div>
          </div>
        </div>
      </div>

      {/* Third Row: Non-Negotiables, Life Rules, Rituals, and Courage List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 manifestation-bottom-grid">
        {/* Non-Negotiables */}
        <Card className="border rounded-lg overflow-hidden print-break-inside-avoid">
          <CardHeader className="p-0">
            <div className="bg-slate-600 text-white text-center py-2 text-sm font-medium">
              MAIN 5 NON-NEGOTIABLES
            </div>
          </CardHeader>
          <CardContent className="p-4">
            <ul className="space-y-3">
              {Array.from({ length: 5 }).map((_, index) => (
                <li
                  key={`non-negotiable-${index}`}
                  className="flex items-start"
                >
                  <div className="w-7 h-7 rounded-full border border-gray-400 flex items-center justify-center mr-2 mt-0.5 flex-shrink-0">
                    {index + 1}
                  </div>
                  {isEditing ? (
                    <Textarea
                      value={nonNegotiables[index] || ""}
                      onChange={(e) => {
                        handleInputChange(
                          setNonNegotiables,
                          index,
                          e.target.value
                        );
                        autoResizeTextarea(e.target);
                      }}
                      placeholder="Enter a non-negotiable..."
                      className="text-sm resize-none overflow-hidden"
                      rows={1}
                    />
                  ) : (
                    <span className="text-gray-700 dark:text-gray-300 text-sm break-words">
                      {nonNegotiables[index] || ""}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Life Rules */}
        <Card className="border rounded-lg overflow-hidden print-break-inside-avoid">
          <CardHeader className="p-0">
            <div className="bg-gray-400 text-white text-center py-2 text-sm font-medium">
              KEY 5 LIFE RULES
            </div>
          </CardHeader>
          <CardContent className="p-4">
            <ul className="space-y-3">
              {Array.from({ length: 5 }).map((_, index) => (
                <li key={`life-rule-${index}`} className="flex items-start">
                  <div className="w-7 h-7 rounded-full border border-gray-400 flex items-center justify-center mr-2 mt-0.5 flex-shrink-0">
                    {index + 1}
                  </div>
                  {isEditing ? (
                    <Textarea
                      value={lifeRules[index] || ""}
                      onChange={(e) => {
                        handleInputChange(setLifeRules, index, e.target.value);
                        autoResizeTextarea(e.target);
                      }}
                      placeholder="Enter a life rule..."
                      className="text-sm resize-none overflow-hidden"
                      rows={1}
                    />
                  ) : (
                    <span className="text-gray-700 dark:text-gray-300 text-sm break-words">
                      {lifeRules[index] || ""}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Rituals */}
        <Card className="border rounded-lg overflow-hidden print-break-inside-avoid">
          <CardHeader className="p-0">
            <div className="bg-gray-500 text-white text-center py-2 text-sm font-medium">
              BEST 5 RITUALS
            </div>
          </CardHeader>
          <CardContent className="p-4">
            <ul className="space-y-3">
              {Array.from({ length: 5 }).map((_, index) => (
                <li key={`ritual-${index}`} className="flex items-start">
                  <div className="w-7 h-7 rounded-full border border-gray-400 flex items-center justify-center mr-2 mt-0.5 flex-shrink-0">
                    {index + 1}
                  </div>
                  {isEditing ? (
                    <Textarea
                      value={rituals[index] || ""}
                      onChange={(e) => {
                        handleInputChange(setRituals, index, e.target.value);
                        autoResizeTextarea(e.target);
                      }}
                      placeholder="Enter a ritual..."
                      className="text-sm resize-none overflow-hidden"
                      rows={1}
                    />
                  ) : (
                    <span className="text-gray-700 dark:text-gray-300 text-sm break-words">
                      {rituals[index] || ""}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Courage List */}
        <Card className="border rounded-lg overflow-hidden print-break-inside-avoid">
          <CardHeader className="p-0">
            <div className="bg-purple-600 text-white text-center py-2 text-sm font-medium">
              COURAGE LIST
            </div>
          </CardHeader>
          <CardContent className="p-4">
            <ul className="space-y-3">
              {Array.from({ length: 5 }).map((_, index) => (
                <li key={`courage-${index}`} className="flex items-start">
                  <div className="w-7 h-7 rounded-full border border-gray-400 flex items-center justify-center mr-2 mt-0.5 flex-shrink-0">
                    {index + 1}
                  </div>
                  {isEditing ? (
                    <Textarea
                      value={courageList[index].text || ""}
                      onChange={(e) => {
                        handleCourageListChange(index, e.target.value);
                        autoResizeTextarea(e.target);
                      }}
                      placeholder="Enter a courage item..."
                      className="text-sm resize-none overflow-hidden"
                      rows={1}
                    />
                  ) : (
                    <div className="flex items-start flex-grow">
                                                                  <span 
                        className={`text-gray-700 dark:text-gray-300 text-sm flex-grow break-words pr-2 ${
                          courageList[index].completed ? 'line-through text-gray-400 dark:text-gray-500' : ''
                        }`}
                      >
                          {courageList[index].text || ""}
                        </span>
                      {courageList[index].text && (
                        <button
                          onClick={() => toggleCourageListCompletion(index)}
                          className={`ml-2 w-6 h-6 rounded border-2 flex items-center justify-center transition-colors no-print flex-shrink-0 ${
                            courageList[index].completed 
                              ? 'bg-green-500 border-green-500 text-white' 
                              : 'border-gray-300 hover:border-green-400'
                          }`}
                        >
                          {courageList[index].completed && <Check size={14} />}
                        </button>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Loading/Error State */}
      {loading && (
        <p className="text-center text-muted-foreground">
          Loading manifestation data...
        </p>
      )}
      {error && (
        <p className="text-center text-red-500">Error: {error.message}</p>
      )}
    </div>
  );
};

export default ManifestationSection;
