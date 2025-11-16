import express from 'express';
import multer from 'multer';
import { authenticateToken } from '../middleware/auth.js';
import { getOrCreateInterview } from '../models/interviewModel.js';
import { createInterviewLink, validateInterviewLink, validateInterviewLinkAllowUsed, markLinkAsUsed, getInterviewLinksByInterview, getInterviewLinkByToken } from '../models/interviewLinkModel.js';
import { createCandidate, getCandidateByEmailAndRole, updateCandidateSubmission } from '../models/candidateModel.js';
import { createVideoAnswer, getVideoAnswersByToken, getResponsesByInterviewer, getVideoAnswersForStitching } from '../models/videoAnswerModel.js';
import { sendEmail } from '../utils/emailService.js';
import { uploadVideoToGCS, generateVideoFileName, extractFileNameFromUrl, storage, gcsBucketName } from '../utils/gcsStorage.js';
import dotenv from 'dotenv';
import { getRoleById } from '../models/roleModel.js';
import { findInterviewerByEmail } from '../models/interviewerModel.js';

dotenv.config();

const router = express.Router();
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// Configure multer for video uploads (in memory)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 500 * 1024 * 1024 * 5, // 2.5 GB limit
  },
});

// Create interview invitation and send email (protected endpoint)
router.post('/invite', authenticateToken, async (req, res) => {
  try {
    const { role_id, candidate_email, expires_in_days } = req.body;

    // Validation
    if (!role_id || !candidate_email) {
      return res.status(400).json({
        message: 'role_id and candidate_email are required'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(candidate_email)) {
      return res.status(400).json({
        message: 'Invalid email address format'
      });
    }

    // Validate expires_in_days
    let days = 7; // Default value
    if (expires_in_days !== undefined && expires_in_days !== null) {
      const parsedDays = Number(expires_in_days);
      
      if (isNaN(parsedDays)) {
        return res.status(400).json({
          message: 'expires_in_days must be a valid number'
        });
      }
      
      if (parsedDays < 1 || parsedDays > 30) {
        return res.status(400).json({
          message: 'expires_in_days must be between 1 and 30'
        });
      }
      
      days = parsedDays;
    }

    // Get or create interview for this role
    const interview = await getOrCreateInterview(Number(role_id));

    // Create interview link
    const link = await createInterviewLink({
      candidate_email: candidate_email.trim(),
      interview_id: interview.id,
      expires_in_days: days
    });

    // Create candidate record if it doesn't exist
    let candidate;
    try {
      candidate = await createCandidate({
        role_id: Number(role_id),
        name: candidate_email.split('@')[0], // Default name from email
        email: candidate_email.trim()
      });
    } catch (err) {
      // Candidate might already exist, try to get it
      if (err.message.includes('already exists') || err.code === '23505') {
        candidate = await getCandidateByEmailAndRole(Number(role_id), candidate_email.trim());
      } else {
        throw err;
      }
    }

    // Generate the interview link URL
    const interviewUrl = `${FRONTEND_URL}/interview/${link.unique_token}`;

    // Format expiration date
    const expiresAt = new Date(link.expires_at);
    const formattedDate = expiresAt.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    // Send invitation email
    const emailSubject = `Interview Invitation - Pre-recorded Interview`;
    const emailText = `Hello,

You have been invited to participate in a pre-recorded interview.

Interview Link: ${interviewUrl}

This link will expire on: ${formattedDate}

Please click the link above to access your interview. You will be asked to provide your name and email before starting.

Best regards,
Interview Team`;

    try {
      await sendEmail(candidate_email.trim(), emailText, emailSubject);
    } catch (emailError) {
      console.error('Failed to send email:', emailError);
      // Still return success for the link creation, but note email failure
      return res.status(201).json({
        message: 'Interview link created successfully, but email failed to send',
        link: {
          id: link.id,
          unique_token: link.unique_token,
          interview_url: interviewUrl,
          expires_at: link.expires_at,
          candidate_email: link.candidate_email
        },
        candidate: candidate,
        email_sent: false,
        email_error: emailError.message
      });
    }

    res.status(201).json({
      message: 'Interview invitation sent successfully',
      link: {
        id: link.id,
        unique_token: link.unique_token,
        interview_url: interviewUrl,
        expires_at: link.expires_at,
        candidate_email: link.candidate_email
      },
      candidate: candidate,
      email_sent: true
    });
  } catch (error) {
    console.error('Create interview invitation error:', error);

    if (error.message === 'Role not found') {
      return res.status(404).json({ message: error.message });
    }

    if (error.message.includes('already exists')) {
      return res.status(409).json({ message: error.message });
    }

    res.status(500).json({
      message: error.message || 'Server error during invitation creation'
    });
  }
});

// Get interview link details by token (public endpoint for validation)
router.get('/link/:token', async (req, res) => {
  try {
    const { token } = req.params;

    const link = await validateInterviewLink(token);

    res.json({
      message: 'Interview link is valid',
      link: {
        unique_token: link.unique_token,
        expires_at: link.expires_at,
        used: link.used,
        role_title: link.role_title
      }
    });
  } catch (error) {
    console.error('Get interview link error:', error);
    
    if (error.message.includes('Invalid') || error.message.includes('expired') || error.message.includes('used')) {
      return res.status(400).json({ message: error.message });
    }
    
    res.status(500).json({ 
      message: error.message || 'Server error retrieving interview link' 
    });
  }
});

// Validate candidate info (when form is submitted, but don't mark link as used yet)
router.post('/validate/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const { name, email } = req.body;

    if (!name || !email) {
      return res.status(400).json({ 
        message: 'name and email are required' 
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ 
        message: 'Invalid email address format' 
      });
    }

    // Validate and get the link (but don't mark as used)
    const link = await validateInterviewLink(token);

    // Verify email matches
    if (link.candidate_email.toLowerCase() !== email.toLowerCase()) {
      return res.status(400).json({ 
        message: 'Email does not match the invitation email' 
      });
    }

    // Update candidate information (name)
    const candidate = await getCandidateByEmailAndRole(link.role_id, email);
    if (candidate) {
      // Note: We'll mark as submitted later after camera test
      // For now, just validate
    }

    res.json({
      message: 'Candidate information validated successfully',
      candidate: {
        name: name,
        email: email
      }
    });
  } catch (error) {
    console.error('Validate candidate error:', error);
    
    if (error.message.includes('Invalid') || error.message.includes('expired') || error.message.includes('used')) {
      return res.status(400).json({ message: error.message });
    }
    
    res.status(500).json({ 
      message: error.message || 'Server error validating candidate' 
    });
  }
});

