"use client";

import React, { useEffect, useRef, useState, useMemo } from 'react';
import { hierarchy, pack } from 'd3-hierarchy';
import { EmotionBubbleData } from '@/app/ai-journal/services/useEmotionStats';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EmotionNode {
  id: string;
  emotion: string;
  entryCount: number;
  value: number; // For d3-hierarchy
  x?: number;
  y?: number;
  r?: number; // radius from d3-pack
}

interface EmotionBubblesProps {
  emotions: EmotionBubbleData[];
  onBubbleClick: (emotion: string) => void;
  loading?: boolean;
}

export function EmotionBubbles({ emotions, onBubbleClick, loading = false }: EmotionBubblesProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerDimensions, setContainerDimensions] = useState({ width: 800, height: 700 });
  
  // Container resize observer
  useEffect(() => {
    const updateContainerDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setContainerDimensions({ width: rect.width, height: rect.height });
      }
    };

    updateContainerDimensions();
    
    const resizeObserver = new ResizeObserver(updateContainerDimensions);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }
    
    return () => resizeObserver.disconnect();
  }, []);

  // D3-Pack calculation
  const packedNodes = useMemo(() => {
    if (emotions.length === 0 || containerDimensions.width === 0) return [];

    // Create hierarchy data structure for d3-pack
    const hierarchyData = {
      children: emotions.map(emotionData => ({
        id: emotionData.emotion,
        emotion: emotionData.emotion,
        entryCount: emotionData.entryCount,
        // 668px diameter as minimum (1-entry) - double the previous size
        value: 17800000 + Math.pow(emotionData.entryCount - 1, 2.0) * 2000000, // Double all sizes
        isPlus: false
      }))
    };

    // Create hierarchy and pack layout
    const root = hierarchy<any>(hierarchyData)
      .sum(d => d.value || 0)
      .sort((a, b) => (b.value || 0) - (a.value || 0));

    // Configure pack layout with container dimensions  
    const packLayout = pack<any>()
      .size([containerDimensions.width - 120, containerDimensions.height - 120]) // 60px padding on all sides for much larger circles
      .padding(12); // increased padding for proper spacing between larger circles

    // Apply pack layout
    packLayout(root);

    // Extract packed nodes with positions
    const nodes: (EmotionNode & { isPlus?: boolean })[] = [];
    if (root.children) {
      root.children.forEach(node => {
        if (node.data.emotion) {
          nodes.push({
            id: node.data.id,
            emotion: node.data.emotion,
            entryCount: node.data.entryCount,
            value: node.data.value,
            x: (node as any).x || 0 + 60, // Add padding offset for larger circles
            y: (node as any).y || 0 + 60, // Add padding offset for larger circles
            r: (node as any).r || 20, // radius from pack layout
            isPlus: node.data.isPlus || false
          });
        }
      });
    }

    return nodes;
  }, [emotions, containerDimensions.width, containerDimensions.height]);

  if (loading) {
    return (
      <div 
        ref={containerRef}
        className="bg-gray-50 rounded-lg p-8 w-full flex items-center justify-center"
        style={{ height: 700 }}
      >
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mx-auto mb-3"></div>
          <p className="text-muted-foreground">Loading emotional insights...</p>
        </div>
      </div>
    );
  }

  if (emotions.length === 0) {
    return (
      <div 
        ref={containerRef}
        className="bg-gray-50 rounded-lg p-8 w-full flex items-center justify-center"
        style={{ height: 700 }}
      >
        <div className="text-center">
          <div className="w-16 h-16 bg-gray-200 rounded-full mx-auto mb-3 flex items-center justify-center">
            <span className="text-gray-400 text-xs">💭</span>
          </div>
          <p className="text-muted-foreground">No emotional data available</p>
          <p className="text-sm text-muted-foreground mt-1">Continue journaling to see emotion patterns</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className="bg-gray-50 rounded-lg p-8 relative overflow-hidden w-full"
      style={{ height: 600 }}
    >
      {/* D3-Pack positioned bubbles */}
      <div className="relative w-full h-full">
        {packedNodes.map((node, index) => {
          const diameter = (node.r || 20) * 2;
          
          return (
            <div
              key={node.id}
              className="absolute cursor-pointer group"
              onClick={() => onBubbleClick(node.emotion)}
              style={{
                left: node.x,
                top: node.y,
                transform: 'translate(-50%, -50%)',
                zIndex: 10 + index
              }}
            >
              {/* Regular emotion circle styling */}
              <div
                className={cn(
                  "bg-white rounded-full flex flex-col items-center justify-center",
                  "shadow-lg border border-gray-200",
                  "transition-all duration-300 ease-in-out",
                  "hover:shadow-xl hover:scale-110",
                  "group-hover:border-purple-300"
                )}
                style={{
                  width: `${diameter}px`,
                  height: `${diameter}px`
                }}
              >
                <div className="text-center px-3">
                  <p className={cn(
                    "font-normal capitalize text-gray-800",
                    "leading-tight mb-1",
                    diameter < 150 ? "text-base" : diameter < 220 ? "text-lg" : diameter < 300 ? "text-xl" : "text-2xl"
                  )}>
                    {node.emotion}
                  </p>
                  <p className={cn(
                    "text-muted-foreground font-medium",
                    diameter < 150 ? "text-sm" : diameter < 220 ? "text-base" : "text-lg"
                  )}>
                    {node.entryCount}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}