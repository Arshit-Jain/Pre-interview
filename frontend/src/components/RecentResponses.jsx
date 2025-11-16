import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
// import './AllResponses.css'; // Removed external CSS import to fix compilation error

/**
 * CSS styles for the component.
 * In a single-file setup, we inject a <style> tag.
 */
const AllResponsesCSS = () => (
  <style>{`
    :root {
      --dark-bg: #1a1a2e;
      --card-bg: #2a2a4e;
      --card-hover: #3a3a5e;
      --primary-color: #4a4a88;
      --text-color: #f0f0f0;
      --text-muted: #a0a0c0;
      --error-color: #ff6b6b;
      --success-color: #50fa7b;
      --border-color: #3a3a5e;
    }

    .all-responses-container {
      background-color: var(--dark-bg);
      color: var(--text-color);
      min-height: 100vh;
      padding: 2rem;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    }

    .responses-page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid var(--border-color);
      padding-bottom: 1rem;
      margin-bottom: 2rem;
    }

    .responses-page-header h1 {
      margin: 0;
      color: #fff;
    }
    
    .responses-page-header p {
      margin: 0.25rem 0 0;
      color: var(--text-muted);
    }

    .header-actions {
      display: flex;
      gap: 1rem;
    }

    .back-button,
    .logout-button,
    .back-to-list-button {
      background-color: var(--primary-color);
      color: var(--text-color);
      border: none;
      padding: 0.75rem 1.25rem;
      border-radius: 8px;
      cursor: pointer;
      font-weight: 600;
      transition: background-color 0.2s ease;
    }

    .back-button:hover,
    .logout-button:hover,
    .back-to-list-button:hover {
      background-color: var(--card-hover);
    }
    
    .logout-button {
      background-color: #c94040;
    }
    
    .logout-button:hover {
      background-color: #e06060;
    }

    .filter-section {
      margin-bottom: 2rem;
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .role-filter-select {
      background-color: var(--card-bg);
      color: var(--text-color);
      border: 1px solid var(--border-color);
      padding: 0.75rem;
      border-radius: 8px;
      font-size: 1rem;
    }

    .error-message {
      background-color: #ff6b6b20;
      color: var(--error-color);
      padding: 1rem;
      border-radius: 8px;
      margin-bottom: 2rem;
      border: 1px solid var(--error-color);
    }
    
    .loading-message {
      text-align: center;
      color: var(--text-muted);
      font-size: 1.2rem;
      padding: 4rem 0;
    }

    .response-detail-view {
      background-color: var(--card-bg);
      padding: 2rem;
      border-radius: 12px;
    }

    .back-to-list-button {
      margin-bottom: 1.5rem;
    }

    .response-detail-header {
      display: flex;
      align-items: center;
      gap: 1rem;
      margin-bottom: 1.5rem;
    }
    
    .response-detail-header h2 {
      margin: 0;
      color: #fff;
    }

    .role-badge {
      background-color: var(--primary-color);
      color: var(--text-color);
      padding: 0.25rem 0.75rem;
      border-radius: 12px;
      font-size: 0.85rem;
      font-weight: 600;
      white-space: nowrap;
    }

    .video-answers-section {
      margin-top: 2rem;
    }
    
    .individual-videos {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 1.5rem;
      margin-top: 1rem;
    }

    .answer-item {
      background-color: var(--dark-bg);
      padding: 1rem;
      border-radius: 8px;
    }
    
    .answer-item h4 {
      margin: 0 0 1rem;
    }

    .answer-video,
    .playlist-video,
    .stitched-video {
      width: 100%;
      max-width: 100%;
      border-radius: 8px;
      background-color: #000;
    }
    
    .no-video {
      background-color: var(--dark-bg);
      color: var(--text-muted);
      display: flex;
      align-items: center;
      justify-content: center;
      height: 200px;
      border-radius: 8px;
      border: 1px dashed var(--border-color);
    }

    .answer-meta {
      font-size: 0.9rem;
      color: var(--text-muted);
      margin-top: 1rem;
      line-height: 1.4;
    }

    .stitched-video-section {
      margin-top: 3rem;
      border-top: 1px solid var(--border-color);
      padding-top: 2rem;
    }
    
    .video-playlist {
      display: flex;
      flex-direction: column;
      gap: 2rem;
    }
    
    .playlist-item {
      background-color: var(--dark-bg);
      padding: 1.5rem;
      border-radius: 8px;
    }
    
    .playlist-item h4 {
      margin: 0 0 1rem;
    }

    .no-answers {
      text-align: center;
      padding: 2rem;
      color: var(--text-muted);
    }

    .responses-list {
      margin-top: 2rem;
    }
    
    .no-responses {
      text-align: center;
      padding: 4rem 0;
      color: var(--text-muted);
      font-size: 1.2rem;
    }
    
    .responses-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 1.5rem;
    }

    .response-card {
      background-color: var(--card-bg);
      padding: 1.5rem;
      border-radius: 12px;
      cursor: pointer;
      transition: background-color 0.2s ease, transform 0.2s ease;
      border: 1px solid var(--border-color);
    }

    .response-card:hover {
      background-color: var(--card-hover);
      transform: translateY(-5px);
    }
    
    .response-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 1rem;
      margin-bottom: 1rem;
    }
    
    .response-header h3 {
      margin: 0;
      word-break: break-all;
    }
    
    .response-info {
      color: var(--text-muted);
    }
    
    .response-email {
      margin: 0 0 1rem;
      color: var(--text-color);
      word-break: break-all;
    }
    
    .response-meta {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.9rem;
    }
    
    .separator {
      color: var(--border-color);
    }
  `}</style>
);

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

    // Fixed: Removed import.meta.env which caused a build error.
    // Hardcoding the fallback URL.
    const backendUrl = 'http://localhost:3000';

    useEffect(() => {
        console.log('[AllResponses] Component mounted/updated', { token });
        fetchRoles();
        if (!token) {
            fetchResponses();
        } else {
            // If we have a token, we're viewing a specific response, so set loading to false
            console.log('[AllResponses] Token present, setting loading to false');
            setLoading(false);
            // Also fetch video answers immediately if token is present
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
        console.log('[AllResponses] fetchVideoAnswers called with token:', interviewToken);
        setLoadingAnswers(true);
        setLoading(false); // Make sure main loading is false when loading video answers
        setStitchedVideoUrl(null);
        setError('');

        try {
            const authToken = localStorage.getItem('token');
            console.log('[AllResponses] Making API request to fetch video answers...');
            const startTime = Date.now();
            
            const response = await axios.get(
                `${backendUrl}/api/interviews/responses/${interviewToken}`,
                {
                    headers: {
                        'Authorization': `Bearer ${authToken}`
                    }
                }
            );

            const endTime = Date.now();
            console.log(`[AllResponses] Video answers API response received in ${endTime - startTime}ms`);
            
            const answers = response.data.video_answers || [];
            const interviewData = response.data.interview;
            console.log(`[AllResponses] Received ${answers.length} video answers`);
            console.log(`[AllResponses] Interview token: ${interviewData?.token}`);
            console.log(`[AllResponses] Answer tokens:`, answers.map(a => a.interview_link_token));
            
            // Filter answers to only include those matching the current interview token
            const filteredAnswers = answers.filter(a => a.interview_link_token === interviewToken);
            console.log(`[AllResponses] Filtered to ${filteredAnswers.length} answers for token ${interviewToken}`);
            console.log('[AllResponses] Filtered answer details:', filteredAnswers.map(a => ({
                id: a.id,
                question_id: a.question_id,
                question_order: a.question_order,
                question_text: a.question_text,
                video_url: a.video_url ? a.video_url.substring(0, 50) + '...' : 'null',
                interview_link_token: a.interview_link_token
            })));
            
            setVideoAnswers(filteredAnswers);
            setSelectedResponse(interviewData);
            console.log('[AllResponses] Video answers and interview data set in state');
            
            // Prepare videos for sequential playback
            console.log('[AllResponses] Preparing videos for sequential playback...');
            await stitchVideos(filteredAnswers);
            console.log('[AllResponses] Videos prepared');
        } catch (err) {
            console.error('[AllResponses] Failed to fetch video answers:', err);
            if (err.response) {
                console.error('[AllResponses] Error response:', err.response.data);
                setError(err.response.data.message || 'Failed to load video answers');
            } else {
                setError('Failed to load video answers');
            }
        } finally {
            setLoadingAnswers(false);
            console.log('[AllResponses] fetchVideoAnswers completed');
        }
    };

    const stitchVideos = async (answers) => {
        console.log('[AllResponses] stitchVideos called with', answers.length, 'answers');
        if (!answers || answers.length === 0) {
            setError('No video answers found');
            return;
        }

        try {
            // Filter and sort answers by question order - only for THIS interview token
            const validAnswers = answers
                .filter(a => a.video_url && a.interview_link_token === (token || selectedResponse?.token))
                .sort((a, b) => a.question_order - b.question_order);
            
            console.log('[AllResponses] Valid answers after filtering:', validAnswers.length);
            
            if (validAnswers.length === 0) {
                setError('No valid video URLs found for this interview');
                return;
            }

            // Create a playlist mode for sequential playback
            // Videos will be displayed in order and can be played sequentially
            setStitchedVideoUrl('playlist'); // Special marker for playlist mode
            console.log('[AllResponses] Playlist mode set');
        } catch (err) {
            console.error('[AllResponses] Error preparing videos:', err);
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

    // Helper function to get MIME type from URL extension
    const getMimeTypeFromUrl = (url) => {
        if (!url) return null;
        try {
            // Use the original URL for extension checking, not the proxied one
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
                    // Fallback based on your error log
                    console.warn(`[AllResponses] Unknown video extension: ${extension}. Defaulting to video/webm`);
                    return 'video/webm'; 
            }
        } catch (e) {
            // If URL parsing fails, fallback to webm based on error
            console.error('[AllResponses] Failed to parse video URL for MIME type:', url, e);
            return 'video/webm';
        }
    };


    if (loading) {
        return (
            <div className="all-responses-container">
                <AllResponsesCSS />
                <div className="loading-message">Loading responses...</div>
            </div>
        );
    }

    return (
        <div className="all-responses-container">
            <AllResponsesCSS />
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
                    ) : error ? (
                        <div className="error-message">{error}</div>
                    ) : videoAnswers.length > 0 ? (
                        <div className="video-answers-section">
                            <h3>Individual Answers ({videoAnswers.length} total)</h3>
                            <div className="individual-videos">
                                {videoAnswers
                                    .filter(a => a.interview_link_token === (token || selectedResponse?.token))
                                    .sort((a, b) => a.question_order - b.question_order)
                                    .map((answer, index) => {
                                        console.log(`[AllResponses] Rendering answer ${index}:`, {
                                            id: answer.id,
                                            question_id: answer.question_id,
                                            question_order: answer.question_order,
                                            video_url: answer.video_url ? answer.video_url.substring(0, 80) : 'null'
                                        });
                                        return (
                                            <div key={`answer-${answer.id}-${answer.question_id}`} className="answer-item">
                                                <h4>Question {answer.question_order}: {answer.question_text}</h4>
                                                {answer.video_url ? (
                                                    <video 
                                                        key={`video-${answer.id}-${answer.question_id}`}
                                                        src={`${backendUrl}/api/interviews/video-proxy?url=${encodeURIComponent(answer.video_url)}`}
                                                        type={getMimeTypeFromUrl(answer.video_url)}
                                                        controls
                                                        className="answer-video"
                                                        preload="metadata"
                                                        onError={(e) => {
                                                            const video = e.target;
                                                            console.error(`[AllResponses] Video load error for question ${answer.question_order}:`, {
                                                                error: e,
                                                                videoSrc: video.src,
                                                                networkState: video.networkState,
                                                                errorCode: video.error?.code,
                                                                errorMessage: video.error?.message,
                                                                originalUrl: answer.video_url
                                                            });
                                                        }}
                                                        onLoadedData={() => {
                                                            console.log(`[AllResponses] Video loaded for question ${answer.question_order}`);
                                                        }}
                                                    />
                                                ) : (
                                                    <div className="no-video">Video URL not available</div>
                                                )}
                                                <p className="answer-meta">
                                                    Duration: {answer.recording_duration ? formatTime(answer.recording_duration) : 'N/A'}
                                                    <br />
                                                    <small style={{ color: 'rgba(255, 255, 255, 0.5)' }}>
                                                        Question ID: {answer.question_id} | Answer ID: {answer.id}
                                                    </small>
                                                </p>
                                            </div>
                                        );
                                    })}
                            </div>

                            <div className="stitched-video-section">
                                <h3>Complete Interview (Sequential Playback)</h3>
                                {stitchedVideoUrl === 'playlist' && videoAnswers.length > 0 ? (
                                    <div className="video-playlist">
                                        {videoAnswers
                                            .filter(a => a.video_url && a.interview_link_token === (token || selectedResponse?.token))
                                            .sort((a, b) => a.question_order - b.question_order)
                                            .map((answer, index, filteredArray) => (
                                                <div key={answer.id} className="playlist-item">
                                                    <h4>Question {answer.question_order}: {answer.question_text}</h4>
                                                    <video 
                                                        src={`${backendUrl}/api/interviews/video-proxy?url=${encodeURIComponent(answer.video_url)}`}
                                                        type={getMimeTypeFromUrl(answer.video_url)}
                                                        controls
                                                        className="playlist-video"
                                                        preload="metadata"
                                                        onEnded={() => {
                                                            if (index < filteredArray.length - 1) {
                                                                const nextVideo = document.querySelector(`.playlist-video[data-index="${index + 1}"]`);
                                                                if (nextVideo) {
                                                                    nextVideo.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                                                    nextVideo.play().catch(err => {
                                                                        console.error('[AllResponses] Auto-play failed:', err);
                                                                    });
                                                                }
                                                            }
                                                        }}
                                                        onError={(e) => {
                                                            const video = e.target;
                                                            console.error('[AllResponses] Playlist video error:', {
                                                                error: e,
                                                                videoSrc: video.src,
                                                                networkState: video.networkState,
                                                                errorCode: video.error?.code,
                                                                errorMessage: video.error?.message
                                                            });
                                                        }}
                                                        data-index={index}
                                                    />
                                                </div>
                                            ))}
                                    </div>
                                ) : stitchedVideoUrl ? (
                                    <video 
                                        src={stitchedVideoUrl}
                                        controls
                                        className="stitched-video"
                                        crossOrigin="anonymous"
                                    />
                                ) : (
                                    <div className="loading-message">Preparing videos...</div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="no-answers">
                            <p>No video answers found for this interview.</p>
                            {error && <p style={{ color: '#ff6b6b', marginTop: '1rem' }}>Error: {error}</p>}
                            <p style={{ marginTop: '1rem', fontSize: '0.9rem', color: 'rgba(255, 255, 255, 0.6)' }}>
                                Token: {token || selectedResponse?.token}
                            </p>
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
    // Ensure seconds is an integer
    const totalSeconds = Math.round(seconds);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export default AllResponses;