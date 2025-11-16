import { Storage } from '@google-cloud/storage';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

dotenv.config();

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize Google Cloud Storage
let storage;
let bucketName = process.env.GCS_BUCKET_NAME;

try {
  // Try to load credentials from key file first
  if (process.env.GCS_KEY_FILE) {
    const keyPath = process.env.GCS_KEY_FILE.startsWith('./') || process.env.GCS_KEY_FILE.startsWith('/')
      ? process.env.GCS_KEY_FILE
      : join(__dirname, '..', process.env.GCS_KEY_FILE);
    
    try {
      const keyFile = JSON.parse(readFileSync(keyPath, 'utf8'));
      storage = new Storage({
        projectId: process.env.GCS_PROJECT_ID || keyFile.project_id,
        credentials: keyFile,
      });
      console.log('✅ GCS initialized with key file:', keyPath);
    } catch (fileError) {
      console.warn('⚠️  Could not load key file, trying alternative methods...', fileError.message);
      // Fall through to try other methods
    }
  }

  // Try to load from gcs-key.json in backend directory
  if (!storage) {
    try {
      const keyPath = join(__dirname, '..', 'gcs-key.json');
      const keyFile = JSON.parse(readFileSync(keyPath, 'utf8'));
      storage = new Storage({
        projectId: process.env.GCS_PROJECT_ID || keyFile.project_id,
        credentials: keyFile,
      });
      console.log('✅ GCS initialized with gcs-key.json');
    } catch (fileError) {
      console.warn('⚠️  Could not load gcs-key.json, trying environment variable...', fileError.message);
    }
  }

  // Try to use credentials from environment variable
  if (!storage && process.env.GCS_CREDENTIALS) {
    try {
      const credentials = JSON.parse(process.env.GCS_CREDENTIALS);
      storage = new Storage({
        projectId: process.env.GCS_PROJECT_ID || credentials.project_id,
        credentials: credentials,
      });
      console.log('✅ GCS initialized with environment credentials');
    } catch (envError) {
      console.warn('⚠️  Could not parse GCS_CREDENTIALS from environment', envError.message);
    }
  }

  // Try keyFilename as last resort
  if (!storage && process.env.GCS_KEY_FILE) {
    const keyPath = process.env.GCS_KEY_FILE.startsWith('./') || process.env.GCS_KEY_FILE.startsWith('/')
      ? process.env.GCS_KEY_FILE
      : join(__dirname, '..', process.env.GCS_KEY_FILE);
    
    storage = new Storage({
      projectId: process.env.GCS_PROJECT_ID,
      keyFilename: keyPath,
    });
    console.log('✅ GCS initialized with keyFilename:', keyPath);
  }

  // If still no storage, create with just project ID (will use default credentials)
  if (!storage) {
    storage = new Storage({
      projectId: process.env.GCS_PROJECT_ID,
    });
    console.warn('⚠️  GCS initialized with default credentials (may require gcloud auth)');
  }
} catch (error) {
  console.error('❌ Error initializing GCS:', error.message);
  storage = null;
}

if (!bucketName) {
  console.warn('⚠️  GCS_BUCKET_NAME not set. Video uploads will fail.');
}

// Export storage and bucketName for use in other modules
export { storage, bucketName as gcsBucketName };

/**
 * Upload video to Google Cloud Storage
 * @param {Buffer} videoBuffer - Video file buffer
 * @param {string} fileName - Name for the file (e.g., "interview-token-question-id-timestamp.webm")
 * @returns {Promise<string>} Public URL of the uploaded video
 */
