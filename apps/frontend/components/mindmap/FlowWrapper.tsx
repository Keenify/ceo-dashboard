import { memo } from 'react';
import { ReactFlowProvider } from 'reactflow';
import Flow from './MindMapFlow';

/**
 * Props interface for FlowWrapper component
 */
interface FlowWrapperProps {
  /** User ID for authentication */
  userId: string;
  /** Optional ID of the mindmap to be displayed */
  mindmapId?: string;
  onBackToMindmaps?: () => void;
}

/**
 * FlowWrapper component that provides ReactFlow context and renders the mindmap
 * This component wraps the main Flow/MindMap component with necessary providers
 * and positioning styles.
 * 
 * @param {FlowWrapperProps} props - Component props
 * @param {string} props.userId - User ID for authentication
 * @param {string} [props.mindmapId] - Optional ID of the mindmap to display
 * @param {function} [props.onBackToMindmaps] - Function to navigate back to mindmaps
 * @returns {JSX.Element} Wrapped Flow component with ReactFlow provider
 */
export const FlowWrapper = memo(({ userId, mindmapId, onBackToMindmaps }: FlowWrapperProps) => {
  return (
    <div className="absolute inset-0">
      <ReactFlowProvider>
        <Flow userId={userId} mindmapId={mindmapId} onBackToMindmaps={onBackToMindmaps} />
      </ReactFlowProvider>
    </div>
  );
});

FlowWrapper.displayName = 'FlowWrapper';

export default FlowWrapper; 