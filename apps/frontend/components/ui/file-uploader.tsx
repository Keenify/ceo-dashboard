import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Database } from '@/lib/database.types';
import { X, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FileUploaderProps {
  onFilesChange: (fileUrls: string[]) => void;
  existingFiles?: string[];
  className?: string;
  bucketName?: string;
  userId?: string;
}

export default function FileUploader({ 
  onFilesChange, 
  existingFiles = [], 
  className, 
  bucketName = 'futureme',
  userId
}: FileUploaderProps) {
  const [uploadedUrls, setUploadedUrls] = useState<string[]>(existingFiles);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const supabase = createClientComponentClient<Database>();

  const getFileName = (url: string) => {
    try {
      return url.split('/').pop() || 'file';
    } catch {
      return 'file';
    }
  };

  const getPathFromUrl = (url: string) => {
    try {
      // Extract the path from the URL (everything after /object/bucketname/)
      const parts = url.split(`/object/${bucketName}/`);
      return parts.length > 1 ? parts[1] : null;
    } catch {
      return null;
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    
    const selectedFiles = Array.from(e.target.files);
    
    // Check for large files
    const oversizedFiles = selectedFiles.filter(file => file.size > 5242880); // 5MB limit
    if (oversizedFiles.length > 0) {
      setError(`Files exceeding 5MB: ${oversizedFiles.map(f => f.name).join(', ')}`);
      return;
    }
    
    // Upload files immediately
    uploadFiles(selectedFiles);
  };

  const removeUploadedFile = async (index: number) => {
    try {
      const urlToRemove = uploadedUrls[index];
      const filePath = getPathFromUrl(urlToRemove);
      
      if (filePath) {
        // Delete from Supabase storage
        await supabase.storage
          .from(bucketName)
          .remove([filePath]);
      }
      
      // Remove from UI regardless of whether deletion succeeded
      const newUrls = [...uploadedUrls];
      newUrls.splice(index, 1);
      setUploadedUrls(newUrls);
      onFilesChange(newUrls);
    } catch (err) {
      // Silently fail - we've already removed it from the UI
    }
  };

  const uploadFiles = async (filesToUpload: File[]) => {
    if (!filesToUpload.length) return;
    
    setUploading(true);
    setError(null);
    
    try {
      const newUrls = [...uploadedUrls];
      let userIdToUse = userId;
      
      if (!userIdToUse) {
        const { data: userData } = await supabase.auth.getUser();
        userIdToUse = userData?.user?.id;
        
        if (!userIdToUse) {
          throw new Error('User not authenticated');
        }
      }

      for (const file of filesToUpload) {
        // Use the original filename with timestamp to prevent collisions
        const fileName = `${Date.now()}_${file.name}`;
        let filePath = `${userIdToUse}/${fileName}`;

        const options = {
          cacheControl: '3600',
          upsert: true,
          contentType: file.type,
        };
        
        const uploadResponse = await supabase.storage
          .from(bucketName)
          .upload(filePath, file, options);
        
        let { data, error: uploadError } = uploadResponse;

        if (uploadError) {
          if (uploadError.message.includes('Permission') || uploadError.message.includes('policy')) {
            const publicFilePath = `public/${fileName}`;
            
            const alternateUploadResponse = await supabase.storage
              .from(bucketName)
              .upload(publicFilePath, file, options);
            
            if (alternateUploadResponse.error) {
              throw new Error(`Upload failed: ${alternateUploadResponse.error.message}`);
            } else {
              data = alternateUploadResponse.data;
              filePath = publicFilePath;
            }
          } else {
            throw new Error(`Upload error: ${uploadError.message}`);
          }
        }

        if (data) {
          const { data: publicUrlData } = supabase.storage
            .from(bucketName)
            .getPublicUrl(filePath);
          
          if (publicUrlData && publicUrlData.publicUrl) {
            newUrls.push(publicUrlData.publicUrl);
          }
        }
      }

      setUploadedUrls(newUrls);
      onFilesChange(newUrls);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error uploading files');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex flex-wrap gap-2">
        {uploadedUrls.map((url, index) => (
          <div key={url} className="relative flex items-center p-2 border rounded group">
            <FileText className="w-4 h-4 mr-2" />
            <span className="text-sm truncate max-w-[180px]">{getFileName(url)}</span>
            <button
              type="button"
              onClick={() => removeUploadedFile(index)}
              className="absolute flex items-center justify-center w-5 h-5 text-red-500 -top-2 -right-2 bg-white rounded-full border border-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label={`Remove file ${getFileName(url)}`}
              title={`Remove ${getFileName(url)}`}
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <div className="relative">
          <input
            type="file"
            id="file-upload"
            multiple
            onChange={handleFileChange}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            aria-label="Choose files for upload"
            title="Choose files for upload"
            disabled={uploading}
          />
          <Button 
            type="button" 
            variant="outline" 
            size="sm"
            disabled={uploading}
          >
            {uploading ? 'Uploading...' : 'Choose Files'}
            {uploading && <span className="ml-2 animate-spin">↻</span>}
          </Button>
        </div>
        
        {uploading && <p className="text-sm text-muted-foreground">Uploading files...</p>}
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
} 