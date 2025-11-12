import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import './Interview.css';

const Interview = () => {
    const { token } = useParams();
    const navigate = useNavigate();
    const [linkInfo, setLinkInfo] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    const backendUrl = import.meta.env.BACKEND_URL || 'http://localhost:3000';

    useEffect(() => {
        const validateLink = async () => {
            try {
                const response = await axios.get(
                    `${backendUrl}/api/interviews/link/${token}`
                );
                setLinkInfo(response.data.link);
            } catch (err) {
                if (err.response) {
                    setError(err.response.data.message || 'Invalid or expired interview link');
                } else {
                    setError('Failed to validate interview link');
                }
            } finally {
                setLoading(false);
            }
        };

        if (token) {
            validateLink();
        } else {
            setError('Invalid interview link');
            setLoading(false);
        }
    }, [token, backendUrl]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSubmitting(true);

        if (!name.trim() || !email.trim()) {
            setError('Name and email are required');
            setSubmitting(false);
            return;
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            setError('Please enter a valid email address');
            setSubmitting(false);
            return;
        }

        try {
            await axios.post(
                `${backendUrl}/api/interviews/submit/${token}`,
                {
                    name: name.trim(),
                    email: email.trim()
                },
                {
                    headers: {
                        'Content-Type': 'application/json'
                    }
                }
            );

            setSubmitted(true);
        } catch (err) {
            if (err.response) {
                setError(err.response.data.message || 'Failed to submit interview');
            } else {
                setError('Failed to submit interview. Please try again.');
            }
        } finally {
            setSubmitting(false);
        }
    };

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    if (loading) {
        return (
            <div className="interview-container">
                <div className="interview-card">
                    <div className="loading">Validating interview link...</div>
                </div>
            </div>
        );
    }

    if (error && !linkInfo) {
        return (
            <div className="interview-container">
                <div className="interview-card">
                    <h1>Interview Link Invalid</h1>
                    <div className="error-message">{error}</div>
                    <p className="help-text">
                        This link may have expired or already been used. Please contact the interviewer for a new invitation.
                    </p>
                </div>
            </div>
        );
    }

    if (submitted) {
        return (
            <div className="interview-container">
                <div className="interview-card">
                    <div className="success-icon">✓</div>
                    <h1>Interview Submitted Successfully!</h1>
                    <p>Thank you for participating in the interview.</p>
                    <p className="submitted-info">
                        <strong>Name:</strong> {name}<br />
                        <strong>Email:</strong> {email}
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="interview-container">
            <div className="interview-card">
                <h1>Pre-Recorded Interview</h1>
                
                {linkInfo && (
                    <div className="interview-info">
                        <p><strong>Role:</strong> {linkInfo.role_title}</p>
                        <p><strong>Link Expires:</strong> {formatDate(linkInfo.expires_at)}</p>
                    </div>
                )}

                <div className="instructions">
                    <h2>Welcome!</h2>
                    <p>Please provide your information to begin the interview.</p>
                </div>

                {error && <div className="error-message">{error}</div>}

                <form onSubmit={handleSubmit} className="interview-form">
                    <div className="form-group">
                        <label htmlFor="name">Full Name</label>
                        <input
                            type="text"
                            id="name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Enter your full name"
                            required
                            disabled={submitting}
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="email">Email Address</label>
                        <input
                            type="email"
                            id="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="Enter your email address"
                            required
                            disabled={submitting}
                        />
                        <small>This should match the email address you were invited with</small>
                    </div>

                    <button 
                        type="submit" 
                        className="submit-button"
                        disabled={submitting || !name.trim() || !email.trim()}
                    >
                        {submitting ? 'Submitting...' : 'Start Interview'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default Interview;

