import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import './AllResponses.css';

const AllResponses = () => {
    const navigate = useNavigate();
    const { token } = useParams();
    const [responses, setResponses] = useState([]);
    const [roles, setRoles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [selectedRoleId, setSelectedRoleId] = useState('all');
    const [selectedResponse, setSelectedResponse] = useState(null);
    const [videoAnswers, setVideoAnswers] = useState([]);
    const [loadingAnswers, setLoadingAnswers] = useState(false);
    const [stitchedVideoUrl, setStitchedVideoUrl] = useState(null);
    const [currentPlayingIndex, setCurrentPlayingIndex] = useState(0);

    const backendUrl = import.meta.env.BACKEND_URL || 'http://localhost:3000';

    useEffect(() => {
        console.log('[AllResponses] Component mounted/updated', { token });
        fetchRoles();
        if (!token) {
            fetchResponses();
        } else {
            // If we have a token, we're viewing a specific response, so set loading to false
            console.log('[AllResponses] Token present, setting loading to false');
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (token) {
            console.log('[AllResponses] Token detected, fetching video answers:', token);
            fetchVideoAnswers(token);
        }
    }, [token]);

    useEffect(() => {
        if (!token) {
            fetchResponses();
        }
    }, [selectedRoleId]);

    const fetchRoles = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(
                `${backendUrl}/api/roles/my-interviewer`,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                }
            );

            if (response.data.interviewer?.id) {
                const rolesResponse = await axios.get(
                    `${backendUrl}/api/roles/interviewer/${response.data.interviewer.id}`,
                    {
                        headers: {
                            'Authorization': `Bearer ${token}`
                        }
                    }
                );
                setRoles(rolesResponse.data.roles || []);
            }
        } catch (err) {
            console.error('Failed to fetch roles:', err);
        }
    };

    const fetchResponses = async () => {
        console.log('[AllResponses] Starting to fetch responses...', { selectedRoleId });
        setLoading(true);
        setError('');

        try {
            const token = localStorage.getItem('token');
            const params = selectedRoleId !== 'all' ? { role_id: selectedRoleId } : {};
            console.log('[AllResponses] Making API request with params:', params);
            const startTime = Date.now();
            
            const response = await axios.get(
                `${backendUrl}/api/interviews/responses`,
                {
                    params,
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                }
            );

            const endTime = Date.now();
            console.log(`[AllResponses] API response received in ${endTime - startTime}ms`);
            console.log(`[AllResponses] Received ${response.data.responses?.length || 0} responses`);
            
            setResponses(response.data.responses || []);
            console.log('[AllResponses] Responses set in state');
        } catch (err) {
            console.error('[AllResponses] Error fetching responses:', err);
            if (err.response) {
                setError(err.response.data.message || 'Failed to load responses');
            } else {
                setError('Failed to load responses');
            }
        } finally {
            setLoading(false);
            console.log('[AllResponses] Loading completed');
        }
    };

    const fetchVideoAnswers = async (interviewToken) => {
        setLoadingAnswers(true);
        setStitchedVideoUrl(null);
        setError('');

        try {
            const authToken = localStorage.getItem('token');
            const response = await axios.get(
                `${backendUrl}/api/interviews/responses/${interviewToken}`,
                {
                    headers: {
                        'Authorization': `Bearer ${authToken}`
                    }
                }
            );

            const answers = response.data.video_answers || [];
            setVideoAnswers(answers);
            setSelectedResponse(response.data.interview);
            
            // Prepare videos for sequential playback
            await stitchVideos(answers);
        } catch (err) {
            console.error('Failed to fetch video answers:', err);
            if (err.response) {
                setError(err.response.data.message || 'Failed to load video answers');
            } else {
                setError('Failed to load video answers');
            }
        } finally {
            setLoadingAnswers(false);
        }
    };

    const stitchVideos = async (answers) => {
        if (!answers || answers.length === 0) {
            setError('No video answers found');
            return;
        }

        try {
            // Filter and sort answers by question order
            const validAnswers = answers
                .filter(a => a.video_url)
                .sort((a, b) => a.question_order - b.question_order);
            
            if (validAnswers.length === 0) {
                setError('No valid video URLs found');
                return;
            }

            // For now, we'll create a playlist that plays videos sequentially
            // A full stitching solution would require server-side processing or a more complex client-side approach
            // This creates a simple sequential playback experience
            setStitchedVideoUrl('playlist'); // Special marker for playlist mode
        } catch (err) {
            console.error('Error preparing videos:', err);
            setError('Failed to prepare videos');
        }
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/login');
    };

    if (loading) {
        return (
            <div className="all-responses-container">
                <div className="loading-message">Loading responses...</div>
            </div>
        );
    }

    return (
        <div className="all-responses-container">
            <div className="responses-page-header">
                <div>
                    <h1>All Responses</h1>
                    <p>View and manage candidate interview responses</p>
                </div>
                <div className="header-actions">
                    <button 
                        className="back-button"
                        onClick={() => navigate('/dashboard')}
                    >
                        ← Back to Dashboard
                    </button>
                    <button 
                        className="logout-button"
                        onClick={handleLogout}
                    >
                        Logout
                    </button>
                </div>
            </div>

            <div className="filter-section">
                <label htmlFor="role-filter">Filter by Role:</label>
                <select
                    id="role-filter"
                    value={selectedRoleId}
                    onChange={(e) => setSelectedRoleId(e.target.value)}
                    className="role-filter-select"
                >
                    <option value="all">All Roles</option>
                    {roles.map(role => (
                        <option key={role.id} value={role.id}>
                            {role.title}
                        </option>
                    ))}
                </select>
            </div>

            {error && <div className="error-message">{error}</div>}

            {(selectedResponse || token) ? (
                <div className="response-detail-view">
                    <button 
                        className="back-to-list-button"
                        onClick={() => {
                            setSelectedResponse(null);
                            setVideoAnswers([]);
                            setStitchedVideoUrl(null);
                            setCurrentPlayingIndex(0);
                            navigate('/responses');
                        }}
                    >
                        ← Back to List
                    </button>
                    
                    <div className="response-detail-header">
                        <h2>{selectedResponse?.candidate_email || 'Loading...'}</h2>
                        {selectedResponse?.role_title && (
                            <span className="role-badge">{selectedResponse.role_title}</span>
                        )}
                    </div>

                    {loadingAnswers ? (
                        <div className="loading-message">Loading video answers...</div>
                    ) : videoAnswers.length > 0 ? (
                        <div className="video-answers-section">
                            <h3>Individual Answers</h3>
                            <div className="individual-videos">
                                {videoAnswers.map((answer, index) => (
                                    <div key={answer.id} className="answer-item">
                                        <h4>Question {answer.question_order}: {answer.question_text}</h4>
                                        {answer.video_url && (
                                            <video 
                                                src={answer.video_url}
                                                controls
                                                className="answer-video"
                                            />
                                        )}
                                        <p className="answer-meta">
                                            Duration: {answer.recording_duration ? formatTime(answer.recording_duration) : 'N/A'}
                                        </p>
                                    </div>
                                ))}
                            </div>

                            <div className="stitched-video-section">
                                <h3>Complete Interview (Sequential Playback)</h3>
                                {stitchedVideoUrl === 'playlist' && videoAnswers.length > 0 ? (
                                    <div className="video-playlist">
                                        {videoAnswers
                                            .filter(a => a.video_url)
                                            .sort((a, b) => a.question_order - b.question_order)
                                            .map((answer, index) => (
                                                <div key={answer.id} className="playlist-item">
                                                    <h4>Question {answer.question_order}: {answer.question_text}</h4>
                                                    <video 
                                                        src={answer.video_url}
                                                        controls
                                                        className="playlist-video"
                                                        onEnded={() => {
                                                            if (index < videoAnswers.length - 1) {
                                                                setCurrentPlayingIndex(index + 1);
                                                            }
                                                        }}
                                                        autoPlay={index === currentPlayingIndex && index === 0}
                                                    />
                                                </div>
                                            ))}
                                    </div>
                                ) : stitchedVideoUrl ? (
                                    <video 
                                        src={stitchedVideoUrl}
                                        controls
                                        className="stitched-video"
                                    />
                                ) : (
                                    <div className="loading-message">Preparing videos...</div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="no-answers">No video answers found for this interview.</div>
                    )}
                </div>
            ) : (
                <div className="responses-list">
                    {responses.length === 0 ? (
                        <div className="no-responses">
                            <p>No responses found{selectedRoleId !== 'all' ? ' for this role' : ''}.</p>
                        </div>
                    ) : (
                        <div className="responses-grid">
                            {responses.map((response) => (
                                <div 
                                    key={response.interview_token} 
                                    className="response-card"
                                    onClick={() => navigate(`/responses/${response.interview_token}`)}
                                >
                                    <div className="response-header">
                                        <h3>{response.candidate_name || response.candidate_email}</h3>
                                        <span className="role-badge">{response.role_title}</span>
                                    </div>
                                    <div className="response-info">
                                        <p className="response-email">{response.candidate_email}</p>
                                        <p className="response-meta">
                                            <span>{response.answer_count} answer{response.answer_count !== 1 ? 's' : ''}</span>
                                            <span className="separator">•</span>
                                            <span>{formatDate(response.last_response_at)}</span>
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

const formatTime = (seconds) => {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export default AllResponses;