export async function uploadVideoToGCS(videoBuffer, fileName) {
  if (!bucketName) {
    throw new Error('GCS_BUCKET_NAME is not configured');
  }

  if (!storage) {
    throw new Error('Google Cloud Storage is not properly initialized. Please check your credentials configuration.');
  }

  try {
    const bucket = storage.bucket(bucketName);
    const file = bucket.file(fileName);

    // Upload the file
    // Note: If uniform bucket-level access is enabled, file-level permissions cannot be set
    // Access will be controlled by bucket-level IAM policies
    await file.save(videoBuffer, {
      metadata: {
        contentType: 'video/webm',
        cacheControl: 'public, max-age=31536000',
      },
    });

    // Try to make the file publicly accessible
    // This will fail if uniform bucket-level access is enabled, but that's okay
    // In that case, configure bucket-level permissions in GCS console
    try {
      await file.makePublic();
      console.log('✅ File made publicly accessible');
    } catch (aclError) {
      // If uniform bucket-level access is enabled, we can't set individual file permissions
      if (aclError.message && aclError.message.includes('uniform bucket-level access')) {
        console.log('ℹ️  Uniform bucket-level access is enabled. File uploaded successfully.');
        console.log('ℹ️  To make files publicly accessible, configure bucket-level permissions in GCS console:');
        console.log(`   https://console.cloud.google.com/storage/browser/${bucketName}`);
        // The file is still uploaded successfully, but access is controlled at bucket level
      } else {
        // Re-throw if it's a different error
        throw aclError;
      }
    }

    // Return the public URL
    // Note: This URL will only work if the bucket or file has public access configured
    const publicUrl = `https://storage.googleapis.com/${bucketName}/${fileName}`;
    
    console.log(`✅ Video uploaded successfully to GCS: ${publicUrl}`);
    return publicUrl;
  } catch (error) {
    console.error('Error uploading video to GCS:', error);
    throw new Error(`Failed to upload video to Google Cloud Storage: ${error.message}`);
  }
}

/**
 * Delete video from Google Cloud Storage
 * @param {string} fileName - Name of the file to delete
 */
export async function deleteVideoFromGCS(fileName) {
  if (!bucketName) {
    throw new Error('GCS_BUCKET_NAME is not configured');
  }

  try {
    const bucket = storage.bucket(bucketName);
    const file = bucket.file(fileName);
    await file.delete();
  } catch (error) {
    console.error('Error deleting video from GCS:', error);
    throw new Error(`Failed to delete video from Google Cloud Storage: ${error.message}`);
  }
}

/**
 * Generate a unique file name for video
 * @param {string} interviewToken - Interview link token
 * @param {number} questionId - Question ID
 * @param {string} candidateEmail - Candidate email
 * @returns {string} Unique file name
 */
export function generateVideoFileName(interviewToken, questionId, candidateEmail) {
  const timestamp = Date.now();
  const emailSlug = candidateEmail.replace(/[^a-zA-Z0-9]/g, '-');
  return `interviews/${interviewToken}/${questionId}-${emailSlug}-${timestamp}.webm`;
}

/**
 * Get a readable stream for a video file from GCS
 * @param {string} fileName - Name/path of the file in GCS
 * @returns {Promise<ReadableStream>} Stream of the video file
 */
export async function getVideoStreamFromGCS(fileName) {
  if (!bucketName) {
    throw new Error('GCS_BUCKET_NAME is not configured');
  }

  if (!storage) {
    throw new Error('Google Cloud Storage is not properly initialized');
  }

  try {
    const bucket = storage.bucket(bucketName);
    const file = bucket.file(fileName);
    
    // Check if file exists
    const [exists] = await file.exists();
    if (!exists) {
      throw new Error('Video file not found in GCS');
    }

    // Return a readable stream
    return file.createReadStream();
  } catch (error) {
    console.error('Error getting video stream from GCS:', error);
    throw new Error(`Failed to get video from Google Cloud Storage: ${error.message}`);
  }
}

/**
 * Extract file name from a GCS URL
 * @param {string} url - Full GCS URL
 * @returns {string} File name/path in bucket
 */
export function extractFileNameFromUrl(url) {
  if (!url) return null;
  
  // Handle URLs like: https://storage.googleapis.com/bucket-name/path/to/file.webm
  const match = url.match(/https?:\/\/storage\.googleapis\.com\/[^\/]+\/(.+)/);
  if (match) {
    return match[1];
  }
  
  // If it's already a path (not a full URL), return as is
  if (!url.startsWith('http')) {
    return url;
  }
  
  return null;
}

