"use client";

import { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from '@/lib/utils';
import { CalendarIcon, SaveIcon } from 'lucide-react';

// --- Types ---
export interface ReviewSectionData {
  feelings: string;
  headline: string;
  significance: string;
}

export interface TableReviewData {
  Work: ReviewSectionData;
  Family: ReviewSectionData;
  Personal: ReviewSectionData;
  "Next 30-60 days": string; // Simplified to single string
  challenge_or_opportunity?: string;
}

const SECTIONS_CONFIG: { name: keyof Omit<TableReviewData, 'challenge_or_opportunity'>; emoji: string; isSimplified?: boolean }[] = [
  { name: "Work", emoji: "💼" },
  { name: "Family", emoji: "👨‍👩‍👧" },
  { name: "Personal", emoji: "👤" },
  { name: "Next 30-60 days", emoji: "🎯", isSimplified: true },
];

const TABLE_HEADERS = [
  { 
    title: "FEELINGS", 
    description: "Strong feelings last 30 days. Single words (joy, sad etc.) 3-5 words each box" 
  },
  { 
    title: "HEADLINE", 
    description: "What caused these feelings? Single sentence" 
  },
  { 
    title: "SIGNIFICANCE (5%)", 
    description: "How is this personally significant to me? Dig deep!" 
  }
];

interface EditableCellProps {
  value: string;
  onChange: (value: string) => void;
  isEditing: boolean;
  onToggleEdit: () => void;
  fieldType: 'input' | 'textarea';
  className?: string;
  inputPlaceholder?: string;
}

const EditableCell: React.FC<EditableCellProps> = ({
  value,
  onChange,
  isEditing,
  onToggleEdit,
  fieldType,
  className,
  inputPlaceholder
}) => {
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const displayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      // Focus first, then adjust height for textareas
      requestAnimationFrame(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          
          if (inputRef.current instanceof HTMLTextAreaElement) {
            inputRef.current.style.height = 'auto';
            inputRef.current.style.height = `${inputRef.current.scrollHeight}px`;
          }
        }
      });
    }
  }, [isEditing]);

  const handleValueChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    onChange(e.target.value);
    if (e.target instanceof HTMLTextAreaElement) {
        e.target.style.height = 'auto';
        e.target.style.height = `${e.target.scrollHeight}px`;
      }
  };

  const displayPlaceholderText = "Click to edit...";

  const isLeftAligned = className?.includes('text-left');
  const isChallengeSection = className?.includes('min-h-[100px]');

  if (isEditing) {
    return fieldType === 'input' ? (
      <Input
        ref={inputRef as React.RefObject<HTMLInputElement>}
        type="text"
        value={value}
        onChange={handleValueChange}
        onBlur={onToggleEdit}
        className={cn("w-full border-blue-500 min-h-[40px] sm:min-h-[50px] text-center rounded-md text-xs sm:text-sm")}
        placeholder={inputPlaceholder}
        style={{ 
          textAlign: isLeftAligned ? 'left' : 'center',
          paddingTop: isChallengeSection ? '8px' : '12px',
          paddingBottom: isChallengeSection ? '8px' : '12px',
          paddingLeft: '8px',
          paddingRight: '8px',
          lineHeight: '1.4',
          verticalAlign: isChallengeSection ? 'top' : 'middle'
        }}
      />
    ) : (
      <Textarea
        ref={inputRef as React.RefObject<HTMLTextAreaElement>}
        value={value}
        onChange={handleValueChange}
        onBlur={onToggleEdit}
        className={cn("w-full border-blue-500 min-h-[40px] sm:min-h-[50px] resize-none text-xs sm:text-sm text-foreground", isLeftAligned ? 'text-left' : 'text-center', className)}
        placeholder={inputPlaceholder}
        style={{ 
          textAlign: isLeftAligned ? 'left' : 'center',
          paddingTop: isChallengeSection ? '8px' : '12px',
          paddingBottom: isChallengeSection ? '8px' : '12px',
          paddingLeft: '8px',
          paddingRight: '8px',
          lineHeight: '1.4',
          verticalAlign: isChallengeSection ? 'top' : 'middle'
        }}
        onInput={(e) => {
            const target = e.target as HTMLTextAreaElement;
            target.style.height = 'auto';
            target.style.height = `${target.scrollHeight}px`;
        }}
      />
    );
  }

  return (
    <div
      ref={displayRef}
      onClick={(e) => {
        e.stopPropagation();
        onToggleEdit();
      }}
      className={cn(
        "w-full h-full cursor-pointer min-h-[40px] sm:min-h-[50px]",
        "whitespace-pre-wrap break-words text-xs sm:text-sm",
        isChallengeSection ? 'flex-col items-start justify-start' : 'flex items-center justify-center',
        isLeftAligned ? 'text-left justify-start' : 'text-center justify-center',
        className
      )}
      style={{
        paddingTop: isChallengeSection ? '8px' : '12px',
        paddingBottom: isChallengeSection ? '8px' : '12px',
        paddingLeft: '8px',
        paddingRight: '8px',
        lineHeight: '1.4',
        display: 'flex',
        alignItems: isChallengeSection ? 'flex-start' : 'center',
        justifyContent: isLeftAligned ? 'flex-start' : 'center'
      }}
      title={displayPlaceholderText}
    >
      {value ? (
        <span className={cn("w-full", isLeftAligned ? 'text-left' : 'text-center')}>{value}</span>
      ) : (
        <span className={cn("text-muted-foreground italic w-full", isLeftAligned ? 'text-left' : 'text-center')}>{displayPlaceholderText}</span>
      )}
    </div>
  );
};

