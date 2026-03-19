"use client";

import { useEffect, useRef, useState, useImperativeHandle, forwardRef } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { supabase } from "@/lib/supabase";
// @ts-ignore
import * as venn from "venn.js";
// @ts-ignore
import * as d3 from "d3";

interface IkigaiSection {
  title: string;
  description: string;
}

interface IkigaiData {
  mission: IkigaiSection;    // What the world needs & what you're good at
  passion: IkigaiSection;    // What you love & what you're good at  
  profession: IkigaiSection; // What you're good at & what you can be paid for
  vocation: IkigaiSection;   // What you love & what the world needs
}

interface ExtendedIkigaiData extends IkigaiData {
  love: IkigaiSection;       // What you love
  good_at: IkigaiSection;    // What you're good at
  world_needs: IkigaiSection; // What the world needs
  paid_for: IkigaiSection;   // What you can be paid for
  ikigai: IkigaiSection;     // Center - your ikigai
}

interface IkigaiDiagramProps {
  ikigaiData: IkigaiData | ExtendedIkigaiData;
  onUpdateSection: (section: keyof IkigaiData, field: 'title' | 'description', value: string) => void;
  onExtendedDataChange?: (data: ExtendedIkigaiData) => void;
}

export interface IkigaiDiagramRef {
  resetData: () => void;
}

