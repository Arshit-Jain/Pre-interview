import { useState, useEffect } from 'react';
import axios from 'axios';
import './InterviewResponses.css';

const InterviewResponses = ({ roleId, roleTitle, onClose }) => {
    const [responses, setResponses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [selectedCandidate, setSelectedCandidate] = useState(null);
    const [currentVideoIndex, setCurrentVideoIndex] = useState(0);

    const backendUrl = import.meta.env.BACKEND_URL;

    useEffect(() => {
        if (roleId) {
            fetchResponses();
        }
    }, [roleId]);

    const fetchResponses = async () => {
        setLoading(true);
        setError('');

        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(
                `${backendUrl}/api/interviews/responses/role/${roleId}`,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                }
            );

            setResponses(response.data.responses || []);
        } catch (err) {
            if (err.response) {
                setError(err.response.data.message || 'Failed to load responses');
            } else {
                setError('Failed to load responses');
            }
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getStatusBadge = (status) => {
        const badges = {
            pending: { text: 'Pending', class: 'status-pending' },
            processing: { text: 'Processing', class: 'status-processing' },
            completed: { text: 'Completed', class: 'status-completed' },
            failed: { text: 'Failed', class: 'status-failed' }
        };
        return badges[status] || badges.pending;
    };

    const handleViewCandidate = (candidate) => {
        setSelectedCandidate(candidate);
        setCurrentVideoIndex(0);
    };

    const handleNextVideo = () => {
        if (selectedCandidate && currentVideoIndex < selectedCandidate.responses.length - 1) {
            setCurrentVideoIndex(prev => prev + 1);
        }
    };

    const handlePrevVideo = () => {
        if (currentVideoIndex > 0) {
            setCurrentVideoIndex(prev => prev - 1);
        }
    };

    if (loading) {
        return (
            <div className="responses-overlay" onClick={onClose}>
                <div className="responses-modal" onClick={(e) => e.stopPropagation()}>
                    <div className="loading">Loading interview responses...</div>
                </div>
            </div>
        );
    }

    // Video player view for selected candidate
    if (selectedCandidate) {
        const currentVideo = selectedCandidate.responses?.[currentVideoIndex];
        const hasMultipleVideos = selectedCandidate.responses?.length > 1;

        return (
            <div className="responses-overlay" onClick={() => setSelectedCandidate(null)}>
                <div className="responses-modal large" onClick={(e) => e.stopPropagation()}>
                    <div className="responses-header">
                        <div>
                            <h2>{selectedCandidate.candidate_email}</h2>
                            <p className="subtitle">{roleTitle}</p>
                        </div>
                        <button className="close-button" onClick={() => setSelectedCandidate(null)}>×</button>
                    </div>

                    <div className="video-player-container">
                        {selectedCandidate.final_video_url ? (
                            // Show final stitched video
                            <div className="final-video-section">
                                <div className="video-header">
                                    <h3>Complete Interview Recording</h3>
                                    <span className="status-badge status-completed">Processed</span>
                                </div>
                                <video 
                                    controls 
                                    className="interview-video"
                                    src={selectedCandidate.final_video_url}
                                >
                                    Your browser does not support the video tag.
                                </video>
                                <div className="video-info">
                                    <p>This is the complete interview with all questions and answers stitched together.</p>
                                </div>
                            </div>
                        ) : selectedCandidate.videos_processed === false && selectedCandidate.processing_status === 'processing' ? (
                            // Show processing status
                            <div className="processing-message">
                                <div className="loading-spinner"></div>
                                <h3>Processing Interview...</h3>
                                <p>The videos are being stitched together. This may take a few minutes.</p>
                                <p className="help-text">Refresh this page in a moment to see the final video.</p>
                            </div>
                        ) : currentVideo ? (
                            // Show individual videos with navigation
                            <div className="individual-videos-section">
                                <div className="video-header">
                                    <div>
                                        <h3>Question {currentVideoIndex + 1} of {selectedCandidate.responses.length}</h3>
                                        <p className="question-text">{currentVideo.questionText}</p>
                                    </div>
                                    {hasMultipleVideos && (
                                        <div className="video-navigation">
                                            <button 
                                                onClick={handlePrevVideo}
                                                disabled={currentVideoIndex === 0}
                                                className="nav-btn"
                                            >
                                                ← Previous
                                            </button>
                                            <span className="video-counter">
                                                {currentVideoIndex + 1} / {selectedCandidate.responses.length}
                                            </span>
                                            <button 
                                                onClick={handleNextVideo}
                                                disabled={currentVideoIndex === selectedCandidate.responses.length - 1}
                                                className="nav-btn"
                                            >
                                                Next →
                                            </button>
                                        </div>
                                    )}
                                </div>
                                <video 
                                    key={currentVideo.videoUrl}
                                    controls 
                                    className="interview-video"
                                    src={currentVideo.videoUrl}
                                >
                                    Your browser does not support the video tag.
                                </video>
                                <div className="video-metadata">
                                    <span>Uploaded: {formatDate(currentVideo.uploadedAt)}</span>
                                </div>
                            </div>
                        ) : (
                            <div className="no-videos-message">
                                <p>No video responses available yet.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // List view of all candidates
    return (
        <div className="responses-overlay" onClick={onClose}>
            <div className="responses-modal" onClick={(e) => e.stopPropagation()}>
                <div className="responses-header">
                    <div>
                        <h2>Interview Responses</h2>
                        <p className="subtitle">{roleTitle}</p>
                    </div>
                    <button className="close-button" onClick={onClose}>×</button>
                </div>

                {error && <div className="error-message">{error}</div>}

                <div className="responses-content">
                    {responses.length === 0 ? (
                        <div className="empty-state">
                            <p>No completed interviews yet.</p>
                            <p className="help-text">Candidates who complete their interviews will appear here.</p>
                        </div>
                    ) : (
                        <div className="responses-list">
                            {responses.map((candidate) => (
                                <div 
                                    key={candidate.unique_token} 
                                    className="response-card"
                                    onClick={() => handleViewCandidate(candidate)}
                                >
                                    <div className="response-header">
                                        <div className="candidate-info">
                                            <h3>{candidate.candidate_email}</h3>
                                            <p className="date-info">
                                                Invited: {formatDate(candidate.invited_at)}
                                            </p>
                                            {candidate.last_upload && (
                                                <p className="date-info">
                                                    Completed: {formatDate(candidate.last_upload)}
                                                </p>
                                            )}
                                        </div>
                                        <div className="response-status">
                                            <span className={`status-badge ${getStatusBadge(candidate.processing_status).class}`}>
                                                {getStatusBadge(candidate.processing_status).text}
                                            </span>
                                        </div>
                                    </div>
                                    
                                    <div className="response-details">
                                        <div className="detail-item">
                                            <span className="detail-label">Questions Answered:</span>
                                            <span className="detail-value">{candidate.response_count || 0}</span>
                                        </div>
                                        {candidate.videos_processed && (
                                            <div className="detail-item">
                                                <span className="detail-label">Status:</span>
                                                <span className="detail-value success">✓ Video Ready</span>
                                            </div>
                                        )}
                                    </div>

                                    <div className="response-actions">
                                        <button className="view-btn">
                                            {candidate.final_video_url ? 'View Complete Interview' : 'View Individual Responses'}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default InterviewResponses;