interface EditableReviewTableProps {
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  completedDates: Date[];
  reviewData: TableReviewData;
  onReviewDataChange: (section: keyof TableReviewData, field: keyof ReviewSectionData | 'next_30_60', value: string) => void;
  onChallengeOpportunityChange: (value: string) => void;
  onSave: () => Promise<void>;
  loadingSave: boolean;
  errorSave?: string | null;
}

export const EditableReviewTable: React.FC<EditableReviewTableProps> = ({
  selectedDate,
  onDateChange,
  completedDates,
  reviewData,
  onReviewDataChange,
  onChallengeOpportunityChange,
  onSave,
  loadingSave,
  errorSave
}) => {
  const [editingCell, setEditingCell] = useState<{ section: keyof TableReviewData; field: keyof ReviewSectionData | 'next_30_60'; } | null>(null);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  const handleToggleEdit = (section: keyof TableReviewData, field: keyof ReviewSectionData | 'next_30_60') => {
    if (editingCell?.section === section && editingCell?.field === field) {
      setEditingCell(null);
    } else {
      setEditingCell({ section, field });
    }
  };
  
  const renderDayContents = (day: number, date: Date) => {
    const formattedDate = format(date, 'yyyy-MM-dd');
    const isCompleted = completedDates.some(d => format(d, 'yyyy-MM-dd') === formattedDate);
    return (
      <div className={cn('relative px-1 py-0.5', isCompleted && !isDateSame(date, selectedDate) ? 'font-bold text-primary' : '', isDateSame(date, selectedDate) ? 'bg-accent text-accent-foreground rounded-md' : '')}>
        {day}
        {isCompleted && (
          <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-primary rounded-full"></div>
        )}
      </div>
    );
  };

  const isDateSame = (date1: Date, date2: Date) => {
      return format(date1, 'yyyy-MM-dd') === format(date2, 'yyyy-MM-dd');
  }

  return (
    <div className="bg-card border border-border rounded-lg shadow-sm p-1 md:col-span-2 w-full">
      <div className="overflow-x-auto -mx-2 px-2">
        <table className="w-full border-collapse table-fixed max-w-full min-w-[640px]">
          <colgroup>
              <col className="w-[180px]" />
              <col className="w-[160px] sm:w-[18%]" />
              <col className="w-[200px] sm:w-[32%]" />
              <col className="w-[180px] sm:w-[50%]" />
          </colgroup>
          <thead>
            <tr className="bg-muted/50">
              <th className="p-2 sm:p-3 text-center font-semibold text-xs sm:text-sm sticky left-0 bg-muted/50 z-10 border-b border-r min-w-[180px] w-[180px]">
                  <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                      <PopoverTrigger asChild>
                          <Button
                              variant="outline"
                              className={cn(
                              "w-full mx-auto justify-center text-center font-normal text-xs sm:text-sm",
                              !selectedDate && "text-muted-foreground"
                              )}
                          >
                              <CalendarIcon className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                              <span className="whitespace-nowrap">{selectedDate ? format(selectedDate, "PPP") : "Pick a date"}</span>
                          </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                          <DatePicker
                              selected={selectedDate}
                              onChange={(date) => {
                                  if (date) onDateChange(date);
                                  setIsCalendarOpen(false);
                              }}
                              inline
                              renderDayContents={renderDayContents}
                              highlightDates={completedDates.filter(d => !isDateSame(d, selectedDate))}
                              calendarClassName="text-sm"
                          />
                      </PopoverContent>
                  </Popover>
              </th>
              {TABLE_HEADERS.map((header, index) => (
                <th key={header.title} className="p-2 sm:p-3 text-center font-semibold text-xs sm:text-sm border-b overflow-hidden">
                  <div className="flex flex-col items-center">
                    <span className="whitespace-nowrap">{header.title}</span>
                    <span className="text-xs text-muted-foreground font-normal mt-1 leading-tight">
                      {header.description}
                    </span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SECTIONS_CONFIG.map(({ name: sectionName, emoji, isSimplified }) => (
              <tr key={sectionName} className="hover:bg-muted/20 transition-colors border-b">
                <td className="p-2 sm:p-3 font-medium text-xs sm:text-sm sticky left-0 bg-card hover:bg-muted/20 z-10 border-r text-center overflow-hidden">
                  <div className="flex items-center justify-center">
                      <span role="img" aria-label={sectionName} className="emoji-section-icon">{emoji}</span>
                      {sectionName}
                  </div>
                </td>
                {isSimplified ? (
                  // Simplified single input spanning all three columns for "Next 30-60 days"
                  <td colSpan={3} className="p-0 align-middle overflow-hidden text-center">
                    <EditableCell
                      value={reviewData[sectionName] as string || ""}
                      onChange={(value) => onReviewDataChange(sectionName, 'next_30_60', value)}
                      isEditing={editingCell?.section === sectionName && editingCell?.field === 'next_30_60'}
                      onToggleEdit={() => handleToggleEdit(sectionName, 'next_30_60')}
                      fieldType="textarea"
                      className="text-center"
                      inputPlaceholder="What are your plans and goals for the next 30-60 days?"
                    />
                  </td>
                ) : (
                  // Standard three-column layout for Work, Family, Personal
                  (Object.keys(reviewData[sectionName] as ReviewSectionData) as Array<keyof ReviewSectionData>).map((field) => (
                    <td key={field} className="p-0 align-middle overflow-hidden text-center">
                      <EditableCell
                        value={(reviewData[sectionName] as ReviewSectionData)[field]}
                        onChange={(value) => onReviewDataChange(sectionName, field, value)}
                        isEditing={editingCell?.section === sectionName && editingCell?.field === field}
                        onToggleEdit={() => handleToggleEdit(sectionName, field)}
                        fieldType="textarea"
                        className="text-center"
                        inputPlaceholder={field === 'feelings' ? 'How you feel...' : field === 'headline' ? 'What caused these feelings...' : 'How is this personally significant to me...'} 
                      />
                    </td>
                  ))
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {/* Challenge or Opportunity Section */}
      <div className="mt-6 p-4 bg-card border-2 border-dashed border-blue-200 rounded-lg hover:border-blue-300 transition-colors duration-200">
        <div className="space-y-3">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-white text-base">💡</span>
            </div>
            <p className="text-base font-medium text-foreground italic">
              A challenge or opportunity I would like to explore further with the group is...
            </p>
          </div>
          <div className="ml-9">
            <EditableCell
              value={reviewData.challenge_or_opportunity || ""}
              onChange={onChallengeOpportunityChange}
              isEditing={editingCell?.section === 'challenge_or_opportunity'}
              onToggleEdit={() => {
                if (editingCell?.section === 'challenge_or_opportunity') {
                  setEditingCell(null);
                } else {
                  setEditingCell({ section: 'challenge_or_opportunity' as any, field: 'challenge_or_opportunity' as any });
                }
              }}
              fieldType="textarea"
              className="min-h-[100px] sm:min-h-[120px] text-left justify-start items-start text-foreground"
              inputPlaceholder="Share your challenge or opportunity here..."
            />
          </div>
        </div>
      </div>

      <div className="mt-4 sm:mt-6 flex justify-end p-2 sm:p-3 border-t no-print">
        {errorSave && <p className="text-xs sm:text-sm text-destructive mr-2 sm:mr-4 self-center">{errorSave}</p>}
        <Button onClick={onSave} disabled={loadingSave} className="text-xs sm:text-sm py-1 px-2 sm:py-2 sm:px-4">
          <SaveIcon className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
          {loadingSave ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </div>
  );
}; 