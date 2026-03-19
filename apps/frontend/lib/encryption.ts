"use client";

import CryptoJS from 'crypto-js';

/**
 * Encrypts content using AES encryption with the configured key
 * @param content The content to encrypt
 * @returns The encrypted content string
 */
export function encryptContent(content: string): string {
  if (!content) return '';
  
  try {
    // Use environment variable or fallback to hardcoded key
    const key = process.env.NEXT_PUBLIC_EMAIL_CONTENT_ENCRYPTION_KEY || 
                "Eiil3LIJyRjZFdVBLSWfjNuy65kzISW7736R5dnAtEs=";
    
    // Check if already encrypted to prevent double encryption
    if (isContentEncrypted(content)) {
      return content;
    }
    
    const encrypted = CryptoJS.AES.encrypt(content, key).toString();
    return encrypted;
  } catch (error) {
    // Silently fail and return original content
    return content;
  }
}

/**
 * Decrypts AES encrypted content using the configured key
 * @param encryptedContent The encrypted content to decrypt
 * @returns The decrypted content string
 */
export function decryptContent(encryptedContent: string): string {
  if (!encryptedContent) return '';
  
  try {
    // Use environment variable or fallback to hardcoded key
    const key = process.env.NEXT_PUBLIC_EMAIL_CONTENT_ENCRYPTION_KEY || 
                "Eiil3LIJyRjZFdVBLSWfjNuy65kzISW7736R5dnAtEs=";
    
    // Check if actually encrypted before attempting to decrypt
    if (!isContentEncrypted(encryptedContent)) {
      return encryptedContent;
    }
    
    const bytes = CryptoJS.AES.decrypt(encryptedContent, key);
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);
    
    // If decryption result is empty but we had content, there was likely an error
    if (!decrypted && encryptedContent) {
      return encryptedContent;
    }
    
    return decrypted;
  } catch (error) {
    return encryptedContent; // Return encrypted content on error
  }
}

/**
 * Checks if a string appears to be encrypted (as a basic heuristic)
 * @param content The content to check
 * @returns True if the content appears encrypted
 */
export function isContentEncrypted(content: string): boolean {
  // Basic heuristic - encrypted content will be a Base64 string
  if (!content) return false;
  
  // CryptoJS AES encryption typically starts with "U2FsdGVk" (Base64 for "Salted")
  if (content.startsWith('U2FsdGVk')) {
    return true;
  }
  
  // Fallback to more generic check
  const base64Regex = /^[A-Za-z0-9+/=]+$/;
  return base64Regex.test(content) && content.length > 30;
} 