import React, { useState, useMemo } from 'react';
import { FetchedHabit } from '@/app/habit-tracker/services/useHabits';
import { HabitEntryResponse } from '@/app/habit-tracker/services/useHabitEntry';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, Save, X } from 'lucide-react';
import { toast } from 'sonner';

interface HabitNotesSectionProps {
  habit: FetchedHabit;
  entries: HabitEntryResponse[];
  selectedDate: string;
  onUpdateNote: (entryId: string, note: string) => Promise<void>;
  onCreateEntryWithNote: (date: string, note: string) => Promise<void>;
  onDateSelect?: (date: string) => void;
}

const formatDate = (date: Date) => date.toISOString().split('T')[0];

export const HabitNotesSection: React.FC<HabitNotesSectionProps> = ({
  habit,
  entries,
  selectedDate,
  onUpdateNote,
  onCreateEntryWithNote,
  onDateSelect,
}) => {
  const [noteText, setNoteText] = useState<string>('');
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Update note text when selected date changes
  React.useEffect(() => {
    if (selectedDate) {
      const entry = entries.find(e => e.entry_date === selectedDate);
      setNoteText(entry?.note || '');
      setIsEditing(true);
    } else {
      setIsEditing(false);
      setNoteText('');
    }
  }, [selectedDate, entries]);

  // Get entries with notes, sorted by date (most recent first)
  const entriesWithNotes = useMemo(() => {
    return entries
      .filter(entry => entry.note && entry.note.trim() !== '')
      .sort((a, b) => new Date(b.entry_date).getTime() - new Date(a.entry_date).getTime());
  }, [entries]);

  // Get the current entry for the selected date
  const selectedEntry = useMemo(() => {
    if (!selectedDate) return null;
    return entries.find(entry => entry.entry_date === selectedDate);
  }, [selectedDate, entries]);



  const handleSaveNote = async () => {
    if (!selectedDate) return;
    
    setIsSaving(true);
    try {
      if (selectedEntry) {
        // Update existing entry's note
        await onUpdateNote(selectedEntry.id, noteText);
      } else {
        // Create new entry with note
        await onCreateEntryWithNote(selectedDate, noteText);
      }
      toast.success('Note saved successfully');
      setIsEditing(false);
    } catch (error) {
      toast.error('Failed to save note');
      console.error('Error saving note:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setNoteText(selectedEntry?.note || '');
  };

  const formatDisplayDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <Card className="w-full h-fit">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Notes for {habit.name}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Selected date display */}
        {selectedDate && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="text-sm font-medium text-blue-800">
              Selected Date: {formatDisplayDate(selectedDate)}
            </div>
            <div className="text-xs text-blue-600 mt-1">
              Click on other habit entry cells to change the selected date, or click on previous notes below
            </div>
          </div>
        )}

        {!selectedDate && (
          <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
            <div className="text-sm text-gray-600 text-center">
              Click on any habit entry cell in the table above to add or edit notes for that date
            </div>
          </div>
        )}

        {/* Note editor */}
        {isEditing && selectedDate && (
          <div className="space-y-3 p-3 border rounded-lg bg-gray-50">
            <div className="text-sm font-medium text-gray-700">
              Note for {formatDisplayDate(selectedDate)}
            </div>
            <Textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Enter your note here..."
              className="min-h-[100px] resize-none"
            />
            <div className="flex gap-2">
              <Button
                onClick={handleSaveNote}
                disabled={isSaving}
                size="sm"
                className="flex items-center gap-1"
              >
                <Save className="h-4 w-4" />
                {isSaving ? 'Saving...' : 'Save'}
              </Button>
              <Button
                onClick={handleCancelEdit}
                variant="outline"
                size="sm"
                className="flex items-center gap-1"
              >
                <X className="h-4 w-4" />
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Existing notes list */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-700">Previous Notes</h4>
          {entriesWithNotes.length === 0 ? (
            <p className="text-sm text-gray-500 italic">No notes yet</p>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {entriesWithNotes.map((entry) => (
                <div
                  key={entry.id}
                  className={`p-3 border rounded-lg bg-white hover:bg-gray-50 cursor-pointer transition-colors ${
                    selectedDate === entry.entry_date ? 'border-blue-500 bg-blue-50' : ''
                  }`}
                  onClick={() => {
                    if (onDateSelect) {
                      onDateSelect(entry.entry_date);
                    }
                  }}
                >
                  <div className="text-xs text-gray-500 mb-1">
                    {formatDisplayDate(entry.entry_date)}
                  </div>
                  <div className="text-sm text-gray-800 line-clamp-3">
                    {entry.note}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default HabitNotesSection; 