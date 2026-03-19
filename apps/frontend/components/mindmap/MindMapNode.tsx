import { useLayoutEffect, useEffect, useRef } from 'react';
import { Handle, NodeProps, Position, useReactFlow } from 'reactflow';

import DragIcon from './DragIcon';

/**
 * NodeData type definition for mind map nodes
 */
export type NodeData = {
  label: string;
  color: string;
};

/**
 * MindMapNode Component
 * Renders an interactive node in a mind map with editing, deletion, and connection capabilities.
 * 
 * @component
 * @param {Object} props - Component props from ReactFlow NodeProps
 * @param {string} props.id - Unique identifier for the node
 * @param {NodeData} props.data - Node data containing the label
 * @returns {JSX.Element} A mind map node with handles for connections
 */
function MindMapNode({ id, data }: NodeProps<NodeData>) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { setNodes, setEdges, getEdges } = useReactFlow();

  /**
   * Recursively finds all descendant nodes of a given node
   */
  const getDescendantNodes = (nodeId: string): string[] => {
    const descendants: string[] = [];
    const edges = getEdges();
    
    const findChildren = (currentId: string) => {
      const childEdges = edges.filter(edge => edge.source === currentId);
      childEdges.forEach(edge => {
        descendants.push(edge.target);
        findChildren(edge.target);
      });
    };
    
    findChildren(nodeId);
    return descendants;
  };

  /**
   * Handles node deletion by removing the node and all its descendants
   */
  const handleDelete = () => {
    const descendantIds = getDescendantNodes(id);
    const allNodesToDelete = [id, ...descendantIds];

    setNodes(nodes => nodes.filter(node => !allNodesToDelete.includes(node.id)));
    setEdges(edges => edges.filter(edge => 
      !allNodesToDelete.includes(edge.source) && !allNodesToDelete.includes(edge.target)
    ));
  };

  /**
   * Updates the label of a specific node
   */
  const updateNodeLabel = (nodeId: string, label: string) => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === nodeId) {
          return { ...node, data: { ...node.data, label } };
        }
        return node;
      })
    );
  };

  useEffect(() => {
    setTimeout(() => {
      inputRef.current?.focus({ preventScroll: true });
    }, 1);
  }, []);

  useLayoutEffect(() => {
    if (inputRef.current) {
      // Create a temporary span to measure text width
      const span = document.createElement('span');
      span.style.visibility = 'hidden';
      span.style.position = 'absolute';
      span.style.whiteSpace = 'nowrap';
      span.style.font = window.getComputedStyle(inputRef.current).font;
      span.textContent = data.label;
      
      document.body.appendChild(span);
      const width = span.getBoundingClientRect().width;
      document.body.removeChild(span);
      
      // Add some padding to the width
      inputRef.current.style.width = `${Math.ceil(width) + 20}px`;
    }
  }, [data.label]);

  return (
    <>
      <div 
        className="inputWrapper"
        style={{ backgroundColor: data.color || '#F6AD55' }}
      >
        <div className="dragHandle">
          <DragIcon />
        </div>
        <input
          title={data.label}
          value={data.label}
          onChange={(evt) => updateNodeLabel(id, evt.target.value)}
          className="input"
          ref={inputRef}
        />
        {id !== 'root' && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDelete();
            }}
            className="deleteButton"
            title="Delete node"
          >
            ×
          </button>
        )}
      </div>

      {/* Left side handle for connection dragging */}
      <Handle 
        type="source" 
        position={Position.Left} 
        id="left-edge-handle"
        isConnectable={true}
        style={{ 
          width: '20px',
          height: '100%',
          top: 0,
          left: 0,
          border: 'none',
          background: 'transparent',
          borderRadius: '20px 0 0 20px',
          opacity: 0,
          transform: 'none',
          cursor: 'crosshair',
          zIndex: 1,
          pointerEvents: 'all'
        }} 
      />
      {/* Right side handle for connection dragging - avoid delete button */}
      <Handle 
        type="source" 
        position={Position.Right} 
        id="connection-handle"
        isConnectable={true}
        style={{ 
          width: '30px',
          height: 'calc(100% - 20px)',
          top: '20px',
          right: 0,
          border: 'none',
          background: 'transparent',
          borderRadius: '0 0 20px 0',
          opacity: 0,
          transform: 'none',
          cursor: 'crosshair',
          zIndex: 1,
          pointerEvents: 'all'
        }} 
      />
      {/* Top edge handle for connection dragging - avoid delete button */}
      <Handle 
        type="source" 
        position={Position.Top} 
        id="top-edge-handle"
        isConnectable={true}
        style={{ 
          width: 'calc(100% - 30px)',
          height: '12px',
          top: 0,
          left: 0,
          border: 'none',
          background: 'transparent',
          borderRadius: '20px 0 0 0',
          opacity: 0,
          transform: 'none',
          cursor: 'crosshair',
          zIndex: 1,
          pointerEvents: 'all'
        }} 
      />
      {/* Bottom edge handle for connection dragging */}
      <Handle 
        type="source" 
        position={Position.Bottom} 
        id="bottom-edge-handle"
        isConnectable={true}
        style={{ 
          width: '100%',
          height: '12px',
          bottom: 0,
          left: 0,
          border: 'none',
          background: 'transparent',
          borderRadius: '0 0 20px 20px',
          opacity: 0,
          transform: 'none',
          cursor: 'crosshair',
          zIndex: 1,
          pointerEvents: 'all'
        }} 
      />
      {/* Center handles for incoming/outgoing connections */}
      <Handle 
        type="target" 
        position={Position.Top} 
        id="center-target"
        isConnectable={true}
        style={{ 
          position: 'absolute',
          top: '50%', 
          left: '50%', 
          transform: 'translate(-50%, -50%)',
          width: '1px',
          height: '1px',
          background: 'transparent', 
          border: 'none',
          opacity: 0,
          pointerEvents: 'none'
        }} 
      />
      <Handle 
        type="source" 
        position={Position.Bottom} 
        id="center-source"
        isConnectable={true}
        style={{ 
          position: 'absolute',
          top: '50%', 
          left: '50%', 
          transform: 'translate(-50%, -50%)',
          width: '1px',
          height: '1px',
          background: 'transparent', 
          border: 'none',
          opacity: 0,
          pointerEvents: 'none'
        }} 
      />
    </>
  );
}

export default MindMapNode; 