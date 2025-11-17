// backend/utils/videoProcessor.js
import ffmpeg from 'fluent-ffmpeg';
import { Storage } from '@google-cloud/storage';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { promisify } from 'util';
import sql from '../database/db.js';
import { sendEmail } from './emailService.js';

const mkdir = promisify(fs.mkdir);
const unlink = promisify(fs.unlink);
const writeFile = promisify(fs.writeFile);

// Initialize GCS Storage
let storage;
let bucketName;
let bucket;

try {
  storage = new Storage({
    projectId: process.env.GCP_PROJECT_ID,
    keyFilename: process.env.GCP_KEY_FILE
  });

  bucketName = process.env.GCS_BUCKET_NAME || 'interview-videos';
  bucket = storage.bucket(bucketName);
  
  console.log(`GCS initialized with bucket: ${bucketName}`);
} catch (error) {
  console.error('Failed to initialize GCS Storage:', error);
  throw new Error(`GCS initialization failed: ${error.message}`);
}

/**
 * Verify bucket exists and is accessible
 */
async function verifyBucketAccess() {
  try {
    const [exists] = await bucket.exists();
    if (!exists) {
      throw new Error(`Bucket "${bucketName}" does not exist. Please create it in GCP or check the bucket name.`);
    }
    
    // Try to get bucket metadata to verify permissions
    await bucket.getMetadata();
    console.log(`✅ Bucket "${bucketName}" is accessible`);
    return true;
  } catch (error) {
    console.error(`❌ Bucket access error:`, error);
    if (error.code === 403) {
      throw new Error(`Access denied to bucket "${bucketName}". Check service account permissions.`);
    } else if (error.code === 404) {
      throw new Error(`Bucket "${bucketName}" not found. Please create it in GCP.`);
    }
    throw new Error(`Failed to access bucket "${bucketName}": ${error.message}`);
  }
}

/**
 * Download a file from Google Cloud Storage
 */
async function downloadFromGCS(filename, localPath) {
  try {
    const file = bucket.file(filename);
    
    // Check if file exists
    const [exists] = await file.exists();
    if (!exists) {
      throw new Error(`File "${filename}" does not exist in bucket "${bucketName}"`);
    }
    
    await file.download({ destination: localPath });
    console.log(`✅ Downloaded ${filename} to ${localPath}`);
  } catch (error) {
    console.error(`❌ Failed to download ${filename} from GCS:`, error);
    if (error.code === 404) {
      throw new Error(`File "${filename}" not found in bucket "${bucketName}"`);
    } else if (error.code === 403) {
      throw new Error(`Access denied when downloading "${filename}" from bucket "${bucketName}"`);
    }
    throw new Error(`Failed to download file from GCS: ${error.message}`);
  }
}

/**
 * Upload a file to Google Cloud Storage
 */
async function uploadToGCS(localPath, destination) {
  try {
    // Verify local file exists
    if (!fs.existsSync(localPath)) {
      throw new Error(`Local file "${localPath}" does not exist`);
    }
    
    await bucket.upload(localPath, {
      destination,
      metadata: {
        contentType: 'video/mp4'
      }
    });
    
    const file = bucket.file(destination);
    const [url] = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + 365 * 24 * 60 * 60 * 1000 // 1 year
    });
    
    console.log(`✅ Uploaded ${localPath} to ${destination}`);
    return url;
  } catch (error) {
    console.error(`❌ Failed to upload ${localPath} to GCS:`, error);
    if (error.code === 403) {
      throw new Error(`Access denied when uploading to bucket "${bucketName}"`);
    }
    throw new Error(`Failed to upload file to GCS: ${error.message}`);
  }
}

/**
 * Create a text overlay for a video with question information
 */
