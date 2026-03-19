import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { FrameIcon } from 'lucide-react';
import { Database } from "@/lib/database.types";
import { 
  FRAME_TEMPLATES, 
  getAllFrameTemplates, 
  getFrameTemplatesByCategory,
  searchFrameTemplates,
  FRAME_CATEGORIES 
} from "@/app/dreamboard/utils/frameTemplates";

interface FrameSelectorProps {
  onFrameSelect: (frameData: any) => void;
  onItemCreate: (item: Database["public"]["Tables"]["dreamboard_items"]["Insert"]) => void;
  userId: string;
  selectedItemId?: string | null;
  items: Database["public"]["Tables"]["dreamboard_items"]["Row"][];
  onItemUpdate: (itemId: string, updates: Partial<Database["public"]["Tables"]["dreamboard_items"]["Row"]>) => void;
  isOpen?: boolean;
  onClose?: () => void;
}

export const FrameSelector: React.FC<FrameSelectorProps> = ({
  onFrameSelect,
  onItemCreate,
  userId,
  selectedItemId,
  items,
  onItemUpdate,
  isOpen,
  onClose
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('Basic');
  const [searchTerm, setSearchTerm] = useState('');

  const handleFrameClick = async (frameTemplate: any) => {
    if (selectedItemId) {
      // Apply frame to selected item
      const selectedItem = items.find(item => item.id === selectedItemId);
      if (selectedItem) {
        // Get item dimensions
        let itemWidth = 200;
        let itemHeight = 150;
        
        if (selectedItem.type === 'image' && selectedItem.content) {
          try {
            const content = JSON.parse(selectedItem.content);
            itemWidth = content.width || 200;
            itemHeight = content.height || 150;
          } catch (e) {
            // Use defaults
          }
        } else if (selectedItem.type === 'text') {
          itemWidth = 300;
          itemHeight = 100;
        }

        // Create frame SVG
        const frameSvg = frameTemplate.svg(itemWidth + 40, itemHeight + 40);
        
        // Create new frame item
        const frameItem: Database["public"]["Tables"]["dreamboard_items"]["Insert"] = {
          user_id: userId,
          type: 'image',
          content: JSON.stringify({
            type: 'frame',
            svg: frameSvg,
            frameName: frameTemplate.name,
            width: itemWidth + 40,
            height: itemHeight + 40
          }),
          title: `Frame: ${frameTemplate.name}`,
          position_x: (selectedItem.position_x || 0) - 20,
          position_y: (selectedItem.position_y || 0) - 20,
          z_index: (selectedItem.z_index || 0) - 1, // Place behind the content
        };

        await onItemCreate(frameItem);
      }
    } else {
      // Create standalone frame
      const frameSvg = frameTemplate.svg(200, 150);
      
      const frameItem: Database["public"]["Tables"]["dreamboard_items"]["Insert"] = {
        user_id: userId,
        type: 'image',
        content: JSON.stringify({
          type: 'frame',
          svg: frameSvg,
          frameName: frameTemplate.name,
          width: 200,
          height: 150
        }),
        title: `Frame: ${frameTemplate.name}`,
        position_x: 100,
        position_y: 100,
        z_index: 1,
      };

      await onItemCreate(frameItem);
    }
    
    if (onClose) {
      onClose();
    }
  };

  // Filter frames based on search term
  const getFilteredFrames = (category: string) => {
    const frames = getFrameTemplatesByCategory(category as keyof typeof FRAME_CATEGORIES);
    if (!searchTerm) return frames;
    
    return frames.filter(frame => 
      frame.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      frame.category.toLowerCase().includes(searchTerm.toLowerCase())
    );
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="absolute top-16 left-4 bg-white border border-gray-200 rounded-lg shadow-lg p-4 z-20 max-w-2xl">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Select Frame</h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onClose?.()}
        >
          ×
        </Button>
      </div>

      {selectedItemId && (
        <div className="mb-4 p-2 bg-blue-50 rounded-md text-sm text-blue-700">
          Frame will be applied to selected item
        </div>
      )}

      {/* Search Input */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search frames..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Category Tabs */}
      <div className="flex gap-1 mb-4 overflow-x-auto">
        {Object.keys(FRAME_CATEGORIES).map((category) => (
          <Button
            key={category}
            variant={selectedCategory === category ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedCategory(category)}
            className="whitespace-nowrap"
          >
            {category}
          </Button>
        ))}
      </div>

      {/* Frame Grid */}
      <div className="grid grid-cols-3 gap-3 max-h-96 overflow-y-auto">
        {getFilteredFrames(selectedCategory).map((frameTemplate, index) => (
          <button
            key={index}
            onClick={() => handleFrameClick(frameTemplate)}
            className="p-3 hover:bg-gray-100 rounded-md transition-colors border border-gray-200 hover:border-gray-300 flex flex-col items-center gap-2"
            title={frameTemplate.name}
          >
            <div 
              className="w-20 h-16 flex items-center justify-center"
              dangerouslySetInnerHTML={{ __html: frameTemplate.preview }}
            />
            <span className="text-xs text-gray-600 text-center">
              {frameTemplate.name}
            </span>
          </button>
        ))}
      </div>

      {/* Frame Count Display */}
      <div className="mt-3 text-xs text-gray-500 text-center">
        {getFilteredFrames(selectedCategory).length} frames in {selectedCategory}
        {searchTerm && ` (filtered by "${searchTerm}")`}
      </div>

      <div className="mt-2 text-xs text-gray-500 text-center">
        {selectedItemId ? 
          "Click a frame to apply it to the selected item" : 
          "Click a frame to add it to the canvas"
        }
      </div>
    </div>
  );
}; 