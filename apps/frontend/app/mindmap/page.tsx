'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams, usePathname } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import FlowWrapper from '@/components/mindmap/FlowWrapper';
import { useMindmap, MindMapResponse } from './services/useMindmap';

/**
 * Mindmap Page Component
 * 
 * A component that manages and displays mind maps in a dashboard environment.
 * It provides functionality to view, create, and delete mind maps, with a grid layout
 * for existing mind maps and a creation button.
 * 
 * Features:
 * - Displays a grid of existing mind maps with their metadata
 * - Allows creation of new mind maps
 * - Supports deletion of mind maps with confirmation
 * - Shows mind map editor when a specific mind map is selected
 * 
 * @component
 * 
 * @example
 * ```tsx
 * // Accessed via routes:
 * // /mindmap - Shows grid of mindmaps
 * // /mindmap/new - Creates new mindmap
 * // /mindmap/[id] - Opens specific mindmap
 * ```
 */
export default function MindmapPage() {
  const router = useRouter();
  const params = useParams();
  const pathname = usePathname();
  
  const [mindmaps, setMindmaps] = useState<MindMapResponse[]>([]);
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedMindmapForDelete, setSelectedMindmapForDelete] = useState<MindMapResponse | null>(null);
  const [user, setUser] = useState<any>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const { getUserMindMaps, deleteMindMap } = useMindmap();

  // Get mindmap ID from URL params
  const mindmapId = params?.id as string;

  // Check if we're on the new route
  const isNewRoute = pathname?.endsWith('/new') || false;
  const isEditorView = mindmapId || isNewRoute;

  // Get current user
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };
    getUser();
  }, []);

  const fetchMindmaps = useCallback(async () => {
    if (!user?.id) return;

    try {
      setIsLoading(true);
      const fetchedMindmaps = await getUserMindMaps(user.id);
      if (fetchedMindmaps) {
        // Sort mindmaps by updated_at in descending order (most recent first)
        const sortedMindmaps = fetchedMindmaps.sort((a, b) => 
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
        );
        setMindmaps(sortedMindmaps);
      }
      setIsLoading(false);
    } catch (error) {
      console.error('Error fetching mindmaps:', error);
      setError('Failed to load mindmaps. Please try again later.');
      setIsLoading(false);
    }
  }, [user?.id, getUserMindMaps]);

  useEffect(() => {
    if (user?.id) {
      fetchMindmaps();
    }
  }, [fetchMindmaps, user?.id, refreshKey]);

  // Refresh mindmaps when returning to main view (not in editor)
  useEffect(() => {
    if (user?.id && !isEditorView) {
      fetchMindmaps();
    }
  }, [user?.id, isEditorView, fetchMindmaps]);

  // Navigation handlers
  const handleMindmapClick = (id: string) => {
    router.push(`/mindmap/${id}`);
  };

  const handleCreateClick = () => {
    router.push(`/mindmap/new`);
  };

  const handleDeleteClick = (mindmap: MindMapResponse, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering the mindmap selection
    setSelectedMindmapForDelete(mindmap);
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    if (!selectedMindmapForDelete) return;

    try {
      const success = await deleteMindMap(selectedMindmapForDelete.id);
      if (success) {
        setMindmaps(mindmaps.filter(m => m.id !== selectedMindmapForDelete.id));
        toast.success('Mind map deleted successfully');
      }
    } catch (error) {
      console.error('Error deleting mindmap:', error);
      toast.error('Failed to delete mind map');
    } finally {
      setShowDeleteModal(false);
      setSelectedMindmapForDelete(null);
    }
  };

  // Loading state
  if (!user) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-600 dark:text-gray-400">Loading user data...</p>
      </div>
    );
  }

  // If mindmapId is present or we're on the new route, show the FlowWrapper
  if (isEditorView) {
    return (
      <div className="w-full h-[80vh] relative">
        <FlowWrapper 
          userId={user.id} 
          mindmapId={isNewRoute ? undefined : mindmapId}
          onBackToMindmaps={() => {
            // Navigate to main mindmaps page and refresh the list
            router.push('/mindmap');
            // Small delay to ensure navigation completes before refreshing
            setTimeout(() => {
              setRefreshKey(prev => prev + 1);
            }, 100);
          }}
        />
      </div>
    );
  }

  return (
    <div className="w-full py-4 px-6">
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-6">Mindmaps</h1>
      {error ? (
        <p className="text-red-500 dark:text-red-400 text-center">{error}</p>
      ) : isLoading ? (
        <p className="text-gray-600 dark:text-gray-400 text-center">Loading...</p>
      ) : (
        <div className="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {mindmaps.map((mindmap) => (
            <div
              key={mindmap.id}
              className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-400 transition-all duration-200 relative group h-48"
            >
              <div 
                className="p-4 h-full flex flex-col cursor-pointer"
                onClick={() => handleMindmapClick(mindmap.id)}
              >
                <h3 className="font-medium text-gray-900 dark:text-gray-100 text-lg mb-2 truncate">
                  {mindmap.title}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 line-clamp-2">
                  {mindmap.description || 'No description'}
                </p>
                <div className="text-sm text-gray-500 dark:text-gray-400 mt-auto space-y-1">
                  <div className="truncate">
                    Last updated on {new Date(mindmap.updated_at).toLocaleDateString()}
                  </div>
                </div>
              </div>
              <div 
                className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => handleDeleteClick(mindmap, e)}
              >
                <button className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full text-red-500" title="Delete Mind Map">
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))}

          {/* Create New Mindmap Button */}
          <div
            onClick={handleCreateClick}
            className="bg-white dark:bg-gray-800 rounded-lg border-2 border-dashed border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-400 transition-all duration-200 cursor-pointer group h-48"
          >
            <div className="p-4 h-full flex flex-col items-center justify-center">
              <div className="w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-900/30 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/50 flex items-center justify-center mb-2 transition-colors">
                <svg
                  className="w-5 h-5 text-blue-600 dark:text-blue-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
              </div>
              <span className="text-gray-600 dark:text-gray-300 group-hover:text-blue-600 dark:group-hover:text-blue-400 font-medium text-sm transition-colors">
                Create New Mindmap
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Delete Mind Map</h3>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              Are you sure you want to delete "{selectedMindmapForDelete?.title}"? This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-4">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 