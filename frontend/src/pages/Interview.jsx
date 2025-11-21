import { useState, useEffect, useRef } from 'react';
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
    
    // Form submission state
    const [formSubmitted, setFormSubmitted] = useState(false);
    
    // Camera test state
    const [cameraTestStarted, setCameraTestStarted] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [recordedVideo, setRecordedVideo] = useState(null);
    const [recordingTime, setRecordingTime] = useState(0);
    const [showWarning, setShowWarning] = useState(false);
    
    // Questions state
    const [questions, setQuestions] = useState([]);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [questionTimer, setQuestionTimer] = useState(600);
    const [isQuestionRecording, setIsQuestionRecording] = useState(false);
    const [questionRecordedVideo, setQuestionRecordedVideo] = useState(null);
    const [questionRecordingTime, setQuestionRecordingTime] = useState(0);
    const [savedAnswers, setSavedAnswers] = useState({});
    const [allQuestionsCompleted, setAllQuestionsCompleted] = useState(false);

    const videoRef = useRef(null);
    const testVideoRef = useRef(null);
    const questionVideoRef = useRef(null);
    const mediaRecorderRef = useRef(null);
    const questionMediaRecorderRef = useRef(null);
    const streamRef = useRef(null);
    const questionStreamRef = useRef(null);
    const timerIntervalRef = useRef(null);
    const questionTimerIntervalRef = useRef(null);
    const recordingIntervalRef = useRef(null);
    const questionRecordingIntervalRef = useRef(null);
    const isRecordingRef = useRef(false);
    const isTestRecordingRef = useRef(false);

    const backendUrl = import.meta.env.BACKEND_URL;

    // Define preferred MIME type
    const preferredMimeType = 'video/mp4';
    const fallbackMimeType = 'video/webm';

    const getSupportedMimeType = () => {
        if (MediaRecorder.isTypeSupported(preferredMimeType)) {
            return preferredMimeType;
        }
        return fallbackMimeType;
    };

    const getFileExtension = (mimeType) => {
        return mimeType === preferredMimeType ? 'mp4' : 'webm';
    };

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

    useEffect(() => {
        if (cameraTestStarted && streamRef.current && testVideoRef.current) {
            if (!testVideoRef.current.srcObject || testVideoRef.current.srcObject !== streamRef.current) {
                testVideoRef.current.srcObject = streamRef.current;
                testVideoRef.current.play().catch(err => {
                    console.error('Error playing video:', err);
                });
            }
        }
    }, [cameraTestStarted]);

    useEffect(() => {
        if (questionStreamRef.current && questionVideoRef.current) {
            if (!questionVideoRef.current.srcObject || questionVideoRef.current.srcObject !== questionStreamRef.current) {
                questionVideoRef.current.srcObject = questionStreamRef.current;
                questionVideoRef.current.src = '';
                questionVideoRef.current.play().catch(err => {
                    console.error('Error playing question video:', err);
                });
            }
        }
    }, [currentQuestionIndex, isQuestionRecording]);

    useEffect(() => {
        if (questions.length > 0 && !allQuestionsCompleted && currentQuestionIndex < questions.length) {
            const autoStart = async () => {
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({ 
                        video: { facingMode: 'user' }, 
                        audio: true 
                    });
                    questionStreamRef.current = stream;
                    if (questionVideoRef.current) {
                        questionVideoRef.current.srcObject = stream;
                        questionVideoRef.current.play().catch(err => {
                            console.error('Error playing video:', err);
                        });
                    }

                    setTimeout(() => {
                        if (questionStreamRef.current && !isQuestionRecording && !questionRecordedVideo && questionMediaRecorderRef.current === null) {
                            const mimeType = getSupportedMimeType();
                            const mediaRecorder = new MediaRecorder(questionStreamRef.current, { mimeType });
                            const chunks = [];

                            mediaRecorder.ondataavailable = (e) => {
                                if (e.data.size > 0) {
                                    chunks.push(e.data);
                                }
                            };

                            mediaRecorder.onstop = async () => {
                                const blob = new Blob(chunks, { type: mimeType });
                                setQuestionRecordedVideo(blob);
                                await saveVideoAnswer(blob, questionRecordingTime);
                            };

                            questionMediaRecorderRef.current = mediaRecorder;
                            mediaRecorder.start();
                            setIsQuestionRecording(true);
                            isRecordingRef.current = true;
                            setQuestionRecordingTime(0);

                            const interval = setInterval(() => {
                                setQuestionRecordingTime((prev) => prev + 1);
                            }, 1000);

                            questionRecordingIntervalRef.current = interval;
                        }
                    }, 500);
                } catch (err) {
                    console.error('Failed to auto-start camera:', err);
                    setError('Failed to access camera. Please grant permissions.');
                }
            };

            if (!isQuestionRecording && !questionRecordedVideo && !questionStreamRef.current) {
                autoStart();
            }
        }
    }, [questions.length, currentQuestionIndex, allQuestionsCompleted, isQuestionRecording, questionRecordedVideo]);

    useEffect(() => {
        return () => {
            if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
            if (questionTimerIntervalRef.current) clearInterval(questionTimerIntervalRef.current);
            if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
            if (questionRecordingIntervalRef.current) clearInterval(questionRecordingIntervalRef.current);
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
            }
            if (questionStreamRef.current) {
                questionStreamRef.current.getTracks().forEach(track => track.stop());
            }
        };
    }, []);

    const startCameraTest = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { facingMode: 'user' }, 
                audio: true 
            });
            streamRef.current = stream;
            setCameraTestStarted(true);
            setTimeout(() => {
                if (testVideoRef.current) {
                    testVideoRef.current.srcObject = stream;
                    testVideoRef.current.src = '';
                    testVideoRef.current.controls = false;
                    testVideoRef.current.play().catch(err => {
                        console.error('Error playing video:', err);
                    });
                }
            }, 100);
        } catch (err) {
            setError('Failed to access camera and microphone. Please grant permissions.');
            console.error('Camera access error:', err);
        }
    };

    const startTestRecording = () => {
        if (!streamRef.current) return;

        const mimeType = getSupportedMimeType();
        const mediaRecorder = new MediaRecorder(streamRef.current, { mimeType });
        const chunks = [];

        mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) {
                chunks.push(e.data);
            }
        };

        mediaRecorder.onstop = () => {
            const blob = new Blob(chunks, { type: mimeType });
            const videoUrl = URL.createObjectURL(blob);
            setRecordedVideo(videoUrl);
            
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
            }
            
            if (testVideoRef.current) {
                testVideoRef.current.srcObject = null;
                testVideoRef.current.src = videoUrl;
                testVideoRef.current.controls = true;
                testVideoRef.current.load();
            }
            
            isTestRecordingRef.current = false;
        };

        mediaRecorderRef.current = mediaRecorder;
        mediaRecorder.start();
        setIsRecording(true);
        isTestRecordingRef.current = true;
        setRecordingTime(0);

        const interval = setInterval(() => {
            setRecordingTime((prev) => {
                if (prev >= 29) {
                    clearInterval(interval);
                    stopTestRecording();
                    return 30;
                }
                return prev + 1;
            });
        }, 1000);

        recordingIntervalRef.current = interval;
    };

    const stopTestRecording = () => {
        if (mediaRecorderRef.current && isTestRecordingRef.current) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            isTestRecordingRef.current = false;
            
            if (recordingIntervalRef.current) {
                clearInterval(recordingIntervalRef.current);
            }
            
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
                streamRef.current = null;
            }
        }
    };

    const handleContinueAfterTest = () => {
        if (!recordedVideo) {
            setError('Please record a test video first');
            return;
        }
        setShowWarning(true);
    };

    const handleProceedToQuestions = async () => {
        setShowWarning(false);
        
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }

        try {
            await axios.post(
                `${backendUrl}/api/interviews/mark-used/${token}`,
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
        } catch (err) {
            console.error('Failed to mark link as used:', err);
        }

        try {
            const response = await axios.get(
                `${backendUrl}/api/questions/interview/${token}`
            );
            const fetchedQuestions = response.data.questions || [];
            setQuestions(fetchedQuestions);
            
            if (fetchedQuestions.length > 0) {
                startQuestionTimer();
            }
        } catch (err) {
            setError('Failed to load questions. Please try again.');
            console.error('Load questions error:', err);
        }
    };

    const startQuestionTimer = () => {
        setQuestionTimer(600);
        if (questionTimerIntervalRef.current) {
            clearInterval(questionTimerIntervalRef.current);
        }
        
        questionTimerIntervalRef.current = setInterval(() => {
            setQuestionTimer((prev) => {
                if (prev <= 1) {
                    clearInterval(questionTimerIntervalRef.current);
                    if (isRecordingRef.current && questionMediaRecorderRef.current) {
                        stopQuestionRecording();
                    }
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    };

    const stopQuestionRecording = () => {
        if (questionMediaRecorderRef.current && isRecordingRef.current) {
            questionMediaRecorderRef.current.stop();
            setIsQuestionRecording(false);
            isRecordingRef.current = false;
            if (questionRecordingIntervalRef.current) {
                clearInterval(questionRecordingIntervalRef.current);
            }
            if (questionStreamRef.current) {
                questionStreamRef.current.getTracks().forEach(track => track.stop());
                questionStreamRef.current = null;
            }
        }
    };

    const saveVideoAnswer = async (videoBlob, duration) => {
        const currentQuestion = questions[currentQuestionIndex];
        if (!currentQuestion) return;

        try {
            const mimeType = getSupportedMimeType();
            const extension = getFileExtension(mimeType);
            const fileName = `question-${currentQuestion.id}.${extension}`;

            const formData = new FormData();
            formData.append('video', videoBlob, fileName);
            formData.append('question_id', currentQuestion.id);
            formData.append('candidate_email', email);
            formData.append('recording_duration', duration);

            await axios.post(
                `${backendUrl}/api/interviews/video-answer/${token}`,
                formData,
                {
                    headers: {
                        'Content-Type': 'multipart/form-data'
                    }
                }
            );

            setSavedAnswers({
                ...savedAnswers,
                [currentQuestion.id]: true
            });
        } catch (err) {
            console.error('Save video answer error:', err);
            setError('Failed to save video answer. Please try again.');
        }
    };

    const goToNextQuestion = async () => {
        if (isQuestionRecording) {
            stopQuestionRecording();
        }

        if (questionStreamRef.current) {
            questionStreamRef.current.getTracks().forEach(track => track.stop());
            questionStreamRef.current = null;
        }

        if (questionVideoRef.current) {
            questionVideoRef.current.srcObject = null;
            questionVideoRef.current.src = '';
            questionVideoRef.current.load();
        }

        setQuestionRecordedVideo(null);
        setIsQuestionRecording(false);
        isRecordingRef.current = false;
        setQuestionRecordingTime(0);
        questionMediaRecorderRef.current = null;

        if (currentQuestionIndex < questions.length - 1) {
            setCurrentQuestionIndex(currentQuestionIndex + 1);
            startQuestionTimer();
        } else {
            setAllQuestionsCompleted(true);
            if (questionTimerIntervalRef.current) {
                clearInterval(questionTimerIntervalRef.current);
            }
            if (questionStreamRef.current) {
                questionStreamRef.current.getTracks().forEach(track => track.stop());
                questionStreamRef.current = null;
            }
            
            // Notify backend that interview is finished to send emails
            try {
                await axios.post(`${backendUrl}/api/interviews/finish/${token}`);
            } catch (e) {
                console.error('Failed to send completion notification:', e);
            }
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSubmitting(true);

        if (!name.trim() || !email.trim()) {
            setError('Name and email are required');
            setSubmitting(false);
            return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            setError('Please enter a valid email address');
            setSubmitting(false);
            return;
        }

        try {
            await axios.post(
                `${backendUrl}/api/interviews/validate/${token}`,
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

            setFormSubmitted(true);
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

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
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

    // Show completion screen with role and token
    if (allQuestionsCompleted || (questions.length > 0 && currentQuestionIndex >= questions.length)) {
        return (
            <div className="interview-container">
                <div className="interview-card">
                    <div className="success-icon">✓</div>
                    <h1>Interview Submitted Successfully</h1>
                    <p style={{ textAlign: 'center', color: 'rgba(255, 255, 255, 0.8)', marginBottom: '1.5rem' }}>
                        Thank you for completing your interview!
                    </p>
                    
                    <div className="submitted-info">
                        <p><strong>Name:</strong> {name}</p>
                        <p><strong>Email:</strong> {email}</p>
                        <p><strong>Role:</strong> {linkInfo?.role_title || 'N/A'}</p>
                    </div>

                    <div className="confirmation-token">
                        <strong>Your Confirmation Token:</strong>
                        <div className="token-value">{token}</div>
                    </div>

                    <p className="help-text" style={{ marginTop: '1.5rem' }}>
                        Save this token for your records. All your video answers have been successfully recorded.
                    </p>
                    
                    <p className="help-text" style={{ marginTop: '0.5rem' }}>
                        You can now close this window.
                    </p>
                </div>
            </div>
        );
    }

    if (!formSubmitted) {
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
    }

    if (!cameraTestStarted) {
        return (
            <div className="interview-container">
                <div className="interview-card">
                    <h1>Camera & Hardware Test</h1>
                    <div className="instructions">
                        <p>Before we begin, let's test your camera and microphone.</p>
                        <p>Click the button below to start the test.</p>
                    </div>
                    {error && <div className="error-message">{error}</div>}
                    <button 
                        className="submit-button"
                        onClick={startCameraTest}
                    >
                        Start Camera Test
                    </button>
                </div>
            </div>
        );
    }

    if (questions.length > 0 && !allQuestionsCompleted) {
        const currentQuestion = questions[currentQuestionIndex];
        if (!currentQuestion) return null;
        
        const isLastQuestion = currentQuestionIndex === questions.length - 1;
        const hasRecorded = questionRecordedVideo !== null;

        return (
            <div className="interview-container">
                <div className="interview-card">
                    <div className="question-header">
                        <h1>Question {currentQuestionIndex + 1} of {questions.length}</h1>
                        <div className="timer-display">
                            Time: {formatTime(questionTimer)}
                        </div>
                    </div>

                    <div className="question-content">
                        <h2>{currentQuestion.question_text}</h2>
                        <p className="question-instruction">
                            Recording starts automatically. You have 10 minutes per answer. Click "Next" when ready to proceed.
                        </p>
                    </div>

                    {error && <div className="error-message">{error}</div>}

                    <div className="video-container">
                        <video 
                            ref={questionVideoRef}
                            autoPlay
                            muted={isQuestionRecording}
                            playsInline
                            controls={false}
                            className="test-video"
                        />
                    </div>

                    <div className="recording-controls">
                        {isQuestionRecording ? (
                            <div className="recording-indicator">
                                <span className="recording-dot"></span>
                                Recording: {formatTime(questionRecordingTime)}
                            </div>
                        ) : (
                            <div className="recording-indicator">
                                <span className="recording-dot"></span>
                                {hasRecorded ? 'Ready to proceed' : 'Preparing to record...'}
                            </div>
                        )}
                    </div>

                    <div className="question-navigation">
                        {(hasRecorded || isQuestionRecording) && (
                            <button 
                                className="submit-button"
                                onClick={() => {
                                    if (isQuestionRecording) {
                                        stopQuestionRecording();
                                    }
                                    goToNextQuestion();
                                }}
                            >
                                {isLastQuestion ? 'Complete Interview' : 'Next Question'}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    if (showWarning) {
        return (
            <div className="interview-container">
                <div className="interview-card warning-card">
                    <h1>⚠️ Important Warning</h1>
                    <div className="warning-content">
                        <p><strong>You cannot go back once you proceed.</strong></p>
                        <p>Make sure your camera and microphone are working correctly.</p>
                        <p>You'll have 10 minutes per question and can proceed anytime during recording.</p>
                    </div>
                    <div className="warning-buttons">
                        <button 
                            className="submit-button cancel-button"
                            onClick={() => setShowWarning(false)}
                        >
                            Go Back
                        </button>
                        <button 
                            className="submit-button"
                            onClick={handleProceedToQuestions}
                        >
                            I Understand, Continue
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (cameraTestStarted && !showWarning) {
        if (recordedVideo) {
            return (
                <div className="interview-container">
                    <div className="interview-card">
                        <h1>Review Your Test Video</h1>
                        <div className="instructions">
                            <p>Please review your test video to ensure your camera and microphone work correctly.</p>
                        </div>
                        
                        <div className="video-container">
                            <video 
                                ref={testVideoRef}
                                src={recordedVideo}
                                controls
                                className="test-video"
                                playsInline
                                autoPlay={false}
                            />
                        </div>

                        <div className="playback-section">
                            <div className="recording-controls">
                                <button 
                                    className="submit-button secondary-button"
                                    onClick={async () => {
                                        setRecordedVideo(null);
                                        setIsRecording(false);
                                        setRecordingTime(0);
                                        
                                        if (streamRef.current) {
                                            streamRef.current.getTracks().forEach(track => track.stop());
                                            streamRef.current = null;
                                        }
                                        
                                        if (testVideoRef.current) {
                                            testVideoRef.current.srcObject = null;
                                            testVideoRef.current.src = '';
                                            testVideoRef.current.controls = false;
                                            testVideoRef.current.load();
                                        }
                                        
                                        try {
                                            const stream = await navigator.mediaDevices.getUserMedia({ 
                                                video: { facingMode: 'user' }, 
                                                audio: true 
                                            });
                                            streamRef.current = stream;
                                            
                                            setTimeout(() => {
                                                if (testVideoRef.current) {
                                                    testVideoRef.current.srcObject = stream;
                                                    testVideoRef.current.play().catch(err => {
                                                        console.error('Error playing video:', err);
                                                    });
                                                }
                                            }, 100);
                                        } catch (err) {
                                            setError('Failed to access camera. Please grant permissions.');
                                            console.error('Camera access error:', err);
                                        }
                                    }}
                                >
                                    Record Again
                                </button>
                                <button 
                                    className="submit-button"
                                    onClick={handleContinueAfterTest}
                                >
                                    Continue to Interview
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            );
        }
        
        return (
            <div className="interview-container">
                <div className="interview-card">
                    <h1>Camera & Hardware Test</h1>
                    <div className="instructions">
                        <p><strong>Record a 30-second test video saying "1, 2, 3, 4, 5"</strong></p>
                        <p>This verifies your camera and microphone work correctly.</p>
                    </div>
                    
                    <div className="video-container">
                        {!isRecording && streamRef.current ? (
                            <video 
                                ref={testVideoRef}
                                autoPlay
                                muted
                                playsInline
                                className="test-video"
                            />
                        ) : isRecording ? (
                            <video 
                                ref={testVideoRef}
                                autoPlay
                                muted
                                playsInline
                                className="test-video"
                            />
                        ) : (
                            <div className="video-placeholder">
                                <p>Camera will start when you begin recording</p>
                            </div>
                        )}
                    </div>

                    <div className="recording-controls">
                        {!isRecording ? (
                            <button 
                                className="submit-button"
                                onClick={startTestRecording}
                            >
                                Start Recording
                            </button>
                        ) : (
                            <div>
                                <div className="recording-indicator">
                                    <span className="recording-dot"></span>
                                    Recording: {recordingTime}/30 seconds
                                </div>
                                <button 
                                    className="submit-button stop-button"
                                    onClick={stopTestRecording}
                                >
                                    Stop Recording
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    return null;
};

export default Interview;