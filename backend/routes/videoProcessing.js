// backend/routes/videoProcessing.js
import express from 'express';
import multer from 'multer';
import { Storage } from '@google-cloud/storage';
import { authenticateToken } from '../middleware/auth.js';
import sql from '../database/db.js';
import { sendEmail } from '../utils/emailService.js';
import { validateInterviewLink } from '../models/interviewLinkModel.js';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();

// Configure Google Cloud Storage
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
  
  // Verify bucket access on startup
  bucket.exists().then(([exists]) => {
    if (exists) {
      console.log(`✅ GCS bucket "${bucketName}" is accessible`);
    } else {
      console.error(`❌ GCS bucket "${bucketName}" does not exist`);
    }
  }).catch((error) => {
    console.error(`❌ Failed to verify GCS bucket "${bucketName}":`, error.message);
  });
} catch (error) {
  console.error('Failed to initialize GCS Storage:', error);
}

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB max file size
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only video files are allowed'));
    }
  }
});

// Upload individual video response
router.post('/upload-video', upload.single('video'), async (req, res) => {
  try {
    const { questionId, questionText, questionOrder, candidateName, candidateEmail, token } = req.body;
    
    if (!req.file) {
      return res.status(400).json({ message: 'No video file provided' });
    }

    // Validate the interview link
    const link = await validateInterviewLink(token);
    
    // Generate unique filename
    const timestamp = Date.now();
    const filename = `${candidateEmail}/${token}/${questionOrder}_${questionId}_${timestamp}.webm`;
    
    // Create file reference
    const file = bucket.file(filename);
    
    // Upload to GCS
    const stream = file.createWriteStream({
      metadata: {
        contentType: req.file.mimetype,
        metadata: {
          candidateName,
          candidateEmail,
          questionId,
          questionText,
          questionOrder,
          interviewToken: token,
          uploadedAt: new Date().toISOString()
        }
      },
      resumable: false
    });

    stream.on('error', (err) => {
      console.error('GCS upload error:', err);
      let errorMessage = 'Failed to upload video to storage';
      
      if (err.code === 403) {
        errorMessage = `Access denied to bucket "${bucketName}". Check service account permissions.`;
      } else if (err.code === 404) {
        errorMessage = `Bucket "${bucketName}" not found. Please create it in GCP.`;
      } else if (err.message) {
        errorMessage = `Upload failed: ${err.message}`;
      }
      
      console.error(`❌ ${errorMessage}`);
      res.status(500).json({ message: errorMessage });
    });

    stream.on('finish', async () => {
      try {
        // Make the file publicly accessible (optional)
        // await file.makePublic();
        
        // Get signed URL for private access (valid for 7 days)
        const [url] = await file.getSignedUrl({
          action: 'read',
          expires: Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 days
        });

        // Store video metadata in database
        await sql`
          INSERT INTO interview_responses (
            interview_link_id,
            question_id,
            video_url,
            video_filename,
            question_order,
            uploaded_at
          )
          VALUES (
            (SELECT id FROM interview_links WHERE unique_token = ${token}),
            ${questionId},
            ${url},
            ${filename},
            ${questionOrder},
            NOW()
          )
        `;

        res.json({
          message: 'Video uploaded successfully',
          filename,
          url
        });
      } catch (dbError) {
        console.error('Database error:', dbError);
        res.status(500).json({ message: 'Video uploaded but failed to save metadata' });
      }
    });

    stream.end(req.file.buffer);
  } catch (error) {
    console.error('Upload video error:', error);
    
    if (error.message.includes('Invalid') || error.message.includes('expired')) {
      return res.status(400).json({ message: error.message });
    }
    
    res.status(500).json({ message: 'Failed to upload video' });
  }
});

// Process and stitch videos for a completed interview
router.post('/process-interview/:token', async (req, res) => {
  try {
    const { token } = req.params;
    
    // Validate link
    const link = await validateInterviewLink(token);
    
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
      WHERE il.unique_token = ${token}
      ORDER BY ir.question_order ASC
    `;

    if (responses.length === 0) {
      return res.status(404).json({ message: 'No video responses found' });
    }

    // Here you would implement video stitching logic
    // This typically involves:
    // 1. Downloading all videos from GCS
    // 2. Using FFmpeg or similar to add question overlays
    // 3. Stitching videos together
    // 4. Uploading final video back to GCS
    // 5. Sending email notifications

    // For now, we'll return the list of videos
    res.json({
      message: 'Interview processing initiated',
      responses: responses.map(r => ({
        questionOrder: r.question_order,
        questionText: r.question_text,
        videoUrl: r.video_url,
        uploadedAt: r.uploaded_at
      })),
      candidateEmail: responses[0].candidate_email,
      roleTitle: responses[0].role_title
    });
  } catch (error) {
    console.error('Process interview error:', error);
    res.status(500).json({ message: 'Failed to process interview' });
  }
});

// Get interview responses for a role (interviewer view)
router.get('/responses/role/:roleId', authenticateToken, async (req, res) => {
  try {
    const { roleId } = req.params;
    
    const responses = await sql`
      SELECT 
        il.candidate_email,
        il.unique_token,
        il.created_at as invited_at,
        il.used,
        COUNT(ir.id) as response_count,
        MAX(ir.uploaded_at) as last_upload,
        json_agg(
          json_build_object(
            'questionOrder', ir.question_order,
            'questionText', q.question_text,
            'videoUrl', ir.video_url,
            'uploadedAt', ir.uploaded_at
          ) ORDER BY ir.question_order
        ) as responses
      FROM interview_links il
      JOIN interviews i ON il.interview_id = i.id
      LEFT JOIN interview_responses ir ON il.id = ir.interview_link_id
      LEFT JOIN questions q ON ir.question_id = q.id
      WHERE i.role_id = ${roleId} AND il.used = true
      GROUP BY il.id, il.candidate_email, il.unique_token, il.created_at, il.used
      ORDER BY il.created_at DESC
    `;

    res.json({
      message: 'Interview responses retrieved successfully',
      responses
    });
  } catch (error) {
    console.error('Get responses error:', error);
    res.status(500).json({ message: 'Failed to retrieve responses' });
  }
});

// Get specific candidate's interview responses
router.get('/responses/candidate/:token', authenticateToken, async (req, res) => {
  try {
    const { token } = req.params;
    
    const responses = await sql`
      SELECT 
        ir.*,
        q.question_text,
        q.question_order,
        il.candidate_email,
        r.title as role_title
      FROM interview_responses ir
      JOIN interview_links il ON ir.interview_link_id = il.id
      JOIN interviews i ON il.interview_id = i.id
      JOIN questions q ON ir.question_id = q.id
      JOIN roles r ON i.role_id = r.id
      WHERE il.unique_token = ${token}
      ORDER BY ir.question_order ASC
    `;

    if (responses.length === 0) {
      return res.status(404).json({ message: 'No responses found for this interview' });
    }

    res.json({
      message: 'Candidate responses retrieved successfully',
      candidateEmail: responses[0].candidate_email,
      roleTitle: responses[0].role_title,
      responses: responses.map(r => ({
        questionOrder: r.question_order,
        questionText: r.question_text,
        videoUrl: r.video_url,
        uploadedAt: r.uploaded_at
      }))
    });
  } catch (error) {
    console.error('Get candidate responses error:', error);
    res.status(500).json({ message: 'Failed to retrieve candidate responses' });
  }
});

export default router;