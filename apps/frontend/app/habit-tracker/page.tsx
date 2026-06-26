"use client";

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { HabitTable } from '@/components/habit-tracker/HabitTable';
import Link from 'next/link';
import { useHabits, FetchedHabit } from './services/useHabits';
import { useHabitEntries, HabitEntryResponse } from './services/useHabitEntry';
import { useHabitStreaks, HabitStreakResponse } from './services/useHabitStreaks';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { HabitModal } from '../../components/habit-tracker/HabitModal';
import { DeleteHabitConfirmModal } from '../../components/habit-tracker/DeleteHabitConfirmModal';
import { HabitBuddyManager } from '../../components/habit-tracker/HabitBuddyManager';
import { toast } from 'sonner';
import HabitDetailChart from '@/components/habit-tracker/HabitDetailChart';
import HabitNotesSection from '@/components/habit-tracker/HabitNotesSection';
import HabitYearOverview from '@/components/habit-tracker/HabitYearOverview';
import { Loader2 } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

type HabitEntriesState = Record<string, Record<string, HabitEntryResponse>>;
type HabitStreaksState = Record<string, HabitStreakResponse>;

const formatDate = (date: Date): string => {
  // Format as YYYY-MM-DD in local time
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function HabitTrackerPage() {
  const router = useRouter();
  const {
    fetchUserHabits,
    createHabit,
    updateHabit,
    deleteHabit,
    loading: habitLoading,
    error: habitError,
  } = useHabits();
  const {
    fetchHabitEntries,
    createHabitEntry,
    updateHabitEntry,
    loading: entryLoading,
    error: entryError,
  } = useHabitEntries();
  const {
    fetchHabitStreak,
    loading: streakLoading,
    error: streakError,
  } = useHabitStreaks();

  const [habits, setHabits] = useState<FetchedHabit[]>([]);
  const [habitEntries, setHabitEntries] = useState<HabitEntriesState>({});
  const [streaks, setStreaks] = useState<HabitStreaksState>({});
  const [user, setUser] = useState<any>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedHabit, setSelectedHabit] = useState<FetchedHabit | undefined>(undefined);
  const [isEditMode, setIsEditMode] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'year'>('grid');
  const [selectedChartHabit, setSelectedChartHabit] = useState<FetchedHabit | null>(null);
  const [chartEntriesData, setChartEntriesData] = useState<HabitEntryResponse[]>([]);
  const [isChartLoading, setIsChartLoading] = useState<boolean>(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [habitToDelete, setHabitToDelete] = useState<FetchedHabit | null>(null);
  const [selectedDateForNotes, setSelectedDateForNotes] = useState<string>('');
  const [lastKnownDate, setLastKnownDate] = useState<string>('');
  const [isPageVisible, setIsPageVisible] = useState<boolean>(true);

  const getCurrentDateString = () => {
    const now = new Date();
    return formatDate(new Date(now.getFullYear(), now.getMonth(), now.getDate()));
  };

  const checkDateChange = useCallback(() => {
    const currentDateString = getCurrentDateString();
    if (lastKnownDate && lastKnownDate !== currentDateString) {
      console.log('[DateChange] Date changed from', lastKnownDate, 'to', currentDateString);
      // Update to show today's date when date changes
      const now = new Date();
      const todayLocal = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      setCurrentDate(todayLocal);
      toast.success('Date changed - habit tracker updated!');
    }
    setLastKnownDate(currentDateString);
  }, [lastKnownDate]);

  // Initialize lastKnownDate on component mount
  useEffect(() => {
    setLastKnownDate(getCurrentDateString());
  }, []);

  // Page Visibility API effect
  useEffect(() => {
    const handleVisibilityChange = () => {
      const isVisible = !document.hidden;
      setIsPageVisible(isVisible);
      
      if (isVisible) {
        // Check for date change when page becomes visible
        checkDateChange();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [checkDateChange]);

  // Date change check effect (every minute when page is active)
  useEffect(() => {
    if (!isPageVisible) return;

    const interval = setInterval(() => {
      checkDateChange();
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [isPageVisible, checkDateChange]);

  useEffect(() => {
    const checkUser = async () => {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData?.user) {
        router.push("/login");
      } else {
        setUser(authData.user);
      }
    };
    checkUser();
  }, [router]);

  const DAYS_TO_SHOW = 21; // Number of days to display in the table

  const getVisibleDates = useCallback(() => {
    const dates: Date[] = [];
    // Use local midnight for today
    const now = new Date();
    const todayLocal = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Use local midnight for end date
    const end = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());
    let endDate = end > todayLocal ? todayLocal : end;

    // Calculate the start date
    let startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - (DAYS_TO_SHOW - 1));

    // Fill the dates array from startDate to endDate inclusive
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      dates.push(new Date(d));
    }

    // If not enough days, pad at the start
    while (dates.length < DAYS_TO_SHOW) {
      const first = new Date(dates[0]);
      first.setDate(first.getDate() - 1);
      dates.unshift(new Date(first));
    }

    // Always ensure today is the last date if endDate is today
    if (endDate.getTime() === todayLocal.getTime()) {
      dates[dates.length - 1] = new Date(todayLocal);
    }

    return dates;
  }, [currentDate]);

  const loadHabitsAndStreaks = useCallback(async () => {
    if (!user?.id) return;
    console.log("[Page] Loading Habits...");
    const fetchedHabits = await fetchUserHabits(user.id);
    if (fetchedHabits) {
      setHabits(fetchedHabits);
      console.log("[Page] Habits Loaded. Fetching initial streaks...");
      // Fetch initial streaks for all loaded habits
      const initialStreaks: HabitStreaksState = {};
      await Promise.all(fetchedHabits.map(async (habit) => {
         try {
            const streakData = await fetchHabitStreak(habit.id);
            if (streakData) {
                initialStreaks[habit.id] = streakData;
            }
         } catch (err) {
            console.error(`Error fetching initial streak for habit ${habit.id}:`, err);
            // Optionally set a default/error state for this habit's streak
            initialStreaks[habit.id] = { 
              habit_id: habit.id, 
              current_streak: 0, 
              longest_streak: 0, 
              total_streak: 0,
              last_entry_date: null, 
              last_value: null 
            };
         }
      }));
      console.log("[Page] Initial Streaks Fetched:", initialStreaks);
      setStreaks(initialStreaks);
    } else {
        setHabits([]); // Clear habits if fetch failed
        setStreaks({}); // Clear streaks if habits fetch failed
    }
  }, [user, fetchUserHabits, fetchHabitStreak]);

  const loadEntries = useCallback(async (targetHabits: FetchedHabit[], targetDates: Date[]) => {
    if (!user?.id || targetHabits.length === 0 || targetDates.length === 0) {
      if (Object.keys(habitEntries).length > 0) setHabitEntries({});
      return;
    }

    const startDateStr = formatDate(targetDates[0]);
    const endDateStr = formatDate(targetDates[targetDates.length - 1]);
    let allEntries: HabitEntriesState = {};
    let hasError = false;

    await Promise.all(targetHabits.map(async (habit) => {
      try {
        const entries = await fetchHabitEntries(habit.id, startDateStr, endDateStr);
        if (entries) {
          const habitEntryMap: Record<string, HabitEntryResponse> = {};
          entries.forEach(entry => {
            habitEntryMap[entry.entry_date] = entry;
          });
          allEntries[habit.id] = habitEntryMap;
        } else {
          allEntries[habit.id] = {};
        }
      } catch (err) {
        console.error(`Error fetching entries for habit ${habit.id}:`, err);
        allEntries[habit.id] = {};
        hasError = true;
      }
    }));

    setHabitEntries(allEntries);
    if(hasError) {
        toast.error("Error fetching some habit entries.");
    }

  }, [user, fetchHabitEntries]);

  useEffect(() => {
    loadHabitsAndStreaks();
  }, [loadHabitsAndStreaks]);

  useEffect(() => {
      const visibleDates = getVisibleDates();
      if (habits.length > 0 && visibleDates.length > 0) {
          loadEntries(habits, visibleDates);
      } else {
           if (Object.keys(habitEntries).length > 0) setHabitEntries({});
      }
  }, [habits, currentDate, loadEntries, getVisibleDates]);

  const handleCreateOrUpdateHabit = async (habitData: {
    name: string;
    description: string;
    habit_type: 'build' | 'break' | 'track';
    color_code: string;
  }) => {
    if (!user?.id) return;
    setIsModalOpen(false);

    try {
      let success = false;
      if (selectedHabit) {
        const updatedHabit = await updateHabit(selectedHabit.id, user.id, habitData);
        if (updatedHabit) {
          toast.success('Habit updated successfully');
          setHabits(prev => prev.map(h => h.id === updatedHabit.id ? { ...h, ...updatedHabit } : h));
          success = true;
        }
      } else {
        const newHabit = await createHabit({ ...habitData, user_id: user.id });
        if (newHabit) {
          toast.success('Habit created successfully');
          setHabits(prev => [...prev, newHabit]);
          setHabitEntries(prev => ({ ...prev, [newHabit.id]: {} }));
          success = true;
        }
      }
      if (!success) {
         toast.error(selectedHabit ? 'Failed to update habit' : 'Failed to create habit');
      }
    } catch (err) {
      toast.error(selectedHabit ? 'Failed to update habit' : 'Failed to create habit');
      console.error('Error with habit:', err);
    } finally {
       setSelectedHabit(undefined);
    }
  };

  const handleDeleteHabit = async (habitId: string) => {
    // Find the habit to show in confirmation modal
    const habit = habits.find(h => h.id === habitId);
    if (habit) {
      setHabitToDelete(habit);
      setIsDeleteModalOpen(true);
    }
  };

  const handleConfirmDelete = async () => {
    if (!user?.id || !habitToDelete) return;

    try {
      const success = await deleteHabit(habitToDelete.id, user.id);
      if (success) {
        toast.success('Habit deleted successfully');
        setHabits(prevHabits => prevHabits.filter(habit => habit.id !== habitToDelete.id));
        setHabitEntries(prevEntries => {
            const newEntries = {...prevEntries};
            delete newEntries[habitToDelete.id];
            return newEntries;
        });
        setStreaks(prevStreaks => {
            const newStreaks = {...prevStreaks};
            delete newStreaks[habitToDelete.id];
            return newStreaks;
        });
      } else {
        toast.error('Failed to delete habit');
      }
    } catch (err) {
      toast.error('An error occurred while deleting the habit');
      console.error('Error deleting habit:', err);
    } finally {
      setIsDeleteModalOpen(false);
      setHabitToDelete(null);
    }
  };

  const handleCancelDelete = () => {
    setIsDeleteModalOpen(false);
    setHabitToDelete(null);
  };

  const handleEditHabit = (habit: FetchedHabit) => {
    setSelectedHabit(habit);
    setIsModalOpen(true);
  };

  const handleCreateOrUpdateEntry = async (habitId: string, dateStr: string, value?: string | null) => {
    if (!user?.id) return;

    // Note: selectedDateForNotes is now set immediately via onCellClick callback

    const currentEntries = habitEntries; // Store state for revert
    const existingEntry = currentEntries[habitId]?.[dateStr];
    const habit = habits.find(h => h.id === habitId);
    const isTrackHabit = habit?.habit_type === 'track';

    // --- Optimistic Update --- 
    let optimisticEntry: HabitEntryResponse;
    let newStatus: 'completed' | 'skipped' = 'completed'; // Default to completed
    const optimisticValue: string | null = value !== undefined && value !== null ? String(value) : null;

    if (existingEntry) {
        if (isTrackHabit) {
            // For track habits, status depends on value
            newStatus = optimisticValue === null ? 'skipped' : 'completed';
            optimisticEntry = { ...existingEntry, status: newStatus, value: optimisticValue };
        } else {
            // For build/break habits, toggle status
            newStatus = existingEntry.status === 'completed' ? 'skipped' : 'completed';
            optimisticEntry = { ...existingEntry, status: newStatus };
        }
    } else {
        // For new entries, determine status correctly for track habits
        if (isTrackHabit) {
            newStatus = optimisticValue === null ? 'skipped' : 'completed';
        }
        // build/break habits keep default 'completed' status
        
        // Create a placeholder optimistic entry
        optimisticEntry = {
            habit_id: habitId,
            entry_date: dateStr,
            status: newStatus,
            id: `optimistic-${Date.now()}`, // Temporary ID
            created_at: new Date().toISOString(), // Placeholder time
            note: null,
            value: optimisticValue,
        };
    }

    // Update state immediately
    setHabitEntries(prev => ({
        ...prev,
        [habitId]: {
            ...(prev[habitId] || {}),
            [dateStr]: optimisticEntry
        }
    }));
    // --- End Optimistic Update ---

    try {
      let serverResponse: HabitEntryResponse | null = null;

      const payload = { 
        status: newStatus, 
        value: optimisticValue, // Use the correct final value
        note: existingEntry?.note ?? "" 
      };

      if (existingEntry) {
        // API Call: Update existing entry with the calculated payload
        serverResponse = await updateHabitEntry(habitId, existingEntry.id, payload);
      } else {
        // API Call: Create new entry, adding entry_date to the payload
        serverResponse = await createHabitEntry(habitId, { entry_date: dateStr, ...payload });
      }

      if (!serverResponse) {
          throw new Error("API operation failed");
      }
      // Update local state with actual server response
       setHabitEntries(prev => ({
            ...prev,
            [habitId]: {
                ...(prev[habitId] || {}),
                [dateStr]: serverResponse!
            }
        }));

      // Also update chart data if this habit is currently being viewed
      if (selectedChartHabit && selectedChartHabit.id === habitId) {
        setChartEntriesData(prev => {
          const existingIndex = prev.findIndex(entry => entry.entry_date === dateStr);
          if (existingIndex >= 0) {
            // Update existing entry
            const updated = [...prev];
            updated[existingIndex] = serverResponse!;
            return updated;
          } else {
            // Add new entry and sort
            return [...prev, serverResponse!].sort((a, b) => 
              new Date(a.entry_date).getTime() - new Date(b.entry_date).getTime()
            );
          }
        });
      }

      // --- Re-fetch streak for the updated habit --- 
      console.log(`[HabitTrackerPage] Entry saved for ${habitId}. Fetching updated streak...`);
      try {
          const updatedStreak = await fetchHabitStreak(habitId);
          if (updatedStreak) {
              console.log(`[HabitTrackerPage] Updated streak for ${habitId}:`, updatedStreak);
              setStreaks(prev => ({ ...prev, [habitId]: updatedStreak }));
          } else {
               console.log(`[HabitTrackerPage] No streak data returned for ${habitId} after update.`);
               // Optionally reset streak in state if API returns null after update
               // setStreaks(prev => ({ ...prev, [habitId]: { habit_id: habitId, current_streak: 0, ... } }));
          }
      } catch (streakErr) {
           console.error(`Error fetching streak for ${habitId} after entry update:`, streakErr);
           toast.error("Failed to update streak display.");
      }
      // --- End streak re-fetch --- 

    } catch (err) {
      // --- Revert Optimistic Update on Error ---
      toast.error('Failed to update habit entry. Reverting.');
      console.error('Error creating/updating habit entry, reverting UI:', err);
      setHabitEntries(currentEntries); // Revert to the state before the optimistic update
      // --- End Revert ---
    }
  };

  const handleUpdateNote = async (entryId: string, note: string) => {
    if (!user?.id || !selectedChartHabit) return;

    try {
      const serverResponse = await updateHabitEntry(selectedChartHabit.id, entryId, { note });
      if (serverResponse) {
        // Update the chart entries data
        setChartEntriesData(prev => 
          prev.map(entry => 
            entry.id === entryId ? { ...entry, note } : entry
          )
        );
        
        // Update the main habit entries state if the entry is in the visible range
        setHabitEntries(prev => {
          const habitEntries = prev[selectedChartHabit.id] || {};
          const updatedEntries = { ...habitEntries };
          
          // Find the entry by ID and update it
          Object.keys(updatedEntries).forEach(dateKey => {
            if (updatedEntries[dateKey].id === entryId) {
              updatedEntries[dateKey] = { ...updatedEntries[dateKey], note };
            }
          });
          
          return {
            ...prev,
            [selectedChartHabit.id]: updatedEntries
          };
        });
      }
    } catch (error) {
      console.error('Error updating note:', error);
      throw error;
    }
  };

  const handleCreateEntryWithNote = async (date: string, note: string) => {
    if (!user?.id || !selectedChartHabit) return;

    try {
      // Check if an entry already exists for this date in both data sources
      const existingEntryInChart = chartEntriesData.find(entry => entry.entry_date === date);
      const existingEntryInTable = habitEntries[selectedChartHabit.id]?.[date];
      const existingEntry = existingEntryInChart || existingEntryInTable;
      
      let serverResponse: HabitEntryResponse | null = null;

      if (existingEntry) {
        // Update existing entry with the note
        serverResponse = await updateHabitEntry(selectedChartHabit.id, existingEntry.id, {
          note
        });
      } else {
        // Create new entry with note
        serverResponse = await createHabitEntry(selectedChartHabit.id, {
          entry_date: date,
          status: 'completed',
          note,
          value: null
        });
      }
      
      if (serverResponse) {
        // Update the chart entries data
        if (existingEntryInChart) {
          // Update existing entry in chart data
          setChartEntriesData(prev => 
            prev.map(entry => 
              entry.id === existingEntry.id ? { ...entry, note } : entry
            )
          );
        } else {
          // Add new entry to chart entries data
          setChartEntriesData(prev => [...prev, serverResponse].sort((a, b) => 
            new Date(a.entry_date).getTime() - new Date(b.entry_date).getTime()
          ));
        }
        
        // Update the main habit entries state
        setHabitEntries(prev => ({
          ...prev,
          [selectedChartHabit.id]: {
            ...(prev[selectedChartHabit.id] || {}),
            [date]: serverResponse
          }
        }));

        // Update streak only if we created a new entry
        if (!existingEntry) {
          try {
            const updatedStreak = await fetchHabitStreak(selectedChartHabit.id);
            if (updatedStreak) {
              setStreaks(prev => ({ ...prev, [selectedChartHabit.id]: updatedStreak }));
            }
          } catch (streakErr) {
            console.error(`Error fetching streak after creating entry with note:`, streakErr);
          }
        }
      }
    } catch (error) {
      console.error('Error creating/updating entry with note:', error);
      throw error;
    }
  };

  const handlePreviousPage = () => {
    const newEndDate = new Date(currentDate);
    newEndDate.setDate(newEndDate.getDate() - DAYS_TO_SHOW);
    setCurrentDate(newEndDate);
  };

  const handleNextPage = () => {
    const now = new Date();
    const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const newEndDate = new Date(currentDate);
    newEndDate.setUTCDate(newEndDate.getUTCDate() + DAYS_TO_SHOW);

    // If the new end date is after today, set it to today (UTC)
    if (newEndDate >= todayUtc) {
      setCurrentDate(todayUtc);
    } else {
      setCurrentDate(newEndDate);
    }
  };

  const combinedLoading = habitLoading || entryLoading || streakLoading;
  const combinedError = habitError || entryError || streakError;

  if (combinedLoading && habits.length === 0) {
    return (
      <div className="min-h-screen bg-background p-8 flex items-center justify-center">
        <div className="text-lg">Loading habits...</div>
      </div>
    );
  }

  if (combinedError) {
    return (
      <div className="min-h-screen bg-background p-8 flex items-center justify-center">
        <div className="text-lg text-destructive">Error: {combinedError.message}</div>
      </div>
    );
  }

  const visibleDates = getVisibleDates();
  const isNextDisabled = () => {
      // Get today's date components in UTC
      const now = new Date();
      const todayUtcMidnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());

      // Get the current end date components based on currentDate (interpreted as UTC)
      const currentEndDateObj = new Date(currentDate);
      const currentEndUtcMidnight = Date.UTC(currentEndDateObj.getUTCFullYear(), currentEndDateObj.getUTCMonth(), currentEndDateObj.getUTCDate());

      // Disable if the current end date is already today (UTC comparison)
      return currentEndUtcMidnight >= todayUtcMidnight;
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="w-full max-w-[calc(100vw-2rem)]">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-4xl font-bold">Habit Tracker</h1>
          <div className="flex items-center gap-4">
            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'grid' | 'year')}>
              <TabsList>
                <TabsTrigger value="grid">21-day grid</TabsTrigger>
                <TabsTrigger value="year">Year overview</TabsTrigger>
              </TabsList>
            </Tabs>
            {user?.id && <HabitBuddyManager userId={user.id} />}
          </div>
        </div>
        {viewMode === 'year' && (
          <HabitYearOverview habits={habits} streaks={streaks} />
        )}
        {viewMode === 'grid' && (<>
        <HabitTable
          habits={habits}
          dates={visibleDates}
          entries={habitEntries}
          streaks={streaks}
          onCreateOrUpdateEntry={handleCreateOrUpdateEntry as (habitId: string, dateStr: string, value?: string | null) => void}
          onCellClick={(habitId: string, dateStr: string) => {
            // Set note date immediately when any cell is clicked (for chart viewing habit)
            if (selectedChartHabit && selectedChartHabit.id === habitId) {
              setSelectedDateForNotes(dateStr);
            }
          }}
          onEdit={handleEditHabit}
          onDelete={handleDeleteHabit}
          onNewHabit={() => {
            setSelectedHabit(undefined);
            setIsModalOpen(true);
          }}
          onPreviousPage={handlePreviousPage}
          onNextPage={handleNextPage}
          isNextDisabled={isNextDisabled()}
          onJumpToDate={(date) => {
            if (!date) return;
            // Use local midnight for picked date
            const pickedLocal = new Date(date.getFullYear(), date.getMonth(), date.getDate());
            setCurrentDate(pickedLocal);
          }}
          onUpdateSortOrder={async (habitId: string, sort_order: number) => {
            if (!user?.id) return;
            const endpoint = `/habits/${habitId}?user_id=${user.id}`;
            const payload = { sort_order };
            console.log('[DragDrop] Update Habit Sort Order:', { endpoint, payload });
            await updateHabit(habitId, user.id, payload);
            // Optionally, re-fetch habits or update local state for immediate UI feedback
            await loadHabitsAndStreaks(); // Re-fetch habits to get the updated order
          }}
          isEditMode={isEditMode}
          setIsEditMode={setIsEditMode}
          onRowClick={async (habitId) => {
            const habit = habits.find(h => h.id === habitId);
            if (habit) {
              setSelectedChartHabit(habit);
              setChartEntriesData([]);
              setSelectedDateForNotes(''); // Reset selected date when switching habits
              setIsChartLoading(true);
              try {
                const todayStr = formatDate(new Date());
                const allEntries = await fetchHabitEntries(habitId, "2025-01-01", todayStr);
                setChartEntriesData(allEntries || []);
              } catch (error) {
                console.error("Error fetching all entries for chart:", error);
                toast.error("Failed to load chart data.");
                setChartEntriesData([]);
              } finally {
                setIsChartLoading(false);
              }
            }
          }}
        />
        {selectedChartHabit && (
          <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <div className="p-4 border rounded-lg shadow-sm">
                {isChartLoading ? (
                  <div className="flex items-center justify-center h-40">
                    <Loader2 className="h-6 w-6 animate-spin mr-2" />
                    <span>Loading chart data...</span>
                  </div>
                ) : (
                  <HabitDetailChart
                    habit={selectedChartHabit}
                    entries={chartEntriesData}
                    streak={streaks[selectedChartHabit.id] || null}
                    onClose={() => {
                      setSelectedChartHabit(null);
                      setChartEntriesData([]);
                      setSelectedDateForNotes('');
                    }}
                  />
                )}
              </div>
            </div>
            <div className="lg:col-span-1">
              {!isChartLoading && (
                <HabitNotesSection
                  habit={selectedChartHabit}
                  entries={chartEntriesData}
                  selectedDate={selectedDateForNotes}
                  onUpdateNote={handleUpdateNote}
                  onCreateEntryWithNote={handleCreateEntryWithNote}
                  onDateSelect={setSelectedDateForNotes}
                />
              )}
            </div>
          </div>
        )}
        </>)}
      </div>
      <HabitModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedHabit(undefined);
        }}
        onSubmit={handleCreateOrUpdateHabit}
        habit={selectedHabit}
      />
      <DeleteHabitConfirmModal
        open={isDeleteModalOpen}
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
        habitName={habitToDelete?.name}
      />
    </div>
  );
}
