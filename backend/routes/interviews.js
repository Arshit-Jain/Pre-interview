import express from 'express';
import multer from 'multer';
import { authenticateToken } from '../middleware/auth.js';
import { getOrCreateInterview } from '../models/interviewModel.js';
import { createInterviewLink, validateInterviewLink, validateInterviewLinkAllowUsed, markLinkAsUsed, getInterviewLinksByInterview } from '../models/interviewLinkModel.js';
import { createCandidate, getCandidateByEmailAndRole, updateCandidateSubmission } from '../models/candidateModel.js';
import { createVideoAnswer, getVideoAnswersByToken } from '../models/videoAnswerModel.js';
import { sendEmail } from '../utils/emailService.js';
import { uploadVideoToGCS, generateVideoFileName } from '../utils/gcsStorage.js';
import dotenv from 'dotenv';

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
    const fileName = generateVideoFileName(token, question_id, candidate_email);

    // Upload video to Google Cloud Storage
    let videoUrl;
    try {
      videoUrl = await uploadVideoToGCS(req.file.buffer, fileName);
      console.log(`Video uploaded to GCS: ${videoUrl}`);
    } catch (gcsError) {
      console.error('GCS upload error:', gcsError);
      // Fallback: store as base64 if GCS fails (for development)
      if (process.env.NODE_ENV === 'development') {
        const base64Data = req.file.buffer.toString('base64');
        videoUrl = `data:video/webm;base64,${base64Data}`;
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

export default router;