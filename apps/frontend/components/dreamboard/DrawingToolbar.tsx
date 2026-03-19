"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Palette, RotateCcw, Brush } from "lucide-react";

interface DrawingToolbarProps {
  isVisible: boolean;
  brushSize: number;
  setBrushSize: (size: number) => void;
  brushColor: string;
  setBrushColor: (color: string) => void;
  onClear: () => void;
  onUndo: () => void;
}

const PRESET_COLORS = [
  "#000000", "#FFFFFF", "#FF0000", "#00FF00", "#0000FF",
  "#FFFF00", "#FF00FF", "#00FFFF", "#FFA500", "#800080",
  "#FFC0CB", "#A52A2A", "#808080", "#000080", "#008000",
  "#800000", "#808000", "#008080", "#C0C0C0", "#FF6347"
];

export default function DrawingToolbar({
  isVisible,
  brushSize,
  setBrushSize,
  brushColor,
  setBrushColor,
  onClear,
  onUndo
}: DrawingToolbarProps) {
  const [showColorPicker, setShowColorPicker] = useState(false);

  if (!isVisible) return null;

  return (
    <div className="absolute top-4 left-4 bg-white rounded-lg shadow-lg p-4 z-10 min-w-[250px]">
      <div className="space-y-4">
        {/* Brush Size */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Brush Size: {brushSize}px
          </label>
          <input
            type="range"
            value={brushSize}
            onChange={(e) => setBrushSize(Number(e.target.value))}
            max={50}
            min={1}
            step={1}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          />
        </div>

        {/* Color Selection */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <label className="block text-sm font-medium">Color:</label>
            <div 
              className="w-8 h-8 rounded border-2 border-gray-300 cursor-pointer"
              style={{ backgroundColor: brushColor }}
              onClick={() => setShowColorPicker(!showColorPicker)}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowColorPicker(!showColorPicker)}
            >
              <Palette size={16} />
            </Button>
          </div>
          
          {showColorPicker && (
            <div className="grid grid-cols-5 gap-2 mt-2">
              {PRESET_COLORS.map((color) => (
                <button
                  key={color}
                  className="w-8 h-8 rounded border-2 border-gray-300 hover:border-gray-400"
                  style={{ backgroundColor: color }}
                  onClick={() => {
                    setBrushColor(color);
                    setShowColorPicker(false);
                  }}
                />
              ))}
            </div>
          )}
          
          {/* Custom Color Input */}
          <div className="mt-2">
            <input
              type="color"
              value={brushColor}
              onChange={(e) => setBrushColor(e.target.value)}
              className="w-full h-8 rounded border cursor-pointer"
            />
          </div>
        </div>



        {/* Drawing Controls */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onUndo}
            className="flex items-center gap-2"
          >
            <RotateCcw size={16} />
            Undo
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={onClear}
            className="flex items-center gap-2"
          >
            Clear All
          </Button>
        </div>

        {/* Drawing Tips */}
        <div className="text-xs text-gray-600 pt-2 border-t">
          <p>💡 Tips:</p>
          <p>• Click and drag to draw</p>
          <p>• Adjust brush size with slider</p>
          <p>• Pick colors from palette or use custom color</p>
          <p>• Select drawings to delete them with the remove button</p>
        </div>
      </div>
    </div>
  );
} 