// Mark link as used (after camera test is completed)
router.post('/mark-used/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const { name, email } = req.body;

    if (!name || !email) {
      return res.status(400).json({ 
        message: 'name and email are required' 
      });
    }

    // Validate and get the link
    const link = await validateInterviewLink(token);

    // Verify email matches
    if (link.candidate_email.toLowerCase() !== email.toLowerCase()) {
      return res.status(400).json({ 
        message: 'Email does not match the invitation email' 
      });
    }

    // Update candidate information
    const candidate = await getCandidateByEmailAndRole(link.role_id, email);
    if (candidate) {
      await updateCandidateSubmission(candidate.id, true);
    }

    // Mark link as used
    await markLinkAsUsed(token);

    res.json({
      message: 'Interview link marked as used',
      candidate: {
        name: name,
        email: email
      }
    });
  } catch (error) {
    console.error('Mark link as used error:', error);
    
    if (error.message.includes('Invalid') || error.message.includes('expired') || error.message.includes('used')) {
      return res.status(400).json({ message: error.message });
    }
    
    res.status(500).json({ 
      message: error.message || 'Server error marking link as used' 
    });
  }
});

// Submit interview (when candidate completes it) - kept for backward compatibility
router.post('/submit/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const { name, email } = req.body;

    if (!name || !email) {
      return res.status(400).json({ 
        message: 'name and email are required' 
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ 
        message: 'Invalid email address format' 
      });
    }

    // Validate and get the link
    const link = await validateInterviewLink(token);

    // Verify email matches
    if (link.candidate_email.toLowerCase() !== email.toLowerCase()) {
      return res.status(400).json({ 
        message: 'Email does not match the invitation email' 
      });
    }

    // Update candidate information
    const candidate = await getCandidateByEmailAndRole(link.role_id, email);
    if (candidate) {
      await updateCandidateSubmission(candidate.id, true);
    }

    // Mark link as used
    await markLinkAsUsed(token);

    res.json({
      message: 'Interview submitted successfully',
      candidate: {
        name: name,
        email: email
      }
    });
  } catch (error) {
    console.error('Submit interview error:', error);
    
    if (error.message.includes('Invalid') || error.message.includes('expired') || error.message.includes('used')) {
      return res.status(400).json({ message: error.message });
    }
    
    res.status(500).json({ 
      message: error.message || 'Server error submitting interview' 
    });
  }
});

