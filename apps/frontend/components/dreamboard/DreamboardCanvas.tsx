"use client";

import { useEffect, useRef, useState } from "react";
import { Stage, Layer, Line, Text, Image as KonvaImage, Transformer, Group } from "react-konva";
import { Database } from "@/lib/database.types";
import { supabase } from "@/lib/supabase";
import useImage from "use-image";
import Konva from "konva";
import DrawingToolbar from "./DrawingToolbar";

type DreamboardItem = Database["public"]["Tables"]["dreamboard_items"]["Row"];

interface DreamboardCanvasProps {
  items: DreamboardItem[];
  selectedTool: "select" | "text" | "draw" | "image";
  onItemUpdate: (itemId: string, updates: Partial<DreamboardItem>) => void;
  onItemCreate: (item: Database["public"]["Tables"]["dreamboard_items"]["Insert"]) => void;
  onItemDelete: (itemId: string) => void;
  userId: string;
  selectedItemId?: string | null;
  onItemSelect: (id: string | null) => void;
  onSelectedItemsChange?: (items: string[]) => void;
}

// Image component for Konva
const URLImage = ({ 
  item, 
  isSelected, 
  onSelect, 
  onChange,
  selectedTool
}: { 
  item: DreamboardItem; 
  isSelected: boolean; 
  onSelect: () => void; 
  onChange: (attrs: any) => void;
  selectedTool: "select" | "text" | "draw" | "image";
}) => {
  const [image] = useImage(item.content || "", "anonymous");
  const shapeRef = useRef<any>();
  const transformerRef = useRef<any>();

  // Parse image metadata from content
  const getImageData = () => {
    try {
      if (item.content && item.content.startsWith('http')) {
        // Old format: just URL
        return {
          url: item.content,
          width: 200,
          height: 150
        };
      } else if (item.content) {
        // New format: JSON with URL and dimensions
        const parsed = JSON.parse(item.content);
        return {
          url: parsed.url || parsed,
          width: parsed.width || 200,
          height: parsed.height || 150
        };
      }
      return { url: '', width: 200, height: 150 };
    } catch (e) {
      // Fallback for invalid JSON
      return {
        url: item.content || '',
        width: 200,
        height: 150
      };
    }
  };

  const imageData = getImageData();
  const [imageUrl] = useImage(imageData.url, "anonymous");

  useEffect(() => {
    if (isSelected) {
      transformerRef.current?.nodes([shapeRef.current]);
      transformerRef.current?.getLayer()?.batchDraw();
    }
  }, [isSelected]);

  return (
    <>
      <KonvaImage
        ref={shapeRef}
        image={imageUrl}
        x={item.position_x || 0}
        y={item.position_y || 0}
        width={imageData.width}
        height={imageData.height}
        draggable={selectedTool === "select" || selectedTool === "image"}
        onClick={selectedTool !== "text" ? onSelect : undefined}
        onTap={selectedTool !== "text" ? onSelect : undefined}
        onDragEnd={(e) => {
          onChange({
            position_x: e.target.x(),
            position_y: e.target.y(),
          });
        }}
        onTransformEnd={(e) => {
          const node = shapeRef.current;
          const scaleX = node.scaleX();
          const scaleY = node.scaleY();
          
          // Calculate new dimensions
          const newWidth = node.width() * scaleX;
          const newHeight = node.height() * scaleY;
          
          // Reset scale to 1
          node.scaleX(1);
          node.scaleY(1);
          
          // Update the stored content with new dimensions
          const newImageData = {
            url: imageData.url,
            width: Math.round(newWidth),
            height: Math.round(newHeight)
          };
          

          
          onChange({
            position_x: node.x(),
            position_y: node.y(),
            content: JSON.stringify(newImageData)
          });
        }}
      />
      {isSelected && (
        <Transformer
          ref={transformerRef}
          flipEnabled={false}
          boundBoxFunc={(oldBox, newBox) => {
            // Limit resize
            if (Math.abs(newBox.width) < 50 || Math.abs(newBox.height) < 50) {
              return oldBox;
            }
            return newBox;
          }}
        />
      )}
    </>
  );
};

