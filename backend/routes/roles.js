import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { createRole, getRolesByInterviewer, getAllRoles } from '../models/roleModel.js';
import { findInterviewerByEmail } from '../models/interviewerModel.js';

const router = express.Router();

// Create a new role (protected endpoint)
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { id, interviewer_id, title } = req.body;

    // Validation
    if (!interviewer_id || !title) {
      return res.status(400).json({ 
        message: 'interviewer_id and title are required' 
      });
    }

    if (typeof interviewer_id !== 'number' && !Number.isInteger(Number(interviewer_id))) {
      return res.status(400).json({ 
        message: 'interviewer_id must be a valid integer' 
      });
    }

    // Validate optional ID if provided
    if (id !== undefined && id !== null) {
      if (typeof id !== 'number' && !Number.isInteger(Number(id))) {
        return res.status(400).json({ 
          message: 'id must be a valid integer' 
        });
      }
      if (Number(id) <= 0) {
        return res.status(400).json({ 
          message: 'id must be a positive integer' 
        });
      }
    }

    if (typeof title !== 'string' || title.trim().length === 0) {
      return res.status(400).json({ 
        message: 'title must be a non-empty string' 
      });
    }

    if (title.length > 150) {
      return res.status(400).json({ 
        message: 'title must be 150 characters or less' 
      });
    }

    // Create the role
    console.log('Received request with id:', id, 'type:', typeof id);
    const role = await createRole({
      id: id !== undefined && id !== null ? Number(id) : undefined,
      interviewer_id: Number(interviewer_id),
      title: title.trim()
    });
    console.log('Created role:', role);

    res.status(201).json({
      message: 'Role created successfully',
      role
    });
  } catch (error) {
    console.error('Create role error:', error);
    
    if (error.message === 'Interviewer not found') {
      return res.status(404).json({ message: error.message });
    }
    
    if (error.message === 'Role ID already exists') {
      return res.status(409).json({ message: error.message });
    }
    
    res.status(500).json({ 
      message: error.message || 'Server error during role creation' 
    });
  }
});

// Get all roles for a specific interviewer (protected endpoint)
router.get('/interviewer/:interviewer_id', authenticateToken, async (req, res) => {
  try {
    const { interviewer_id } = req.params;

    if (!Number.isInteger(Number(interviewer_id))) {
      return res.status(400).json({ 
        message: 'Invalid interviewer_id' 
      });
    }

    const roles = await getRolesByInterviewer(Number(interviewer_id));

    res.json({
      message: 'Roles retrieved successfully',
      roles
    });
  } catch (error) {
    console.error('Get roles error:', error);
    res.status(500).json({ 
      message: error.message || 'Server error retrieving roles' 
    });
  }
});

// Get all roles (protected endpoint)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const roles = await getAllRoles();

    res.json({
      message: 'Roles retrieved successfully',
      roles
    });
  } catch (error) {
    console.error('Get all roles error:', error);
    res.status(500).json({ 
      message: error.message || 'Server error retrieving roles' 
    });
  }
});

// Get current user's interviewer info (protected endpoint)
router.get('/my-interviewer', authenticateToken, async (req, res) => {
  try {
    const userEmail = req.user?.email;
    
    if (!userEmail) {
      return res.status(400).json({ 
        message: 'User email not found in token' 
      });
    }

    const interviewer = await findInterviewerByEmail(userEmail);
    
    if (!interviewer) {
      return res.status(404).json({ 
        message: 'Interviewer not found for this user' 
      });
    }

    res.json({
      message: 'Interviewer retrieved successfully',
      interviewer: {
        id: interviewer.id,
        name: interviewer.name,
        email: interviewer.email
      }
    });
  } catch (error) {
    console.error('Get interviewer error:', error);
    res.status(500).json({ 
      message: error.message || 'Server error retrieving interviewer' 
    });
  }
});

export default router;