function addTextOverlay(inputPath, outputPath, questionText, questionNumber) {
  return new Promise((resolve, reject) => {
    // Escape special characters in question text for FFmpeg
    const escapedText = questionText
      .replace(/'/g, "'\\\\\\''")
      .replace(/:/g, '\\:')
      .replace(/\[/g, '\\[')
      .replace(/\]/g, '\\]');

    ffmpeg(inputPath)
      .videoFilters([
        {
          filter: 'drawbox',
          options: {
            x: '0',
            y: 'ih-100',
            width: 'iw',
            height: '100',
            color: 'black@0.7',
            thickness: 'fill'
          }
        },
        {
          filter: 'drawtext',
          options: {
            text: `Q${questionNumber}`,
            fontsize: 24,
            fontcolor: 'white',
            x: '20',
            y: 'h-80',
            fontfile: '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
          }
        },
        {
          filter: 'drawtext',
          options: {
            text: escapedText,
            fontsize: 18,
            fontcolor: 'white',
            x: '20',
            y: 'h-50',
            fontfile: '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
          }
        }
      ])
      .output(outputPath)
      .on('end', () => resolve(outputPath))
      .on('error', reject)
      .run();
  });
}

/**
 * Stitch multiple videos together
 */
function stitchVideos(inputPaths, outputPath) {
  return new Promise((resolve, reject) => {
    const command = ffmpeg();
    
    // Add all input files
    inputPaths.forEach(inputPath => {
      command.input(inputPath);
    });

    // Create filter complex for concatenation
    const filterComplex = inputPaths
      .map((_, i) => `[${i}:v][${i}:a]`)
      .join('') + `concat=n=${inputPaths.length}:v=1:a=1[outv][outa]`;

    command
      .complexFilter(filterComplex)
      .map('[outv]')
      .map('[outa]')
      .output(outputPath)
      .outputOptions([
        '-c:v libx264',
        '-preset medium',
        '-crf 23',
        '-c:a aac',
        '-b:a 128k'
      ])
      .on('end', () => resolve(outputPath))
      .on('error', reject)
      .on('progress', (progress) => {
        console.log(`Processing: ${progress.percent}% done`);
      })
      .run();
  });
}

/**
 * Process a complete interview: download videos, add overlays, stitch together
 */
export async function processInterviewVideos(interviewToken) {
  const tempDir = path.join(os.tmpdir(), `interview_${interviewToken}`);
  
  try {
    // Verify bucket access before processing
    await verifyBucketAccess();
    
    // Create temp directory
    await mkdir(tempDir, { recursive: true });
    
    // Update processing status
    await sql`
      UPDATE interview_links
      SET processing_status = 'processing'
      WHERE unique_token = ${interviewToken}
    `;

    // Get all video responses for this interview
    const responses = await sql`
      SELECT 
        ir.*,
        q.question_text,
        il.candidate_email,
        r.title as role_title
      FROM interview_responses ir
      JOIN interview_links il ON ir.interview_link_id = il.id
      JOIN interviews i ON il.interview_id = i.id
      JOIN questions q ON ir.question_id = q.id
      JOIN roles r ON i.role_id = r.id
      WHERE il.unique_token = ${interviewToken}
      ORDER BY ir.question_order ASC
    `;

    if (responses.length === 0) {
      console.error(`No video responses found for interview token: ${interviewToken}`);
      throw new Error(`No video responses found for this interview. Token: ${interviewToken}`);
    }
    
    console.log(`Found ${responses.length} video response(s) for interview ${interviewToken}`);

    console.log(`Processing ${responses.length} videos for ${responses[0].candidate_email}`);

    const processedVideos = [];
    
    // Process each video: download, add overlay
    for (const response of responses) {
      const originalPath = path.join(tempDir, `original_${response.question_order}.webm`);
      const processedPath = path.join(tempDir, `processed_${response.question_order}.mp4`);
      
      // Download from GCS
      await downloadFromGCS(response.video_filename, originalPath);
      
      // Add text overlay
      await addTextOverlay(
        originalPath,
        processedPath,
        response.question_text,
        response.question_order
      );
      
      processedVideos.push(processedPath);
      
      // Clean up original
      await unlink(originalPath);
    }

    // Stitch all videos together
    const finalVideoPath = path.join(tempDir, 'final_interview.mp4');
    await stitchVideos(processedVideos, finalVideoPath);

    // Upload final video to GCS
    const finalFilename = `${responses[0].candidate_email}/${interviewToken}/final_interview.mp4`;
    const finalUrl = await uploadToGCS(finalVideoPath, finalFilename);

    // Save to database
    const [processedInterview] = await sql`
      INSERT INTO processed_interviews (
        interview_link_id,
        final_video_url,
        final_video_filename
      )
      VALUES (
        (SELECT id FROM interview_links WHERE unique_token = ${interviewToken}),
        ${finalUrl},
        ${finalFilename}
      )
      RETURNING *
    `;

    // Update interview link status
    await sql`
      UPDATE interview_links
      SET videos_processed = true,
          processing_status = 'completed'
      WHERE unique_token = ${interviewToken}
    `;

    // Send email to candidate
    await sendEmailWithVideo(
      responses[0].candidate_email,
      responses[0].role_title,
      finalUrl,
      responses.length
    );

    // Mark email as sent
    await sql`
      UPDATE processed_interviews
      SET email_sent = true,
          email_sent_at = NOW()
      WHERE id = ${processedInterview.id}
    `;

    // Clean up temp files
    for (const videoPath of processedVideos) {
      await unlink(videoPath);
    }
    await unlink(finalVideoPath);

    console.log(`Successfully processed interview for ${responses[0].candidate_email}`);
    
    return {
      success: true,
      finalVideoUrl: finalUrl,
      candidateEmail: responses[0].candidate_email
    };

  } catch (error) {
    console.error('Error processing interview videos:', error);
    
    // Update status to failed
    await sql`
      UPDATE interview_links
      SET processing_status = 'failed'
      WHERE unique_token = ${interviewToken}
    `;
    
    throw error;
  } finally {
    // Clean up temp directory
    try {
      const files = await fs.promises.readdir(tempDir);
      for (const file of files) {
        await unlink(path.join(tempDir, file));
      }
      await fs.promises.rmdir(tempDir);
    } catch (err) {
      console.error('Error cleaning up temp directory:', err);
    }
  }
}

/**
 * Send email to candidate with their interview video
 */
async function sendEmailWithVideo(candidateEmail, roleTitle, videoUrl, questionCount) {
  const subject = `Your Interview Submission - ${roleTitle}`;
  const text = `Dear Candidate,

Thank you for completing your interview for the ${roleTitle} position.

Your interview has been successfully recorded and processed. You answered ${questionCount} question${questionCount > 1 ? 's' : ''}.

You can view your complete interview recording here:
${videoUrl}

This link will remain active for 1 year.

The interviewer will review your responses and get back to you soon.

Best regards,
Interview Team`;

  try {
    await sendEmail(candidateEmail, text, subject);
    console.log(`Confirmation email sent to ${candidateEmail}`);
  } catch (error) {
    console.error(`Failed to send email to ${candidateEmail}:`, error);
    throw error;
  }
}

/**
 * Check if all videos for an interview have been uploaded
 */
async function checkVideosReady(interviewToken, maxWaitTime = 30000, checkInterval = 2000) {
  const startTime = Date.now();
  
  while (Date.now() - startTime < maxWaitTime) {
    const responses = await sql`
      SELECT COUNT(*) as count
      FROM interview_responses ir
      JOIN interview_links il ON ir.interview_link_id = il.id
      WHERE il.unique_token = ${interviewToken}
    `;
    
    const count = Number(responses[0]?.count || 0);
    
    // Get expected number of questions for this interview
    const interviewData = await sql`
      SELECT COUNT(q.id) as question_count
      FROM interview_links il
      JOIN interviews i ON il.interview_id = i.id
      JOIN questions q ON q.role_id = i.role_id
      WHERE il.unique_token = ${interviewToken}
      GROUP BY il.id
    `;
    
    const expectedCount = interviewData.length > 0 ? Number(interviewData[0]?.question_count || 0) : 0;
    
    console.log(`Checking videos for ${interviewToken}: ${count}/${expectedCount} uploaded`);
    
    if (expectedCount > 0 && count >= expectedCount) {
      console.log(`✅ All videos uploaded for interview ${interviewToken}`);
      return true;
    }
    
    // Wait before next check
    await new Promise(resolve => setTimeout(resolve, checkInterval));
  }
  
  // Final check
  const finalCheck = await sql`
    SELECT COUNT(*) as count
    FROM interview_responses ir
    JOIN interview_links il ON ir.interview_link_id = il.id
    WHERE il.unique_token = ${interviewToken}
  `;
  
  const finalCount = Number(finalCheck[0]?.count || 0);
  console.log(`Final video count for ${interviewToken}: ${finalCount}`);
  
  return finalCount > 0;
}

/**
 * Queue an interview for processing (can be used with a job queue in production)
 */
export async function queueInterviewProcessing(interviewToken) {
  // In production, you would add this to a job queue (Bull, BullMQ, etc.)
  // For now, we'll wait for videos to be uploaded before processing
  
  setTimeout(async () => {
    try {
      console.log(`🔄 Starting video processing check for interview: ${interviewToken}`);
      
      // Wait for videos to be uploaded (max 30 seconds, check every 2 seconds)
      const videosReady = await checkVideosReady(interviewToken, 30000, 2000);
      
      if (!videosReady) {
        console.error(`❌ No videos found for interview ${interviewToken} after waiting. Processing will be skipped.`);
        // Update status to indicate no videos were found
        await sql`
          UPDATE interview_links
          SET processing_status = 'failed',
              videos_processed = false
          WHERE unique_token = ${interviewToken}
        `;
        return;
      }
      
      // Process the videos
      await processInterviewVideos(interviewToken);
    } catch (error) {
      console.error(`Failed to process interview ${interviewToken}:`, error);
    }
  }, 2000); // Start checking after 2 seconds to allow uploads to complete
  
  return { message: 'Interview queued for processing' };
}

export default {
  processInterviewVideos,
  queueInterviewProcessing
};