// Get all interview links for a role (protected endpoint)
router.get('/role/:role_id/links', authenticateToken, async (req, res) => {
  try {
    const { role_id } = req.params;

    const interview = await getOrCreateInterview(Number(role_id));
    const links = await getInterviewLinksByInterview(interview.id);

    res.json({
      message: 'Interview links retrieved successfully',
      links: links.map(link => ({
        id: link.id,
        candidate_email: link.candidate_email,
        candidate_name: link.candidate_name,
        unique_token: link.unique_token,
        interview_url: `${FRONTEND_URL}/interview/${link.unique_token}`,
        expires_at: link.expires_at,
        used: link.used,
        created_at: link.created_at
      }))
    });
  } catch (error) {
    console.error('Get interview links error:', error);
    res.status(500).json({ 
      message: error.message || 'Server error retrieving interview links' 
    });
  }
});

// Save video answer (public endpoint for candidates)
router.post('/video-answer/:token', upload.single('video'), async (req, res) => {
  try {
    const { token } = req.params;
    const { question_id, candidate_email, recording_duration } = req.body;

    if (!question_id || !candidate_email) {
      return res.status(400).json({ 
        message: 'question_id and candidate_email are required' 
      });
    }

    if (!req.file) {
      return res.status(400).json({ 
        message: 'Video file is required' 
      });
    }

    // Validate the interview link (allow used links since we mark as used before questions)
    const link = await validateInterviewLinkAllowUsed(token);

    // Verify email matches
    if (link.candidate_email.toLowerCase() !== candidate_email.toLowerCase()) {
      return res.status(400).json({ 
        message: 'Email does not match the invitation email' 
      });
    }

    // Generate unique file name
    const fileName = generateVideoFileName(token, question_id, candidate_email, 'mp4'); // Ensure video format is MP4 if possible

    // Upload video to Google Cloud Storage
    let videoUrl;
    try {
      videoUrl = await uploadVideoToGCS(req.file.buffer, fileName);
      console.log(`Video uploaded to GCS: ${videoUrl}`);
    } catch (gcsError) {
      console.error('GCS upload error:', gcsError);
      // Fallback: store as base64 if GCS fails (for development)
      if (process.env.NODE_ENV === 'development') {
        // Changed fallback mimeType to video/mp4 for consistency
        const base64Data = req.file.buffer.toString('base64');
        videoUrl = `data:video/mp4;base64,${base64Data}`; 
        console.warn('⚠️  GCS upload failed, storing as base64 (development mode)');
      } else {
        throw new Error('Failed to upload video to storage');
      }
    }

    // Store video answer with GCS URL
    const videoAnswer = await createVideoAnswer({
      interview_link_token: token,
      question_id: Number(question_id),
      candidate_email: candidate_email.trim(),
      video_url: videoUrl,
      recording_duration: recording_duration ? Number(recording_duration) : null
    });

    res.json({
      message: 'Video answer saved successfully',
      video_answer: videoAnswer
    });
  } catch (error) {
    console.error('Save video answer error:', error);
    
    if (error.message.includes('Invalid') || error.message.includes('expired')) {
      return res.status(400).json({ message: error.message });
    }
    
    res.status(500).json({ 
      message: error.message || 'Server error saving video answer' 
    });
  }
});

