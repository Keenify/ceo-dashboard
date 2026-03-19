'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useOPPP } from './services/useOPPP';
import { OPPPFormData, OPPPForm, TimeFrame, Category, CATEGORY_LABELS } from './types';
import { useUser } from '@/lib/hooks/useUser';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { X, Save, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from '@/components/ui/toast';

export default function OPPPPage() {
  const { user } = useUser();
  const { 
    fetchOPPPForm, 
    fetchAllOPPPForms,
    upsertOPPPForm, 
    deleteOPPPForm, 
    getEmptyFormData, 
    loading, 
    error 
  } = useOPPP();

  const [formData, setFormData] = useState<OPPPFormData>(getEmptyFormData());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [hasChanges, setHasChanges] = useState(false);
  const [newItemInputs, setNewItemInputs] = useState<Record<string, string>>({});
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [focusedInput, setFocusedInput] = useState<string | null>(null);
  const [allForms, setAllForms] = useState<OPPPForm[]>([]);
  const [latestFormDate, setLatestFormDate] = useState<string | null>(null);


  const loadAllForms = useCallback(async () => {
    if (!user?.id) return;
    
    const forms = await fetchAllOPPPForms(user.id);
    setAllForms(forms);
    
    if (forms.length > 0) {
      const latestForm = forms[0]; // fetchAllOPPPForms orders by date desc
      setLatestFormDate(latestForm.form_date);
      setSelectedDate(new Date(latestForm.form_date));
      
      // Ensure form_data exists and has the correct structure
      if (latestForm.form_data && typeof latestForm.form_data === 'object') {
        setFormData(latestForm.form_data);
      } else {
        setFormData(getEmptyFormData());
      }
    } else {
      setFormData(getEmptyFormData());
      setLatestFormDate(null);
    }
    setHasChanges(false);
  }, [user?.id, fetchAllOPPPForms, getEmptyFormData]);

  const loadForm = useCallback(async (dateStr: string) => {
    if (!user?.id) return;
    
    const form = await fetchOPPPForm(user.id, dateStr);
    if (form) {
      setFormData(form.form_data);
    } else {
      setFormData(getEmptyFormData());
    }
    setHasChanges(false);
  }, [user?.id, fetchOPPPForm, getEmptyFormData]);

  useEffect(() => {
    if (user?.id) {
      loadAllForms();
    }
  }, [user?.id, loadAllForms]);

  useEffect(() => {
    if (user?.id && selectedDate && latestFormDate) {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      if (dateStr !== latestFormDate) {
        loadForm(dateStr);
      }
    }
  }, [user?.id, selectedDate, loadForm, latestFormDate]);

  const handleDateChange = async (dateString: string) => {
    const date = new Date(dateString);
    if (!isNaN(date.getTime())) {
      setSelectedDate(date);
      // Explicitly load the form data for this date
      if (user?.id) {
        await loadForm(dateString);
      }
    }
  };

  const addItem = (timeFrame: TimeFrame, category: Category) => {
    const inputKey = `${timeFrame}-${category}`;
    const newItem = newItemInputs[inputKey]?.trim();
    
    if (!newItem) return;

    const updatedFormData = { ...formData };
    updatedFormData[timeFrame][category] = [...updatedFormData[timeFrame][category], newItem];
    
    setFormData(updatedFormData);
    setNewItemInputs(prev => ({ ...prev, [inputKey]: '' }));
    setHasChanges(true);
    toast.success('Item added successfully!');
  };

  const removeItem = (timeFrame: TimeFrame, category: Category, index: number) => {
    const updatedFormData = { ...formData };
    updatedFormData[timeFrame][category] = updatedFormData[timeFrame][category].filter((_, i) => i !== index);
    
    setFormData(updatedFormData);
    setHasChanges(true);
  };

  const handleInputChange = (timeFrame: TimeFrame, category: Category, value: string) => {
    const inputKey = `${timeFrame}-${category}`;
    setNewItemInputs(prev => ({ ...prev, [inputKey]: value }));
  };

  // Helper function to check if there are pending changes
  const hasPendingChanges = () => {
    return hasChanges || Object.values(newItemInputs).some(input => input && input.trim().length > 0);
  };

  const handleCellClick = (timeFrame: TimeFrame, category: Category) => {
    const inputKey = `${timeFrame}-${category}`;
    setFocusedInput(inputKey);
    
    // Focus the input after state update
    setTimeout(() => {
      const input = document.querySelector(`input[data-input-key="${inputKey}"]`) as HTMLInputElement;
      if (input) {
        input.focus();
      }
    }, 0);
  };

  const handleKeyPress = (e: React.KeyboardEvent, timeFrame: TimeFrame, category: Category) => {
    const inputKey = `${timeFrame}-${category}`;
    const currentValue = newItemInputs[inputKey] || '';
    
    if (e.key === 'Enter') {
      e.preventDefault();
      addItem(timeFrame, category);
    } else if (e.key === 'Backspace' && currentValue === '') {
      e.preventDefault();
      
      // Check if there are existing items in this cell
      const existingItems = formData[timeFrame][category];
      if (existingItems.length > 0) {
        // Move the last item back to the input field for editing
        const lastItem = existingItems[existingItems.length - 1];
        
        // Remove the last item from formData
        const updatedFormData = { ...formData };
        updatedFormData[timeFrame][category] = existingItems.slice(0, -1);
        setFormData(updatedFormData);
        
        // Put the last item in the input field for editing
        setNewItemInputs(prev => ({ ...prev, [inputKey]: lastItem }));
        setHasChanges(true);
      } else {
        // If no items in current cell, try to navigate to previous timeframe in same category
        const timeFrames: TimeFrame[] = ['10-25_years', '1_year', 'start', 'stop'];
        const currentTimeFrameIndex = timeFrames.indexOf(timeFrame);
        
        if (currentTimeFrameIndex > 0) {
          const previousTimeFrame = timeFrames[currentTimeFrameIndex - 1];
          const previousInputKey = `${previousTimeFrame}-${category}`;
          const previousInput = document.querySelector(`input[data-input-key="${previousInputKey}"]`) as HTMLInputElement;
          if (previousInput) {
            previousInput.focus();
            setTimeout(() => {
              previousInput.setSelectionRange(previousInput.value.length, previousInput.value.length);
            }, 0);
          }
        }
      }
    }
  };

  const saveForm = async () => {
    if (!user?.id) {
      console.error('No user ID available for saving form');
      toast.error('Unable to save: No user ID available');
      return;
    }

    // Before saving, add any pending input values to the form data
    const updatedFormData = { ...formData };
    
    Object.entries(newItemInputs).forEach(([inputKey, value]) => {
      if (value && value.trim()) {
        // Parse inputKey more carefully since timeframes can contain hyphens
        // inputKey format: "{timeFrame}-{category}"
        // timeframes: "10-25_years", "1_year", "start", "stop"
        // categories: "relationships", "achievements", "rituals", "wealth"
        
        let timeFrame: TimeFrame;
        let category: Category;
        
        if (inputKey.startsWith('10-25_years-')) {
          timeFrame = '10-25_years';
          category = inputKey.replace('10-25_years-', '') as Category;
        } else {
          const lastDashIndex = inputKey.lastIndexOf('-');
          timeFrame = inputKey.substring(0, lastDashIndex) as TimeFrame;
          category = inputKey.substring(lastDashIndex + 1) as Category;
        }
        
        updatedFormData[timeFrame][category] = [...updatedFormData[timeFrame][category], value.trim()];
      }
    });

    const payload = {
      user_id: user.id,
      form_date: format(selectedDate, 'yyyy-MM-dd'),
      form_data: updatedFormData
    };

    console.log('Attempting to save OPPP form with payload:', payload);
    
    try {
      const result = await upsertOPPPForm(payload);
      if (result) {
        console.log('Form saved successfully:', result);
        // Update the current form data with the saved data
        setFormData(updatedFormData);
        // Clear all pending inputs
        setNewItemInputs({});
        setHasChanges(false);
        // Reload all forms to update the list
        await loadAllForms();
        toast.success('OPPP form saved successfully!');
      } else {
        console.error('Failed to save form, result was null');
        toast.error('Failed to save form');
      }
    } catch (error) {
      console.error('Error saving form:', error);
      toast.error('Error occurred while saving form');
    }
  };

  const handleClearClick = () => {
    setShowDeleteConfirm(true);
  };

  const confirmClear = async () => {
    if (!user?.id) {
      toast.error('Unable to delete: No user ID available');
      return;
    }
    
    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const success = await deleteOPPPForm(user.id, dateStr);
      
      if (success) {
        setFormData(getEmptyFormData());
        setNewItemInputs({}); // Clear all unsaved input text
        setHasChanges(false);
        setShowDeleteConfirm(false);
        // Reload all forms to update the list
        await loadAllForms();
        toast.success('OPPP form deleted successfully!');
      } else {
        toast.error('Failed to delete form');
      }
    } catch (error) {
      console.error('Error deleting form:', error);
      toast.error('Error occurred while deleting form');
    }
  };

  const cancelClear = () => {
    setShowDeleteConfirm(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto relative">
      {/* Header */}
      <div className="bg-orange-500 text-white p-4 rounded-t-lg">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">People: One-Page Personal Plan (OPPP)</h1>
          {latestFormDate && format(selectedDate, 'yyyy-MM-dd') === latestFormDate && (
            <div className="bg-white bg-opacity-20 px-3 py-1 rounded-full text-sm font-medium">
              Latest Entry
            </div>
          )}
        </div>
      </div>


      {/* Form Controls */}
      <div className="bg-white border-l border-r border-gray-200 p-4 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="font-medium">Name:</span>
            <span className="px-3 py-1 bg-gray-100 rounded border-b-2 border-gray-300">
              {user?.user_metadata?.display_name || user?.email || 'User'}
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="font-medium">Date:</span>
            <input 
              type="date" 
              value={format(selectedDate, 'yyyy-MM-dd')}
              onChange={(e) => handleDateChange(e.target.value)}
              className="border border-gray-300 border-b-2 border-b-gray-300 rounded px-3 py-2 text-sm font-normal focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        <div className="flex gap-2">
          {hasPendingChanges() && (
            <Button onClick={saveForm} className="flex items-center gap-2">
              <Save className="h-4 w-4" />
              Save
            </Button>
          )}
          <Button onClick={handleClearClick} variant="destructive" className="flex items-center gap-2">
            <Trash2 className="h-4 w-4" />
            Clear
          </Button>
        </div>
      </div>

      {/* Grid Table */}
      <div className="bg-white border border-gray-200 rounded-b-lg overflow-auto">
        <div className="min-w-full">
          <table className="w-full table-fixed">
          <thead>
            <tr>
              <th className="w-32 bg-gray-400 text-white p-3 border border-gray-300" aria-label="Categories"></th>
              <th className="w-40 bg-gray-400 text-white p-3 border border-gray-300" aria-label="Timeframes"></th>
              {(['relationships', 'achievements', 'rituals', 'wealth'] as Category[]).map((category) => (
                <th key={category} className="bg-gray-400 text-white p-3 border border-gray-300 text-center min-w-[200px]">
                  {CATEGORY_LABELS[category]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* Faith - 10-25 Years Row */}
            <tr className="min-h-[120px]">
              <td className="bg-gray-300 p-3 border border-gray-300 w-32 min-h-[600px]" rowSpan={5} style={{verticalAlign: 'top'}}>
                <div className="h-full min-h-[600px] flex flex-col justify-between items-center py-4">
                  <div className="font-medium text-center">Faith</div>
                  <div className="font-medium text-center">Family</div>
                  <div className="font-medium text-center">Friends</div>
                  <div className="font-medium text-center">Fitness</div>
                  <div className="font-medium text-center">Finance</div>
                </div>
              </td>
              <td className="bg-gray-300 p-3 border border-gray-300 h-full" style={{verticalAlign: 'middle'}}>
                <div className="font-medium text-center h-full flex flex-col justify-center">
                  <div className="bg-teal-600 text-white px-2 py-1 rounded text-sm">
                    10-25 Years (Aspirations)
                  </div>
                </div>
              </td>
              {(['relationships', 'achievements', 'rituals', 'wealth'] as Category[]).map((category) => (
                <td key={category} className="p-3 border border-gray-300 align-top min-h-[120px] cursor-pointer" onClick={() => handleCellClick('10-25_years', category)}>
                  <div className="space-y-1">
                    {/* Existing items */}
                    {formData['10-25_years'][category].map((item, index) => (
                      <div key={index} className="group flex items-center justify-between bg-gray-50 px-2 py-0.5 rounded text-sm hover:bg-gray-100">
                        <span className="flex-1 break-words whitespace-pre-wrap overflow-wrap-anywhere min-w-0">{item}</span>
                        <button
                          type="button"
                          title="Remove item"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeItem('10-25_years', category, index);
                            toast.success('Item removed successfully!');
                          }}
                          className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 ml-2 transition-opacity flex-shrink-0"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                    
                    {/* Add new item input */}
                    <div>
                      <Input
                        value={newItemInputs[`10-25_years-${category}`] || ''}
                        onChange={(e) => handleInputChange('10-25_years', category, e.target.value)}
                        onKeyDown={(e) => handleKeyPress(e, '10-25_years', category)}
                        onBlur={() => setFocusedInput(null)}
                        className={`text-sm h-8 border-none bg-transparent focus:ring-0 focus:outline-none px-0 ${
                          focusedInput === `10-25_years-${category}` || newItemInputs[`10-25_years-${category}`] 
                            ? 'opacity-100' 
                            : 'opacity-0'
                        }`}
                        data-input-key={`10-25_years-${category}`}
                        placeholder="Click to add item..."
                      />
                    </div>
                  </div>
                </td>
              ))}
            </tr>

            {/* Family - 1 Year Row */}
            <tr className="min-h-[120px]">
              {/* First column covered by rowSpan */}
              <td className="bg-gray-300 p-3 border border-gray-300 h-full" style={{verticalAlign: 'middle'}}>
                <div className="font-medium text-center h-full flex flex-col justify-center">
                  <div className="bg-teal-600 text-white px-2 py-1 rounded text-sm">
                    <div>1 Year</div>
                    <div>(Activities)</div>
                  </div>
                </div>
              </td>
              {(['relationships', 'achievements', 'rituals', 'wealth'] as Category[]).map((category) => (
                <td key={category} className="p-3 border border-gray-300 align-top min-h-[120px] cursor-pointer" onClick={() => handleCellClick('1_year', category)}>
                  <div className="space-y-1">
                    {/* Existing items */}
                    {formData['1_year'][category].map((item, index) => (
                      <div key={index} className="group flex items-center justify-between bg-gray-50 px-2 py-0.5 rounded text-sm hover:bg-gray-100">
                        <span className="flex-1 break-words whitespace-pre-wrap overflow-wrap-anywhere min-w-0">{item}</span>
                        <button
                          type="button"
                          title="Remove item"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeItem('1_year', category, index);
                            toast.success('Item removed successfully!');
                          }}
                          className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 ml-2 transition-opacity flex-shrink-0"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                    
                    {/* Add new item input */}
                    <div>
                      <Input
                        value={newItemInputs[`1_year-${category}`] || ''}
                        onChange={(e) => handleInputChange('1_year', category, e.target.value)}
                        onKeyDown={(e) => handleKeyPress(e, '1_year', category)}
                        onBlur={() => setFocusedInput(null)}
                        className={`text-sm h-8 border-none bg-transparent focus:ring-0 focus:outline-none px-0 ${
                          focusedInput === `1_year-${category}` || newItemInputs[`1_year-${category}`] 
                            ? 'opacity-100' 
                            : 'opacity-0'
                        }`}
                        data-input-key={`1_year-${category}`}
                        placeholder="Click to add item..."
                      />
                    </div>
                  </div>
                </td>
              ))}
            </tr>

            {/* Start Row */}
            <tr style={{height: '50%'}}>
              <td className="bg-gray-300 p-3 border border-gray-300 h-full" rowSpan={2} style={{verticalAlign: 'middle'}}>
                <div className="font-medium text-center h-full flex flex-col justify-center">
                  <div className="bg-teal-600 text-white px-2 py-1 rounded text-sm">
                    90 Days (Actions)
                  </div>
                </div>
              </td>
              {(['relationships', 'achievements', 'rituals', 'wealth'] as Category[]).map((category) => (
                <td key={category} className="p-3 border-l border-r border-t border-gray-300 align-top cursor-pointer" style={{height: '150px'}} onClick={() => handleCellClick('start', category)}>
                  <div className="bg-gray-400 text-white px-2 py-1 text-sm font-medium text-center mb-2">Start</div>
                  <div className="space-y-1">
                    {/* Existing items */}
                    {formData['start'][category].map((item, index) => (
                      <div key={index} className="group flex items-center justify-between bg-gray-50 px-2 py-0.5 rounded text-sm hover:bg-gray-100">
                        <span className="flex-1 break-words whitespace-pre-wrap overflow-wrap-anywhere min-w-0">{item}</span>
                        <button
                          type="button"
                          title="Remove item"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeItem('start', category, index);
                            toast.success('Item removed successfully!');
                          }}
                          className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 ml-2 transition-opacity flex-shrink-0"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                    
                    {/* Add new item input */}
                    <div>
                      <Input
                        value={newItemInputs[`start-${category}`] || ''}
                        onChange={(e) => handleInputChange('start', category, e.target.value)}
                        onKeyDown={(e) => handleKeyPress(e, 'start', category)}
                        onBlur={() => setFocusedInput(null)}
                        className={`text-sm h-8 border-none bg-transparent focus:ring-0 focus:outline-none px-0 ${
                          focusedInput === `start-${category}` || newItemInputs[`start-${category}`] 
                            ? 'opacity-100' 
                            : 'opacity-0'
                        }`}
                        data-input-key={`start-${category}`}
                        placeholder="Click to add item..."
                      />
                    </div>
                  </div>
                </td>
              ))}
            </tr>

            {/* Stop Row */}
            <tr style={{height: '50%'}}>
              {(['relationships', 'achievements', 'rituals', 'wealth'] as Category[]).map((category) => (
                <td key={category} className="p-3 border-l border-r border-b border-gray-300 align-top cursor-pointer" style={{height: '150px'}} onClick={() => handleCellClick('stop', category)}>
                  <div className="bg-gray-400 text-white px-2 py-1 text-sm font-medium text-center mb-2">Stop</div>
                  <div className="space-y-1">
                    {/* Existing items */}
                    {formData['stop'][category].map((item, index) => (
                      <div key={index} className="group flex items-center justify-between bg-gray-50 px-2 py-0.5 rounded text-sm hover:bg-gray-100">
                        <span className="flex-1 break-words whitespace-pre-wrap overflow-wrap-anywhere min-w-0">{item}</span>
                        <button
                          type="button"
                          title="Remove item"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeItem('stop', category, index);
                            toast.success('Item removed successfully!');
                          }}
                          className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 ml-2 transition-opacity flex-shrink-0"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                    
                    {/* Add new item input */}
                    <div>
                      <Input
                        value={newItemInputs[`stop-${category}`] || ''}
                        onChange={(e) => handleInputChange('stop', category, e.target.value)}
                        onKeyDown={(e) => handleKeyPress(e, 'stop', category)}
                        onBlur={() => setFocusedInput(null)}
                        className={`text-sm h-8 border-none bg-transparent focus:ring-0 focus:outline-none px-0 ${
                          focusedInput === `stop-${category}` || newItemInputs[`stop-${category}`] 
                            ? 'opacity-100' 
                            : 'opacity-0'
                        }`}
                        data-input-key={`stop-${category}`}
                        placeholder="Click to add item..."
                      />
                    </div>
                  </div>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
        </div>
      </div>

      {/* Past Entries Section */}
      {(() => {
        const currentDateStr = format(selectedDate, 'yyyy-MM-dd');
        const otherForms = allForms.filter(form => form.form_date !== currentDateStr);
        
        return otherForms.length > 0 && (
          <div className="mt-8">
            <div className="bg-gray-100 p-4 rounded-t-lg border-b">
              <h2 className="text-xl font-semibold text-gray-800">Past Entries</h2>
            </div>
            <div className="bg-white border border-gray-200 rounded-b-lg">
              <div className="max-h-96 overflow-y-auto">
                {otherForms.map((form) => (
                <div key={form.id} className="border-b border-gray-200 last:border-b-0">
                  <div className="p-4">
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="text-lg font-medium text-gray-700">
                        {format(new Date(form.form_date), 'PPP')}
                      </h3>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          const targetDate = new Date(form.form_date);
                          setSelectedDate(targetDate);
                          // Explicitly load the form data for this date
                          if (user?.id) {
                            await loadForm(format(targetDate, 'yyyy-MM-dd'));
                          }
                        }}
                        className="text-sm"
                      >
                        Load This Entry
                      </Button>
                    </div>
                    
                    {/* Mini table view for past entry */}
                    <div className="grid grid-cols-4 gap-4 text-sm">
                      {(['relationships', 'achievements', 'rituals', 'wealth'] as Category[]).map((category) => (
                        <div key={category} className="space-y-2">
                          <h4 className="font-medium text-gray-600 border-b pb-1">
                            {CATEGORY_LABELS[category]}
                          </h4>
                          
                          {/* Show data for each timeframe */}
                          {(['10-25_years', '1_year', 'start', 'stop'] as TimeFrame[]).map((timeframe) => {
                            const items = form.form_data[timeframe][category];
                            if (items.length === 0) return null;
                            
                            return (
                              <div key={timeframe} className="space-y-1">
                                <div className="text-xs font-medium text-gray-500 uppercase">
                                  {timeframe === '10-25_years' ? '10-25 Years' : 
                                   timeframe === '1_year' ? '1 Year' : 
                                   timeframe.charAt(0).toUpperCase() + timeframe.slice(1)}
                                </div>
                                {items.map((item, itemIndex) => (
                                  <div key={itemIndex} className="text-xs text-gray-700 bg-gray-50 px-2 py-1 rounded break-words whitespace-pre-wrap">
                                    {item}
                                  </div>
                                ))}
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                ))}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Delete Confirmation Modal */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Delete</DialogTitle>
            <DialogDescription>
              Are you sure you want to clear this OPPP form? This action cannot be undone and will permanently delete all data for {format(selectedDate, 'PPP')}.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={cancelClear}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmClear}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {error && (
        <div className="mt-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
          <div className="font-semibold">Error:</div>
          <div>{error.message}</div>
          <div className="mt-2 text-sm">
            <details>
              <summary className="cursor-pointer">Debug Information</summary>
              <pre className="mt-2 text-xs bg-red-50 p-2 rounded overflow-auto">
                {JSON.stringify(error, null, 2)}
              </pre>
            </details>
          </div>
        </div>
      )}
    </div>
  );
}