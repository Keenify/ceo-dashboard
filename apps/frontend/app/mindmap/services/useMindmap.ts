import { useState, useCallback } from 'react';

// Read the backend API domain from environment variables
const backendApiDomain = process.env.NEXT_PUBLIC_BACKEND_API_DOMAIN || 'http://localhost:8000';

// Types for mind map data structure
export interface MindMapNode {
    id: string;
    type: string;
    data: {
        label: string;
        description: string;
        color: string;
    };
    position: {
        x: number;
        y: number;
    };
    parentNode?: string;
}

export interface MindMapEdge {
    id: string;
    source: string;
    target: string;
    type: string;
    sourceHandle?: string;
    targetHandle?: string;
    style?: {
        stroke?: string;
        strokeWidth?: string | number;
        [key: string]: any;
    };
}

export interface MindMapData {
    title: string;
    description: string;
    nodes: MindMapNode[];
    edges: MindMapEdge[];
}

export interface CreateMindMapRequest {
    title: string;
    description: string;
    mindmap: MindMapData;
    user_id: string;
}

export interface MindMapResponse extends CreateMindMapRequest {
    id: string;
    title: string;
    user_id: string;
    updated_by: string | null;
    updated_at: string;
    created_at: string;
    deleted_at: string | null;
}

export interface UpdateMindMapRequest {
    title?: string;
    description?: string;
    mindmap?: Partial<MindMapData>;
    updated_by: string;
}

interface PaginationParams {
    skip?: number;
    limit?: number;
}

