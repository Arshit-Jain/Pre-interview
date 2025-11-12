import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { getOrCreateInterview } from '../models/interviewModel.js';
import { createInterviewLink, validateInterviewLink, markLinkAsUsed, getInterviewLinksByInterview } from '../models/interviewLinkModel.js';
import { createCandidate, getCandidateByEmailAndRole, updateCandidateSubmission } from '../models/candidateModel.js';
import { sendEmail } from '../utils/emailService.js';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// Create interview invitation and send email (protected endpoint)
// Create interview invitation and send email (protected endpoint)
router.post('/invite', authenticateToken, async (req, res) => {
  try {
    // 1. REMOVED 'expires_in_days' from here
    const { role_id, candidate_email } = req.body;

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

    // 2. ALL VALIDATION LOGIC for 'days' is REMOVED
    // 3. 'days' is now HARDCODED to 7
    const days = 7;

    // Get or create interview for this role
    const interview = await getOrCreateInterview(Number(role_id));

    // Create interview link
    const link = await createInterviewLink({
      candidate_email: candidate_email.trim(),
      interview_id: interview.id,
      expires_in_days: days // This will now always be 7
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
      if (err.message.includes('already exists') || err.code === '23505') { // Added err.code
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
      return res.status(440).json({ message: error.message });
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

// Submit interview (when candidate completes it)
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

    // Verify email matches (optional - you might want to allow different emails)
    if (link.candidate_email.toLowerCase() !== email.toLowerCase()) {
      return res.status(400).json({ 
        message: 'Email does not match the invitation email' 
      });
    }

    // Update candidate information
    const candidate = await getCandidateByEmailAndRole(link.role_id, email);
    if (candidate) {
      // Update candidate name if provided
      // Note: You might want to add an update function for candidate name
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

export default router;