// Auto-resize textarea component
const AutoResizeTextarea = ({ value, onChange, placeholder, className, ...props }: any) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.max(40, textarea.scrollHeight)}px`;
    }
  };

  useEffect(() => {
    adjustHeight();
  }, [value]);

  return (
    <Textarea
      ref={textareaRef}
      value={value}
      onChange={(e) => {
        onChange(e);
        adjustHeight();
      }}
      placeholder={placeholder}
      className={`resize-none overflow-hidden text-xs ${className}`}
      style={{ minHeight: '40px' }}
      {...props}
    />
  );
};

export const IkigaiDiagram = forwardRef<IkigaiDiagramRef, IkigaiDiagramProps>(({ 
  ikigaiData, 
  onUpdateSection,
  onExtendedDataChange
}, ref) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const pendingNotificationRef = useRef(false);
  const onExtendedDataChangeRef = useRef(onExtendedDataChange);
  
  // Check if ikigaiData has extended fields
  const hasExtendedFields = (data: any): data is ExtendedIkigaiData => {
    return data && typeof data.love === 'object' && typeof data.good_at === 'object';
  };

  const [extendedData, setExtendedData] = useState<ExtendedIkigaiData>(() => {
    if (hasExtendedFields(ikigaiData)) {
      // Use the extended data directly
      return ikigaiData;
    } else {
      // Initialize with basic data + empty extended fields
      return {
        ...ikigaiData,
        love: { title: "", description: "" },
        good_at: { title: "", description: "" },
        world_needs: { title: "", description: "" },
        paid_for: { title: "", description: "" },
        ikigai: { title: "", description: "" }
      };
    }
  });

  // Expose reset function to parent
  useImperativeHandle(ref, () => ({
    resetData: () => {
      const resetData: ExtendedIkigaiData = {
        love: { title: "", description: "" },
        good_at: { title: "", description: "" },
        world_needs: { title: "", description: "" },
        paid_for: { title: "", description: "" },
        passion: { title: "", description: "" },
        mission: { title: "", description: "" },
        profession: { title: "", description: "" },
        vocation: { title: "", description: "" },
        ikigai: { title: "", description: "" }
      };
      setExtendedData(resetData);
    }
  }));

  // Sync with parent data when ikigaiData prop changes
  useEffect(() => {
    // Reset pending flag since this is parent sync, not user input
    pendingNotificationRef.current = false;
    
    if (hasExtendedFields(ikigaiData)) {
      // Parent passed extended data - use it directly
      setExtendedData(ikigaiData);
    } else {
      // Parent passed basic data - merge with existing extended fields
      setExtendedData(prev => ({
        ...prev,
        ...ikigaiData, // Merge in the basic data from parent
      }));
    }
  }, [ikigaiData]);

  // Track when we're updating from user input vs parent sync
  const updateExtendedSection = (section: keyof ExtendedIkigaiData, field: 'title' | 'description', value: string) => {
    // Prevent duplicate notifications
    if (pendingNotificationRef.current) {
      return;
    }
    
    pendingNotificationRef.current = true;
    
    setExtendedData(prev => {
      const newData = {
        ...prev,
        [section]: {
          ...prev[section],
          [field]: value
        }
      };
      
      return newData;
    });

    // Update parent component for original sections as well
    if (section in ikigaiData) {
      onUpdateSection(section as keyof IkigaiData, field, value);
    }
  };

  // Keep callback ref updated
  useEffect(() => {
    onExtendedDataChangeRef.current = onExtendedDataChange;
  }, [onExtendedDataChange]);

  // Notify parent when data changes from user input (outside of render)
  useEffect(() => {
    if (pendingNotificationRef.current && onExtendedDataChangeRef.current) {
      onExtendedDataChangeRef.current(extendedData);
      pendingNotificationRef.current = false;
    }
  }, [extendedData]);

  useEffect(() => {
    if (!svgRef.current) return;

    // Clear previous diagram
    d3.select(svgRef.current).selectAll("*").remove();

    // Define the sets for the Venn diagram with exact Ikigai positioning
    const sets = [
      // Main circles with exact coordinates to match traditional Ikigai layout
      { sets: ['love'], size: 180, label: 'What You Love', x: 450, y: 150 },           // Top circle
      { sets: ['good_at'], size: 180, label: 'What You\'re Good At', x: 300, y: 350 }, // Left circle
      { sets: ['world_needs'], size: 180, label: 'What the World Needs', x: 600, y: 350 }, // Right circle  
      { sets: ['paid_for'], size: 180, label: 'What You Can Be Paid For', x: 450, y: 500 }, // Bottom circle
      // Two-way intersections (automatically calculated based on circle positions)
      { sets: ['love', 'good_at'], size: 75, label: 'Passion' },        // Top-Left intersection
      { sets: ['love', 'world_needs'], size: 75, label: 'Mission' },    // Top-Right intersection
      { sets: ['good_at', 'paid_for'], size: 75, label: 'Profession' }, // Bottom-Left intersection
      { sets: ['world_needs', 'paid_for'], size: 75, label: 'Vocation' }, // Bottom-Right intersection
      // Three-way intersections (smaller)
      { sets: ['love', 'good_at', 'world_needs'], size: 30 },
      { sets: ['love', 'good_at', 'paid_for'], size: 30 },
      { sets: ['love', 'world_needs', 'paid_for'], size: 30 },
      { sets: ['good_at', 'world_needs', 'paid_for'], size: 30 },
      // Center intersection - Ikigai
      { sets: ['love', 'good_at', 'world_needs', 'paid_for'], size: 55, label: 'Ikigai' }
    ];

    const chart = venn.VennDiagram()
      .width(1000)
      .height(800)
      .padding(0);

    const svg = d3.select(svgRef.current);
    svg.datum(sets).call(chart);

    // Define colors for each section
    const sectionColors = {
      love: { fill: "rgba(20, 184, 166, 0.15)", stroke: "#14b8a6" }, // Teal
      good_at: { fill: "rgba(249, 115, 22, 0.15)", stroke: "#f97316" }, // Orange
      world_needs: { fill: "rgba(234, 179, 8, 0.15)", stroke: "#eab308" }, // Yellow
      paid_for: { fill: "rgba(236, 72, 153, 0.15)", stroke: "#ec4899" }, // Pink
      passion: { fill: "rgba(64, 180, 169, 1)", stroke: "#40b4a9" }, // Teal (love + good_at)
      mission: { fill: "rgba(251, 197, 62, 1)", stroke: "#fbc53e" }, // Yellow (love + world_needs)
      profession: { fill: "rgba(247, 131, 30, 1)", stroke: "#f7831e" }, // Orange (good_at + paid_for)
      vocation: { fill: "rgba(214, 86, 160, 1)", stroke: "#d656a0" }, // Pink (world_needs + paid_for)
      ikigai: { fill: "rgba(136, 200, 64, 1)", stroke: "#888888" } // Green (center)
    };

    // Style main circles with individual colors
    svg.selectAll(".venn-circle")
      .each(function(d: any) {
        const circle = d3.select(this);
        const setName = d.sets[0]; // Get the primary set name
        const colors = sectionColors[setName as keyof typeof sectionColors];
        if (colors) {
          circle.select("path")
            .style("fill", colors.fill)
            .style("stroke", colors.stroke)
            .style("stroke-width", 2);
        }
      });

    // Style intersection areas with appropriate colors
    svg.selectAll(".venn-intersection")
      .each(function(d: any) {
        const intersection = d3.select(this);
        const sets = d.sets.sort().join('_');

        let colors;
        let strokeWidth = 1.5;
        let fillOpacity = 1;

        if (sets === 'good_at_love') {
          colors = sectionColors.profession;      
        } else if (sets === 'love_world_needs') {
          colors = sectionColors.passion;      
        } else if (sets === 'good_at_paid_for') {
          colors = sectionColors.vocation;  
        } else if (sets === 'paid_for_world_needs') {
          colors = sectionColors.mission;    
        } else if (sets === 'good_at_love_paid_for_world_needs') {
          colors = sectionColors.ikigai;
          strokeWidth = 2;
        } else if (d.sets.length === 3) {
          // ✅ 3-way intersections — solid gray color
          intersection.select("path")
            .style("fill", "#d1d5db")  // Solid gray color
            .style("stroke", "#888888")  // Gray border
            .style("stroke-width", 1.5)
            .style("fill-opacity", 1);
          return; // ⛔ skip rest of styling
        } else {
          // Optional: fallback for other intersections
          colors = { fill: "rgba(150, 150, 150, 0.2)", stroke: "none" };
        }

        intersection.select("path")
          .style("fill", colors.fill)
          .style("stroke", colors.stroke)
          .style("stroke-width", strokeWidth)
          .style("fill-opacity", fillOpacity);
      });

    // Hide the text labels from venn.js
    svg.selectAll("text").style("display", "none");

  }, []);

  const getRegionPosition = (regionKey: string) => {
    // 🎯 INPUT FIELD POSITIONS - Adjust these percentages to move text fields in PDF
    const positions: Record<string, { top: string; left: string; width: string }> = {
      love: { top: "-2%", left: "40%", width: "20%" },              // Top-right after rotation
      good_at: { top: "43%", left: "6%", width: "20%" },           // Top-left after rotation
      world_needs: { top: "43%", left: "74%", width: "20%" },       // Bottom-right after rotation
      paid_for: { top: "83%", left: "40%", width: "20%" },           // Bottom-left after rotation
      passion: { top: "22%", left: "25%", width: "19%" },           // Between love & good_at
      mission: { top: "22%", left: "56%", width: "19%" },           // Between love & world_needs
      profession: { top: "63%", left: "25%", width: "19%" },        // Between good_at & paid_for
      vocation: { top: "63%", left: "56%", width: "19%" },          // Between world_needs & paid_for
      ikigai: { top: "44%", left: "43%", width: "14%" }             // Center intersection
    };
    return positions[regionKey] || { top: "50%", left: "50%", width: "25%" };
  };

  const renderEditableRegion = (key: keyof ExtendedIkigaiData, label: string) => {
    const position = getRegionPosition(key);
    const data = extendedData[key];
    
    // Flexible size constraints for text fields
    const isIntersection = ['passion', 'mission', 'profession', 'vocation', 'ikigai'].includes(key);
    const minWidth = isIntersection ? "120px" : "140px";

  return (
      <div
        key={key}
        className="absolute bg-white/95 backdrop-blur-sm p-2 rounded-lg border shadow-lg hover:shadow-xl transition-all duration-200 hover:bg-white ikigai-print-text-field"
        style={{
          top: position.top,
          left: position.left,
          width: position.width,
          minWidth
        }}
      >
        <div className="text-xs font-bold text-foreground mb-1 truncate ikigai-print-region-label" title={label}>
          {label}
          </div>

        {/* Ikigai center region - only one text field */}
        {key === 'ikigai' ? (
              <AutoResizeTextarea
            value={data.title}
            onChange={(e: any) => updateExtendedSection(key, 'title', e.target.value)}
            placeholder="Your reason for being..."
            className="text-xs text-center font-medium px-2 ikigai-print-text-field"
          />
        ) : (
          /* All other regions - title and description */
          <>
              <Input
              value={data.title}
              onChange={(e) => updateExtendedSection(key, 'title', e.target.value)}
                placeholder="Title"
              className="text-xs font-semibold border-primary/30 focus:border-primary mb-1 h-6 px-2 ikigai-print-text-field"
              />
              <AutoResizeTextarea
              value={data.description}
              onChange={(e: any) => updateExtendedSection(key, 'description', e.target.value)}
                placeholder="Description..."
              className="text-xs text-muted-foreground px-2 ikigai-print-text-field"
              />
          </>
        )}
            </div>
    );
  };

  return (
    <div className="w-full mx-auto">
      <div className="relative flex justify-center items-center py-20 px-12 ikigai-print-container">
        {/* SVG Venn Diagram */}
        <div className="relative">
          <svg
            ref={svgRef}
            width="1000"
            height="800"
            className="w-full h-auto max-w-5xl ikigai-print-svg-container"
            viewBox="0 0 1000 800"
            style={{ 
              transform: "rotate(45deg)",
              transformOrigin: "center"
            }}
          />
          {/* 🎯 SVG DIAGRAM SIZE - Adjust width/height above and scale in ikigai-print-svg-container class */}

          {/* Editable Overlays */}
          <div 
            className="absolute inset-0 ikigai-print-overlay-container"
          >
            {renderEditableRegion('love', 'What You Love')}
            {renderEditableRegion('good_at', 'What You\'re Good At')}
            {renderEditableRegion('world_needs', 'What the World Needs')}
            {renderEditableRegion('paid_for', 'What You Can Be Paid For')}
            {renderEditableRegion('passion', 'Passion')}
            {renderEditableRegion('mission', 'Mission')}
            {renderEditableRegion('profession', 'Profession')}
            {renderEditableRegion('vocation', 'Vocation')}
            {renderEditableRegion('ikigai', 'Your Ikigai')}
          </div>

          {/* 3-Way Intersection Labels with Pointers */}
          <div className="absolute inset-0 pointer-events-none">
            {/* 🎯 DOTTED LINES & DESCRIPTIONS - Adjust positions and text below */}
            
            {/* Top-left: Love + Good At + World Needs */}
            <svg className="absolute w-full h-full" viewBox="0 0 1000 800">
              {/* 🎯 DOTTED LINE PATH - Adjust the 'd' attribute to change line curve */}
              <path d="M 370 400 Q 160 230 65 220" stroke="#888" strokeWidth="3" strokeDasharray="6,6" fill="none" />
            </svg>
            <div className="absolute ikigai-print-description-container" style={{ top: '20%', left: '-11%', width: '200px' }}>
              {/* 🎯 DESCRIPTION TEXT & POSITION - Adjust style positioning and text content */}
              <div className="text-lg text-gray-600 dark:text-gray-400 italic text-right ikigai-print-description-text">
                Satisfaction but feeling of uselessness
              </div>
            </div>

            {/* Top-right: Love + World Needs + Paid For */}
            <svg className="absolute w-full h-full" viewBox="0 0 1000 800">
              {/* 🎯 DOTTED LINE PATH */}
              <path d="M 500 280 Q 550 150 730 -40" stroke="#888" strokeWidth="3" strokeDasharray="6,6" fill="none" />
            </svg>
            <div className="absolute ikigai-print-description-container" style={{ top: '-8%', right: '10%', width: '200px' }}>
              {/* 🎯 DESCRIPTION TEXT & POSITION */}
              <div className="text-lg text-gray-600 dark:text-gray-400 italic ikigai-print-description-text">
                Delight and fullness but no wealth
              </div>
            </div>

            {/* Bottom-left: Good At + Love + Paid For */}
            <svg className="absolute w-full h-full" viewBox="0 0 1000 800">
              {/* 🎯 DOTTED LINE PATH */}
              <path d="M 500 520 Q 460 690 200 730" stroke="#888" strokeWidth="3" strokeDasharray="6,6" fill="none" />
            </svg>
            <div className="absolute ikigai-print-description-container" style={{ bottom: '5%', left: '-2%', width: '200px' }}>
              {/* 🎯 DESCRIPTION TEXT & POSITION */}
              <div className="text-lg text-gray-600 dark:text-gray-400 italic text-right ikigai-print-description-text">
                Comfortable, but feeling of emptiness
              </div>
            </div>

            {/* Bottom-right: Good At + World Needs + Paid For */}
            <svg className="absolute w-full h-full" viewBox="0 0 1000 800">
              {/* 🎯 DOTTED LINE PATH */}
              <path d="M 630 400 Q 750 420 850 660" stroke="#888" strokeWidth="3" strokeDasharray="6,6" fill="none" />
            </svg>
            <div className="absolute ikigai-print-description-container" style={{ bottom: '6%', right: '-2%', width: '200px' }}>
              {/* 🎯 DESCRIPTION TEXT & POSITION */}
              <div className="text-lg text-gray-600 dark:text-gray-400 italic ikigai-print-description-text">
                Excitement and Complacency, but sense of uncertainty
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}); 