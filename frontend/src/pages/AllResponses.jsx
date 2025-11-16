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
    const [videoBlobUrls, setVideoBlobUrls] = useState({});
    const [stitchedVideoUrl, setStitchedVideoUrl] = useState(null);
    const [stitching, setStitching] = useState(false);

    const backendUrl = import.meta.env.BACKEND_URL || 'http://localhost:3000';

    useEffect(() => {
        console.log('[AllResponses] Component mounted/updated', { token });
        fetchRoles();
        if (!token) {
            fetchResponses();
        } else {
            console.log('[AllResponses] Token present, setting loading to false');
            setLoading(false);
            fetchVideoAnswers(token);
        }
    }, []);

    useEffect(() => {
        if (token) {
            console.log('[AllResponses] Token detected, fetching video answers:', token);
            fetchVideoAnswers(token);
        }
    }, [token]);

    useEffect(() => {
        if (videoAnswers.length > 0) {
            const fetchVideoBlobs = async () => {
                const authToken = localStorage.getItem('token');
                if (!authToken) {
                    setError('Authentication token not found. Cannot load videos.');
                    return;
                }

                const blobUrlMap = {};
                for (const answer of videoAnswers) {
                    if (answer.video_url) {
                        try {
                            const response = await axios.get(
                                `${backendUrl}/api/interviews/video-proxy?url=${encodeURIComponent(answer.video_url)}`,
                                {
                                    headers: {
                                        'Authorization': `Bearer ${authToken}`
                                    },
                                    responseType: 'blob'
                                }
                            );
                            const mimeType = response.headers['content-type'] || getMimeTypeFromUrl(answer.video_url);
                            const blob = new Blob([response.data], { type: mimeType });
                            blobUrlMap[answer.id] = URL.createObjectURL(blob);
                        } catch (err) {
                            console.error(`[AllResponses] Failed to fetch video blob for answer ${answer.id}:`, err);
                            blobUrlMap[answer.id] = null;
                        }
                    }
                }
                setVideoBlobUrls(blobUrlMap);
            };
            fetchVideoBlobs();
        }

        return () => {
            setVideoBlobUrls(prevUrls => {
                Object.values(prevUrls).forEach(url => {
                    if (url) URL.revokeObjectURL(url);
                });
                return {};
            });
        };
    }, [videoAnswers, backendUrl]);

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
            
            const response = await axios.get(
                `${backendUrl}/api/interviews/responses`,
                {
                    params,
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                }
            );
            
            setResponses(response.data.responses || []);
        } catch (err) {
            console.error('[AllResponses] Error fetching responses:', err);
            if (err.response) {
                setError(err.response.data.message || 'Failed to load responses');
            } else {
                setError('Failed to load responses');
            }
        } finally {
            setLoading(false);
        }
    };

    const fetchVideoAnswers = async (interviewToken) => {
        console.log('[AllResponses] fetchVideoAnswers called with token:', interviewToken);
        setLoadingAnswers(true);
        setLoading(false);
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
            const interviewData = response.data.interview;
            
            const filteredAnswers = answers.filter(a => a.interview_link_token === interviewToken);
            
            setVideoAnswers(filteredAnswers);
            setSelectedResponse(interviewData);
        } catch (err) {
            console.error('[AllResponses] Failed to fetch video answers:', err);
            if (err.response) {
                setError(err.response.data.message || 'Failed to load video answers');
            } else {
                setError('Failed to load video answers');
            }
        } finally {
            setLoadingAnswers(false);
        }
    };

    const handleStitchVideos = async () => {
        console.log('[AllResponses] Starting video stitching...');
        setStitching(true);
        setError('');

        try {
            const authToken = localStorage.getItem('token');
            const response = await axios.post(
                `${backendUrl}/api/interviews/stitch-video/${token}`,
                {},
                {
                    headers: {
                        'Authorization': `Bearer ${authToken}`
                    }
                }
            );

            console.log('[AllResponses] Stitched video URL:', response.data.stitched_url);
            setStitchedVideoUrl(response.data.stitched_url);
        } catch (err) {
            console.error('[AllResponses] Failed to stitch videos:', err);
            setError(err.response?.data?.message || 'Failed to stitch videos together');
        } finally {
            setStitching(false);
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

    const getMimeTypeFromUrl = (url) => {
        if (!url) return null;
        try {
            const parsedUrl = new URL(url); 
            const pathname = parsedUrl.pathname;
            const extension = pathname.split('.').pop().toLowerCase();
            
            switch (extension) {
                case 'webm':
                    return 'video/webm';
                case 'mp4':
                    return 'video/mp4';
                case 'ogv':
                    return 'video/ogg';
                default:
                    return 'video/mp4'; 
            }
        } catch (e) {
            return 'video/mp4';
        }
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
                    ) : error ? (
                        <div className="error-message">{error}</div>
                    ) : videoAnswers.length > 0 ? (
                        <div className="video-answers-section">
                            <h3>Individual Answers ({videoAnswers.length} total)</h3>
                            <div className="individual-videos">
                                {videoAnswers
                                    .filter(a => a.interview_link_token === (token || selectedResponse?.token))
                                    .sort((a, b) => a.question_order - b.question_order)
                                    .map((answer) => (
                                        <div key={`answer-${answer.id}-${answer.question_id}`} className="answer-item">
                                            <h4>Question {answer.question_order}: {answer.question_text}</h4>
                                            {answer.video_url ? (
                                                videoBlobUrls[answer.id] === null ? (
                                                    <div className="no-video">Error loading video</div>
                                                ) : videoBlobUrls[answer.id] ? (
                                                    <video 
                                                        key={`video-${answer.id}-${answer.question_id}`}
                                                        src={videoBlobUrls[answer.id]}
                                                        type={getMimeTypeFromUrl(answer.video_url)}
                                                        controls
                                                        className="answer-video"
                                                        preload="metadata"
                                                    />
                                                ) : (
                                                    <div className="no-video">Loading video...</div>
                                                )
                                            ) : (
                                                <div className="no-video">Video URL not available</div>
                                            )}
                                            <p className="answer-meta">
                                                Duration: {answer.recording_duration ? formatTime(answer.recording_duration) : 'N/A'}
                                            </p>
                                        </div>
                                    ))}
                            </div>

                            <div className="stitched-video-section">
                                <h3>Complete Interview (Single Video)</h3>
                                
                                {stitching ? (
                                    <div className="loading-message">
                                        <div className="spinner"></div>
                                        <p>Stitching videos together... This may take a few minutes.</p>
                                    </div>
                                ) : stitchedVideoUrl ? (
                                    <video 
                                        src={stitchedVideoUrl}
                                        controls
                                        className="stitched-video"
                                        crossOrigin="anonymous"
                                    />
                                ) : (
                                    <div className="stitch-prompt">
                                        <p>Click the button below to create a single combined video of all answers.</p>
                                        <button 
                                            className="stitch-button"
                                            onClick={handleStitchVideos}
                                        >
                                            Create Combined Video
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="no-answers">
                            <p>No video answers found for this interview.</p>
                        </div>
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