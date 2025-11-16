import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import {
  createQuestion,
  getQuestionsByRole,
  updateQuestion,
  deleteQuestion,
  reorderQuestions
} from '../models/questionModel.js';

const router = express.Router();

// Get all questions for a role (protected endpoint)
router.get('/role/:role_id', authenticateToken, async (req, res) => {
  try {
    const { role_id } = req.params;

    if (!Number.isInteger(Number(role_id))) {
      return res.status(400).json({ 
        message: 'Invalid role_id' 
      });
    }

    const questions = await getQuestionsByRole(Number(role_id));

    res.json({
      message: 'Questions retrieved successfully',
      questions
    });
  } catch (error) {
    console.error('Get questions error:', error);
    res.status(500).json({ 
      message: error.message || 'Server error retrieving questions' 
    });
  }
});

// Create a new question (protected endpoint)
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { role_id, question_text, question_order } = req.body;

    // Validation
    if (!role_id || !question_text || question_order === undefined) {
      return res.status(400).json({ 
        message: 'role_id, question_text, and question_order are required' 
      });
    }

    if (typeof question_order !== 'number' || question_order < 1 || question_order > 10) {
      return res.status(400).json({ 
        message: 'question_order must be a number between 1 and 10' 
      });
    }

    if (typeof question_text !== 'string' || question_text.trim().length === 0) {
      return res.status(400).json({ 
        message: 'question_text must be a non-empty string' 
      });
    }

    // Create the question
    const question = await createQuestion({
      role_id: Number(role_id),
      question_text: question_text.trim(),
      question_order: Number(question_order)
    });

    res.status(201).json({
      message: 'Question created successfully',
      question
    });
  } catch (error) {
    console.error('Create question error:', error);
    
    if (error.message === 'Role not found') {
      return res.status(404).json({ message: error.message });
    }
    
    if (error.message.includes('Maximum')) {
      return res.status(400).json({ message: error.message });
    }
    
    res.status(500).json({ 
      message: error.message || 'Server error during question creation' 
    });
  }
});

// Update a question (protected endpoint)
router.put('/:question_id', authenticateToken, async (req, res) => {
  try {
    const { question_id } = req.params;
    const { question_text } = req.body;

    if (!question_text || typeof question_text !== 'string' || question_text.trim().length === 0) {
      return res.status(400).json({ 
        message: 'question_text must be a non-empty string' 
      });
    }

    const question = await updateQuestion(Number(question_id), question_text);

    res.json({
      message: 'Question updated successfully',
      question
    });
  } catch (error) {
    console.error('Update question error:', error);
    
    if (error.message === 'Question not found') {
      return res.status(404).json({ message: error.message });
    }
    
    res.status(500).json({ 
      message: error.message || 'Server error during question update' 
    });
  }
});

// Delete a question (protected endpoint)
router.delete('/:question_id', authenticateToken, async (req, res) => {
  try {
    const { question_id } = req.params;

    await deleteQuestion(Number(question_id));

    res.json({
      message: 'Question deleted successfully'
    });
  } catch (error) {
    console.error('Delete question error:', error);
    
    if (error.message === 'Question not found') {
      return res.status(404).json({ message: error.message });
    }
    
    res.status(500).json({ 
      message: error.message || 'Server error during question deletion' 
    });
  }
});

// Reorder questions (protected endpoint)
router.put('/role/:role_id/reorder', authenticateToken, async (req, res) => {
  try {
    const { role_id } = req.params;
    const { question_orders } = req.body; // Array of { question_id, question_order }

    if (!Array.isArray(question_orders)) {
      return res.status(400).json({ 
        message: 'question_orders must be an array' 
      });
    }

    // Validate each order
    for (const item of question_orders) {
      if (!item.question_id || item.question_order === undefined) {
        return res.status(400).json({ 
          message: 'Each item must have question_id and question_order' 
        });
      }
      if (item.question_order < 1 || item.question_order > 10) {
        return res.status(400).json({ 
          message: 'question_order must be between 1 and 10' 
        });
      }
    }

    const questions = await reorderQuestions(Number(role_id), question_orders);

    res.json({
      message: 'Questions reordered successfully',
      questions
    });
  } catch (error) {
    console.error('Reorder questions error:', error);
    res.status(500).json({ 
      message: error.message || 'Server error during question reordering' 
    });
  }
});

// Get questions by interview token (public endpoint for candidates)
router.get('/interview/:token', async (req, res) => {
  try {
    const { token } = req.params;

    if (!token) {
      return res.status(400).json({ 
        message: 'Token is required' 
      });
    }

    // First validate the interview link and get role_id (allow used links since we mark as used before fetching questions)
    const { validateInterviewLinkAllowUsed } = await import('../models/interviewLinkModel.js');
    const link = await validateInterviewLinkAllowUsed(token);

    // Get questions for the role
    const questions = await getQuestionsByRole(link.role_id);

    res.json({
      message: 'Questions retrieved successfully',
      questions: questions.sort((a, b) => a.question_order - b.question_order)
    });
  } catch (error) {
    console.error('Get questions by token error:', error);
    
    if (error.message.includes('Invalid') || error.message.includes('expired')) {
      return res.status(400).json({ message: error.message });
    }
    
    res.status(500).json({ 
      message: error.message || 'Server error retrieving questions' 
    });
  }
});

export default router;

