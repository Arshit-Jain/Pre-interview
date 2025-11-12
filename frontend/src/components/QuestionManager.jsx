import { useState, useEffect } from 'react';
import axios from 'axios';
import './QuestionManager.css';

const QuestionManager = ({ roleId, onClose }) => {
    const [questions, setQuestions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [draggedIndex, setDraggedIndex] = useState(null);
    const [editingId, setEditingId] = useState(null);
    const [editText, setEditText] = useState('');

    const backendUrl = import.meta.env.BACKEND_URL || 'http://localhost:3000';

    const fetchQuestions = async () => {
        setLoading(true);
        setError('');

        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(
                `${backendUrl}/api/questions/role/${roleId}`,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                }
            );

            setQuestions(response.data.questions || []);
        } catch (err) {
            if (err.response) {
                setError(err.response.data.message || 'Failed to load questions');
            } else {
                setError('Failed to load questions');
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (roleId) {
            fetchQuestions();
        }
    }, [roleId]);

    const handleAddQuestion = async () => {
        if (questions.length >= 10) {
            setError('Maximum of 10 questions allowed');
            return;
        }

        const newOrder = questions.length + 1;
        const newQuestionText = 'New question';

        try {
            const token = localStorage.getItem('token');
            const response = await axios.post(
                `${backendUrl}/api/questions`,
                {
                    role_id: roleId,
                    question_text: newQuestionText,
                    question_order: newOrder
                },
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    }
                }
            );

            setQuestions(prev => [...prev, response.data.question]);
            setEditingId(response.data.question.id);
            setEditText(newQuestionText);
            setError('');
        } catch (err) {
            if (err.response) {
                setError(err.response.data.message || 'Failed to add question');
            } else {
                setError('Failed to add question');
            }
        }
    };

    // Auto-create first question if none exist
    useEffect(() => {
        if (!loading && questions.length === 0 && roleId) {
            handleAddQuestion();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loading, questions.length, roleId]);

    const handleSaveEdit = async (questionId) => {
        if (!editText.trim()) {
            setError('Question text cannot be empty');
            return;
        }

        try {
            const token = localStorage.getItem('token');
            const response = await axios.put(
                `${backendUrl}/api/questions/${questionId}`,
                { question_text: editText.trim() },
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    }
                }
            );

            setQuestions(questions.map(q => 
                q.id === questionId ? response.data.question : q
            ));
            setEditingId(null);
            setEditText('');
            setError('');
        } catch (err) {
            if (err.response) {
                setError(err.response.data.message || 'Failed to update question');
            } else {
                setError('Failed to update question');
            }
        }
    };

    const handleDeleteQuestion = async (questionId) => {
        const nonEmptyQuestions = questions.filter(q => q.question_text && q.question_text.trim());
        
        if (nonEmptyQuestions.length <= 1 && questions.find(q => q.id === questionId)?.question_text?.trim()) {
            setError('At least one question with text is required');
            return;
        }

        if (!window.confirm('Are you sure you want to delete this question?')) {
            return;
        }

        try {
            const token = localStorage.getItem('token');
            await axios.delete(
                `${backendUrl}/api/questions/${questionId}`,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                }
            );

            const updatedQuestions = questions
                .filter(q => q.id !== questionId)
                .map((q, index) => ({ ...q, question_order: index + 1 }));

            // Reorder remaining questions
            await handleReorder(updatedQuestions);
        } catch (err) {
            if (err.response) {
                setError(err.response.data.message || 'Failed to delete question');
            } else {
                setError('Failed to delete question');
            }
        }
    };

    const handleReorder = async (newQuestions) => {
        try {
            const token = localStorage.getItem('token');
            const question_orders = newQuestions.map((q, index) => ({
                question_id: q.id,
                question_order: index + 1
            }));

            const response = await axios.put(
                `${backendUrl}/api/questions/role/${roleId}/reorder`,
                { question_orders },
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    }
                }
            );

            setQuestions(response.data.questions);
        } catch (err) {
            if (err.response) {
                setError(err.response.data.message || 'Failed to reorder questions');
            } else {
                setError('Failed to reorder questions');
            }
            // Refresh questions on error
            fetchQuestions();
        }
    };

    const handleDragStart = (e, index) => {
        setDraggedIndex(index);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/html', e.target);
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDrop = (e, dropIndex) => {
        e.preventDefault();

        if (draggedIndex === null || draggedIndex === dropIndex) {
            setDraggedIndex(null);
            return;
        }

        const newQuestions = [...questions];
        const draggedQuestion = newQuestions[draggedIndex];
        newQuestions.splice(draggedIndex, 1);
        newQuestions.splice(dropIndex, 0, draggedQuestion);

        setQuestions(newQuestions);
        setDraggedIndex(null);

        // Update order in backend
        handleReorder(newQuestions);
    };

    const handleDragEnd = () => {
        setDraggedIndex(null);
    };

    const startEdit = (question) => {
        setEditingId(question.id);
        setEditText(question.question_text);
    };

    const cancelEdit = () => {
        setEditingId(null);
        setEditText('');
        setError('');
    };

    if (loading) {
        return (
            <div className="question-manager-overlay" onClick={onClose}>
                <div className="question-manager-modal" onClick={(e) => e.stopPropagation()}>
                    <div className="loading">Loading questions...</div>
                </div>
            </div>
        );
    }

    return (
        <div className="question-manager-overlay" onClick={onClose}>
            <div className="question-manager-modal" onClick={(e) => e.stopPropagation()}>
                <div className="question-manager-header">
                    <h2>Manage Questions</h2>
                    <button className="close-button" onClick={onClose}>×</button>
                </div>

                {error && <div className="error-message">{error}</div>}

                <div className="questions-container">
                    {questions.length === 0 ? (
                        <div className="empty-state">
                            <p>No questions yet. Add your first question below.</p>
                        </div>
                    ) : (
                        <div className="questions-list">
                            {questions.map((question, index) => (
                                <div
                                    key={question.id}
                                    className={`question-item ${draggedIndex === index ? 'dragging' : ''}`}
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, index)}
                                    onDragOver={handleDragOver}
                                    onDrop={(e) => handleDrop(e, index)}
                                    onDragEnd={handleDragEnd}
                                >
                                    <div className="drag-handle">☰</div>
                                    <div className="question-content">
                                        {editingId === question.id ? (
                                            <div className="edit-mode">
                                                <textarea
                                                    value={editText}
                                                    onChange={(e) => setEditText(e.target.value)}
                                                    placeholder="Enter question text..."
                                                    rows={3}
                                                    autoFocus
                                                />
                                                <div className="edit-actions">
                                                    <button
                                                        onClick={() => handleSaveEdit(question.id)}
                                                        className="save-btn"
                                                    >
                                                        Save
                                                    </button>
                                                    <button
                                                        onClick={cancelEdit}
                                                        className="cancel-btn"
                                                    >
                                                        Cancel
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="view-mode">
                                                <div className="question-number">{index + 1}.</div>
                                                <div className="question-text">{question.question_text || '(Empty question)'}</div>
                                                <div className="question-actions">
                                                    <button
                                                        onClick={() => startEdit(question)}
                                                        className="edit-btn"
                                                    >
                                                        Edit
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteQuestion(question.id)}
                                                        className="delete-btn"
                                                        disabled={questions.length <= 1}
                                                    >
                                                        Delete
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="add-question-section">
                        {questions.length < 10 ? (
                            <button
                                onClick={handleAddQuestion}
                                className="add-question-btn"
                            >
                                + Add Question
                            </button>
                        ) : (
                            <p className="max-questions">Maximum of 10 questions reached</p>
                        )}
                        <p className="question-count">
                            {questions.length} / 10 questions (minimum 1 required)
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default QuestionManager;

