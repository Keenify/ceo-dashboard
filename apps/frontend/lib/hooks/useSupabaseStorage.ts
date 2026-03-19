"use client";

import { useState } from 'react';
import { supabase } from '@/lib/supabase'; // Assuming supabase client setup here
import { v4 as uuidv4 } from 'uuid'; // For generating unique filenames

export function useSupabaseStorage() {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0); // Optional progress tracking

  /**
   * Uploads a file to the specified Supabase storage bucket.
   * @param file The file object to upload.
   * @param bucketName The name of the Supabase storage bucket.
   * @param filePathPrefix Optional prefix for the file path (e.g., userId). Ends with / if provided.
   * @returns The storage path of the uploaded file, or null if upload fails.
   */
  const uploadFile = async (
    file: File,
    bucketName: string,
    filePathPrefix: string = ''
  ): Promise<string | null> => {
    setLoading(true);
    setError(null);
    setUploadProgress(0);

    try {
      const fileExt = file.name.split('.').pop();
      const uniqueFileName = `${uuidv4()}.${fileExt}`;
      const filePath = `${filePathPrefix}${uniqueFileName}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(filePath, file, {
          cacheControl: '3600', // Optional: Cache control
          upsert: false, // Optional: Don't overwrite existing files
          // Add progress tracking if desired (requires browser support)
          // onProgress: (event) => {
          //   if (event.lengthComputable) {
          //     setUploadProgress(Math.round((event.loaded / event.total) * 100));
          //   }
          // },
        });

      if (uploadError) {
        console.error('Detailed Supabase upload error:', JSON.stringify(uploadError, null, 2));
        throw uploadError;
      }

      setLoading(false);
      return filePath;

    } catch (err) {
      console.error('Detailed error in uploadFile hook:', err instanceof Error ? err.message : JSON.stringify(err, null, 2));
      setError(err instanceof Error ? err : new Error('An unknown error occurred during file upload'));
      setLoading(false);
      setUploadProgress(0);
      return null;
    }
  };

  return {
    uploadFile,
    loading,
    error,
    uploadProgress, // Expose progress if needed by UI
  };
} 