// Get video answers for an interview (public endpoint for candidates)
router.get('/video-answers/:token', async (req, res) => {
  try {
    const { token } = req.params;

    // Validate the interview link
    await validateInterviewLink(token);

    const videoAnswers = await getVideoAnswersByToken(token);

    res.json({
      message: 'Video answers retrieved successfully',
      video_answers: videoAnswers
    });
  } catch (error) {
    console.error('Get video answers error:', error);
    
    if (error.message.includes('Invalid') || error.message.includes('expired') || error.message.includes('used')) {
      return res.status(400).json({ message: error.message });
    }
    
    res.status(500).json({ 
      message: error.message || 'Server error retrieving video answers' 
    });
  }
});

// Get all responses for an interviewer (protected endpoint)
router.get('/responses', authenticateToken, async (req, res) => {
  const startTime = Date.now();
  console.log('[API /responses] Request received', { 
    role_id: req.query.role_id, 
    limit: req.query.limit,
    userEmail: req.user?.email 
  });

  try {
    const { role_id, limit } = req.query;
    const userEmail = req.user?.email;

    if (!userEmail) {
      console.log('[API /responses] Error: User email not found in token');
      return res.status(400).json({ 
        message: 'User email not found in token' 
      });
    }

    console.log('[API /responses] Fetching interviewer by email...');
    const interviewerStartTime = Date.now();
    // Get interviewer by email
    // const { findInterviewerByEmail } = await import('../models/interviewerModel.js'); // Already imported at top
    const interviewer = await findInterviewerByEmail(userEmail);
    console.log(`[API /responses] Interviewer lookup completed in ${Date.now() - interviewerStartTime}ms`, {
      interviewerFound: !!interviewer,
      interviewerId: interviewer?.id
    });

    if (!interviewer) {
      console.log('[API /responses] Error: Interviewer not found');
      return res.status(404).json({ 
        message: 'Interviewer not found' 
      });
    }

    console.log('[API /responses] Fetching responses from database...', {
      interviewerId: interviewer.id,
      roleId: role_id ? Number(role_id) : null,
      limit: limit ? Number(limit) : null
    });
    const dbStartTime = Date.now();
    
    const responses = await getResponsesByInterviewer(
      interviewer.id,
      role_id ? Number(role_id) : null,
      limit ? Number(limit) : null
    );

    console.log(`[API /responses] Database query completed in ${Date.now() - dbStartTime}ms`, {
      responseCount: responses.length
    });

    const totalTime = Date.now() - startTime;
    console.log(`[API /responses] Total request time: ${totalTime}ms`);

    res.json({
      message: 'Responses retrieved successfully',
      responses
    });
  } catch (error) {
    console.error('[API /responses] Error:', error);
    const totalTime = Date.now() - startTime;
    console.log(`[API /responses] Request failed after ${totalTime}ms`);
    res.status(500).json({ 
      message: error.message || 'Server error retrieving responses' 
    });
  }
});

