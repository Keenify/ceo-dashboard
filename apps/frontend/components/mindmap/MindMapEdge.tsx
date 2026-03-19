import React from 'react';
import { EdgeProps } from 'reactflow';

/**
 * MindMapEdgeComponent
 * 
 * A custom edge component that renders straight lines between node centers
 */
export default function MindMapEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  style = {},
  selected,
  source,
  target,
}: EdgeProps) {
  // Calculate center-to-center connection
  // ReactFlow provides the edge coordinates, but we want center-to-center connections
  
  return (
    <g>
      <path
        id={id}
        d={`M${sourceX},${sourceY} L${targetX},${targetY}`}
        stroke={selected ? '#3B82F6' : style.stroke || '#F6AD55'}
        strokeWidth={selected ? 4 : style.strokeWidth || 3}
        strokeDasharray={selected ? '5,5' : 'none'}
        fill="none"
      />
    </g>
  );
} 