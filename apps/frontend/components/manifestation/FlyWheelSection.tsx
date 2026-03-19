"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, X, Edit, Check, Save, Loader2, AlertCircle, UploadCloud, Download } from "lucide-react";
import { toast } from "@/components/ui/toast";
import { useDropzone } from 'react-dropzone';
import { 
  useFlywheel, 
  FlywheelPayload, 
  FlywheelResponse, 
  FlywheelEdge as ApiFlywheelEdge // Rename to avoid clash 
} from "@/app/manifestation/services/useFlywheel";
import { useSupabaseStorage } from "@/lib/hooks/useSupabaseStorage"; // Import the new hook
import { supabase } from "@/lib/supabase"; // Need supabase client here

// Define types for our FlyWheel data structure
interface FlyWheelEdge extends ApiFlywheelEdge {}

interface FlyWheel {
  id: string;
  name: string;
  description?: string; // Add description based on API response
  image_path?: string | null; // Changed from image_url
  edges: FlyWheelEdge[];
}

export interface FlyWheelSectionProps {
  userId: string;
}

export const FlyWheelSection: React.FC<FlyWheelSectionProps> = ({ userId }) => {
  const {
    addFlywheel,
    fetchFlywheels,
    updateFlywheel,
    deleteFlywheel,
    loading: apiLoading, // Rename to avoid clash with potential local loading
    error: apiError,
  } = useFlywheel();

  // State for all flywheels
  const [flywheels, setFlywheels] = useState<FlyWheel[]>([]);
  const [selectedFlyWheelId, setSelectedFlyWheelId] = useState<string | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newFlyWheelName, setNewFlyWheelName] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [isLoadingInitialData, setIsLoadingInitialData] = useState(true);
  const [localError, setLocalError] = useState<string | null>(null);
  
  // Current editing state for the selected flywheel
  const [editingName, setEditingName] = useState("");
  const [editingDescription, setEditingDescription] = useState<string | undefined>(""); // Add state for description
  const [editingEdges, setEditingEdges] = useState<FlyWheelEdge[]>([]);
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState<boolean>(false);
  
  // Instantiate the storage hook
  const { 
    uploadFile,
    loading: storageLoading,
    error: storageError,
    // uploadProgress: storageProgress // Can use this later for UI
  } = useSupabaseStorage();
  
  // Fetch data on mount and when userId changes
  const loadFlywheels = useCallback(async () => {
    if (!userId) return;
    setIsLoadingInitialData(true);
    setLocalError(null); // Clear previous errors
    const fetchedFlywheels = await fetchFlywheels(userId);
    if (fetchedFlywheels) {
      // Map API response to component state type if needed (here it matches)
      setFlywheels(fetchedFlywheels);
      if (fetchedFlywheels.length > 0 && !selectedFlyWheelId) {
        setSelectedFlyWheelId(fetchedFlywheels[0].id);
      } else if (fetchedFlywheels.length === 0) {
        setSelectedFlyWheelId(null);
      }
    } else {
      // Error handling is managed by the hook, but we might want specific UI feedback
      setLocalError("Failed to load flywheels."); 
    }
    setIsLoadingInitialData(false);
  }, [userId, fetchFlywheels, selectedFlyWheelId]);

  useEffect(() => {
    loadFlywheels();
  }, [loadFlywheels]); // Depend on the memoized load function
  
  // Update local error state when API error changes
  useEffect(() => {
    if (apiError) {
      setLocalError(apiError.message);
      toast.error(`Error: ${apiError.message}`);
    }
  }, [apiError]);

  // Get the currently selected flywheel
  const selectedFlyWheel = flywheels.find(fw => fw.id === selectedFlyWheelId);
  
  // Function to start editing the current flywheel
  const startEditing = () => {
    if (selectedFlyWheel) {
      setEditingName(selectedFlyWheel.name);
      setEditingDescription(selectedFlyWheel.description || "");
      setEditingEdges([...selectedFlyWheel.edges.map(edge => ({...edge}))]); // Deep copy edges
      setIsEditing(true);
      setLocalError(null); // Clear errors when starting edit
    }
  };
  
  // Function to cancel editing
  const cancelEditing = () => {
    setIsEditing(false);
    setEditingName("");
    setEditingDescription("");
    setEditingEdges([]);
    setLocalError(null); // Clear errors on cancel
  };
  
  // Function to save the current flywheel
  const saveFlyWheel = async () => {
    if (!selectedFlyWheelId || !userId || apiLoading || storageLoading) return;
    setLocalError(null);

    let imagePath: string | null | undefined = selectedFlyWheel?.image_path; // Keep existing if no new file

    // 1. Upload image if a new one is selected
    if (selectedImageFile) {
      setIsUploadingImage(true); // Indicate image upload start
      // Get the path from the upload service
      const uploadedPath = await uploadFile(selectedImageFile, 'public-images', `${userId}/`); 
      setIsUploadingImage(false); // Indicate image upload end

      if (!uploadedPath) {
        // Error handled by the hook, but show specific toast
        toast.error("Image upload failed. Please try saving again.");
        setLocalError(storageError?.message || "Image upload failed.");
        return; // Stop saving process if image upload fails
      }
      imagePath = uploadedPath; // Update imagePath with the newly uploaded path
    }

    // 2. Prepare payload for Flywheel update
    const updatePayload: Partial<FlywheelPayload> = {
      name: editingName,
      description: editingDescription || undefined, // Send undefined if empty
      edges: editingEdges,
      image_path: imagePath, // Include the image path (new or existing)
    };
    
    // 3. Update Flywheel data
    const updatedFlywheel = await updateFlywheel(selectedFlyWheelId, userId, updatePayload);
    
    if (updatedFlywheel) {
      // Update the flywheel in the state
      setFlywheels(prev => prev.map(fw => 
        fw.id === selectedFlyWheelId 
          ? { ...updatedFlywheel, image_path: updatedFlywheel.image_path ?? imagePath } // Use response data, ensure image_path is updated
          : fw
      ));
      toast.success("Flywheel saved successfully!");
      setIsEditing(false);
      // Reset file input state after successful save
      setSelectedImageFile(null);
      setImagePreviewUrl(null);
      if (document.getElementById('flywheel-image-upload')) { // Reset file input visually if possible
          (document.getElementById('flywheel-image-upload') as HTMLInputElement).value = "";
      }
    } else {
      // Error is handled by the hook and useEffect
      // toast.error("Failed to save flywheel."); 
    }
  };
  
  // Function to add a new flywheel
  const addNewFlyWheel = async () => {
    if (!newFlyWheelName.trim()) {
      setLocalError("Please enter a name for the flywheel");
      toast.error("Please enter a name for the flywheel");
      return;
    }
    if (!userId) {
      setLocalError("User ID is missing");
      toast.error("User ID is missing");
      return;
    }
    setLocalError(null);

    const newFlyWheelPayload: FlywheelPayload = {
      name: newFlyWheelName,
      // Optional: Add a default description or leave it out
      description: "New flywheel description", 
      edges: [ // Start with some default edges
        { id: `e${Date.now()}-1`, text: "Step 1" },
        { id: `e${Date.now()}-2`, text: "Step 2" },
        { id: `e${Date.now()}-3`, text: "Step 3" },
      ],
      user_id: userId,
    };
    
    const addedFlywheel = await addFlywheel(newFlyWheelPayload);

    if (addedFlywheel) {
      setFlywheels(prev => [...prev, addedFlywheel]); // Use response data
      setSelectedFlyWheelId(addedFlywheel.id);
      setNewFlyWheelName("");
      setIsAddingNew(false);
      toast.success("New flywheel created!");
    } else {
      // Error is handled by the hook and useEffect
      // toast.error("Failed to create flywheel.");
    }
  };
  
  // Function to add an edge to the current editing flywheel
  const addEdge = () => {
    const newEdge: FlyWheelEdge = {
      id: `e${Date.now()}-${editingEdges.length + 1}`, // More robust temp ID
      text: "New Step"
    };
    setEditingEdges(prev => [...prev, newEdge]);
  };
  
  // Function to remove an edge from the current editing flywheel
  const removeEdge = (edgeId: string) => {
    setEditingEdges(prev => prev.filter(edge => edge.id !== edgeId));
  };
  
  // Function to update an edge's text
  const updateEdgeText = (edgeId: string, text: string) => {
    setEditingEdges(prev => 
      prev.map(edge => edge.id === edgeId ? { ...edge, text } : edge)
    );
  };
  
  // Function to delete the current flywheel
  const deleteFlyWheelHandler = async () => { // Renamed to avoid conflict with hook function
    if (!selectedFlyWheelId || !userId) return;
    setLocalError(null);
    
    if (window.confirm("Are you sure you want to delete this flywheel?")) {
      const success = await deleteFlywheel(selectedFlyWheelId, userId);
      
      if (success) {
        const remainingFlywheels = flywheels.filter(fw => fw.id !== selectedFlyWheelId);
        setFlywheels(remainingFlywheels);
        // Select the first remaining flywheel, or null if none left
        setSelectedFlyWheelId(remainingFlywheels.length > 0 ? remainingFlywheels[0].id : null);
        toast.success("Flywheel deleted");
      } else {
        // Error is handled by the hook and useEffect
        // toast.error("Failed to delete flywheel.");
      }
    }
  };

  // Download PDF function
  const handleDownloadPDF = () => {
    window.print();
  };

  // --- Handle Image File Selection (Adapted for react-dropzone) ---
  const onDrop = useCallback((acceptedFiles: File[]) => {
    setLocalError(null); // Clear previous errors
    if (acceptedFiles && acceptedFiles[0]) {
      const file = acceptedFiles[0];

      // Basic validation (optional: size, type)
      if (file.size > 5 * 1024 * 1024) { // Example: 5MB limit
        toast.error("File size should not exceed 5MB.");
        setSelectedImageFile(null);
        setImagePreviewUrl(null);
        return;
      }
      setSelectedImageFile(file);

      // Create a preview URL
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      // Handle rejection or no file selected if needed
      setSelectedImageFile(null);
      setImagePreviewUrl(null);
    }
  }, []); // Empty dependency array as it uses state setters

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': [] }, // Accept all image types
    multiple: false, // Allow only single file upload
  });
  
  // --- Loading and Error States --- 
  if (isLoadingInitialData) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">Loading Flywheels...</span>
      </div>
    );
  }

  if (localError && flywheels.length === 0) { // Show specific error if loading failed initially
    return (
       <div className="flex flex-col items-center justify-center p-8 border border-dashed rounded-lg bg-destructive/10 text-destructive">
        <AlertCircle className="h-8 w-8 mb-2" />
        <p className="font-medium">Error Loading Flywheels</p>
        <p className="text-sm">{localError}</p>
        <Button variant="outline" size="sm" onClick={loadFlywheels} className="mt-4">
          Retry
        </Button>
      </div>
    );
  }
  
  // Flywheel component using the dynamic circular layout
  const Flywheel = ({ edges, imagePath }: { edges: FlyWheelEdge[], imagePath?: string | null }) => {
    const [centerImageUrl, setCenterImageUrl] = useState<string | null>(null);

    // Get public URL when imagePath changes
    useEffect(() => {
      if (imagePath) {
        const { data } = supabase.storage.from('public-images').getPublicUrl(imagePath);
        setCenterImageUrl(data?.publicUrl ?? null);
      } else {
        setCenterImageUrl(null); // Reset if path is null/undefined
      }
    }, [imagePath]);

    if (edges.length === 0) {
      return (
        <div className="flex items-center justify-center h-80 text-muted-foreground">
          No steps in this flywheel. Click "Edit" to add steps.
        </div>
      );
    }
    
    const size = 600;
    const center = size / 2;
    const textRadius = 250; // Larger radius for text placement
    const arrowRadius = 300; // Larger radius for arrow path
    const itemCount = edges.length;
    
    // Define an angle offset to create a gap between text and arrow start/end
    const angleOffset = Math.PI / 4.9; // INCREASED offset (18 degrees) to shorten arrows

    // Calculate points for text labels and arrows
    const points = edges.map((edge, i) => {
      const angle = ((i / itemCount) * 2 * Math.PI) - (Math.PI / 2); // Start from top (subtract 90 degrees)
      const textX = center + textRadius * Math.cos(angle);
      const textY = center + textRadius * Math.sin(angle);
      
      // Calculate text alignment based on position
      let alignClass = "text-center";
      let offsetX = 0;
      let offsetY = 0;
      
      // Convert angle to degrees for easier conditionals
      const degrees = (angle * 180 / Math.PI + 360) % 360;
      
      // Top
      if (degrees > 315 || degrees < 45) {
        alignClass = "text-center";
        offsetY = -20;
      } 
      // Right
      else if (degrees >= 45 && degrees < 135) {
        alignClass = "text-left";
        offsetX = 15;
      } 
      // Bottom
      else if (degrees >= 135 && degrees < 225) {
        alignClass = "text-center";
        offsetY = 20;
      } 
      // Left
      else {
        alignClass = "text-right";
        offsetX = -15;
      }
      
      return {
        id: edge.id,
        text: edge.text,
        angle,
        textX,
        textY,
        alignClass,
        offsetX,
        offsetY
      };
    });
    
    // Calculate the arrow paths
    const arrows = points.map((point, i) => {
      const nextPoint = points[(i + 1) % points.length];
      
      const startAngle = point.angle;
      const endAngle = nextPoint.angle;
      
      // Define a radius slightly larger than the text radius for arrows
      const arrowPathRadius = textRadius + 10; // Bring arrows closer to text (Keep as is for now)
      
      // Use the angleOffset defined above
      // const angleOffset = Math.PI / 15; // Remove this line, use component-scoped one
      
      // Calculate arrow start and end points on the arrowPathRadius
      const startX = center + arrowPathRadius * Math.cos(startAngle + angleOffset / 2);
      const startY = center + arrowPathRadius * Math.sin(startAngle + angleOffset / 2);
      const endX = center + arrowPathRadius * Math.cos(endAngle - angleOffset / 2);
      const endY = center + arrowPathRadius * Math.sin(endAngle - angleOffset / 2);
      
      // Tangent direction at midpoint
      // Correctly calculate midAngle, handling wrap-around
      let correctedEndAngle = endAngle;
      if (endAngle < startAngle) {
        correctedEndAngle += 2 * Math.PI; // Add 360 degrees if wrapped around
      }
      const midAngle = (startAngle + correctedEndAngle) / 2;
      
      // Define a radius for the control point, larger than arrowPathRadius to force curve outwards
      const controlPointRadius = arrowPathRadius + 30; // Reduce curve intensity slightly
      
      // Calculate control point based on the controlPointRadius and midAngle
      const controlX = center + controlPointRadius * Math.cos(midAngle);
      const controlY = center + controlPointRadius * Math.sin(midAngle);
      
      // SVG path for the curved arrow
      const path = `M ${startX} ${startY} Q ${controlX} ${controlY} ${endX} ${endY}`;
      return { path, startAngle, endAngle };
    });
    
    const imageSize = 100; // Define the size of the center image

    return (
      <div className="relative mx-auto" style={{ width: size, height: size }}>
        {/* SVG for arrows */}
        <svg className="absolute inset-0 w-full h-full" viewBox={`0 0 ${size} ${size}`}>
          {/* Define arrow marker */}
          <defs>
            <marker
              id="arrowhead"
              markerWidth="10"
              markerHeight="7"
              refX="7"
              refY="3.5"
              orient="auto"
              markerUnits="strokeWidth"
            >
              <path d="M0,0 L10,3.5 L0,7 z" fill="#0f766e" />
            </marker>
          </defs>
          
          {/* Draw the circular reference (subtle guide) */}
          <circle cx={center} cy={center} r={arrowRadius} fill="none" stroke="#f0f0f0" strokeWidth="1" />
          
          {/* Draw the curved arrow paths */}
          {arrows.map((arrow, i) => (
            <path
              key={`arrow-${i}`}
              d={arrow.path}
              fill="none"
              stroke="#0f766e"
              strokeWidth="2"
              markerEnd="url(#arrowhead)"
              className="transition-all duration-300 ease-in-out"
            />
          ))}
        </svg>
        
        {/* Text labels */}
        {points.map((point, i) => (
          <div
            key={`text-${point.id}`}
            className={`absolute max-w-[150px] ${point.alignClass} text-sm font-medium text-teal-800 transition-all duration-300 ease-in-out`}
            style={{
              top: point.textY + point.offsetY,
              left: point.textX + point.offsetX,
              transform: 'translate(-50%, -50%)',
            }}
          >
            {point.text}
          </div>
        ))}

        {/* Center Image */} 
        {centerImageUrl && (
          <img
            src={centerImageUrl}
            alt="Flywheel Center"
            // Added rounded-full, object-cover, border, shadow back, kept z-10
            className="absolute rounded-full object-cover border-2 border-gray-200 shadow-md z-10 block"
            style={{
              width: imageSize,
              height: imageSize,
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              opacity: 1,
            }}
          />
        )}
      </div>
    );
  };
  
  return (
    <div className="space-y-6">
      {/* Flywheel selector and Add New button section */}
      <div className="flex flex-wrap items-center gap-2 mb-4 justify-between no-print">
        {/* Flywheel Selector Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {flywheels.map(flywheel => (
            <Button
              key={flywheel.id}
              variant={selectedFlyWheelId === flywheel.id ? "default" : "outline"}
              onClick={() => {
                if (isEditing) {
                  if (window.confirm("Discard unsaved changes?")) {
                    setSelectedFlyWheelId(flywheel.id);
                    cancelEditing();
                  }
                } else {
                  setSelectedFlyWheelId(flywheel.id);
                }
              }}
              className="text-sm"
              disabled={apiLoading}
            >
              {flywheel.name}
            </Button>
          ))}
          
          {isAddingNew && (
            <div className="flex items-center gap-2">
              <Input
                type="text"
                placeholder="Flywheel name"
                value={newFlyWheelName}
                onChange={(e) => setNewFlyWheelName(e.target.value)}
                className="w-48"
                autoFocus
                disabled={apiLoading}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newFlyWheelName.trim() && !apiLoading) {
                    e.preventDefault(); // Prevent potential form submission
                    addNewFlyWheel();
                  }
                }}
              />
              <Button size="sm" onClick={addNewFlyWheel} disabled={apiLoading || !newFlyWheelName.trim()}>
                {apiLoading ? <Loader2 size={16} className="animate-spin"/> : <Check size={16} />}
              </Button>
              <Button size="sm" variant="outline" onClick={() => { setIsAddingNew(false); setLocalError(null); }} disabled={apiLoading}>
                <X size={16} />
              </Button>
            </div>
          )}
        </div>

        {/* Add New Button */}
        {!isAddingNew && flywheels.length > 0 && (
          <Button 
            size="sm" 
            onClick={() => { setIsAddingNew(true); setLocalError(null); }} 
            className="flex items-center gap-1"
            disabled={apiLoading || isEditing}
          >
            <Plus size={16} />
            New Flywheel
          </Button>
        )}
      </div>
      
      {/* Display local error if any occurred during actions */}
      {localError && !isEditing && (
          <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm flex items-center gap-2 no-print">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span>{localError}</span>
          </div>
      )}
      
      {selectedFlyWheel && (
        <Card className="border rounded-lg overflow-hidden">
          <CardHeader className="p-4 flex flex-row items-center justify-between bg-muted/40 print-break-inside-avoid">
            {/* Removed title h3 */}
            {/* Empty div to push buttons to the right */}
            <div></div> 
            <div className="flex items-center gap-2">
              {!isEditing ? (
                <>
                  <Button size="sm" onClick={startEditing} disabled={apiLoading} className="no-print">
                    <Edit size={16} className="mr-1" /> Edit
                  </Button>
                  <Button size="sm" variant="destructive" onClick={deleteFlyWheelHandler} disabled={apiLoading} className="no-print">
                    {apiLoading ? <Loader2 size={16} className="animate-spin mr-1"/> : <X size={16} className="mr-1" />}
                    Delete
                  </Button>
                </>
              ) : (
                <>
                  <Button size="sm" onClick={saveFlyWheel} disabled={apiLoading || !editingName.trim()} className="no-print">
                    {apiLoading ? <Loader2 size={16} className="animate-spin mr-1"/> : <Save size={16} className="mr-1" />}
                    {apiLoading ? "Saving..." : "Save"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={cancelEditing} disabled={apiLoading} className="no-print">
                    Cancel
                  </Button>
                </>
              )}
            </div>
          </CardHeader>
          
          <CardContent className="p-6">
            {/* Display local error during editing */}
            {localError && isEditing && (
                <div className="mb-4 p-3 rounded-md bg-destructive/10 text-destructive text-sm flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    <span>{localError}</span>
                </div>
            )}
            {isEditing ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Flywheel Name</label>
                  <Input
                    type="text"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    placeholder="Enter flywheel name"
                    className="max-w-md"
                    disabled={apiLoading}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Description (Optional)</label>
                  <Input
                    type="text"
                    value={editingDescription}
                    onChange={(e) => setEditingDescription(e.target.value)}
                    placeholder="Enter a short description"
                    className="max-w-md"
                    disabled={apiLoading}
                  />
                </div>
                
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-medium">Flywheel Steps</label>
                    <Button size="sm" onClick={addEdge} className="h-7 text-xs" disabled={apiLoading}>
                      <Plus size={14} className="mr-1" /> Add Step
                    </Button>
                  </div>
                  
                  <div className="space-y-2 max-w-2xl">
                    {editingEdges.map((edge, index) => (
                      <div key={edge.id} className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          {index + 1}
                        </div>
                        <Input
                          type="text"
                          value={edge.text}
                          onChange={(e) => updateEdgeText(edge.id, e.target.value)}
                          placeholder="Enter step description"
                          className="flex-1"
                          disabled={apiLoading}
                        />
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={() => removeEdge(edge.id)}
                          className="h-8 w-8 p-0 flex-shrink-0"
                          disabled={apiLoading}
                        >
                          <X size={14} />
                        </Button>
                      </div>
                    ))}
                    
                    {editingEdges.length === 0 && !apiLoading && (
                      <p className="text-muted-foreground text-sm">
                        No steps added yet. Click "Add Step" to create your flywheel.
                      </p>
                    )}
                  </div>
                </div>

                {/* Image Upload Section */}
                <div>
                  <label className="block text-sm font-medium mb-1">Center Image</label>
                  <div
                    {...getRootProps()}
                    className="flex items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100"
                  >
                    <input {...getInputProps()} />
                    {isDragActive ? (
                      <p className="text-sm text-center text-primary">Drop the image here...</p>
                    ) : (
                      <p className="text-sm text-center text-muted-foreground">
                        {selectedImageFile ? "Click or drag to replace image" : "Click to upload image"}
                      </p>
                    )}
                  </div>
                  {imagePreviewUrl && (
                    <div className="mt-4">
                      <p className="text-sm text-muted-foreground mb-2">Image Preview:</p>
                      <img 
                        src={imagePreviewUrl} 
                        alt="Preview" 
                        className="h-24 w-24 rounded-full object-cover border"
                      />
                    </div>
                  )}
                  {storageError && (
                    <p className="text-sm text-red-500 mt-1">Error uploading image: {storageError.message}</p>
                  )}
                </div>
              </div>
            ) : (
              selectedFlyWheel && 
              <Flywheel 
                edges={selectedFlyWheel.edges} 
                imagePath={selectedFlyWheel.image_path} // Pass image_path instead
              />
            )}
          </CardContent>
        </Card>
      )}
      
      {flywheels.length === 0 && !isAddingNew && !isLoadingInitialData && (
        <div className="flex flex-col items-center justify-center p-8 border border-dashed rounded-lg bg-muted/40">
          <p className="text-muted-foreground mb-4">You don't have any flywheels yet.</p>
          <Button onClick={() => { setIsAddingNew(true); setLocalError(null); }} disabled={apiLoading}>
            <Plus size={16} className="mr-1" /> Create Your First Flywheel
          </Button>
        </div>
      )}
    </div>
  );
};

export default FlyWheelSection; 