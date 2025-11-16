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
    const [questionTimer, setQuestionTimer] = useState(600); // 10 minutes in seconds
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

    // Ensure video stream is set when camera test starts
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

    // Ensure question video stream is set when available
    useEffect(() => {
        if (questionStreamRef.current && questionVideoRef.current) {
            // Always show live feed, never show recorded video
            if (!questionVideoRef.current.srcObject || questionVideoRef.current.srcObject !== questionStreamRef.current) {
                questionVideoRef.current.srcObject = questionStreamRef.current;
                questionVideoRef.current.src = ''; // Clear any recorded video source
                questionVideoRef.current.play().catch(err => {
                    console.error('Error playing question video:', err);
                });
            }
        }
    }, [currentQuestionIndex, isQuestionRecording]);

    // Auto-start recording when questions are loaded or when moving to next question
    useEffect(() => {
        if (questions.length > 0 && !allQuestionsCompleted && currentQuestionIndex < questions.length) {
            // Start camera and recording automatically
            const autoStart = async () => {
                try {
                    // Start camera stream first
                    const stream = await navigator.mediaDevices.getUserMedia({ 
                        video: true, 
                        audio: true 
                    });
                    questionStreamRef.current = stream;
                    if (questionVideoRef.current) {
                        questionVideoRef.current.srcObject = stream;
                        questionVideoRef.current.play().catch(err => {
                            console.error('Error playing video:', err);
                        });
                    }

                    // Wait a bit for camera to initialize, then start recording
                    setTimeout(() => {
                        if (questionStreamRef.current && !isQuestionRecording && !questionRecordedVideo && questionMediaRecorderRef.current === null) {
                            // Start recording using the existing stream
                            const mediaRecorder = new MediaRecorder(questionStreamRef.current);
                            const chunks = [];

                            mediaRecorder.ondataavailable = (e) => {
                                if (e.data.size > 0) {
                                    chunks.push(e.data);
                                }
                            };

                            mediaRecorder.onstop = async () => {
                                const blob = new Blob(chunks, { type: 'video/webm' });
                                setQuestionRecordedVideo(blob); // Store blob, don't switch video element
                                
                                // Keep showing live feed - don't switch to recorded video
                                // The video element will continue showing the live stream
                                
                                // Upload video directly as blob to Google Cloud Storage
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

            // Only auto-start if not already recording and no video recorded for this question
            if (!isQuestionRecording && !questionRecordedVideo && !questionStreamRef.current) {
                autoStart();
            }
        }
    }, [questions.length, currentQuestionIndex, allQuestionsCompleted, isQuestionRecording, questionRecordedVideo]);

    // Cleanup on unmount
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
                video: true, 
                audio: true 
            });
            streamRef.current = stream;
            setCameraTestStarted(true);
            // Use setTimeout to ensure the video element is rendered before setting srcObject
            setTimeout(() => {
                if (testVideoRef.current) {
                    testVideoRef.current.srcObject = stream;
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

        const mediaRecorder = new MediaRecorder(streamRef.current);
        const chunks = [];

        mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) {
                chunks.push(e.data);
            }
        };

        mediaRecorder.onstop = () => {
            const blob = new Blob(chunks, { type: 'video/webm' });
            const videoUrl = URL.createObjectURL(blob);
            setRecordedVideo(videoUrl);
            
            // Stop the camera stream
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
            }
            
            // Update video element to show recorded video
            if (testVideoRef.current) {
                testVideoRef.current.srcObject = null;
                testVideoRef.current.src = videoUrl;
                testVideoRef.current.controls = true;
                testVideoRef.current.load(); // Reload the video element
            }
            
            isTestRecordingRef.current = false;
        };

        mediaRecorderRef.current = mediaRecorder;
        mediaRecorder.start();
        setIsRecording(true);
        isTestRecordingRef.current = true;
        setRecordingTime(0);

        // 30 second timer
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
            
            // Stop camera stream immediately
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
        
        // Stop test camera stream
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }

        // Mark link as used now (after camera test is completed)
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
            // Continue anyway, but log the error
        }

        // Fetch questions
        try {
            const response = await axios.get(
                `${backendUrl}/api/questions/interview/${token}`
            );
            const fetchedQuestions = response.data.questions || [];
            setQuestions(fetchedQuestions);
            
            // Start first question timer
            if (fetchedQuestions.length > 0) {
                startQuestionTimer();
            }
        } catch (err) {
            setError('Failed to load questions. Please try again.');
            console.error('Load questions error:', err);
        }
    };

    const startQuestionTimer = () => {
        setQuestionTimer(600); // Reset to 10 minutes
        if (questionTimerIntervalRef.current) {
            clearInterval(questionTimerIntervalRef.current);
        }
        
        questionTimerIntervalRef.current = setInterval(() => {
            setQuestionTimer((prev) => {
                if (prev <= 1) {
                    clearInterval(questionTimerIntervalRef.current);
                    // Auto-stop recording if timer reaches 0
                    if (isRecordingRef.current && questionMediaRecorderRef.current) {
                        stopQuestionRecording();
                    }
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    };

    const startQuestionRecording = async () => {
        try {
            // Only get new stream if we don't have one
            if (!questionStreamRef.current) {
                const stream = await navigator.mediaDevices.getUserMedia({ 
                    video: true, 
                    audio: true 
                });
                questionStreamRef.current = stream;
                if (questionVideoRef.current) {
                    questionVideoRef.current.srcObject = stream;
                    questionVideoRef.current.play().catch(err => {
                        console.error('Error playing video:', err);
                    });
                }
            }

            // Use existing stream for recording
            const stream = questionStreamRef.current;
            const mediaRecorder = new MediaRecorder(stream);
            const chunks = [];

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    chunks.push(e.data);
                }
            };

            mediaRecorder.onstop = async () => {
                const blob = new Blob(chunks, { type: 'video/webm' });
                setQuestionRecordedVideo(blob); // Store blob, don't switch video element
                
                // Keep showing live feed - don't switch to recorded video
                // The video element will continue showing the live stream
                
                // Upload video directly as blob to Google Cloud Storage
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
        } catch (err) {
            setError('Failed to access camera. Please grant permissions.');
            console.error('Camera access error:', err);
        }
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
            // Create FormData to send video file
            const formData = new FormData();
            formData.append('video', videoBlob, `question-${currentQuestion.id}.webm`);
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
        // Stop current recording if active
        if (isQuestionRecording) {
            stopQuestionRecording();
        }

        // Stop current stream
        if (questionStreamRef.current) {
            questionStreamRef.current.getTracks().forEach(track => track.stop());
            questionStreamRef.current = null;
        }

        // Clear video element to remove any recorded video
        if (questionVideoRef.current) {
            questionVideoRef.current.srcObject = null;
            questionVideoRef.current.src = '';
            questionVideoRef.current.load();
        }

        // Reset state for next question
        setQuestionRecordedVideo(null);
        setIsQuestionRecording(false);
        isRecordingRef.current = false;
        setQuestionRecordingTime(0);
        questionMediaRecorderRef.current = null;

        // Move to next question
        if (currentQuestionIndex < questions.length - 1) {
            setCurrentQuestionIndex(currentQuestionIndex + 1);
            // Start timer for next question
            startQuestionTimer();
            // Auto-start recording will be triggered by useEffect
        } else {
            // All questions completed
            setAllQuestionsCompleted(true);
            if (questionTimerIntervalRef.current) {
                clearInterval(questionTimerIntervalRef.current);
            }
            // Stop any remaining streams
            if (questionStreamRef.current) {
                questionStreamRef.current.getTracks().forEach(track => track.stop());
                questionStreamRef.current = null;
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
            // Only validate and update candidate info, don't mark link as used yet
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

    // Show form if not submitted
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

    // Show camera test if form submitted but test not started
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

    // Show questions interface FIRST (before camera test preview)
    if (questions.length > 0 && !allQuestionsCompleted) {
        const currentQuestion = questions[currentQuestionIndex];
        if (!currentQuestion) return null; // Safety check
        
        const isLastQuestion = currentQuestionIndex === questions.length - 1;
        const hasRecorded = questionRecordedVideo !== null;

        return (
            <div className="interview-container">
                <div className="interview-card">
                    <div className="question-header">
                        <h1>Question {currentQuestionIndex + 1} of {questions.length}</h1>
                        <div className="timer-display">
                            Time Remaining: {formatTime(questionTimer)}
                        </div>
                    </div>

                    <div className="question-content">
                        <h2>{currentQuestion.question_text}</h2>
                        <p className="question-instruction">
                            Recording will start automatically. You have 10 minutes to record your answer. Click "Next Question" when you're ready to proceed.
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
                                    // Stop recording if currently recording, then move to next question
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

    // Show warning modal
    if (showWarning) {
        return (
            <div className="interview-container">
                <div className="interview-card warning-card">
                    <h1>⚠️ Important Warning</h1>
                    <div className="warning-content">
                        <p><strong>You cannot go back and re-attempt once you proceed.</strong></p>
                        <p>Make sure your camera and microphone are working correctly before continuing.</p>
                        <p>You will have 10 minutes to record each answer, and you can move to the next question at any time if the timer is still running.</p>
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

    // Show camera test recording interface or preview
    if (cameraTestStarted && !showWarning) {
        // If video is recorded, show preview screen
        if (recordedVideo) {
            return (
                <div className="interview-container">
                    <div className="interview-card">
                        <h1>Review Your Test Video</h1>
                        <div className="instructions">
                            <p>Please review your test video to ensure your camera and microphone are working correctly.</p>
                        </div>
                        
                        <div className="video-container">
                            <video 
                                ref={testVideoRef}
                                src={recordedVideo}
                                controls
                                className="test-video"
                                autoPlay={false}
                            />
                        </div>

                        <div className="playback-section">
                            <div className="recording-controls">
                                <button 
                                    className="submit-button secondary-button"
                                    onClick={async () => {
                                        // Reset and allow re-recording
                                        setRecordedVideo(null);
                                        setIsRecording(false);
                                        
                                        // Stop any existing stream
                                        if (streamRef.current) {
                                            streamRef.current.getTracks().forEach(track => track.stop());
                                            streamRef.current = null;
                                        }
                                        
                                        // Start camera again
                                        try {
                                            const stream = await navigator.mediaDevices.getUserMedia({ 
                                                video: true, 
                                                audio: true 
                                            });
                                            streamRef.current = stream;
                                            if (testVideoRef.current) {
                                                testVideoRef.current.srcObject = stream;
                                                testVideoRef.current.play().catch(err => {
                                                    console.error('Error playing video:', err);
                                                });
                                            }
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
        
        // Otherwise show recording interface
        return (
            <div className="interview-container">
                <div className="interview-card">
                    <h1>Camera & Hardware Test</h1>
                    <div className="instructions">
                        <p><strong>Please record a 30-second test video saying "1, 2, 3, 4, 5"</strong></p>
                        <p>This will help us verify that your camera and microphone are working correctly.</p>
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

    // Show completion screen
    if (allQuestionsCompleted || (questions.length > 0 && currentQuestionIndex >= questions.length)) {
        return (
            <div className="interview-container">
                <div className="interview-card">
                    <div className="success-icon">✓</div>
                    <h1>Your Response Has Been Submitted</h1>
                    <p>Thank you for completing the interview!</p>
                    <p className="submitted-info">
                        <strong>Name:</strong> {name}<br />
                        <strong>Email:</strong> {email}
                    </p>
                    <p>All your video answers have been successfully recorded and saved.</p>
                    <p style={{ marginTop: '2rem', color: 'rgba(255, 255, 255, 0.7)', fontSize: '0.9rem' }}>
                        You can now close this window.
                    </p>
                </div>
            </div>
        );
    }

    return null;
};

export default Interview;