// Get video answers for a specific interview (for viewing/stitching) - protected endpoint
router.get('/responses/:token', authenticateToken, async (req, res) => {
  const startTime = Date.now();
  console.log('[API /responses/:token] Request received', { 
    token: req.params.token,
    userEmail: req.user?.email 
  });

  try {
    const { token } = req.params;
    const userEmail = req.user?.email;

    if (!userEmail) {
      console.log('[API /responses/:token] Error: User email not found in token');
      return res.status(400).json({ 
        message: 'User email not found in token' 
      });
    }

    console.log('[API /responses/:token] Fetching interviewer by email...');
    const interviewerStartTime = Date.now();
    // Get interviewer by email
    // const { findInterviewerByEmail } = await import('../models/interviewerModel.js'); // Already imported at top
    const interviewer = await findInterviewerByEmail(userEmail);
    console.log(`[API /responses/:token] Interviewer lookup completed in ${Date.now() - interviewerStartTime}ms`, {
      interviewerFound: !!interviewer,
      interviewerId: interviewer?.id
    });

    if (!interviewer) {
      console.log('[API /responses/:token] Error: Interviewer not found');
      return res.status(404).json({ 
        message: 'Interviewer not found' 
      });
    }

    console.log('[API /responses/:token] Fetching interview link by token...');
    const linkStartTime = Date.now();
    // Verify the interview belongs to this interviewer
    // const { getInterviewLinkByToken } = await import('../models/interviewLinkModel.js'); // Already imported at top
    const link = await getInterviewLinkByToken(token);
    console.log(`[API /responses/:token] Link lookup completed in ${Date.now() - linkStartTime}ms`, {
      linkFound: !!link,
      roleId: link?.role_id
    });
    
    if (!link) {
      console.log('[API /responses/:token] Error: Interview not found');
      return res.status(404).json({ 
        message: 'Interview not found' 
      });
    }

    console.log('[API /responses/:token] Fetching role and verifying permissions...');
    const roleStartTime = Date.now();
    // Get role and verify interviewer owns it
    // const { getRoleById } = await import('../models/roleModel.js'); // Already imported at top
    const role = await getRoleById(link.role_id);
    console.log(`[API /responses/:token] Role lookup completed in ${Date.now() - roleStartTime}ms`, {
      roleFound: !!role,
      roleTitle: role?.title,
      roleInterviewerId: role?.interviewer_id,
      currentInterviewerId: interviewer.id
    });
    
    if (!role || role.interviewer_id !== interviewer.id) {
      console.log('[API /responses/:token] Error: Permission denied');
      return res.status(403).json({ 
        message: 'You do not have permission to view this interview' 
      });
    }

    console.log('[API /responses/:token] Fetching video answers...');
    const videoStartTime = Date.now();
    const videoAnswers = await getVideoAnswersForStitching(token);
    console.log(`[API /responses/:token] Video answers fetched in ${Date.now() - videoStartTime}ms`, {
      answerCount: videoAnswers.length
    });

    const totalTime = Date.now() - startTime;
    console.log(`[API /responses/:token] Total request time: ${totalTime}ms`);

    res.json({
      message: 'Video answers retrieved successfully',
      interview: {
        token: token,
        candidate_email: link.candidate_email,
        role_title: role.title,
        role_id: role.id
      },
      video_answers: videoAnswers
    });
  } catch (error) {
    console.error('[API /responses/:token] Error:', error);
    const totalTime = Date.now() - startTime;
    console.log(`[API /responses/:token] Request failed after ${totalTime}ms`);
    
    if (error.message.includes('not found') || error.message.includes('permission')) {
      return res.status(403).json({ message: error.message });
    }
    
    res.status(500).json({ 
      message: error.message || 'Server error retrieving interview responses' 
    });
  }
});

