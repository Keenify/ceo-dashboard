import React from 'react';
import { ALLOWED_COLORS, AllowedColor } from '@/app/annual_calendar_plans/types';
import { Label } from '@/components/ui/label';

interface ColorSelectorProps {
  selectedColor: AllowedColor;
  onColorSelect: (color: AllowedColor) => void;
  label?: string;
  className?: string;
}

const getColorClasses = (color: AllowedColor, isSelected: boolean) => {
  const baseClasses = 'w-8 h-8 rounded-full cursor-pointer border-2 transition-all duration-200 hover:scale-110';
  const borderClass = isSelected ? 'border-gray-800 ring-2 ring-gray-400' : 'border-gray-300 hover:border-gray-500';
  
  const colorMap: Record<AllowedColor, string> = {
    red: 'bg-red-500',
    yellow: 'bg-yellow-500',
    orange: 'bg-orange-500',
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    black: 'bg-black',
    white: 'bg-white',
    purple: 'bg-purple-500',
    pink: 'bg-pink-500'
  };
  
  return `${baseClasses} ${borderClass} ${colorMap[color]}`;
};

const ColorSelector: React.FC<ColorSelectorProps> = ({
  selectedColor,
  onColorSelect,
  label = 'Color',
  className = ''
}) => {
  return (
    <div className={className}>
      <Label className="text-sm font-medium mb-2 block">{label}</Label>
      <div className="grid grid-cols-9 gap-2 p-2 bg-gray-50 rounded-lg border">
        {ALLOWED_COLORS.map((color) => (
          <div
            key={color}
            className={getColorClasses(color, selectedColor === color)}
            onClick={() => onColorSelect(color)}
            title={color.charAt(0).toUpperCase() + color.slice(1)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onColorSelect(color);
              }
            }}
          />
        ))}
      </div>
      <p className="text-xs text-gray-500 mt-1">
        Selected: {selectedColor.charAt(0).toUpperCase() + selectedColor.slice(1)}
      </p>
    </div>
  );
};

export default ColorSelector;