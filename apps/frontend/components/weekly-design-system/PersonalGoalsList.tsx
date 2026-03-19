import React, { useRef, useLayoutEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Trash2 } from 'lucide-react';
import { LinedTextarea } from "@/components/ui/lined-textarea";

type PersonalGoal = {
  goal: string;
};

interface PersonalGoalsListProps {
  personalGoals: PersonalGoal[];
  onChange: (personalGoals: PersonalGoal[]) => void;
  isEditing?: boolean;
  themeClasses?: {
    header: string;
    accent: string;
  };
}

// Auto-resize helper for textareas
const autoResize = (el: HTMLTextAreaElement | null) => {
  if (el) {
    el.style.height = 'auto';
    el.style.height = Math.max(40, el.scrollHeight) + 'px';
  }
};

export default function PersonalGoalsList({ personalGoals, onChange, isEditing = true, themeClasses }: PersonalGoalsListProps) {
  // Refs for textareas
  const personalGoalsRefs = useRef<(HTMLTextAreaElement | null)[]>([]);

  // Safety check for personalGoals - ensure we always have at least 3 goals
  const safePersonalGoals = (() => {
    if (!Array.isArray(personalGoals) || personalGoals.length === 0) {
      return [{ goal: "" }, { goal: "" }, { goal: "" }];
    }
    
    // If we have some goals but fewer than 3, pad with empty goals
    const goals = [...personalGoals];
    while (goals.length < 3) {
      goals.push({ goal: "" });
    }
    
    return goals;
  })();

  // Ensure the refs array has the correct length on every render based on personalGoals state
  if (personalGoalsRefs.current.length !== safePersonalGoals.length) {
    personalGoalsRefs.current = safePersonalGoals.map(() => null as any);
  }

  useLayoutEffect(() => {
    // Auto-resize all textareas when component mounts or data changes
    personalGoalsRefs.current.forEach(textarea => {
      if (textarea) {
        textarea.style.height = 'auto';
        textarea.style.height = Math.max(40, textarea.scrollHeight) + 'px';
      }
    });
  }, [safePersonalGoals]);

  useLayoutEffect(() => {
    if (!isEditing) {
      personalGoalsRefs.current.forEach(textarea => {
        if (textarea) {
          textarea.style.height = 'auto';
          textarea.style.height = Math.max(40, textarea.scrollHeight) + 'px';
        }
      });
    }
  }, [isEditing]);

  const handleGoalChange = (index: number, value: string) => {
    const updatedGoals = [...safePersonalGoals];
    updatedGoals[index] = { goal: value };
    onChange(updatedGoals);
  };

  const handleAddRow = () => {
    onChange([...safePersonalGoals, { goal: "" }]);
  };

  const handleRemoveRow = (index: number) => {
    if (safePersonalGoals.length > 3) {
      onChange(safePersonalGoals.filter((_, i) => i !== index));
    }
  };

  // Use theme classes or fallback to default yellow
  const containerClasses = themeClasses 
    ? `${themeClasses.header} p-4 rounded border border-border w-1/2 self-start`
    : 'bg-yellow-100 dark:bg-amber-500/20 p-4 rounded border border-border w-1/2 self-start';

  const labelClasses = themeClasses 
    ? `font-semibold mb-2 block ${themeClasses.accent}`
    : 'font-semibold mb-2 block';

  return (
    <div className={containerClasses}>
      <div className="mb-4">
        <Label className={labelClasses}>Weekly Personal Goals & Commitments for the next 7 days</Label>
      </div>
      
      {safePersonalGoals.map((goal, index) => (
        <div key={index} className="flex items-start gap-2 mb-2">
          <span className="pt-[9px] font-medium text-sm w-6 text-foreground">{index + 1}.</span>
          <div className="flex-1 flex items-center gap-2">
            <LinedTextarea
              ref={el => {
                personalGoalsRefs.current[index] = el;
              }}
              value={goal.goal}
              onChange={e => isEditing && handleGoalChange(index, e.target.value)}
              onInput={e => isEditing && autoResize(e.currentTarget)}
              className="flex-1 min-h-[40px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 mr-2"
              readOnly={!isEditing}
              disabled={!isEditing}
              style={isEditing ? { overflow: 'hidden', height: 'auto' } : { overflow: 'hidden', resize: 'none' }}
              placeholder={`Enter personal goal #${index + 1}`}
            />
          </div>
          {isEditing && safePersonalGoals.length > 3 && (
            <Button 
              type="button" 
              variant="ghost" 
              size="icon" 
              onClick={() => handleRemoveRow(index)} 
              className="ml-2 pt-[5px]"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      ))}
      
      {isEditing && safePersonalGoals.length > 0 && safePersonalGoals[safePersonalGoals.length - 1].goal && (
        <Button 
          type="button" 
          variant="outline" 
          size="sm" 
          onClick={handleAddRow}
          className="mt-2"
        >
          Add
        </Button>
      )}
    </div>
  );
} 