export function useMindmap() {
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<Error | null>(null);

    /**
     * Creates a new mind map.
     */
    const createMindMap = useCallback(async (mindMapData: CreateMindMapRequest): Promise<MindMapResponse | null> => {
        setLoading(true);
        setError(null);
        
        try {
            const endpoint = `${backendApiDomain}/mindmaps/`;
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(mindMapData)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
            }

            const data: MindMapResponse = await response.json();
            setLoading(false);
            return data;
        } catch (err) {
            setError(err instanceof Error ? err : new Error('An unknown error occurred while creating mind map'));
            setLoading(false);
            return null;
        }
    }, []);

    /**
     * Fetches a mind map by its ID.
     */
    const getMindMap = useCallback(async (mindMapId: string): Promise<MindMapResponse | null> => {
        setLoading(true);
        setError(null);
        
        try {
            const endpoint = `${backendApiDomain}/mindmaps/${encodeURIComponent(mindMapId)}`;
            const response = await fetch(endpoint, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                },
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
            }

            const data: MindMapResponse = await response.json();
            setLoading(false);
            return data;
        } catch (err) {
            setError(err instanceof Error ? err : new Error('An unknown error occurred while fetching mind map'));
            setLoading(false);
            return null;
        }
    }, []);

    /**
     * Updates an existing mind map.
     */
    const updateMindMap = useCallback(async (
        mindMapId: string,
        userId: string,
        mindMapData: Omit<UpdateMindMapRequest, 'updated_by'>
    ): Promise<MindMapResponse | null> => {
        setLoading(true);
        setError(null);
        
        try {
            const endpoint = `${backendApiDomain}/mindmaps/${encodeURIComponent(mindMapId)}`;
            const payload: UpdateMindMapRequest = {
                ...mindMapData,
                updated_by: userId
            };

            const response = await fetch(endpoint, {
                method: 'PUT',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
            }

            const data: MindMapResponse = await response.json();
            setLoading(false);
            return data;
        } catch (err) {
            setError(err instanceof Error ? err : new Error('An unknown error occurred while updating mind map'));
            setLoading(false);
            return null;
        }
    }, []);

    /**
     * Silently updates an existing mind map for autosave (no loading state changes).
     */
    const autosaveMindMap = useCallback(async (
        mindMapId: string,
        userId: string,
        mindMapData: Omit<UpdateMindMapRequest, 'updated_by'>
    ): Promise<MindMapResponse | null> => {
        try {
            const endpoint = `${backendApiDomain}/mindmaps/${encodeURIComponent(mindMapId)}`;
            const payload: UpdateMindMapRequest = {
                ...mindMapData,
                updated_by: userId
            };

            const response = await fetch(endpoint, {
                method: 'PUT',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
            }

            const data: MindMapResponse = await response.json();
            return data;
        } catch (err) {
            console.error('Autosave failed:', err);
            throw err;
        }
    }, []);

    /**
     * Fetches all mind maps for a specific user.
     */
    const getUserMindMaps = useCallback(async (
        userId: string,
        pagination: PaginationParams = { skip: 0, limit: 100 }
    ): Promise<MindMapResponse[] | null> => {
        setLoading(true);
        setError(null);
        
        try {
            const { skip = 0, limit = 100 } = pagination;
            const endpoint = `${backendApiDomain}/mindmaps/user/${encodeURIComponent(userId)}?skip=${skip}&limit=${limit}`;
            
            const response = await fetch(endpoint, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                },
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
            }

            const data: MindMapResponse[] = await response.json();
            setLoading(false);
            return data;
        } catch (err) {
            setError(err instanceof Error ? err : new Error('An unknown error occurred while fetching user mind maps'));
            setLoading(false);
            return null;
        }
    }, []);

    /**
     * Fetches all mind maps (for admin or public view).
     */
    const getAllMindMaps = useCallback(async (
        pagination: PaginationParams = { skip: 0, limit: 100 }
    ): Promise<MindMapResponse[] | null> => {
        setLoading(true);
        setError(null);
        
        try {
            const { skip = 0, limit = 100 } = pagination;
            const endpoint = `${backendApiDomain}/mindmaps/?skip=${skip}&limit=${limit}`;
            
            const response = await fetch(endpoint, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                },
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
            }

            const data: MindMapResponse[] = await response.json();
            setLoading(false);
            return data;
        } catch (err) {
            setError(err instanceof Error ? err : new Error('An unknown error occurred while fetching all mind maps'));
            setLoading(false);
            return null;
        }
    }, []);

    /**
     * Deletes a mind map by its ID (soft delete).
     */
    const deleteMindMap = useCallback(async (mindMapId: string): Promise<boolean> => {
        setLoading(true);
        setError(null);
        
        try {
            const endpoint = `${backendApiDomain}/mindmaps/${encodeURIComponent(mindMapId)}`;
            const response = await fetch(endpoint, {
                method: 'DELETE',
                headers: {
                    'Accept': 'application/json',
                },
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
            }

            setLoading(false);
            return true;
        } catch (err) {
            setError(err instanceof Error ? err : new Error('An unknown error occurred while deleting mind map'));
            setLoading(false);
            return false;
        }
    }, []);

    /**
     * Permanently deletes a mind map by its ID (hard delete).
     */
    const permanentlyDeleteMindMap = useCallback(async (mindMapId: string): Promise<boolean> => {
        setLoading(true);
        setError(null);
        
        try {
            const endpoint = `${backendApiDomain}/mindmaps/${encodeURIComponent(mindMapId)}/permanent`;
            const response = await fetch(endpoint, {
                method: 'DELETE',
                headers: {
                    'Accept': 'application/json',
                },
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
            }

            setLoading(false);
            return true;
        } catch (err) {
            setError(err instanceof Error ? err : new Error('An unknown error occurred while permanently deleting mind map'));
            setLoading(false);
            return false;
        }
    }, []);

    /**
     * Restores a soft-deleted mind map.
     */
    const restoreMindMap = useCallback(async (mindMapId: string): Promise<boolean> => {
        setLoading(true);
        setError(null);
        
        try {
            const endpoint = `${backendApiDomain}/mindmaps/${encodeURIComponent(mindMapId)}/restore`;
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                },
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
            }

            setLoading(false);
            return true;
        } catch (err) {
            setError(err instanceof Error ? err : new Error('An unknown error occurred while restoring mind map'));
            setLoading(false);
            return false;
        }
    }, []);

    return {
        createMindMap,
        getMindMap,
        updateMindMap,
        autosaveMindMap,
        getUserMindMaps,
        getAllMindMaps,
        deleteMindMap,
        permanentlyDeleteMindMap,
        restoreMindMap,
        loading,
        error,
    };
} 