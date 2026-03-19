"use client";

import { useState, useEffect, useCallback, useRef, useLayoutEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { useWeeklyRhythms, WeeklyRhythmGoal, WeeklyRhythmAction, WeeklyRhythmChallenge, WeeklyRhythmNextGoal, WeeklyRhythmPayload, WeeklyRhythmResponse } from "./services/useWeeklyRhythms";
import { format, startOfWeek, endOfWeek, isSameWeek, parseISO } from "date-fns";
import { Trash2, ChevronDown, ChevronUp, Calendar } from 'lucide-react';
import { LinedTextarea } from "@/components/ui/lined-textarea";
import { toast } from "sonner";

// Field mapping for display
const FIELD_LABELS = {
  goals: {
    left: "Top Specific Goals (Month/Quarter)",
    right: "Target Completion by"
  },
  most_significant_moment: "Most Significant Moment last week and why?:",
  actions: {
    left: "Action item in the last 7 days",
    right: "Outcome / Lesson Learnt"
  },
  challenges: {
    left: "Challenges that need resolutions",
    right: "Notes / Comments"
  },
  next_goals: {
    left: "Goals/Commitments for the next 7 days",
    right: "Help/resources needed"
  }
};

// Auto-resize helper for textareas
const autoResize = (el: HTMLTextAreaElement | null) => {
  if (el) {
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  }
};

export default function WeeklyRhythmsPage() {
  const [user, setUser] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [existingEntries, setExistingEntries] = useState<WeeklyRhythmResponse[]>([]);
  const [entryIdForWeek, setEntryIdForWeek] = useState<string | null>(null);
  const [form, setForm] = useState<WeeklyRhythmPayload>({
    week_start_date: format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'),
    most_significant_moment: "",
    goals: [{ goal: "", target_completion_by: "" }],
    actions: [{ action_item: "", outcome: "" }],
    challenges: [{ challenge: "", note: "" }],
    next_goals: [{ goal: "", help_needed: "" }],
    user_id: ""
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasShownMigrationToast, setHasShownMigrationToast] = useState(false);
  
  // Mobile collapsible sections state
  const [mobileCollapsed, setMobileCollapsed] = useState({
    calendar: false,
    goals: false,
    moment: false,
    actions: false,
    challenges: false,
    nextGoals: false
  });
  
  const router = useRouter();
  const {
    addWeeklyRhythm,
    fetchWeeklyRhythms,
    updateWeeklyRhythm,
    loading: apiLoading,
    error: apiError,
    migrationDetected
  } = useWeeklyRhythms();
  const [isEditing, setIsEditing] = useState(true);

  // Refs for all paired textareas in next_goals
  const nextGoalsRefs = useRef<{ left: HTMLTextAreaElement | null, right: HTMLTextAreaElement | null }[]>([]);

  // Ensure the refs array has the correct length on every render based on form state
  if (nextGoalsRefs.current.length !== form.next_goals?.length) {
    nextGoalsRefs.current = form.next_goals?.map(() => ({ left: null, right: null })) || [];
  }

  useLayoutEffect(() => {
    if (!isEditing) {
      nextGoalsRefs.current.forEach(pair => {
        if (pair.left && pair.right) {
          pair.left.style.height = 'auto';
          pair.right.style.height = 'auto';
          const maxHeight = Math.max(pair.left.scrollHeight, pair.right.scrollHeight);
          pair.left.style.height = pair.right.style.height = maxHeight + 'px';
        }
      });
    }
  }, [isEditing, form.next_goals]);

  // Watch for migration detection and show toast
  useEffect(() => {
    if (migrationDetected && !hasShownMigrationToast) {
      setHasShownMigrationToast(true);
      if (process.env.NODE_ENV === 'development') {
        toast.info("Legacy date formats detected and automatically updated", {
          description: "Date formats have been migrated to the latest version",
          duration: 4000,
        });
      }
    }
  }, [migrationDetected, hasShownMigrationToast]);

  // Fetch user and existing entries
  useEffect(() => {
    const checkUser = async () => {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData?.user) {
        router.push("/login");
      } else {
        setUser(authData.user);
        setForm(f => ({ ...f, user_id: authData.user.id }));
        
        const entries = await fetchWeeklyRhythms(authData.user.id);
        setExistingEntries(entries || []);
      }
    };
    checkUser();
  }, [router, fetchWeeklyRhythms]);

  // Helper function to find the immediate previous week's entry
  const findImmediatePreviousWeekEntry = useCallback((currentWeekStart: Date) => {
    // Calculate the exact previous week (7 days before)
    const previousWeekStart = new Date(currentWeekStart);
    previousWeekStart.setDate(previousWeekStart.getDate() - 7);
    const previousWeekId = format(previousWeekStart, 'yyyy-MM-dd');
    
    // Find entry that matches the exact previous week
    return existingEntries.find(e => 
      format(startOfWeek(parseISO(e.week_start_date), { weekStartsOn: 0 }), 'yyyy-MM-dd') === previousWeekId
    );
  }, [existingEntries]);

  // Helper function to find the best match for a goal in existing actions
  const findBestActionMatch = useCallback((goal: string, actions: WeeklyRhythmAction[]) => {
    const goalLower = goal.trim().toLowerCase();
    
    // First try exact match
    for (let i = 0; i < actions.length; i++) {
      if (actions[i].action_item.trim().toLowerCase() === goalLower) {
        return i;
      }
    }
    
    // Then try partial match (goal contains action or vice versa)
    for (let i = 0; i < actions.length; i++) {
      const actionLower = actions[i].action_item.trim().toLowerCase();
      if (actionLower && goalLower && 
          (goalLower.includes(actionLower) || actionLower.includes(goalLower))) {
        return i;
      }
    }
    
    return -1; // No match found
  }, []);

  // Helper function to merge previous week's goals with existing actions
  const mergeActionsWithPreviousGoals = useCallback((currentActions: WeeklyRhythmAction[], previousGoals: WeeklyRhythmNextGoal[]) => {
    const emptyAction = { action_item: "", outcome: "" };
    const nonEmptyGoals = previousGoals.filter(goal => goal.goal.trim() !== "");
    
    // Start with a copy of current actions
    let mergedActions = [...currentActions];
    const usedActionIndices = new Set<number>();
    
    // Track which goals have been processed
    const processedGoals = new Set<number>();
    
    // Phase 1: Update existing action items that match goals
    for (let goalIndex = 0; goalIndex < nonEmptyGoals.length; goalIndex++) {
      const goal = nonEmptyGoals[goalIndex];
      const matchIndex = findBestActionMatch(goal.goal, mergedActions);
      
      if (matchIndex !== -1 && !usedActionIndices.has(matchIndex)) {
        // Update the matching action item (preserve the outcome)
        mergedActions[matchIndex] = {
          action_item: goal.goal,
          outcome: mergedActions[matchIndex].outcome || ""
        };
        usedActionIndices.add(matchIndex);
        processedGoals.add(goalIndex);
        
        if (process.env.NODE_ENV === 'development') {
          console.log(`🔄 Updated action ${matchIndex + 1}: "${goal.goal}"`);
        }
      }
    }
    
    // Phase 2: Add new goals that didn't match any existing actions
    const unprocessedGoals = nonEmptyGoals.filter((_, index) => !processedGoals.has(index));
    
    for (const goal of unprocessedGoals) {
      // Find first empty slot or add to end
      let insertIndex = mergedActions.findIndex((action, index) => 
        !usedActionIndices.has(index) && action.action_item.trim() === ""
      );
      
      if (insertIndex !== -1) {
        // Use empty slot
        mergedActions[insertIndex] = {
          action_item: goal.goal,
          outcome: ""
        };
        usedActionIndices.add(insertIndex);
      } else {
        // Add to end
        mergedActions.push({
          action_item: goal.goal,
          outcome: ""
        });
      }
      
      if (process.env.NODE_ENV === 'development') {
        console.log(`➕ Added new action: "${goal.goal}"`);
      }
    }
    
    // Ensure at least 3 rows for UI consistency
    while (mergedActions.length < 3) {
      mergedActions.push(emptyAction);
    }
    
    return mergedActions;
  }, [findBestActionMatch]);

  // When date changes, check if entry exists for that week
  useEffect(() => {
    if (!user) return;
    const weekStart = format(startOfWeek(selectedDate, { weekStartsOn: 0 }), 'yyyy-MM-dd');
    const currentWeekStart = startOfWeek(selectedDate, { weekStartsOn: 0 });
    setForm(f => ({ ...f, week_start_date: weekStart }));
    
    const found = existingEntries.find(e => format(startOfWeek(parseISO(e.week_start_date), { weekStartsOn: 0 }), 'yyyy-MM-dd') === weekStart);
    
    if (found) {
      // EXISTING ENTRY: Load it and potentially add previous week's goals
      const previousEntry = findImmediatePreviousWeekEntry(currentWeekStart);
      let finalActions = (found.actions && found.actions.length) ? found.actions : [{ action_item: "", outcome: "" }];
      
      // If there's a previous week with goals, merge them with existing actions
      if (previousEntry && previousEntry.next_goals && previousEntry.next_goals.length > 0) {
        finalActions = mergeActionsWithPreviousGoals(finalActions, previousEntry.next_goals);
        
        // Log for debugging
        if (process.env.NODE_ENV === 'development') {
          console.log(`📋 Week ${weekStart}: Found previous week with ${previousEntry.next_goals.length} goals`);
          console.log('Previous goals:', previousEntry.next_goals.map(g => g.goal));
          console.log('Merged actions:', finalActions.map(a => a.action_item));
        }
      }
      
      setEntryIdForWeek(found.id);
      setForm({
        week_start_date: found.week_start_date,
        most_significant_moment: found.most_significant_moment,
        goals: (found.goals && found.goals.length) ? found.goals : [{ goal: "", target_completion_by: "" }],
        actions: finalActions,
        challenges: (found.challenges && found.challenges.length) ? found.challenges : [{ challenge: "", note: "" }],
        next_goals: (found.next_goals && found.next_goals.length) ? found.next_goals : [{ goal: "", help_needed: "" }],
        user_id: found.user_id
      });
      setIsEditing(false);
    } else {
      // NEW ENTRY: Create form and add previous week's goals to actions
      setEntryIdForWeek(null);
      const emptyGoal = { goal: "", target_completion_by: "" };
      const emptyAction = { action_item: "", outcome: "" };
      const emptyChallenge = { challenge: "", note: "" };
      const emptyNextGoal = { goal: "", help_needed: "" };
      
      // Find the immediate previous week's entry
      const previousEntry = findImmediatePreviousWeekEntry(currentWeekStart);
      let initialActions = [emptyAction, emptyAction, emptyAction];
      
      if (previousEntry && previousEntry.next_goals && previousEntry.next_goals.length > 0) {
        // Add previous week's goals as action items
        initialActions = mergeActionsWithPreviousGoals([], previousEntry.next_goals);
        
        // Log for debugging
        if (process.env.NODE_ENV === 'development') {
          console.log(`🆕 Week ${weekStart}: Creating new entry with previous week's goals`);
          console.log('Previous goals:', previousEntry.next_goals.map(g => g.goal));
          console.log('Initial actions:', initialActions.map(a => a.action_item));
        }
      }
      
      setForm(f => ({
        ...f,
        week_start_date: weekStart,
        most_significant_moment: "",
        goals: [emptyGoal, emptyGoal, emptyGoal],
        actions: initialActions,
        challenges: [emptyChallenge, emptyChallenge, emptyChallenge],
        next_goals: [emptyNextGoal, emptyNextGoal, emptyNextGoal],
      }));
      setIsEditing(true);
    }
  }, [selectedDate, existingEntries, user, findImmediatePreviousWeekEntry, mergeActionsWithPreviousGoals]);

  // Only allow one entry per week (disable dates with entry)
  const isWeekDisabled = (date: Date) => {
    const weekStart = format(startOfWeek(date, { weekStartsOn: 0 }), 'yyyy-MM-dd');
    return existingEntries.some(e => format(startOfWeek(parseISO(e.week_start_date), { weekStartsOn: 0 }), 'yyyy-MM-dd') === weekStart);
  };

  // Handlers for dynamic fields
  const handleArrayChange = (field: keyof WeeklyRhythmPayload, idx: number, subfield: string, value: string) => {
    setForm(f => ({
      ...f,
      [field]: (f[field] as any[]).map((item, i) => i === idx ? { ...item, [subfield]: value } : item)
    }));
  };
  const handleAddRow = (field: keyof WeeklyRhythmPayload, emptyObj: any) => {
    setForm(f => ({ ...f, [field]: [...(f[field] as any[]), emptyObj] }));
  };
  const handleRemoveRow = (field: keyof WeeklyRhythmPayload, idx: number) => {
    setForm(f => ({ ...f, [field]: (f[field] as any[]).filter((_, i) => i !== idx) }));
  };

  // Handle input for single fields
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
  };

  // Submit handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      let result;
      if (entryIdForWeek) {
        result = await updateWeeklyRhythm(entryIdForWeek, form.user_id, form);
      } else {
        result = await addWeeklyRhythm(form);
      }
      if (!result) throw new Error("Failed to save entry");
      // Refresh entries
      const entries = await fetchWeeklyRhythms(form.user_id);
      setExistingEntries(entries || []);
      setLoading(false);
      toast.success("Weekly Rhythm entry saved!");
    } catch (err: any) {
      setError(err.message || "Unknown error");
      setLoading(false);
    }
  };

  // Toggle mobile section collapse
  const toggleMobileSection = (section: keyof typeof mobileCollapsed) => {
    setMobileCollapsed(prev => ({ ...prev, [section]: !prev[section] }));
  };

  // Mobile Collapsible Section Component
  const CollapsibleSection = ({ 
    title, 
    section, 
    children, 
    defaultOpen = false 
  }: { 
    title: string; 
    section: keyof typeof mobileCollapsed; 
    children: React.ReactNode; 
    defaultOpen?: boolean;
  }) => {
    const isOpen = mobileCollapsed[section] === false; // false means open, true means collapsed
    
    return (
      <div className="border border-border rounded-lg bg-card shadow-sm mb-6">
        <button
          type="button"
          onClick={() => toggleMobileSection(section)}
          className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-accent/50 transition-colors rounded-t-lg"
        >
          <h3 className="font-semibold text-lg">{title}</h3>
          {isOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </button>
        {isOpen && (
          <div className="px-4 pb-4 border-t border-border">
            {children}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 md:mb-8 flex items-center justify-between">
          <h1 className="text-2xl md:text-3xl font-bold">Weekly Rhythms</h1>
        </div>
        {error && (
          <div className="mb-4 p-4 bg-destructive/10 text-destructive border border-destructive rounded">
            Error: {error}
          </div>
        )}
        
        {/* Desktop Layout */}
        <form onSubmit={handleSubmit} className="hidden md:grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Calendar column */}
          <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
            <h2 className="text-xl font-semibold mb-4">Select Week</h2>
            <div className="overflow-hidden">
              <DatePicker
                selected={selectedDate}
                onChange={date => date && setSelectedDate(date)}
                inline
                filterDate={date => {
                  // Always allow any date in a week that has an entry, and always allow the currently selected week
                  const weekStart = format(startOfWeek(date, { weekStartsOn: 0 }), 'yyyy-MM-dd');
                  const selectedWeekStart = format(startOfWeek(selectedDate, { weekStartsOn: 0 }), 'yyyy-MM-dd');
                  const hasEntry = existingEntries.some(e => format(startOfWeek(parseISO(e.week_start_date), { weekStartsOn: 0 }), 'yyyy-MM-dd') === weekStart);
                  if (weekStart === selectedWeekStart) return true;
                  if (hasEntry) return true;
                  return !isWeekDisabled(date);
                }}
                highlightDates={existingEntries.map(e => parseISO(e.week_start_date))}
                calendarClassName="w-full border rounded-md"
                renderDayContents={(day, date) => {
                  // Highlight the entire week of the selected date
                  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 0 });
                  const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 0 });
                  const isInSelectedWeek = date >= weekStart && date <= weekEnd;
                  return (
                    <div className={`relative ${isInSelectedWeek ? 'font-bold text-primary bg-blue-100 rounded-full' : ''}`}>{day}</div>
                  );
                }}
                dayClassName={date => date.getDay() === 0 ? 'bg-yellow-100 font-bold' : ''}
              />
            </div>
            <div className="mt-4 text-sm text-muted-foreground">
              {(() => {
                const weekStart = startOfWeek(selectedDate, { weekStartsOn: 0 });
                const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 0 });
                const formatDate = (date: Date) =>
                  `${date.getDate()} ${date.toLocaleString('default', { month: 'long' })} ${date.getFullYear()}`;
                return (
                  <>
                    Selected week: <span className="font-medium">{formatDate(weekStart)} - {formatDate(weekEnd)}</span>
                    <div className="text-xs mt-1">You can only create one entry per week. Weeks with entries are disabled.</div>
                  </>
                );
              })()}
            </div>
          </div>
          {/* Entry form column (span 2 columns on desktop) */}
          <div className="rounded-lg border border-border bg-card p-6 shadow-sm md:col-span-2 space-y-8">
            {/* Top Specific Goals */}
            <div>
              <div className="flex flex-col md:flex-row gap-4 mb-4">
                <div className="flex-1">
                  <Label className="font-semibold mb-2 block">{FIELD_LABELS.goals.left}</Label>
                </div>
                <div className="flex-1">
                  <Label className="font-semibold mb-2 block">{FIELD_LABELS.goals.right}</Label>
                </div>
              </div>
              {form.goals?.map((g, i) => (
                <div key={i} className="flex items-start gap-2 mb-2">
                  <span className="pt-[9px] font-medium text-sm w-6">{i + 1}.</span>
                  <div className="flex-1 flex items-center gap-2">
                    <LinedTextarea
                      value={g.goal}
                      onChange={e => isEditing && handleArrayChange('goals', i, 'goal', e.target.value)}
                      onInput={e => isEditing && autoResize(e.currentTarget)}
                      className={`flex-1 min-h-[40px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 mr-2`}
                      readOnly={!isEditing}
                      disabled={!isEditing}
                      style={isEditing ? { overflow: 'hidden', height: 'auto' } : { resize: 'none' }}
                    />
                  </div>
                  <div className="flex-1 flex items-center gap-2">
                    <DatePicker
                      selected={(() => {
                        // Safely parse the date to prevent crashes
                        try {
                          if (!g.target_completion_by) return null;
                          
                          // Check if it's already in valid format
                          if (/^\d{4}-\d{2}-\d{2}$/.test(g.target_completion_by)) {
                            const date = new Date(g.target_completion_by);
                            return isNaN(date.getTime()) ? null : date;
                          }
                          
                          // For any other format, return null (migration will handle it)
                          return null;
                        } catch (error) {
                          console.warn('Invalid date format:', g.target_completion_by);
                          return null;
                        }
                      })()}
                      onChange={date => isEditing && handleArrayChange('goals', i, 'target_completion_by', date ? format(date, 'yyyy-MM-dd') : '')}
                      dateFormat="dd MMM yyyy"
                      placeholderText="Select date"
                      className="flex-1 min-h-[40px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 mr-2"
                      disabled={!isEditing}
                      readOnly={!isEditing}
                    />
                  </div>
                  {isEditing && form.goals!.length > 3 && (
                    <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveRow('goals', i)} className="ml-2 pt-[5px]">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
              {isEditing && form.goals && form.goals.length > 0 && form.goals[form.goals.length - 1].goal && (
                <Button type="button" variant="outline" size="sm" onClick={() => handleAddRow('goals', { goal: "", target_completion_by: "" })}>Add</Button>
              )}
            </div>
            {/* Most Significant Moment */}
            <div>
              <Label className="font-semibold mb-2 block">{FIELD_LABELS.most_significant_moment}</Label>
              <LinedTextarea
                name="most_significant_moment"
                value={form.most_significant_moment}
                onChange={e => isEditing && handleInputChange(e)}
                className={`w-full min-h-[60px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${!isEditing ? 'bg-muted text-muted-foreground' : ''}`}
                readOnly={!isEditing}
                disabled={!isEditing}
                style={!isEditing ? { resize: 'none' } : {}}
              />
            </div>
            {/* Action Items */}
            <div>
              <div className="flex flex-col md:flex-row gap-4 mb-4">
                <div className="flex-1">
                  <Label className="font-semibold mb-2 block">{FIELD_LABELS.actions.left}</Label>
                </div>
                <div className="flex-1">
                  <Label className="font-semibold mb-2 block">{FIELD_LABELS.actions.right}</Label>
                </div>
              </div>
              {form.actions?.map((a, i) => (
                <div key={i} className="flex items-start gap-2 mb-2">
                  <span className="pt-[9px] font-medium text-sm w-6">{i + 1}.</span>
                  <div className="flex-1 flex items-center gap-2">
                    <LinedTextarea
                      value={a.action_item}
                      onChange={e => isEditing && handleArrayChange('actions', i, 'action_item', e.target.value)}
                      onInput={e => isEditing && autoResize(e.currentTarget)}
                      className={`flex-1 min-h-[40px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 mr-2`}
                      readOnly={!isEditing}
                      disabled={!isEditing}
                      style={isEditing ? { overflow: 'hidden', height: 'auto' } : { resize: 'none' }}
                    />
                  </div>
                  <div className="flex-1 flex items-center gap-2">
                    <LinedTextarea
                      value={a.outcome}
                      onChange={e => isEditing && handleArrayChange('actions', i, 'outcome', e.target.value)}
                      onInput={e => isEditing && autoResize(e.currentTarget)}
                      className={`flex-1 min-h-[40px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 mr-2`}
                      readOnly={!isEditing}
                      disabled={!isEditing}
                      style={isEditing ? { overflow: 'hidden', height: 'auto' } : { resize: 'none' }}
                    />
                  </div>
                  {isEditing && form.actions!.length > 3 && (
                    <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveRow('actions', i)} className="ml-2 pt-[5px]">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
              {isEditing && form.actions && form.actions.length > 0 && form.actions[form.actions.length - 1].action_item && (
                <Button type="button" variant="outline" size="sm" onClick={() => handleAddRow('actions', { action_item: "", outcome: "" })}>Add</Button>
              )}
            </div>
            {/* Challenges */}
            <div>
              <div className="flex flex-col md:flex-row gap-4 mb-4">
                <div className="flex-1">
                  <Label className="font-semibold mb-2 block">{FIELD_LABELS.challenges.left}</Label>
                </div>
                <div className="flex-1">
                  <Label className="font-semibold mb-2 block">{FIELD_LABELS.challenges.right}</Label>
                </div>
              </div>
              {form.challenges?.map((c, i) => (
                <div key={i} className="flex items-start gap-2 mb-2">
                  <span className="pt-[9px] font-medium text-sm w-6">{i + 1}.</span>
                  <div className="flex-1 flex items-center gap-2">
                    <LinedTextarea
                      value={c.challenge}
                      onChange={e => isEditing && handleArrayChange('challenges', i, 'challenge', e.target.value)}
                      onInput={e => isEditing && autoResize(e.currentTarget)}
                      className={`flex-1 min-h-[40px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 mr-2`}
                      readOnly={!isEditing}
                      disabled={!isEditing}
                      style={isEditing ? { overflow: 'hidden', height: 'auto' } : { resize: 'none' }}
                    />
                  </div>
                  <div className="flex-1 flex items-center gap-2">
                    <LinedTextarea
                      value={c.note}
                      onChange={e => isEditing && handleArrayChange('challenges', i, 'note', e.target.value)}
                      onInput={e => isEditing && autoResize(e.currentTarget)}
                      className={`flex-1 min-h-[40px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 mr-2`}
                      readOnly={!isEditing}
                      disabled={!isEditing}
                      style={isEditing ? { overflow: 'hidden', height: 'auto' } : { resize: 'none' }}
                    />
                  </div>
                  {isEditing && form.challenges!.length > 3 && (
                    <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveRow('challenges', i)} className="ml-2 pt-[5px]">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
              {isEditing && form.challenges && form.challenges.length > 0 && form.challenges[form.challenges.length - 1].challenge && (
                <Button type="button" variant="outline" size="sm" onClick={() => handleAddRow('challenges', { challenge: "", note: "" })}>Add</Button>
              )}
            </div>
            {/* Next Goals */}
            <div>
              <div className="flex gap-4 mb-4">
                <div className="flex-1">
                  <Label className="font-semibold mb-2 block">{FIELD_LABELS.next_goals.left}</Label>
                </div>
                <div className="flex-1">
                  <Label className="font-semibold mb-2 block">{FIELD_LABELS.next_goals.right}</Label>
                </div>
              </div>
              {form.next_goals?.map((n, i) => (
                <div key={i} className="flex items-start gap-2 mb-2">
                  <span className="pt-[9px] font-medium text-sm w-6">{i + 1}.</span>
                  <div className="flex-1 flex items-center gap-2">
                    <LinedTextarea
                      ref={el => {
                        // Ensure the ref array item exists before assigning
                        if (nextGoalsRefs.current[i]) {
                          nextGoalsRefs.current[i].left = el;
                        }
                      }}
                      value={n.goal}
                      onChange={e => isEditing && handleArrayChange('next_goals', i, 'goal', e.target.value)}
                      onInput={e => isEditing && autoResize(e.currentTarget)}
                      className={`flex-1 min-h-[40px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 mr-2`}
                      readOnly={!isEditing}
                      disabled={!isEditing}
                      style={isEditing ? { overflow: 'hidden', height: 'auto' } : { overflow: 'hidden', resize: 'none' }}
                    />
                  </div>
                  <div className="flex-1 flex items-center gap-2">
                    <LinedTextarea
                      ref={el => {
                        // Ensure the ref array item exists before assigning
                        if (nextGoalsRefs.current[i]) {
                          nextGoalsRefs.current[i].right = el;
                        }
                      }}
                      value={n.help_needed}
                      onChange={e => isEditing && handleArrayChange('next_goals', i, 'help_needed', e.target.value)}
                      onInput={e => isEditing && autoResize(e.currentTarget)}
                      className={`flex-1 min-h-[40px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 mr-2`}
                      readOnly={!isEditing}
                      disabled={!isEditing}
                      style={isEditing ? { overflow: 'hidden', height: 'auto' } : { overflow: 'hidden', resize: 'none' }}
                    />
                  </div>
                  {isEditing && form.next_goals!.length > 3 && (
                    <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveRow('next_goals', i)} className="ml-2 pt-[5px]">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
              {isEditing && form.next_goals && form.next_goals.length > 0 && form.next_goals[form.next_goals.length - 1].goal && (
                <Button type="button" variant="outline" size="sm" onClick={() => handleAddRow('next_goals', { goal: "", help_needed: "" })}>Add</Button>
              )}
            </div>
            {/* Edit Entry button */}
            {entryIdForWeek && !isEditing && (
              <Button
                variant="outline"
                className="w-full"
                onClick={e => { e.preventDefault(); setIsEditing(true); }}
                disabled={loading || apiLoading}
              >
                Edit Entry
              </Button>
            )}
            {/* Save button */}
            {isEditing && (
              <Button type="submit" className="w-full" disabled={loading || apiLoading}>
                {loading || apiLoading ? "Saving..." : "Save Weekly Rhythm"}
              </Button>
            )}
          </div>
        </form>
        
        {/* Mobile Layout */}
        <div className="md:hidden">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Mobile Calendar Section */}
            <CollapsibleSection title="Select Week" section="calendar">
              <div className="pt-4">
                <div className="w-full max-w-full overflow-hidden">
                  <div className="flex justify-center">
                    <div className="mobile-calendar-wrapper" style={{ width: 'fit-content', maxWidth: '100%' }}>
                      <DatePicker
                        selected={selectedDate}
                        onChange={date => date && setSelectedDate(date)}
                        inline
                        filterDate={date => {
                          const weekStart = format(startOfWeek(date, { weekStartsOn: 0 }), 'yyyy-MM-dd');
                          const selectedWeekStart = format(startOfWeek(selectedDate, { weekStartsOn: 0 }), 'yyyy-MM-dd');
                          const hasEntry = existingEntries.some(e => format(startOfWeek(parseISO(e.week_start_date), { weekStartsOn: 0 }), 'yyyy-MM-dd') === weekStart);
                          if (weekStart === selectedWeekStart) return true;
                          if (hasEntry) return true;
                          return !isWeekDisabled(date);
                        }}
                        highlightDates={existingEntries.map(e => parseISO(e.week_start_date))}
                        calendarClassName="border rounded-md mobile-datepicker"
                        renderDayContents={(day, date) => {
                          const weekStart = startOfWeek(selectedDate, { weekStartsOn: 0 });
                          const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 0 });
                          const isInSelectedWeek = date >= weekStart && date <= weekEnd;
                          return (
                            <div className={`relative ${isInSelectedWeek ? 'font-bold text-primary bg-blue-100 rounded-full' : ''}`}>{day}</div>
                          );
                        }}
                        dayClassName={date => date.getDay() === 0 ? 'bg-yellow-100 font-bold' : ''}
                      />
                    </div>
                    
                    <style jsx global>{`
                      .mobile-calendar-wrapper {
                        overflow: hidden;
                      }
                      .mobile-calendar-wrapper .react-datepicker {
                        font-size: 0.875rem;
                        border: none !important;
                        box-shadow: none !important;
                      }
                      .mobile-calendar-wrapper .react-datepicker__header {
                        background-color: #f9fafb;
                        border-bottom: 1px solid #e5e7eb;
                        padding: 8px 0;
                      }
                      .mobile-calendar-wrapper .react-datepicker__current-month {
                        font-size: 1rem;
                        font-weight: 600;
                        color: #374151;
                      }
                      .mobile-calendar-wrapper .react-datepicker__navigation {
                        top: 10px;
                        width: 20px;
                        height: 20px;
                      }
                      .mobile-calendar-wrapper .react-datepicker__navigation--previous {
                        left: 8px;
                      }
                      .mobile-calendar-wrapper .react-datepicker__navigation--next {
                        right: 8px;
                      }
                      .mobile-calendar-wrapper .react-datepicker__month {
                        margin: 8px;
                      }
                      .mobile-calendar-wrapper .react-datepicker__week {
                        display: flex;
                        justify-content: space-between;
                      }
                      .mobile-calendar-wrapper .react-datepicker__day {
                        width: 32px;
                        height: 32px;
                        line-height: 32px;
                        margin: 1px;
                        text-align: center;
                        font-size: 0.875rem;
                      }
                      .mobile-calendar-wrapper .react-datepicker__day-name {
                        width: 32px;
                        margin: 1px;
                        font-size: 0.75rem;
                        font-weight: 600;
                        text-align: center;
                      }
                    `}</style>
                  </div>
                </div>
                <div className="mt-4 text-sm text-muted-foreground">
                  {(() => {
                    const weekStart = startOfWeek(selectedDate, { weekStartsOn: 0 });
                    const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 0 });
                    const formatDate = (date: Date) =>
                      `${date.getDate()} ${date.toLocaleString('default', { month: 'short' })} ${date.getFullYear()}`;
                    return (
                      <>
                        Selected: <span className="font-medium">{formatDate(weekStart)} - {formatDate(weekEnd)}</span>
                      </>
                    );
                  })()}
                </div>
              </div>
            </CollapsibleSection>

            {/* Mobile Goals Section */}
            <CollapsibleSection title="Top Specific Goals" section="goals">
              <div className="pt-4 space-y-4">
                {form.goals?.map((g, i) => (
                  <div key={i} className="space-y-3 p-3 border border-border rounded-lg">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm w-6">{i + 1}.</span>
                      <span className="font-medium text-sm">Goal</span>
                    </div>
                    <LinedTextarea
                      value={g.goal}
                      onChange={e => isEditing && handleArrayChange('goals', i, 'goal', e.target.value)}
                      onInput={e => isEditing && autoResize(e.currentTarget)}
                      className="w-full min-h-[40px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                      readOnly={!isEditing}
                      disabled={!isEditing}
                    />
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">Target Date</span>
                    </div>
                    <DatePicker
                      selected={(() => {
                        try {
                          if (!g.target_completion_by) return null;
                          if (/^\d{4}-\d{2}-\d{2}$/.test(g.target_completion_by)) {
                            const date = new Date(g.target_completion_by);
                            return isNaN(date.getTime()) ? null : date;
                          }
                          return null;
                        } catch (error) {
                          return null;
                        }
                      })()}
                      onChange={date => isEditing && handleArrayChange('goals', i, 'target_completion_by', date ? format(date, 'yyyy-MM-dd') : '')}
                      dateFormat="dd MMM yyyy"
                      placeholderText="Select date"
                      className="w-full min-h-[40px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                      disabled={!isEditing}
                      readOnly={!isEditing}
                    />
                    {isEditing && form.goals!.length > 3 && (
                      <div className="pt-2">
                        <Button type="button" variant="ghost" size="sm" onClick={() => handleRemoveRow('goals', i)}>
                          <Trash2 className="w-4 h-4 mr-2" /> Remove
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
                {isEditing && form.goals && form.goals.length > 0 && form.goals[form.goals.length - 1].goal && (
                  <Button type="button" variant="outline" size="sm" onClick={() => handleAddRow('goals', { goal: "", target_completion_by: "" })}>
                    Add Goal
                  </Button>
                )}
              </div>
            </CollapsibleSection>

            {/* Mobile Most Significant Moment Section */}
            <CollapsibleSection title="Most Significant Moment" section="moment">
              <div className="pt-4">
                <Label className="font-medium mb-2 block text-sm">{FIELD_LABELS.most_significant_moment}</Label>
                <LinedTextarea
                  name="most_significant_moment"
                  value={form.most_significant_moment}
                  onChange={e => isEditing && handleInputChange(e)}
                  className="w-full min-h-[60px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                  readOnly={!isEditing}
                  disabled={!isEditing}
                />
              </div>
            </CollapsibleSection>

            {/* Mobile Actions Section */}
            <CollapsibleSection title="Action Items" section="actions">
              <div className="pt-4 space-y-4">
                {form.actions?.map((a, i) => (
                  <div key={i} className="space-y-3 p-3 border border-border rounded-lg">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm w-6">{i + 1}.</span>
                      <span className="font-medium text-sm">Action Item</span>
                    </div>
                    <LinedTextarea
                      value={a.action_item}
                      onChange={e => isEditing && handleArrayChange('actions', i, 'action_item', e.target.value)}
                      onInput={e => isEditing && autoResize(e.currentTarget)}
                      className="w-full min-h-[40px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                      readOnly={!isEditing}
                      disabled={!isEditing}
                    />
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">Outcome / Lesson</span>
                    </div>
                    <LinedTextarea
                      value={a.outcome}
                      onChange={e => isEditing && handleArrayChange('actions', i, 'outcome', e.target.value)}
                      onInput={e => isEditing && autoResize(e.currentTarget)}
                      className="w-full min-h-[40px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                      readOnly={!isEditing}
                      disabled={!isEditing}
                    />
                    {isEditing && form.actions!.length > 3 && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => handleRemoveRow('actions', i)}>
                        <Trash2 className="w-4 h-4 mr-2" /> Remove
                      </Button>
                    )}
                  </div>
                ))}
                {isEditing && form.actions && form.actions.length > 0 && form.actions[form.actions.length - 1].action_item && (
                  <Button type="button" variant="outline" size="sm" onClick={() => handleAddRow('actions', { action_item: "", outcome: "" })}>
                    Add Action
                  </Button>
                )}
              </div>
            </CollapsibleSection>

            {/* Mobile Challenges Section */}
            <CollapsibleSection title="Challenges" section="challenges">
              <div className="pt-4 space-y-4">
                {form.challenges?.map((c, i) => (
                  <div key={i} className="space-y-3 p-3 border border-border rounded-lg">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm w-6">{i + 1}.</span>
                      <span className="font-medium text-sm">Challenge</span>
                    </div>
                    <LinedTextarea
                      value={c.challenge}
                      onChange={e => isEditing && handleArrayChange('challenges', i, 'challenge', e.target.value)}
                      onInput={e => isEditing && autoResize(e.currentTarget)}
                      className="w-full min-h-[40px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                      readOnly={!isEditing}
                      disabled={!isEditing}
                    />
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">Notes / Comments</span>
                    </div>
                    <LinedTextarea
                      value={c.note}
                      onChange={e => isEditing && handleArrayChange('challenges', i, 'note', e.target.value)}
                      onInput={e => isEditing && autoResize(e.currentTarget)}
                      className="w-full min-h-[40px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                      readOnly={!isEditing}
                      disabled={!isEditing}
                    />
                    {isEditing && form.challenges!.length > 3 && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => handleRemoveRow('challenges', i)}>
                        <Trash2 className="w-4 h-4 mr-2" /> Remove
                      </Button>
                    )}
                  </div>
                ))}
                {isEditing && form.challenges && form.challenges.length > 0 && form.challenges[form.challenges.length - 1].challenge && (
                  <Button type="button" variant="outline" size="sm" onClick={() => handleAddRow('challenges', { challenge: "", note: "" })}>
                    Add Challenge
                  </Button>
                )}
              </div>
            </CollapsibleSection>

            {/* Mobile Next Goals Section */}
            <CollapsibleSection title="Next 7 Days Goals" section="nextGoals">
              <div className="pt-4 space-y-4">
                {form.next_goals?.map((n, i) => (
                  <div key={i} className="space-y-3 p-3 border border-border rounded-lg">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm w-6">{i + 1}.</span>
                      <span className="font-medium text-sm">Goal</span>
                    </div>
                    <LinedTextarea
                      value={n.goal}
                      onChange={e => isEditing && handleArrayChange('next_goals', i, 'goal', e.target.value)}
                      onInput={e => isEditing && autoResize(e.currentTarget)}
                      className="w-full min-h-[40px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                      readOnly={!isEditing}
                      disabled={!isEditing}
                    />
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">Help/Resources Needed</span>
                    </div>
                    <LinedTextarea
                      value={n.help_needed}
                      onChange={e => isEditing && handleArrayChange('next_goals', i, 'help_needed', e.target.value)}
                      onInput={e => isEditing && autoResize(e.currentTarget)}
                      className="w-full min-h-[40px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                      readOnly={!isEditing}
                      disabled={!isEditing}
                    />
                    {isEditing && form.next_goals!.length > 3 && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => handleRemoveRow('next_goals', i)}>
                        <Trash2 className="w-4 h-4 mr-2" /> Remove
                      </Button>
                    )}
                  </div>
                ))}
                {isEditing && form.next_goals && form.next_goals.length > 0 && form.next_goals[form.next_goals.length - 1].goal && (
                  <Button type="button" variant="outline" size="sm" onClick={() => handleAddRow('next_goals', { goal: "", help_needed: "" })}>
                    Add Goal
                  </Button>
                )}
              </div>
            </CollapsibleSection>

            {/* Mobile Action Buttons */}
            <div className="pt-6 space-y-3">
              {entryIdForWeek && !isEditing && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={e => { e.preventDefault(); setIsEditing(true); }}
                  disabled={loading || apiLoading}
                >
                  Edit Entry
                </Button>
              )}
              {isEditing && (
                <Button type="submit" className="w-full" disabled={loading || apiLoading}>
                  {loading || apiLoading ? "Saving..." : "Save Weekly Rhythm"}
                </Button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
} 