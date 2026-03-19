"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { Database } from "@/lib/database.types";
import { Button } from "@/components/ui/button";
import { 
  MousePointer2, 
  Type, 
  Brush, 
  Image as ImageIcon, 
  Upload,
  Trash2,
  ChevronsUp,
  ChevronsDown,
  FrameIcon
} from "lucide-react";
import { FaStar } from "react-icons/fa";
import { toast } from "sonner";
import { FrameSelector } from "./FrameSelector";
import { IconSelector } from "./IconSelector";

interface DreamboardToolbarProps {
  selectedTool: "select" | "text" | "draw" | "image";
  onToolChange: (tool: "select" | "text" | "draw" | "image") => void;
  onItemCreate: (item: Database["public"]["Tables"]["dreamboard_items"]["Insert"]) => void;
  userId: string;
  selectedItemId?: string | null;
  items: Database["public"]["Tables"]["dreamboard_items"]["Row"][];
  onItemUpdate: (itemId: string, updates: Partial<Database["public"]["Tables"]["dreamboard_items"]["Row"]>) => void;
  onItemDelete: (itemId: string) => void;
  onItemSelect: (id: string | null) => void;
  selectedItems?: string[];
}

export default function DreamboardToolbar({
  selectedTool,
  onToolChange,
  onItemCreate,
  userId,
  selectedItemId,
  items,
  onItemUpdate,
  onItemDelete,
  onItemSelect,
  selectedItems = []
}: DreamboardToolbarProps) {
  const [uploading, setUploading] = useState(false);
  const [frameSelectorOpen, setFrameSelectorOpen] = useState(false);
  const [iconSelectorOpen, setIconSelectorOpen] = useState(false);
  
  const frameSelectorRef = useRef<HTMLDivElement>(null);
  const iconSelectorRef = useRef<HTMLDivElement>(null);
  const frameButtonRef = useRef<HTMLButtonElement>(null);
  const iconButtonRef = useRef<HTMLButtonElement>(null);

  // Handle clicks outside selectors to close them
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      
      // Check if click is outside frame selector
      if (frameSelectorOpen && 
          frameSelectorRef.current && 
          !frameSelectorRef.current.contains(target) &&
          frameButtonRef.current &&
          !frameButtonRef.current.contains(target)) {
        setFrameSelectorOpen(false);
      }
      
      // Check if click is outside icon selector
      if (iconSelectorOpen && 
          iconSelectorRef.current && 
          !iconSelectorRef.current.contains(target) &&
          iconButtonRef.current &&
          !iconButtonRef.current.contains(target)) {
        setIconSelectorOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [frameSelectorOpen, iconSelectorOpen]);

  const tools = [
    { id: "select" as const, icon: MousePointer2, label: "Select" },
    { id: "text" as const, icon: Type, label: "Text" },
    { id: "draw" as const, icon: Brush, label: "Draw" },
    { id: "image" as const, icon: ImageIcon, label: "Image" },
  ];

  const handleFrameButtonClick = () => {
    if (iconSelectorOpen) {
      setIconSelectorOpen(false);
    }
    setFrameSelectorOpen(!frameSelectorOpen);
  };

  const handleIconButtonClick = () => {
    if (frameSelectorOpen) {
      setFrameSelectorOpen(false);
    }
    setIconSelectorOpen(!iconSelectorOpen);
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    console.log('Selected file:', file.name, file.type, file.size);

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Image size should be less than 10MB");
      return;
    }

    setUploading(true);
    try {
      // Get actual image dimensions
      const getImageDimensions = (file: File): Promise<{ width: number; height: number }> => {
        return new Promise((resolve, reject) => {
          const img = new Image();
          const url = URL.createObjectURL(file);
          
          img.onload = () => {
            URL.revokeObjectURL(url);
            resolve({
              width: img.naturalWidth,
              height: img.naturalHeight
            });
          };
          
          img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('Failed to load image'));
          };
          
          img.src = url;
        });
      };

      // Get image dimensions before upload
      const { width: originalWidth, height: originalHeight } = await getImageDimensions(file);
      console.log('Original image dimensions:', originalWidth, 'x', originalHeight);

      // Calculate scaled dimensions (max 1000px while maintaining aspect ratio)
      let scaledWidth = originalWidth;
      let scaledHeight = originalHeight;
      
      if (originalWidth > 1000 || originalHeight > 1000) {
        const aspectRatio = originalWidth / originalHeight;
        
        if (originalWidth > originalHeight) {
          // Landscape: scale based on width
          scaledWidth = 1000;
          scaledHeight = Math.round(1000 / aspectRatio);
        } else {
          // Portrait: scale based on height
          scaledHeight = 1000;
          scaledWidth = Math.round(1000 * aspectRatio);
        }
      }
      
      console.log('Scaled image dimensions:', scaledWidth, 'x', scaledHeight);

      // Check storage access

      // Upload to Supabase storage
      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `${userId}/${fileName}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("dreamboard-assets")
        .upload(filePath, file);

      if (uploadError) {
        console.error("Upload error details:", uploadError);
        
        // If bucket doesn't exist, try to create it
        if (uploadError.message?.includes('not found') || uploadError.message?.includes('does not exist')) {
          const { data: createBucketData, error: createBucketError } = await supabase.storage
            .createBucket('dreamboard-assets', {
              public: true,
              allowedMimeTypes: ['image/*'],
              fileSizeLimit: 10485760 // 10MB
            });
          
          if (createBucketError) {
            throw new Error(`Cannot create storage bucket: ${createBucketError.message}`);
          }
          
          // Try upload again
          const { data: retryUploadData, error: retryUploadError } = await supabase.storage
            .from("dreamboard-assets")
            .upload(filePath, file);
            
          if (retryUploadError) throw retryUploadError;
        } else {
          throw uploadError;
        }
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from("dreamboard-assets")
        .getPublicUrl(filePath);

      // Create dreamboard item with scaled image dimensions
      const imageData = {
        url: publicUrl,
        width: scaledWidth,
        height: scaledHeight
      };
      
      const newItem: Database["public"]["Tables"]["dreamboard_items"]["Insert"] = {
        user_id: userId,
        type: "image",
        content: JSON.stringify(imageData),
        title: file.name,
        position_x: 100,
        position_y: 100,
        z_index: 1, // Will be updated in handleItemCreate
      };

      await onItemCreate(newItem);
      toast.success("Image uploaded successfully!");
      
      // Reset file input
      event.target.value = "";
    } catch (error: any) {
      console.error("Error uploading image:", error);
      toast.error(`Failed to upload image: ${error.message || error}`);
    } finally {
      setUploading(false);
    }
  };

  // Layer control functions
  const bringToFront = () => {
    if (!selectedItemId) return;
    const maxZIndex = Math.max(...items.map(item => item.z_index || 0), 0);
    console.log('Bringing to front, new z-index:', maxZIndex + 1);
    onItemUpdate(selectedItemId, { z_index: maxZIndex + 1 });
  };

  const sendToBack = () => {
    if (!selectedItemId) return;
    const minZIndex = Math.min(...items.map(item => item.z_index || 0), 0);
    console.log('Sending to back, new z-index:', minZIndex - 1);
    onItemUpdate(selectedItemId, { z_index: minZIndex - 1 });
  };

  const selectedItem = selectedItemId ? items.find(item => item.id === selectedItemId) : null;

  return (
    <div className="bg-white border-b shadow-sm p-4 relative">
      <div className="flex items-center gap-4">
        {/* Tool Selection */}
        <div className="flex gap-2">
          {tools.map((tool) => (
            <Button
              key={tool.id}
              variant={selectedTool === tool.id ? "default" : "outline"}
              size="sm"
              onClick={() => onToolChange(tool.id)}
              className="flex items-center gap-2"
            >
              <tool.icon size={16} />
              {tool.label}
            </Button>
          ))}
        </div>

        <div className="w-px h-6 bg-gray-300" />

        {/* Layer Controls - Only show when item is selected */}
        {selectedItemId && (
          <>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={bringToFront}
                className="flex items-center gap-1 px-2"
                title="Bring to Front"
              >
                <ChevronsUp size={14} />
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={sendToBack}
                className="flex items-center gap-1 px-2"
                title="Send to Back"
              >
                <ChevronsDown size={14} />
              </Button>
              
              {/* Remove button - for text, image, and drawing items */}
              {selectedItem && (selectedItem.type === 'text' || selectedItem.type === 'image' || selectedItem.type === 'drawing') && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    // Delete all selected items
                    const itemsToDelete = selectedItems.length > 0 
                      ? [selectedItemId, ...selectedItems].filter(Boolean).filter((id, index, arr) => arr.indexOf(id) === index)
                      : [selectedItemId].filter(Boolean);
                    
                    console.log('Deleting items:', itemsToDelete);
                    itemsToDelete.forEach(itemId => {
                      if (itemId) onItemDelete(itemId);
                    });
                    onItemSelect(null);
                  }}
                  className="flex items-center gap-1 px-2"
                  title={selectedItems.length > 0 ? `Delete ${selectedItems.length + 1} items` : "Delete Item"}
                >
                  <Trash2 size={14} />
                </Button>
              )}
            </div>
            
            <div className="text-xs text-gray-600 flex items-center px-2">
              {selectedItem?.type === 'text' && '📝 Text'}
              {selectedItem?.type === 'image' && '🖼️ Image'}
              {selectedItem?.type === 'drawing' && '✏️ Drawing'}
              {items.filter(item => item.id !== selectedItemId && (item.id === selectedItemId || selectedItems?.includes(item.id))).length > 0 && 
                ` (+${items.filter(item => item.id === selectedItemId || selectedItems?.includes(item.id)).length - 1} more)`}
            </div>
            
            <div className="w-px h-6 bg-gray-300" />
          </>
        )}

        {/* Quick Actions */}
        <div className="flex gap-2">
          <div className="relative group">
            <input
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              disabled={uploading}
            />
            <Button
              variant="outline"
              size="sm"
              disabled={uploading}
              className="flex items-center gap-2 pointer-events-none group-hover:bg-accent group-hover:text-accent-foreground transition-colors"
            >
              <Upload size={16} />
              {uploading ? "Uploading..." : "Upload Image"}
            </Button>
          </div>
          
          {/* Add Frame Button - Always visible */}
          <Button
            ref={frameButtonRef}
            variant={frameSelectorOpen ? "default" : "outline"}
            size="sm"
            onClick={handleFrameButtonClick}
            className="flex items-center gap-2"
          >
            <FrameIcon size={16} />
            Add Frame
          </Button>
          
          {/* Add Icon Button - Always visible */}
          <Button
            ref={iconButtonRef}
            variant={iconSelectorOpen ? "default" : "outline"}
            size="sm"
            onClick={handleIconButtonClick}
            className="flex items-center gap-2"
          >
            <FaStar size={16} />
            Add Icon
          </Button>
        </div>
      </div>

      {/* Frame Selector Overlay */}
      {frameSelectorOpen && (
        <div ref={frameSelectorRef}>
          <FrameSelector
            onFrameSelect={(frameData) => {
              // This prop is not used in the current implementation
              // The FrameSelector handles frame creation internally
            }}
            onItemCreate={onItemCreate}
            userId={userId}
            selectedItemId={selectedItemId}
            items={items}
            onItemUpdate={onItemUpdate}
            isOpen={frameSelectorOpen}
            onClose={() => setFrameSelectorOpen(false)}
          />
        </div>
      )}
      
      {/* Icon Selector Overlay */}
      {iconSelectorOpen && (
        <div ref={iconSelectorRef}>
          <IconSelector
            onIconSelect={(iconSvg, iconName) => {
              // This prop is not used in the current implementation
              // The IconSelector handles icon creation internally
            }}
            onItemCreate={onItemCreate}
            userId={userId}
            isOpen={iconSelectorOpen}
            onClose={() => setIconSelectorOpen(false)}
          />
        </div>
      )}

      {/* Tool-specific instructions */}
      <div className="mt-2 text-sm text-gray-600">
        {selectedTool === "select" && "Click items to select, or drag to select multiple items for deletion. Double-click text to edit."}
        {selectedTool === "text" && "Click anywhere to add text. You can edit and move existing text."}
        {selectedTool === "draw" && "Click and drag to draw. Use different brush sizes and colors."}
        {selectedTool === "image" && "Upload images, drag them around, and resize them."}
      </div>
    </div>
  );
} 