export default function DreamboardCanvas({
  items,
  selectedTool,
  onItemUpdate,
  onItemCreate,
  onItemDelete,
  userId,
  selectedItemId,
  onItemSelect,
  onSelectedItemsChange
}: DreamboardCanvasProps) {
  // Use passed selectedItemId instead of internal state
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPath, setCurrentPath] = useState<number[]>([]);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [editingTextValue, setEditingTextValue] = useState<string>('');
  const [editingTextPosition, setEditingTextPosition] = useState<{ x: number; y: number } | null>(null);
  const [stageSize, setStageSize] = useState({ width: 2000, height: 1500 }); // Larger initial size
  const [brushSize, setBrushSize] = useState(5);
  const [brushColor, setBrushColor] = useState("#000000");
  const [drawingHistory, setDrawingHistory] = useState<any[]>([]);
  
  // Selection rectangle state
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionRect, setSelectionRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  
  // Zoom and Pan state
  const [scale, setScale] = useState(1);
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [lastPanPoint, setLastPanPoint] = useState<{ x: number; y: number } | null>(null);
  
  const stageRef = useRef<any>();
  const containerRef = useRef<HTMLDivElement>(null);

  // Zoom constraints
  const MIN_SCALE = 0.1;
  const MAX_SCALE = 5;
  const ZOOM_FACTOR = 1.1;

  // Helper function to get item bounds for selection
  const getItemBounds = (item: DreamboardItem) => {
    const x = item.position_x || 0;
    const y = item.position_y || 0;
    
    if (item.type === 'text') {
      // Estimate text bounds
      const textLength = (item.content || '').length;
      return {
        x,
        y,
        width: Math.max(textLength * 12, 100),
        height: 25
      };
    } else if (item.type === 'image') {
      try {
        if (item.content && item.content.startsWith('{')) {
          const imageData = JSON.parse(item.content);
          return {
            x,
            y,
            width: imageData.width || 200,
            height: imageData.height || 150
          };
        }
      } catch (e) {
        // Fallback for invalid JSON
      }
      return { x, y, width: 200, height: 150 };
    } else if (item.type === 'drawing') {
      try {
        const drawingData = JSON.parse(item.content || '[]');
        const points = drawingData.path || drawingData;
        if (Array.isArray(points) && points.length > 0) {
          const xCoords = points.filter((_, i) => i % 2 === 0);
          const yCoords = points.filter((_, i) => i % 2 === 1);
          const minX = Math.min(...xCoords);
          const maxX = Math.max(...xCoords);
          const minY = Math.min(...yCoords);
          const maxY = Math.max(...yCoords);
          return {
            x: x + minX,
            y: y + minY,
            width: maxX - minX,
            height: maxY - minY
          };
        }
      } catch (e) {
        // Fallback for invalid drawing data
      }
      return { x, y, width: 100, height: 100 };
    }
    
    return null;
  };

  // Helper function to check if two rectangles intersect
  const intersectsRect = (rect1: { x: number; y: number; width: number; height: number }, rect2: { x: number; y: number; width: number; height: number }) => {
    return !(rect1.x + rect1.width < rect2.x || 
             rect2.x + rect2.width < rect1.x || 
             rect1.y + rect1.height < rect2.y || 
             rect2.y + rect2.height < rect1.y);
  };

  // Get stage pointer position accounting for zoom and pan
  const getRelativePointerPosition = () => {
    const stage = stageRef.current;
    if (!stage) return { x: 0, y: 0 };
    
    const transform = stage.getAbsoluteTransform().copy();
    transform.invert();
    const pos = stage.getPointerPosition();
    return transform.point(pos);
  };

  // Handle zoom functionality
  const handleWheel = (e: any) => {
    e.evt.preventDefault();
    
    const stage = stageRef.current;
    if (!stage) return;

    const pointer = stage.getPointerPosition();
    const mousePointTo = {
      x: (pointer.x - stage.x()) / scale,
      y: (pointer.y - stage.y()) / scale,
    };

    let direction = e.evt.deltaY > 0 ? -1 : 1;
    
    // If holding Ctrl/Cmd, zoom faster
    if (e.evt.ctrlKey || e.evt.metaKey) {
      direction *= 2;
    }

    const newScale = Math.max(
      MIN_SCALE,
      Math.min(MAX_SCALE, scale * (ZOOM_FACTOR ** direction))
    );

    const newPos = {
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    };

    setScale(newScale);
    setStagePos(newPos);
  };

  // Reset zoom and pan to center the canvas
  const resetView = () => {
    setScale(1);
    setStagePos({ x: 0, y: 0 });
  };

  // Fit canvas to show all items
  const fitToItems = () => {
    if (items.length === 0) {
      resetView();
      return;
    }

    // Get all item bounds
    const allBounds = items.map(item => getItemBounds(item)).filter(bounds => bounds !== null);
    
    if (allBounds.length === 0) {
      resetView();
      return;
    }

    // Filter out extreme outliers using statistical approach
    const positions = allBounds.map(b => ({ x: b.x, y: b.y }));
    
    // Calculate median positions
    const xPositions = positions.map(p => p.x).sort((a, b) => a - b);
    const yPositions = positions.map(p => p.y).sort((a, b) => a - b);
    const medianX = xPositions[Math.floor(xPositions.length / 2)];
    const medianY = yPositions[Math.floor(yPositions.length / 2)];
    
    // Calculate reasonable bounds around the median (ignore items too far away)
    const maxReasonableDistance = 5000; // Max 5000px from median
    const filteredBounds = allBounds.filter(bounds => {
      const distanceX = Math.abs(bounds.x - medianX);
      const distanceY = Math.abs(bounds.y - medianY);
      return distanceX <= maxReasonableDistance && distanceY <= maxReasonableDistance;
    });

    if (filteredBounds.length === 0) {
      // Fallback: show area around median
      const newScale = 1;
      const newPos = {
        x: (containerRef.current?.clientWidth || 800) / 2 - medianX,
        y: (containerRef.current?.clientHeight || 600) / 2 - medianY,
      };
      setScale(newScale);
      setStagePos(newPos);
      return;
    }

    // Calculate bounds of filtered items
    let minX = Math.min(...filteredBounds.map(b => b.x));
    let minY = Math.min(...filteredBounds.map(b => b.y));
    let maxX = Math.max(...filteredBounds.map(b => b.x + b.width));
    let maxY = Math.max(...filteredBounds.map(b => b.y + b.height));

    const container = containerRef.current;
    if (!container) return;

    const padding = 50;
    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;
    
    // Ensure minimum content size to prevent excessive zoom
    const minContentSize = 200;
    const adjustedContentWidth = Math.max(contentWidth, minContentSize);
    const adjustedContentHeight = Math.max(contentHeight, minContentSize);
    
    const containerWidth = container.clientWidth - padding * 2;
    const containerHeight = container.clientHeight - padding * 2;
    
    const scaleX = containerWidth / adjustedContentWidth;
    const scaleY = containerHeight / adjustedContentHeight;
    
    // Allow reasonable zoom in (up to 3x) but prevent excessive zoom out
    const newScale = Math.max(MIN_SCALE, Math.min(scaleX, scaleY, 3));
    
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    
    const newPos = {
      x: container.clientWidth / 2 - centerX * newScale,
      y: container.clientHeight / 2 - centerY * newScale,
    };

    setScale(newScale);
    setStagePos(newPos);
  };

  // Calculate canvas bounds based on all elements
  const calculateCanvasBounds = () => {
    if (items.length === 0) {
      return { width: 2000, height: 1500 }; // Minimum size
    }

    let minX = 0, minY = 0, maxX = 1000, maxY = 800;

    items.forEach(item => {
      const x = item.position_x || 0;
      const y = item.position_y || 0;

      // Calculate element bounds based on type
      let elementWidth = 0, elementHeight = 0;
      
      if (item.type === 'text') {
        // Estimate text size (rough approximation)
        const textLength = (item.content || '').length;
        elementWidth = Math.max(textLength * 12, 100); // ~12px per character
        elementHeight = 25; // Standard text height
      } else if (item.type === 'image') {
        try {
          if (item.content && item.content.startsWith('{')) {
            const imageData = JSON.parse(item.content);
            elementWidth = imageData.width || 200;
            elementHeight = imageData.height || 150;
          } else {
            elementWidth = 200;
            elementHeight = 150;
          }
        } catch (e) {
          elementWidth = 200;
          elementHeight = 150;
        }
      } else if (item.type === 'drawing') {
        try {
          const drawingData = JSON.parse(item.content || '[]');
          const points = drawingData.path || drawingData;
          if (Array.isArray(points) && points.length > 0) {
            // Find min/max of drawing points
            for (let i = 0; i < points.length; i += 2) {
              minX = Math.min(minX, points[i] || 0);
              maxX = Math.max(maxX, points[i] || 0);
              if (i + 1 < points.length) {
                minY = Math.min(minY, points[i + 1] || 0);
                maxY = Math.max(maxY, points[i + 1] || 0);
              }
            }
            return; // Skip the normal bounds calculation for drawings
          }
        } catch (e) {
          // Ignore invalid drawing data
        }
      }

      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + elementWidth + 100); // Add padding
      maxY = Math.max(maxY, y + elementHeight + 100); // Add padding
    });

    // Ensure minimum size and add extra padding
    const width = Math.max(maxX - minX + 200, 2000);
    const height = Math.max(maxY - minY + 200, 1500);

    return { width, height };
  };

  // Update canvas size when items change
  useEffect(() => {
    const newBounds = calculateCanvasBounds();
    setStageSize(newBounds);

  }, [items]);

  // Notify parent of selectedItems changes
  useEffect(() => {
    onSelectedItemsChange?.(selectedItems);
  }, [selectedItems, onSelectedItemsChange]);

  const handleStageClick = async (e: any) => {
    // If clicking on empty area
    if (e.target === e.target.getStage()) {
      onItemSelect(null);
      
      // Save any ongoing text edit before clearing
      if (editingTextId) {
        handleTextSave();
      }
      
      // Add text on click when text tool is selected
      if (selectedTool === 'text') {
        const pos = getRelativePointerPosition();

        
        // Expand canvas if needed for the new text position
        expandCanvasIfNeeded(pos.x, pos.y);
        
        const newItem: Database["public"]["Tables"]["dreamboard_items"]["Insert"] = {
          user_id: userId,
          type: 'text',
          content: 'Double click to edit',
          title: 'Text Element',
          position_x: pos.x,
          position_y: pos.y,
          z_index: 1, // Will be updated in handleItemCreate
        };
        await onItemCreate(newItem);
      }
    }
  };

  const handleMouseDown = (e: any) => {
    // Check if we should start panning (right click or holding space)
    const shouldPan = e.evt.button === 2 || e.evt.spaceKey || 
                     (selectedTool === 'select' && e.evt.ctrlKey);
    
    if (shouldPan) {
      e.evt.preventDefault(); // Prevent context menu on right click
      setIsPanning(true);
      const pos = e.target.getStage().getPointerPosition();
      setLastPanPoint(pos);
      return;
    }

    if (selectedTool === 'draw') {
      setIsDrawing(true);
      const pos = getRelativePointerPosition();
      setCurrentPath([pos.x, pos.y]);
    } else if (selectedTool === 'select' && e.target === e.target.getStage()) {
      // Start rectangle selection only if clicking on empty area
      setIsSelecting(true);
      const pos = getRelativePointerPosition();
      setSelectionRect({ x: pos.x, y: pos.y, width: 0, height: 0 });
      
      // Clear current selection if not holding Ctrl/Cmd
      if (!e.evt.ctrlKey && !e.evt.metaKey) {
        setSelectedItems([]);
        onItemSelect(null);
      }
    }
  };

  const handleMouseMove = (e: any) => {
    const stage = e.target.getStage();
    const point = stage.getPointerPosition();
    
    if (isPanning && lastPanPoint) {
      const newPos = {
        x: stagePos.x + (point.x - lastPanPoint.x),
        y: stagePos.y + (point.y - lastPanPoint.y)
      };
      setStagePos(newPos);
      setLastPanPoint(point);
      return;
    }
    
    const relativePoint = getRelativePointerPosition();
    
    if (isDrawing && selectedTool === 'draw') {
      // Expand canvas if drawing near edges
      expandCanvasIfNeeded(relativePoint.x, relativePoint.y);
      setCurrentPath([...currentPath, relativePoint.x, relativePoint.y]);
    } else if (isSelecting && selectedTool === 'select' && selectionRect) {
      // Update selection rectangle
      const newRect = {
        x: Math.min(selectionRect.x, relativePoint.x),
        y: Math.min(selectionRect.y, relativePoint.y),
        width: Math.abs(relativePoint.x - selectionRect.x),
        height: Math.abs(relativePoint.y - selectionRect.y)
      };
      setSelectionRect(newRect);
    }
  };

  const handleMouseUp = async () => {
    setIsPanning(false);
    setLastPanPoint(null);

    if (isDrawing && selectedTool === 'draw') {
      setIsDrawing(false);
      
      if (currentPath.length > 4) {
        // Save drawing to database

        
        // Calculate drawing bounds to determine position
        const minX = Math.min(...currentPath.filter((_, i) => i % 2 === 0));
        const minY = Math.min(...currentPath.filter((_, i) => i % 2 === 1));
        
        // Adjust points to be relative to the drawing's position
        const adjustedPath = currentPath.map((point, i) => {
          if (i % 2 === 0) return point - minX; // x coordinates
          return point - minY; // y coordinates
        });
        
        // Save drawing to database with brush settings
        const drawingData = {
          path: adjustedPath,
          color: brushColor,
          strokeWidth: brushSize
        };
        
        const newItem: Database["public"]["Tables"]["dreamboard_items"]["Insert"] = {
          user_id: userId,
          type: 'drawing',
          content: JSON.stringify(drawingData),
          title: 'Drawing',
          position_x: minX,
          position_y: minY,
          z_index: 1, // Will be updated in handleItemCreate
        };
        
        try {
          await onItemCreate(newItem);

        } catch (error) {
          console.error('Error saving drawing:', error);
        }
      }
      
      setCurrentPath([]);
    } else if (isSelecting && selectedTool === 'select' && selectionRect) {
      // Finalize rectangle selection
      setIsSelecting(false);
      
      if (selectionRect.width > 5 && selectionRect.height > 5) {
        // Find items that intersect with selection rectangle
        const selectedItemIds: string[] = [];
        
        items.forEach(item => {
          const itemBounds = getItemBounds(item);
          if (itemBounds && intersectsRect(selectionRect, itemBounds)) {
            selectedItemIds.push(item.id);
          }
        });
        

        setSelectedItems(selectedItemIds);
        
        // Set the first selected item as the primary selection for toolbar
        if (selectedItemIds.length > 0) {
          onItemSelect(selectedItemIds[0]);
        }
      }
      
      setSelectionRect(null);
    }
  };

  const handleTextEdit = (textItem: DreamboardItem) => {
    setEditingTextId(textItem.id);
    setEditingTextValue(textItem.content || '');
    
    // Convert canvas coordinates to screen coordinates for the text input overlay
    const stage = stageRef.current;
    if (stage) {
      const screenPos = {
        x: (textItem.position_x || 0) * scale + stagePos.x,
        y: (textItem.position_y || 0) * scale + stagePos.y
      };
      setEditingTextPosition(screenPos);
    }
  };

  const handleTextSave = () => {
    if (editingTextId) {
      onItemUpdate(editingTextId, { content: editingTextValue });
    }
    setEditingTextId(null);
    setEditingTextValue('');
    setEditingTextPosition(null);
  };

  const handleTextCancel = () => {
    setEditingTextId(null);
    setEditingTextValue('');
    setEditingTextPosition(null);
  };

  const handleItemSelect = (id: string) => {
    // Save any ongoing text edit before selecting new item
    if (editingTextId && editingTextId !== id) {
      handleTextSave();
    }
    
    // Clear multi-selection when selecting individual item
    setSelectedItems([]);
    onItemSelect(id);
  };

  const expandCanvasIfNeeded = (x: number, y: number) => {
    const padding = 200;
    let needsExpansion = false;
    let newWidth = stageSize.width;
    let newHeight = stageSize.height;

    // Check if we need to expand right
    if (x + padding > stageSize.width) {
      newWidth = x + padding;
      needsExpansion = true;
    }

    // Check if we need to expand down
    if (y + padding > stageSize.height) {
      newHeight = y + padding;
      needsExpansion = true;
    }

    // Check if we need to expand left (negative coordinates)
    if (x < 0) {
      newWidth = stageSize.width + Math.abs(x) + padding;
      needsExpansion = true;
    }

    // Check if we need to expand up (negative coordinates)
    if (y < 0) {
      newHeight = stageSize.height + Math.abs(y) + padding;
      needsExpansion = true;
    }

    if (needsExpansion) {
      setStageSize({ width: newWidth, height: newHeight });
    }
  };

  const handleItemChange = (id: string, attrs: any) => {
    onItemUpdate(id, attrs);
    
    // Expand canvas if element is near edges
    if (attrs.position_x !== undefined || attrs.position_y !== undefined) {
      const x = attrs.position_x || 0;
      const y = attrs.position_y || 0;
      expandCanvasIfNeeded(x, y);
    }
    
    // Trigger canvas size recalculation after a brief delay
    setTimeout(() => {
      const newBounds = calculateCanvasBounds();
      setStageSize(newBounds);
    }, 100);
  };

  const checkDeselect = (e: any) => {
    const clickedOnEmpty = e.target === e.target.getStage();
    if (clickedOnEmpty) {
      onItemSelect(null);
      
      // Save any ongoing text edit
      if (editingTextId) {
        handleTextSave();
      }
    }
  };

  // Handle keyboard events
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' && selectedItemId) {
        onItemDelete(selectedItemId);
        onItemSelect(null);
      }
      
      // Zoom controls
      if (e.ctrlKey || e.metaKey) {
        if (e.key === '=' || e.key === '+') {
          e.preventDefault();
          const newScale = Math.min(MAX_SCALE, scale * ZOOM_FACTOR);
          setScale(newScale);
        } else if (e.key === '-') {
          e.preventDefault();
          const newScale = Math.max(MIN_SCALE, scale / ZOOM_FACTOR);
          setScale(newScale);
        } else if (e.key === '0') {
          e.preventDefault();
          resetView();
        } else if (e.key === '1') {
          e.preventDefault();
          fitToItems();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedItemId, onItemDelete, onItemSelect, scale]);

  // Drawing toolbar functions
  const handleClearCanvas = () => {
    // Delete all drawing items
    const drawingItems = items.filter(item => item.type === 'drawing');
    drawingItems.forEach(item => onItemDelete(item.id));
  };

  const handleUndo = () => {
    // Find the most recent drawing item and delete it
    const drawingItems = items
      .filter(item => item.type === 'drawing')
      .sort((a, b) => (b.z_index || 0) - (a.z_index || 0));
    
    if (drawingItems.length > 0) {
      onItemDelete(drawingItems[0].id);
    }
  };

    return (
    <div 
      ref={containerRef}
      id="canvas-container" 
      className="w-full h-full bg-gray-50 relative overflow-hidden"
      style={{ 
        cursor: isPanning ? 'grabbing' : 
                selectedTool === 'draw' ? 'crosshair' : 
                'default',
        maxHeight: 'calc(100vh - 120px)' // Account for header and toolbar
      }}
    >
        {/* Zoom Controls */}
        <div className="absolute top-4 right-4 z-50 flex flex-col gap-2 bg-white rounded-lg shadow-lg p-2">
          <button
            onClick={() => setScale(Math.min(MAX_SCALE, scale * ZOOM_FACTOR))}
            className="px-3 py-2 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded font-medium transition-colors"
            title="Zoom In (Ctrl +)"
          >
            +
          </button>
          <div className="px-2 py-1 text-xs text-center text-gray-600 min-w-[60px]">
            {Math.round(scale * 100)}%
          </div>
          <button
            onClick={() => setScale(Math.max(MIN_SCALE, scale / ZOOM_FACTOR))}
            className="px-3 py-2 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded font-medium transition-colors"
            title="Zoom Out (Ctrl -)"
          >
            -
          </button>
          <div className="border-t border-gray-200 my-1"></div>
          <button
            onClick={fitToItems}
            className="px-2 py-2 text-xs bg-gray-500 hover:bg-gray-600 text-white rounded transition-colors"
            title="Fit to Items (Ctrl 1)"
          >
            Fit
          </button>
          <button
            onClick={resetView}
            className="px-2 py-2 text-xs bg-gray-500 hover:bg-gray-600 text-white rounded transition-colors"
            title="Reset View (Ctrl 0)"
          >
            100%
          </button>
        </div>

        {/* Pan Instructions */}
        <div className="absolute bottom-4 left-4 z-50 bg-black bg-opacity-75 text-white text-xs px-3 py-2 rounded-lg">
          <div>🖱️ Scroll: Zoom | Right Click + Drag: Pan</div>
          <div>⌨️ Ctrl +/-: Zoom | Ctrl 0: Reset | Ctrl 1: Fit</div>
        </div>

        {/* Drawing Toolbar */}
        <DrawingToolbar
          isVisible={selectedTool === 'draw' && !isDrawing}
          brushSize={brushSize}
          setBrushSize={setBrushSize}
          brushColor={brushColor}
          setBrushColor={setBrushColor}
          onClear={handleClearCanvas}
          onUndo={handleUndo}
        />
        
        <Stage
          ref={stageRef}
          width={containerRef.current?.clientWidth || 1000}
          height={containerRef.current?.clientHeight || 800}
          scaleX={scale}
          scaleY={scale}
          x={stagePos.x}
          y={stagePos.y}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMousemove={handleMouseMove}
          onMouseup={handleMouseUp}
          onClick={handleStageClick}
          onTap={checkDeselect}
          onContextMenu={(e) => e.evt.preventDefault()} // Prevent right-click context menu
          draggable={false}
                >
          <Layer>
            {/* Grid Background */}
            {(() => {
              const gridSize = 50;
              const lines = [];
              
              // Calculate visible area based on current zoom and pan
              const container = containerRef.current;
              if (!container) return [];
              
              const visibleLeft = -stagePos.x / scale;
              const visibleTop = -stagePos.y / scale;
              const visibleRight = visibleLeft + container.clientWidth / scale;
              const visibleBottom = visibleTop + container.clientHeight / scale;
              
              // Add some padding to ensure grid extends beyond visible area
              const padding = gridSize * 2;
              const startX = Math.floor((visibleLeft - padding) / gridSize) * gridSize;
              const endX = Math.ceil((visibleRight + padding) / gridSize) * gridSize;
              const startY = Math.floor((visibleTop - padding) / gridSize) * gridSize;
              const endY = Math.ceil((visibleBottom + padding) / gridSize) * gridSize;
              
              // Vertical lines
              for (let i = startX; i <= endX; i += gridSize) {
                lines.push(
                  <Line
                    key={`v-${i}`}
                    points={[i, startY, i, endY]}
                    stroke="#f0f0f0"
                    strokeWidth={1}
                    listening={false}
                  />
                );
              }
              
              // Horizontal lines  
              for (let i = startY; i <= endY; i += gridSize) {
                lines.push(
                  <Line
                    key={`h-${i}`}
                    points={[startX, i, endX, i]}
                    stroke="#f0f0f0"
                    strokeWidth={1}
                    listening={false}
                  />
                );
              }
              
              return lines;
            })()}
            
            {/* Render all items in z-index order */}
          {items
            .sort((a, b) => (a.z_index || 0) - (b.z_index || 0))
            .map((item) => {
            if (item.type === 'text') {
              
              // Hide text when editing inline
              if (editingTextId === item.id) {
                return null;
              }
              
              return (
                <Text
                  key={item.id}
                  text={item.content || 'Default Text'}
                  x={item.position_x || 0}
                  y={item.position_y || 0}
                  fontSize={20}
                  fontFamily="Arial"
                  fill="black"
                  draggable={selectedTool === "select" || selectedTool === "text"}
                  onClick={selectedTool !== "image" ? () => handleItemSelect(item.id) : undefined}
                  onTap={selectedTool !== "image" ? () => handleItemSelect(item.id) : undefined}
                  onDblClick={() => handleTextEdit(item)}
                  onDblTap={() => handleTextEdit(item)}
                  onDragEnd={(e) => {
                    handleItemChange(item.id, {
                      position_x: e.target.x(),
                      position_y: e.target.y(),
                    });
                  }}
                  stroke={(selectedItemId === item.id || selectedItems.includes(item.id)) ? '#0066cc' : 'transparent'}
                  strokeWidth={(selectedItemId === item.id || selectedItems.includes(item.id)) ? 1 : 0}
                />
              );
            }
            
            if (item.type === 'image') {
              // Check if this is a frame or icon with SVG content
              let isCustomSVG = false;
              try {
                if (item.content) {
                  const content = JSON.parse(item.content);
                  if (content.type === 'frame' || content.type === 'icon') {
                    isCustomSVG = true;
                    // For custom SVG elements (frames/icons), create a data URL
                    const svgDataUrl = `data:image/svg+xml;base64,${btoa(content.svg)}`;
                    // Update the content to use the data URL
                    const updatedItem = {
                      ...item,
                      content: JSON.stringify({
                        ...content,
                        url: svgDataUrl
                      })
                    };
                    return (
                      <URLImage
                        key={item.id}
                        item={updatedItem}
                        isSelected={selectedItemId === item.id || selectedItems.includes(item.id)}
                        onSelect={() => handleItemSelect(item.id)}
                        onChange={(attrs) => handleItemChange(item.id, attrs)}
                        selectedTool={selectedTool}
                      />
                    );
                  }
                }
              } catch (e) {
                // Not custom SVG, use regular image handling
              }

              return (
                <URLImage
                  key={item.id}
                  item={item}
                  isSelected={selectedItemId === item.id || selectedItems.includes(item.id)}
                  onSelect={() => handleItemSelect(item.id)}
                  onChange={(attrs) => handleItemChange(item.id, attrs)}
                  selectedTool={selectedTool}
                />
              );
            }
            
            if (item.type === 'drawing' && item.content) {
              try {
                const drawingData = JSON.parse(item.content);
                // Support both old format (just points) and new format (with brush settings)
                const points = drawingData.path || drawingData;
                const strokeColor = drawingData.color || "black";
                const strokeWidth = drawingData.strokeWidth || 2;
                
                return (
                  <Group
                    key={item.id}
                    x={item.position_x || 0}
                    y={item.position_y || 0}
                    draggable={selectedTool === "select"}
                    onClick={selectedTool === "select" ? () => handleItemSelect(item.id) : undefined}
                    onTap={selectedTool === "select" ? () => handleItemSelect(item.id) : undefined}
                    onDragEnd={(e) => {
                      handleItemChange(item.id, {
                        position_x: e.target.x(),
                        position_y: e.target.y(),
                      });
                    }}
                  >
                    <Line
                      points={points}
                      stroke={strokeColor}
                      strokeWidth={strokeWidth}
                      tension={0.5}
                      lineCap="round"
                      lineJoin="round"
                    />
                    {/* Selection indicator */}
                    {(selectedItemId === item.id || selectedItems.includes(item.id)) && (
                      <Line
                        points={points}
                        stroke="#0066cc"
                        strokeWidth={strokeWidth + 2}
                        tension={0.5}
                        lineCap="round"
                        lineJoin="round"
                        opacity={0.3}
                      />
                    )}
                  </Group>
                );
              } catch (e) {
                console.error('Error parsing drawing data:', e);
                return null;
              }
            }
            
            return null;
          })}
          
          {/* Current drawing path */}
          {isDrawing && currentPath.length > 0 && (
            <Line
              points={currentPath}
              stroke={brushColor}
              strokeWidth={brushSize}
              tension={0.5}
              lineCap="round"
              lineJoin="round"
            />
          )}
          
          {/* Selection rectangle */}
          {isSelecting && selectionRect && (
            <Line
              points={[
                selectionRect.x, selectionRect.y,
                selectionRect.x + selectionRect.width, selectionRect.y,
                selectionRect.x + selectionRect.width, selectionRect.y + selectionRect.height,
                selectionRect.x, selectionRect.y + selectionRect.height,
                selectionRect.x, selectionRect.y
              ]}
              stroke="#0066cc"
              strokeWidth={1}
              dash={[5, 5]}
              fill="rgba(0, 102, 204, 0.1)"
              closed={true}
            />
          )}
        </Layer>
      </Stage>
      
      {/* Inline text editing */}
      {editingTextId && editingTextPosition && (
        <div
          className="absolute z-50"
          style={{
            left: editingTextPosition.x,
            top: editingTextPosition.y,
            transform: 'translate(0, -2px)' // Slight offset to align with text baseline
          }}
        >
          <div className="bg-white border-2 border-blue-500 rounded-md shadow-lg p-1">
            <input
              type="text"
              value={editingTextValue}
              onChange={(e) => setEditingTextValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleTextSave();
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  handleTextCancel();
                }
              }}
              onBlur={handleTextSave}
              className="border-none outline-none bg-transparent text-black px-2 py-1"
              style={{
                fontSize: `${20 * scale}px`,
                fontFamily: 'Arial',
                minWidth: '200px',
                width: Math.max(editingTextValue.length * 12 * scale, 200) + 'px'
              }}
              autoFocus
              onFocus={(e) => e.target.select()}
            />
            <div className="text-xs text-gray-500 px-2 pb-1">
              Press Enter to save, Esc to cancel
            </div>
          </div>
        </div>
      )}


    </div>
  );
} 