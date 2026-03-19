import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface EmotionData {
  score: number;
  explanation?: string;
}

interface ExpandableEmotionProps {
  emotion: string;
  data: EmotionData | number; // Support both old format (number) and new format (object)
  percentage: number;
}

export function ExpandableEmotion({ emotion, data, percentage }: ExpandableEmotionProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Handle both old format (just number) and new format (object with score and explanation)
  const score = typeof data === 'number' ? data : data.score;
  const explanation = typeof data === 'object' && data.explanation ? data.explanation : null;
  
  // Don't show expand button if there's no explanation
  const hasExplanation = explanation && explanation.length > 0;

  return (
    <div className="group">
      {/* Clean emotion row */}
      <div 
        className={`flex items-center justify-between py-2 transition-all duration-200 ${
          hasExplanation ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/30 rounded-lg px-2 -mx-2' : ''
        }`}
        onClick={hasExplanation ? () => setIsExpanded(!isExpanded) : undefined}
      >
        <div className="flex items-center space-x-2">
          <span className="text-gray-700 dark:text-gray-300 capitalize leading-relaxed">
            {emotion}
          </span>
          {hasExplanation && (
            <div className={`transition-all duration-300 ease-in-out opacity-0 group-hover:opacity-100 ${isExpanded ? 'rotate-180 opacity-100' : 'rotate-0'}`}>
              <ChevronDown className="h-4 w-4 text-gray-400 transition-colors duration-200" />
            </div>
          )}
        </div>
        <span className="text-gray-500 dark:text-gray-400 font-normal">
          {percentage}%
        </span>
      </div>
      
      {/* Expandable explanation */}
      {hasExplanation && (
        <div className={`overflow-hidden transition-all duration-400 ease-in-out ${
          isExpanded ? 'max-h-40 opacity-100 mt-2 mb-2' : 'max-h-0 opacity-0'
        }`}>
          <div className="pl-4 pr-2">
            <div className="border-l-2 border-gray-200 dark:border-gray-700 pl-4 py-1">
              <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                {explanation}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 