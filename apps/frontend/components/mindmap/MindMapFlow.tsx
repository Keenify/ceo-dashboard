import { useCallback, useRef, useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import ReactFlow, {
  ConnectionLineType,
  NodeOrigin,
  Node,
  Edge,
  Connection,
  useReactFlow,
  useStoreApi,
  Controls,
  Panel,
  useNodesState,
  useEdgesState,
  OnConnectStart,
  OnConnectEnd,
  OnConnect,
  NodeChange,
  EdgeChange,
  addEdge,
} from 'reactflow';
import 'reactflow/dist/style.css';
import '../../app/mindmap/styles.css';
import { 
  useMindmap,
  MindMapData,
  CreateMindMapRequest 
} from '../../app/mindmap/services/useMindmap';
import { useAutosave } from '../../lib/hooks/useDebounce';

import MindMapNode from './MindMapNode';
import MindMapEdgeComponent from './MindMapEdge';

// Define these outside the component
const nodeTypes = { mindmap: MindMapNode };
const edgeTypes = { mindmap: MindMapEdgeComponent };

/**
 * Interface for MindMap component props
 */
interface MindMapProps {
  /** Active user ID */
  userId: string;
  /** Optional ID of existing mindmap. If not provided, creates a new mindmap */
  mindmapId?: string;
  /** Optional callback function to navigate back to mindmaps list */
  onBackToMindmaps?: () => void;
}

/**
 * MindMap Flow Component
 * 
 * A React component that provides an interactive mind mapping interface using ReactFlow.
 * Supports creating new mind maps or editing existing ones with features like:
 * - Drag and drop node creation
 * - Node connections
 * - Editable titles and descriptions
 * - Auto-save functionality
 * - Unsaved changes detection
 * 
 * @param {MindMapProps} props - Component props
 * @returns {JSX.Element} Mind map interface
 */
function Flow({ userId, mindmapId, onBackToMindmaps }: MindMapProps) {
  const router = useRouter();
  
  // State for showing/hiding instructions panel
  const [showInstructions, setShowInstructions] = useState(false);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [title, setTitle] = useState('Double click to edit title');
  const [description, setDescription] = useState('Double click to edit description');
  const [isTitleEditing, setIsTitleEditing] = useState(false);
  const [isDescriptionEditing, setIsDescriptionEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentMindMapId, setCurrentMindMapId] = useState<string | undefined>(mindmapId);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Use the mindmap service hook
  const { 
    createMindMap, 
    getMindMap, 
    autosaveMindMap
  } = useMindmap();

  // Autosave function for both new and existing mindmaps
  const handleAutosave = useCallback(async () => {
    if (!userId) return;

    const mindMapData: MindMapData = {
      title,
      description,
      nodes: nodes.map(node => ({
        id: node.id,
        type: node.type || 'mindmap',
        data: {
          label: node.data.label,
          description: node.data.description,
          color: node.data.color || '#F6AD55'
        },
        position: node.position,
        parentNode: node.parentNode,
      })),
      edges: edges.map(edge => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        sourceHandle: edge.sourceHandle || 'center-source',
        targetHandle: edge.targetHandle || 'center-target',
        type: edge.type || 'mindmap',
        style: edge.style || { stroke: '#F6AD55', strokeWidth: 3 },
      })),
    };

    if (currentMindMapId) {
      // Update existing mindmap
      await autosaveMindMap(currentMindMapId, userId, {
        title,
        description,
        mindmap: mindMapData
      });
    } else {
      // Create new mindmap first
      const createRequest: CreateMindMapRequest = {
        title,
        description,
        mindmap: mindMapData,
        user_id: userId
      };
      const newMindMap = await createMindMap(createRequest);
      if (newMindMap) {
        setCurrentMindMapId(newMindMap.id);
        setHasUnsavedChanges(false);
        
        // Update URL to reflect the new mindmap ID so refresh works
        router.replace(`/mindmap/${newMindMap.id}`);
      }
    }
  }, [title, description, nodes, edges, currentMindMapId, userId, autosaveMindMap, createMindMap, router]);

  // Set up autosave with 0.5-second debounce
  // Use simple, stable dependencies
  const nodeLabels = nodes.map(n => n.data.label).join(',');
  const nodePositions = nodes.map(n => `${n.id}:${n.position.x},${n.position.y}`).join('|');
  const edgeConnections = edges.map(e => `${e.source}-${e.target}`).join('|');
  
  const { autosaveStatus, lastSaved, cancelAutosave } = useAutosave(
    handleAutosave,
    500,
    [title, description, nodeLabels, nodePositions, edgeConnections, nodes.length, edges.length]
  );



  // Initialize or fetch mindmap data
  useEffect(() => {
    const initializeMindMap = async () => {
      setIsLoading(true);
      try {
        if (!mindmapId || mindmapId === 'new') {
          // Initialize new mindmap
          const initialNode = {
            id: 'root',
            type: 'mindmap',
            data: { 
              label: 'Root Node',
              description: 'Start your mind map here',
              color: '#F6AD55'
            },
            position: { x: 0, y: 0 },
            dragHandle: '.dragHandle',
          };
          
          setNodes([initialNode]);
          setEdges([]);
          setTitle('New Mind Map');
          setDescription('Add a description for your mind map');
          setIsLoading(false);
        } else {
          // Fetch existing mindmap
          const mindmapData = await getMindMap(mindmapId);
          if (mindmapData) {
            setTitle(mindmapData.title);
            setDescription(mindmapData.description);
            setCurrentMindMapId(mindmapData.id); // Ensure the ID is set for autosave
            setNodes(mindmapData.mindmap.nodes.map(node => ({
              ...node,
              dragHandle: '.dragHandle',
            })));
            setEdges(mindmapData.mindmap.edges.map(edge => ({
              ...edge,
              type: edge.type || 'mindmap',
              sourceHandle: edge.sourceHandle || 'center-source',
              targetHandle: edge.targetHandle || 'center-target',
              style: edge.style || { stroke: '#F6AD55', strokeWidth: 3 },
            })));

          }
          setIsLoading(false);
        }
      } catch (err) {
        console.error('Error initializing mindmap:', err);
        setError('Failed to initialize mind map');
        setIsLoading(false);
      }
    };

    initializeMindMap();
  }, [mindmapId, setNodes, setEdges, getMindMap]);

  const store = useStoreApi();
  const { screenToFlowPosition } = useReactFlow();
  const connectingNodeId = useRef<string | null>(null);

  /**
   * Calculates the position for a new child node relative to its parent
   */
  const getChildNodePosition = useCallback(
    (event: MouseEvent, parentNode?: Node) => {
      if (!parentNode?.positionAbsolute || !parentNode?.width || !parentNode?.height) {
        return;
      }

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      return {
        x: position.x - parentNode.positionAbsolute.x + parentNode.width / 2,
        y: position.y - parentNode.positionAbsolute.y + parentNode.height / 2,
      };
    },
    [screenToFlowPosition]
  );

  /**
   * Handles direct connections between existing nodes
   */
  const onConnect: OnConnect = useCallback((params: Connection) => {
    // Prevent self-connections
    if (params.source === params.target) {
      return;
    }

    // Check if connection already exists
    const existingEdge = edges.find(
      edge => edge.source === params.source && edge.target === params.target
    );
    
    if (existingEdge) {
      return; // Don't create duplicate edges
    }

    // Create new edge with consistent styling and center handle information
    const newEdge: Edge = {
      id: crypto.randomUUID(),
      source: params.source!,
      target: params.target!,
      sourceHandle: 'center-source',
      targetHandle: 'center-target',
      type: 'mindmap',
      style: { stroke: '#F6AD55', strokeWidth: 3 },
    };

    setEdges((eds) => addEdge(newEdge, eds));
    setHasUnsavedChanges(true);
  }, [edges, setEdges]);

  /**
   * Handles the start of a connection between nodes
   */
  const onConnectStart: OnConnectStart = useCallback((_, params) => {
    connectingNodeId.current = params.nodeId;
  }, []);

  /**
   * Handles the completion of a connection, creating new nodes when connecting to empty space
   */
  const onConnectEnd: OnConnectEnd = useCallback((event: MouseEvent | TouchEvent) => {
    if (!(event instanceof MouseEvent)) return;
    
    const { nodeInternals } = store.getState();
    const targetIsPane = (event.target as Element).classList.contains('react-flow__pane');
    const targetNode = (event.target as Element).closest('.react-flow__node');
    
    // Reset the connecting node reference
    const sourceNodeId = connectingNodeId.current;
    connectingNodeId.current = null;

    // Only create new nodes when dragging to empty space (pane)
    // Don't interfere with normal node-to-node connections
    if (targetIsPane && sourceNodeId && !targetNode) {
      const parentNode = nodeInternals.get(sourceNodeId);
      const childNodePosition = getChildNodePosition(event, parentNode);

      if (parentNode && childNodePosition) {
        const newNode = {
          id: crypto.randomUUID(),
          type: 'mindmap',
          data: { 
            label: 'New Node',
            description: '',
            color: parentNode.data.color || '#F6AD55',
            isEditing: false 
          },
          position: childNodePosition,
          dragHandle: '.dragHandle',
          parentNode: parentNode.id,
        };

        const newEdge: Edge = {
          id: crypto.randomUUID(),
          source: parentNode.id,
          target: newNode.id,
          sourceHandle: 'center-source',
          targetHandle: 'center-target',
          type: 'mindmap',
          style: { stroke: '#F6AD55', strokeWidth: 3 },
        };

        setNodes((nds) => [...nds, newNode]);
        setEdges((eds) => [...eds, newEdge]);
        setHasUnsavedChanges(true);
      }
    }
  }, [getChildNodePosition, setNodes, setEdges, store]);

  const nodeOrigin: NodeOrigin = [0.5, 0.5];
  const connectionLineStyle = { stroke: '#F6AD55', strokeWidth: 3 };
  const defaultEdgeOptions = { style: connectionLineStyle, type: 'mindmap' };

  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    setHasUnsavedChanges(true);
    onNodesChange(changes);
  }, [onNodesChange]);

  const handleEdgesChange = useCallback((changes: EdgeChange[]) => {
    setHasUnsavedChanges(true);
    onEdgesChange(changes);
  }, [onEdgesChange]);

  /**
   * Handles edge deletion when user presses delete key
   */
  const onEdgeDelete = useCallback((edges: Edge[]) => {
    setEdges((eds) => eds.filter((edge) => !edges.some((e) => e.id === edge.id)));
    setHasUnsavedChanges(true);
  }, [setEdges]);

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value);
    setHasUnsavedChanges(true);
  };

  const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setDescription(e.target.value);
    setHasUnsavedChanges(true);
  };



  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges && autosaveStatus !== 'saved') {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges, autosaveStatus]);

  return (
    <div style={{ width: '100%', height: '100%' }}>
      {/* Instructions Modal */}
      {showInstructions && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(31, 41, 55, 0.25)',
          zIndex: 300,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-8 max-w-2xl w-full mx-4 shadow-xl relative">
            <button
              onClick={() => setShowInstructions(false)}
              className="absolute top-3 right-4 bg-transparent border-none text-2xl cursor-pointer text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 font-bold"
            >
              ×
            </button>
            <h2 className="text-xl font-bold mb-4 text-gray-800 dark:text-gray-200">How to Use the Mind Map</h2>
            <ol className="pl-6 m-0 text-gray-700 dark:text-gray-300 text-base space-y-2">
              <li className="mb-2"><span className="font-semibold">Create or Edit a Mind Map:</span> If you're starting fresh, a root node will appear. If you're editing, your existing mind map will load automatically.</li>
              <li className="mb-2"><span className="font-semibold">Edit Title and Description:</span> Double-click the title or description at the top-left to edit them.</li>
              <li className="mb-2"><span className="font-semibold">Add Nodes:</span> Point to an existing node until you see the + icon, then drag to empty space.</li>
              <li className="mb-2"><span className="font-semibold">Connect Nodes:</span> Drag from a node's handle to another node to create a connection.</li>
              <li className="mb-2"><span className="font-semibold">Edit Node Content:</span> Double-click any node to edit its label.</li>
              <li className="mb-2"><span className="font-semibold">Auto-Save:</span> Your work is automatically saved every 0.5 seconds after you make changes. Check the status indicator for save progress.</li>
            </ol>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center h-full">
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      ) : error ? (
        <div className="flex items-center justify-center h-full">
          <p className="text-red-500 dark:text-red-400">{error}</p>
        </div>
      ) : (
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={handleNodesChange}
          onEdgesChange={handleEdgesChange}
          onEdgesDelete={onEdgeDelete}
          onConnect={onConnect}
          onConnectStart={onConnectStart}
          onConnectEnd={onConnectEnd}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          nodeOrigin={nodeOrigin}
          defaultEdgeOptions={defaultEdgeOptions}
          connectionLineStyle={connectionLineStyle}
          connectionLineType={ConnectionLineType.Straight}
          proOptions={{ hideAttribution: true }}
          fitView
          selectNodesOnDrag={false}
        >
          <Controls showInteractive={false} />
          <Panel position="top-left" className="header z-40 mt-16 w-full px-6">
            <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm p-4">
              <div className="flex justify-between items-start gap-4">
                {/* Left side: Title and Description */}
                <div className="flex flex-col gap-3 flex-1 max-w-[500px]">
                                      <input
                      type="text"
                      className={`font-semibold transition-all duration-150 w-full ${
                        isTitleEditing
                          ? 'text-xl bg-white dark:bg-gray-700 border-blue-500 border-2 shadow-lg text-black dark:text-white'
                          : 'text-lg bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 shadow-sm text-black dark:text-white'
                      }`}
                    style={{
                      borderRadius: 8,
                      padding: '12px 16px',
                      outline: 'none',
                    }}
                    value={title}
                    placeholder="Double click to edit title"
                    readOnly={!isTitleEditing}
                    onDoubleClick={() => setIsTitleEditing(true)}
                    onChange={handleTitleChange}
                    onBlur={() => setIsTitleEditing(false)}
                  />
                                      <textarea
                      className={`transition-all duration-150 resize-none w-full ${
                        isDescriptionEditing
                          ? 'text-base bg-white dark:bg-gray-700 border-blue-500 border-2 shadow-lg text-black dark:text-white'
                          : 'text-sm bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 shadow-sm text-black dark:text-white'
                      }`}
                    style={{
                      borderRadius: 8,
                      padding: '12px 16px',
                      outline: 'none',
                      overflowY: 'hidden',
                      minHeight: '44px',
                    }}
                    value={description}
                    placeholder="Double click to edit description"
                    readOnly={!isDescriptionEditing}
                    onDoubleClick={() => setIsDescriptionEditing(true)}
                    onChange={handleDescriptionChange}
                    onBlur={() => setIsDescriptionEditing(false)}
                  />
                </div>

                {/* Right side: Buttons */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {/* Autosave Status Indicator */}
                  <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-700 rounded-lg text-sm">
                    {autosaveStatus === 'saving' && (
                      <>
                        <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-gray-600 dark:text-gray-300">Saving...</span>
                      </>
                    )}
                    {autosaveStatus === 'saved' && (
                      <>
                        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                        <span className="text-green-600 dark:text-green-400">Saved</span>
                      </>
                    )}
                    {autosaveStatus === 'error' && (
                      <>
                        <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                        <span className="text-red-600 dark:text-red-400">Error</span>
                      </>
                    )}
                    {autosaveStatus === 'idle' && lastSaved && (
                      <>
                        <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
                        <span className="text-gray-500 dark:text-gray-400">
                          {lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </>
                    )}
                    {autosaveStatus === 'idle' && !lastSaved && !currentMindMapId && (
                      <>
                        <div className="w-3 h-3 bg-orange-400 rounded-full"></div>
                        <span className="text-orange-600 dark:text-orange-400">Draft</span>
                      </>
                    )}
                  </div>
                  
                  {onBackToMindmaps && (
                    <button
                      onClick={onBackToMindmaps}
                      className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg shadow-sm transition-all text-sm font-medium flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                      Back to Mindmaps
                    </button>
                  )}

                  <button
                    onClick={() => setShowInstructions(true)}
                    className="px-3 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg shadow-sm transition-all text-sm font-medium"
                    title="Show instructions"
                  >
                    ?
                  </button>
                </div>
              </div>
            </div>
          </Panel>
        </ReactFlow>
      )}
    </div>
  );
}

export default Flow; 