// Proxy endpoint to serve videos from GCS (avoids CORS issues)
router.get('/video-proxy', authenticateToken, async (req, res) => {
  const startTime = Date.now();
  console.log('[Video Proxy] Request received', { url: req.query.url?.substring(0, 100) });
  
  try {
    const { url } = req.query;
    
    if (!url) {
      console.log('[Video Proxy] Error: URL is required');
      return res.status(400).send('Video URL is required');
    }

    const userEmail = req.user?.email;
    if (!userEmail) {
      console.log('[Video Proxy] Error: User email not found');
      return res.status(401).send('Unauthorized');
    }

    console.log('[Video Proxy] Fetching interviewer...');
    const interviewer = await findInterviewerByEmail(userEmail);

    if (!interviewer) {
      console.log('[Video Proxy] Error: Interviewer not found');
      return res.status(404).send('Interviewer not found');
    }

    console.log('[Video Proxy] Extracting file name from URL...');
    // Extract file name from URL
    const fileName = extractFileNameFromUrl(url);
    console.log('[Video Proxy] Extracted file name:', fileName);
    
    if (!fileName) {
      console.log('[Video Proxy] Error: Invalid URL format');
      return res.status(400).send('Invalid video URL format');
    }

    // Verify the video belongs to an interview this interviewer can access
    // Extract interview token from file path (format: interviews/{token}/...)
    const pathMatch = fileName.match(/^interviews\/([^\/]+)\//);
    if (pathMatch) {
      const interviewToken = pathMatch[1];
      console.log('[Video Proxy] Interview token:', interviewToken);
      
      // Verify interviewer has access to this interview
      const link = await getInterviewLinkByToken(interviewToken);
      
      if (link) {
        const role = await getRoleById(link.role_id);
        
        if (!role || role.interviewer_id !== interviewer.id) {
          console.log('[Video Proxy] Error: Permission denied');
          return res.status(403).send('Permission denied');
        }
        console.log('[Video Proxy] Permission verified');
      } else {
        // Log a warning but proceed if the token/link structure is valid, 
        // in case the file exists without a direct link entry (though unlikely).
        console.log('[Video Proxy] Warning: Interview link not found for token, continuing with GCS check...');
      }
    }

    console.log('[Video Proxy] Getting file info from GCS...');
    
    if (!storage || !gcsBucketName) {
      console.log('[Video Proxy] Error: GCS not initialized');
      return res.status(500).send('GCS not configured');
    }
    
    // Get file metadata first to get size
    const bucket = storage.bucket(gcsBucketName);
    const file = bucket.file(fileName);
    
    // Check if file exists and get metadata
    const [exists] = await file.exists();
    if (!exists) {
      console.log('[Video Proxy] Error: File does not exist in GCS');
      return res.status(404).send('Video file not found');
    }

    const [metadata] = await file.getMetadata();
    const fileSize = parseInt(metadata.size);
    console.log('[Video Proxy] File size:', fileSize, 'bytes');

    // Set appropriate headers for video streaming
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'public, max-age=31536000');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    res.setHeader('Access-Control-Allow-Headers', 'Range');

    // Handle range requests for video seeking
    const range = req.headers.range;
    let start = 0;
    let end = fileSize - 1;
    let statusCode = 200;

    if (range) {
      console.log('[Video Proxy] Range request:', range);
      const parts = range.replace(/bytes=/, '').split('-');
      start = parseInt(parts[0], 10);
      end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      
      if (start >= fileSize || end >= fileSize) {
        res.status(416).setHeader('Content-Range', `bytes */${fileSize}`);
        return res.end();
      }

      statusCode = 206; // Partial Content
      res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
      res.setHeader('Content-Length', end - start + 1);
    } else {
      res.setHeader('Content-Length', fileSize);
    }

    // Determine content type from file extension or metadata
    let contentType = metadata.contentType;
    if (!contentType) {
      // Fallback: determine from file extension
      if (fileName.endsWith('.webm')) {
        contentType = 'video/webm';
      } else if (fileName.endsWith('.mp4')) {
        contentType = 'video/mp4';
      } else {
        // Changed default from 'video/webm' to 'video/mp4'
        contentType = 'video/mp4'; 
      }
    }
    res.setHeader('Content-Type', contentType);
    res.status(statusCode);
    
    console.log('[Video Proxy] Headers set:', {
      contentType,
      contentLength: range ? (end - start + 1) : fileSize,
      statusCode,
      hasRange: !!range
    });

    console.log('[Video Proxy] Creating read stream...', { start, end, contentType });
    
    // Create read stream with range if specified
    const videoStream = file.createReadStream({
      start: start,
      end: end
    });

    // Pipe the video stream to the response
    videoStream.on('error', (error) => {
      console.error('[Video Proxy] Stream error:', error);
      // If headers haven't been sent, we can still send a 500 status.
      if (!res.headersSent) {
        res.status(500).send('Error streaming video');
      } else {
        // If headers were sent, just close the stream (the video will fail client-side)
        res.end();
      }
    });

    videoStream.on('end', () => {
      console.log(`[Video Proxy] Stream ended, total time: ${Date.now() - startTime}ms`);
    });

    console.log('[Video Proxy] Piping stream to response...');
    videoStream.pipe(res);
  } catch (error) {
    console.error('[Video Proxy] Fatal Error:', error);
    console.error('[Video Proxy] Error stack:', error.stack);
    
    // Catch-all error block: ensure we never send JSON if the client expects a video stream
    if (!res.headersSent) {
      // Send a plain text status for errors occurring before streaming starts
      res.status(500).send('Internal server error during video proxy setup');
    } else {
      // If a response was partially sent, just terminate it gracefully
      res.end();
    }
  }
});

export default router;