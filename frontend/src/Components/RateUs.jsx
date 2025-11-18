import React, { useState, useRef, useEffect, useMemo, Suspense } from "react";
import axios from "axios";
import { Canvas, useFrame } from "@react-three/fiber";
import { Stars } from "@react-three/drei";
import { motion, AnimatePresence } from "framer-motion";
import * as THREE from "three";
import "./RateUs.css";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://127.0.0.1:8000";

// String with Sound Waves - Big animated strings with wave patterns
function SoundString({ position, segments = 50, waveSpeed = 1, waveAmplitude = 0.5, delay = 0 }) {
  const lineRef = useRef();
  const geometryRef = useRef();

  useEffect(() => {
    if (geometryRef.current) {
      const positions = new Float32Array((segments + 1) * 3);
      for (let i = 0; i <= segments; i++) {
        positions[i * 3] = (i / segments) * 8 - 4;
        positions[i * 3 + 1] = 0;
        positions[i * 3 + 2] = 0;
      }
      geometryRef.current.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    }
  }, [segments]);

  useFrame((state) => {
    if (lineRef.current && geometryRef.current) {
      const time = state.clock.elapsedTime + delay;
      const positions = geometryRef.current.attributes.position;
      
      for (let i = 0; i <= segments; i++) {
        const x = (i / segments) * 12 - 6;
        const wave1 = Math.sin(x * 2 + time * waveSpeed) * waveAmplitude;
        const wave2 = Math.sin(x * 3 + time * waveSpeed * 1.5) * (waveAmplitude * 0.6);
        const wave3 = Math.sin(x * 4 + time * waveSpeed * 0.8) * (waveAmplitude * 0.4);
        const y = wave1 + wave2 + wave3;
        
        positions.setXYZ(i, x, y, 0);
      }
      
      positions.needsUpdate = true;
      lineRef.current.rotation.z = Math.sin(time * 0.2) * 0.1;
    }
  });

  return (
    <line ref={lineRef}>
      <bufferGeometry ref={geometryRef} />
      <lineBasicMaterial
        color="#4c1d95"
        transparent
        opacity={0.5}
        linewidth={5}
      />
    </line>
  );
}

// Multiple Strings Group - Creates a curtain of strings
function StringCurtain({ position, stringCount = 15 }) {
  const strings = useMemo(() => {
    return Array.from({ length: stringCount }).map((_, i) => ({
      z: (i - stringCount / 2) * 0.4,
      waveSpeed: 0.5 + (i % 3) * 0.3,
      waveAmplitude: 0.3 + (i % 2) * 0.2,
      delay: i * 0.2,
      color: new THREE.Color().lerpColors(
        new THREE.Color("#4c1d95"),
        new THREE.Color("#6d28d9"),
        i / stringCount
      ),
    }));
  }, [stringCount]);

  return (
    <group position={position}>
      {strings.map((str, i) => (
        <group key={i} position={[0, 0, str.z]}>
          <SoundString
            segments={80}
            waveSpeed={str.waveSpeed}
            waveAmplitude={str.waveAmplitude * 1.5}
            delay={str.delay}
          />
        </group>
      ))}
    </group>
  );
}

// Sound Wave Particles along strings
function StringParticles({ stringRef, count = 20 }) {
  const particlesRef = useRef();
  const positions = useMemo(() => {
    return Array.from({ length: count }).map(() => ({
      progress: Math.random(),
      speed: Math.random() * 0.01 + 0.005,
    }));
  }, [count]);

  useFrame((state) => {
    if (particlesRef.current && stringRef.current) {
      const time = state.clock.elapsedTime;
      const positions = particlesRef.current.geometry.attributes.position;
      
      particlesRef.current.particleData.forEach((particle, i) => {
        particle.progress += particle.speed;
        if (particle.progress > 1) particle.progress = 0;
        
        const x = (particle.progress - 0.5) * 8;
        const waveY = Math.sin(x * 2 + time) * 0.3;
        positions.setXYZ(i, x, waveY, 0);
      });
      
      positions.needsUpdate = true;
    }
  });

  useEffect(() => {
    if (particlesRef.current) {
      particlesRef.current.particleData = positions;
    }
  }, [positions]);

  return (
    <points ref={particlesRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={new Float32Array(count * 3)}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.15}
        color="#a78bfa"
        transparent
        opacity={0.4}
        sizeAttenuation={true}
      />
    </points>
  );
}

// Advanced 3D Background Scene with String Sound Waves
function Scene3D() {
  const purple1 = "#8b5cf6";
  const purple2 = "#a78bfa";
  const purple3 = "#c4b5fd";

  return (
    <>
      <ambientLight intensity={0.3} />
      <pointLight position={[10, 10, 10]} intensity={0.5} color={purple2} />
      <pointLight position={[-10, -10, -10]} intensity={0.3} color={purple3} />
      
      {/* Multiple String Curtains - Bigger and Darker */}
      <StringCurtain position={[-8, 0, -7]} stringCount={15} />
      <StringCurtain position={[8, 0, -7]} stringCount={15} />
      <StringCurtain position={[0, 5, -8]} stringCount={12} />
      <StringCurtain position={[0, -5, -8]} stringCount={12} />
      
      {/* Additional Single Strings - Bigger */}
      <group position={[-12, 3, -6]} rotation={[0, 0, Math.PI / 6]} scale={1.5}>
        <SoundString segments={80} waveSpeed={0.8} waveAmplitude={0.6} delay={0} />
      </group>
      <group position={[12, -3, -6]} rotation={[0, 0, -Math.PI / 6]} scale={1.5}>
        <SoundString segments={80} waveSpeed={0.7} waveAmplitude={0.7} delay={0.5} />
      </group>
      <group position={[0, 8, -7]} rotation={[0, 0, Math.PI / 4]} scale={1.3}>
        <SoundString segments={80} waveSpeed={0.9} waveAmplitude={0.65} delay={0.3} />
      </group>
      <group position={[0, -8, -7]} rotation={[0, 0, -Math.PI / 4]} scale={1.3}>
        <SoundString segments={80} waveSpeed={0.75} waveAmplitude={0.6} delay={0.7} />
      </group>
      
      <Stars radius={400} depth={80} count={2000} factor={6} fade speed={0.8} />
    </>
  );
}

function VoiceNPSChat() {
  const [score, setScore] = useState(null);
  const [transcription, setTranscription] = useState("");
  const [conversationHistory, setConversationHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState("");
  const [recordingTime, setRecordingTime] = useState(0);
  const [currentResponse, setCurrentResponse] = useState(null);
  const [textInput, setTextInput] = useState("");
  const [showTextInput, setShowTextInput] = useState(false);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const streamRef = useRef(null);
  const recognitionRef = useRef(null);
  const timerRef = useRef(null);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    // Check backend connection on mount
    const checkBackendConnection = async () => {
      try {
        const response = await axios.get(`${BACKEND_URL}/health`);
        console.log("✅ Backend connected:", response.data);
      } catch (err) {
        console.warn("⚠️ Backend not reachable at", BACKEND_URL);
        console.warn("Make sure backend server is running on http://127.0.0.1:8000");
      }
    };
    
    checkBackendConnection();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  const startRecording = async () => {
    console.log("🎤 Start Recording clicked");
    try {
      console.log("Requesting microphone access...");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log("✅ Microphone access granted");
      
      streamRef.current = stream;
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];
      setTranscription("");
      setError("");

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
          console.log("Audio chunk received, size:", event.data.size);
        }
      };

      mediaRecorderRef.current.onerror = (event) => {
        console.error("MediaRecorder error:", event.error);
        setError("Recording error occurred. Please try again.");
      };

      const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRec) {
        console.log("Speech recognition available");
        recognitionRef.current = new SpeechRec();
        recognitionRef.current.lang = "en-US";
        recognitionRef.current.continuous = true;
        recognitionRef.current.interimResults = false;

        recognitionRef.current.onresult = (event) => {
          const result = event.results[event.results.length - 1];
          if (result.isFinal) {
            const text = result[0].transcript.trim();
            console.log("Transcription:", text);
            setTranscription(prev => (prev + " " + text).trim());
          }
        };

        recognitionRef.current.onerror = (event) => {
          console.warn("Speech recognition error:", event.error);
        };
        
        recognitionRef.current.start();
      } else {
        console.warn("Speech recognition not available in this browser");
      }

      console.log("Starting MediaRecorder...");
      mediaRecorderRef.current.start();
      setIsRecording(true);
      setRecordingTime(0);
      console.log("✅ Recording started");

      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.error("❌ Error starting recording:", err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setError("Microphone permission denied. Please allow microphone access in your browser settings and try again.");
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setError("No microphone found. Please connect a microphone and try again.");
      } else {
        setError(`Error accessing microphone: ${err.message || "Please check your browser permissions"}`);
      }
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    return new Promise((resolve) => {
      if (recognitionRef.current) recognitionRef.current.stop();
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });

        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
        }

        setIsRecording(false);
        resolve(audioBlob);
      };

      mediaRecorderRef.current.stop();
    });
  };

  const handleInitialSubmit = async () => {
    console.log("🚀 handleInitialSubmit called, score:", score);
    if (!score && score !== 0) {
      setError("Please select a score first");
      console.warn("⚠️ No score selected");
      return;
    }

    console.log("✅ Starting submission with score:", score);
    setLoading(true);
    setError("");
    setCurrentResponse(null);

    try {
      let audioBlob = null;
      if (isRecording) {
        audioBlob = await stopRecording();
      }

      const formData = new FormData();
      formData.append("score", score.toString());

      const transcriptionText = transcription.trim() || textInput.trim();
      
      if (transcriptionText) {
        formData.append("transcription", transcriptionText);
      }
      
      if (audioBlob) {
        formData.append("audio_data", audioBlob, "initial.webm");
      }

      // Ensure at least one is provided
      if (!transcriptionText && !audioBlob) {
        setError("Please provide either text feedback or record audio");
        setLoading(false);
        return;
      }

      console.log("📤 Sending initial feedback to backend:", BACKEND_URL);
      const res = await axios.post(`${BACKEND_URL}/submit_feedback`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      console.log("✅ Received response from backend:", res.data);
      const data = res.data;
      const botReply = data.conversationalResponse ?? data.response ?? "No response";

      setConversationHistory([
        {
          type: "initial",
          score,
          transcription: transcriptionText || data.transcription || "[Audio message]",
          aiResponse: botReply,
          sentiment: data.sentiment,
          feedback: data.feedback
        }
      ]);

      setCurrentResponse(data);
      setTranscription("");
      setTextInput("");

    } catch (err) {
      console.error("❌ Error submitting initial feedback:", err);
      console.error("Error details:", err.response?.data);
      if (err.response?.status === 400) {
        setError(err.response?.data?.detail || "Invalid request. Please check your input.");
      } else if (err.response?.status === 500) {
        setError(err.response?.data?.detail || "Server error. Please try again.");
      } else if (err.code === 'ECONNREFUSED' || err.message?.includes('Network Error')) {
        setError(`Cannot connect to backend at ${BACKEND_URL}. Make sure the backend server is running.`);
      } else {
        setError(err.response?.data?.detail || err.message || "Error submitting initial feedback");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleFollowUpSend = async () => {
    console.log("📤 handleFollowUpSend called");
    if (!conversationHistory.length) {
      setError("Submit initial feedback first!");
      console.warn("⚠️ No conversation history");
      return;
    }

    console.log("✅ Starting follow-up submission");
    setLoading(true);
    setError("");
    setCurrentResponse(null);

    try {
      let audioBlob = null;
      if (isRecording) {
        audioBlob = await stopRecording();
      }

      const initial = conversationHistory.find(x => x.type === "initial");
      const currentScore = score || initial.score;

      const historyData = {
        initial_transcription: initial.transcription,
        sentiment: initial.sentiment,
        feedback: initial.feedback,
        turns: conversationHistory
          .filter(x => x.type === "followup")
          .map(x => ({
            user: x.transcription,
            ai: x.aiResponse,
          })),
      };

      const formData = new FormData();
      formData.append("score", currentScore.toString());
      formData.append("conversation_history", JSON.stringify(historyData));

      const transcriptionText = transcription.trim() || textInput.trim();

      // Send transcription if available (preferred for speed)
      if (transcriptionText) {
        formData.append("transcription", transcriptionText);
      }
      
      // Also send audio if available (for voice follow-ups)
      if (audioBlob) {
        formData.append("audio_data", audioBlob, "followup.webm");
      }

      // Ensure at least one is provided
      if (!transcriptionText && !audioBlob) {
        setError("Please provide either text feedback or record audio");
        setLoading(false);
        return;
      }

      console.log("📤 Sending follow-up to backend:", BACKEND_URL);
      const res = await axios.post(`${BACKEND_URL}/submit_followup`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      console.log("✅ Received follow-up response from backend:", res.data);
      const data = res.data;
      const botReply = data.conversationalResponse ?? data.response ?? "No response";

      setConversationHistory(prev => [
        ...prev,
        {
          type: "followup",
          transcription: transcriptionText || data.transcription || "[Voice Message]",
          aiResponse: botReply,
        }
      ]);

      setCurrentResponse(data);
      setTranscription("");
      setTextInput("");

    } catch (err) {
      console.error("❌ Error sending follow-up:", err);
      console.error("Error details:", err.response?.data);
      if (err.response?.status === 400) {
        setError(err.response?.data?.detail || "Invalid request. Please check your input.");
      } else if (err.response?.status === 500) {
        setError(err.response?.data?.detail || "Server error. Please try again.");
      } else if (err.code === 'ECONNREFUSED' || err.message?.includes('Network Error')) {
        setError(`Cannot connect to backend at ${BACKEND_URL}. Make sure the backend server is running.`);
      } else {
        setError(err.response?.data?.detail || err.message || "Error sending follow-up");
      }
    } finally {
      setLoading(false);
    }
  };

  const stopConversation = async () => {
    console.log("🛑 Stopping conversation");
    
    // Stop recognition if active
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        console.warn("Error stopping recognition:", e);
      }
    }
    
    // Stop recording if active
    if (isRecording && mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        if (mediaRecorderRef.current.state === 'recording') {
          mediaRecorderRef.current.stop();
        }
      } catch (e) {
        console.warn("Error stopping media recorder:", e);
      }
    }
    
    // Clear timer if active
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    // Stop media stream if active
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
      });
      streamRef.current = null;
    }
    
    // Reset all states
    setConversationHistory([]);
    setCurrentResponse(null);
    setTranscription("");
    setTextInput("");
    setError("");
    setLoading(false);
    setIsRecording(false);
    setRecordingTime(0);
    setShowTextInput(false);
    // Don't reset score - user might want to continue with same score
    
    console.log("✅ Conversation stopped and reset");
  };

  const isFollowUp = conversationHistory.length > 0;
  const requiresFollowUp = currentResponse?.requiresFollowUp || false;

  return (
    <div className="rateus-container">
      {/* Animated Background Gradient - Light Theme */}
      <div className="animated-background"></div>
      
      {/* Advanced 3D Background with String Sound Waves */}
      <div className="three-d-background">
        <Canvas camera={{ position: [0, 0, 5], fov: 75 }}>
          <Suspense fallback={null}>
            <Scene3D />
          </Suspense>
        </Canvas>
        </div>

      {/* Content */}
      <div className="content-wrapper">
        <div className="content-inner">
        {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="header-section"
          >
            <motion.h1
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              className="main-title"
            >
            Voice NPS Feedback
            </motion.h1>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="subtitle"
            >
              Share your experience with us through voice or text
            </motion.p>
          </motion.div>

        {/* Main Card */}
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.8 }}
            className="main-card"
          >
            {/* Rating Section */}
          {!isFollowUp && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="rating-section"
              >
                <label className="rating-label">
                How likely are you to recommend us? (0-10)
              </label>

                {/* Rating Buttons */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="rating-buttons-container"
                >
                {Array.from({ length: 11 }, (_, i) => i).map(num => (
                    <motion.button
                    key={num}
                      whileHover={{ scale: 1.2, rotate: 5 }}
                      whileTap={{ scale: 0.9 }}
                    onClick={() => {
                      setScore(num);
                      setError("");
                      setCurrentResponse(null);
                    }}
                      className={`rating-button ${score === num ? 'selected' : ''}`}
                  >
                    {num}
                    </motion.button>
                  ))}
                </motion.div>

                {/* Enhanced Labels */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.7 }}
                  className="rating-labels-container"
                >
                  <motion.div 
                    className="rating-label-card rating-label-left"
                    whileHover={{ scale: 1.05, x: -5 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className="rating-label-badge rating-badge-low">0-3</div>
                    <span className="rating-label-title">Not Likely</span>
                    <p className="rating-label-description">Would not recommend to others</p>
                  </motion.div>
                  
                  <div className="rating-labels-divider">
                    <div className="rating-labels-progress-line">
                      <motion.div 
                        className="rating-labels-progress-fill"
                        initial={{ width: "0%" }}
                        animate={{ width: score !== null ? `${(score / 10) * 100}%` : "0%" }}
                        transition={{ duration: 0.5, ease: "easeOut" }}
                      />
              </div>
                    <div className="rating-labels-numbers">
                      {[0, 2, 4, 6, 8, 10].map(num => (
                        <span key={num} className={`rating-label-number ${score === num ? 'active' : ''}`}>
                    {num}
                        </span>
                ))}
              </div>
            </div>
                  
                  <motion.div 
                    className="rating-label-card rating-label-right"
                    whileHover={{ scale: 1.05, x: 5 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className="rating-label-badge rating-badge-high">8-10</div>
                    <span className="rating-label-title">Very Likely</span>
                    <p className="rating-label-description">Strongly recommend to others</p>
                  </motion.div>
                </motion.div>
              </motion.div>
            )}

            {/* Follow-up Question */}
            <AnimatePresence>
          {isFollowUp && currentResponse && requiresFollowUp && (
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="followup-question"
                >
                  <div className="followup-content">
                    <motion.div
                      animate={{ rotate: [0, 10, -10, 0] }}
                      transition={{ repeat: Infinity, duration: 2 }}
                      className="followup-icon"
                    >
                      <svg className="followup-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                      </svg>
                    </motion.div>
                    <div className="followup-text">
                      <span className="followup-badge">
                      Follow-up Question #{conversationHistory.filter(x => x.type === "followup").length + 1}
                    </span>
                      <p className="followup-message">
                    {currentResponse.conversationalResponse}
                  </p>
                </div>
              </div>
                </motion.div>
          )}
            </AnimatePresence>

            {/* Input Section */}
            <div className="input-section">
              {/* Voice Recording with Enhanced Animation */}
          {isRecording && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="recording-indicator"
                >
                  <div className="recording-header">
                    <div className="recording-animation-container">
                      <motion.div
                        animate={{ scale: [1, 1.3, 1] }}
                        transition={{ repeat: Infinity, duration: 1, ease: "easeInOut" }}
                        className="recording-dot recording-dot-1"
                      />
                      <motion.div
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ repeat: Infinity, duration: 1.2, ease: "easeInOut", delay: 0.2 }}
                        className="recording-dot recording-dot-2"
                      />
                      <motion.div
                        animate={{ scale: [1, 1.4, 1] }}
                        transition={{ repeat: Infinity, duration: 0.8, ease: "easeInOut", delay: 0.4 }}
                        className="recording-dot recording-dot-3"
                      />
                    </div>
                    <span className="recording-text">
                  Recording... {formatTime(recordingTime)}
                </span>
              </div>
              {transcription && (
                    <motion.p
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="transcription-preview"
                    >
                  "{transcription}"
                    </motion.p>
                  )}
                  {/* Audio Waveform Visualization */}
                  <div className="waveform-visualization">
                    {Array.from({ length: 20 }).map((_, i) => (
                      <motion.div
                        key={i}
                        className="waveform-bar"
                        animate={{
                          height: [20, 40 + Math.random() * 30, 20],
                        }}
                        transition={{
                          repeat: Infinity,
                          duration: 0.8 + Math.random() * 0.4,
                          delay: i * 0.05,
                          ease: "easeInOut",
                        }}
                      />
                    ))}
            </div>
                </motion.div>
              )}

              {/* Text Input Toggle */}
              <div className="input-toggle-container">
                {!isRecording && (
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      setShowTextInput(!showTextInput);
                      if (showTextInput) setTextInput("");
                    }}
                    className="text-toggle-btn"
                  >
                    {showTextInput ? "Hide Text Input" : "Use Text Instead"}
                  </motion.button>
                )}
              </div>

              {/* Text Input Field */}
              {showTextInput && !isRecording && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-input-wrapper"
                >
                  <textarea
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    placeholder="Type your feedback here..."
                    className="text-input"
                    rows="4"
                  />
                  {textInput.trim() && (
                    <motion.button
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        console.log("📝 TEXT SUBMIT BUTTON CLICKED");
                        if (!loading) {
                          if (!isFollowUp) {
                            handleInitialSubmit();
                          } else {
                            handleFollowUpSend();
                          }
                        }
                      }}
                      disabled={false}
                      className="text-submit-btn"
                      type="button"
                      style={{ cursor: loading ? 'not-allowed' : 'pointer', position: 'relative', zIndex: 1000, opacity: loading ? 0.6 : 1 }}
                    >
                      {loading ? (
                        <span className="loading-content">
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                            className="loading-spinner-icon"
                          >
                            <svg className="loading-spinner-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <circle cx="12" cy="12" r="10" opacity="0.25"></circle>
                              <path d="M12 2a10 10 0 0 1 10 10" opacity="0.75"></path>
                            </svg>
                          </motion.div>
                          Processing...
                        </span>
                      ) : (
                        !isFollowUp ? "Submit Feedback" : "Send Follow-Up"
                      )}
                    </motion.button>
                  )}
                </motion.div>
              )}
            </div>

            {/* Controls */}
            <div className="controls-section">
            {!isRecording ? (
                // Only show submit button in controls if text input is NOT visible (for transcription from recording)
                // If text input is visible, the submit button is below the textarea
                (!showTextInput && transcription.trim()) ? (
                  !isFollowUp ? (
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        console.log("✅ SUBMIT BUTTON CLICKED");
                        if (!loading) {
                          handleInitialSubmit();
                        }
                      }}
                      disabled={false}
                      className="submit-btn submit-btn-primary"
                      type="button"
                      style={{ cursor: loading ? 'not-allowed' : 'pointer', position: 'relative', zIndex: 1000, opacity: loading ? 0.6 : 1 }}
                    >
                      {loading ? (
                        <span className="loading-content">
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                            className="loading-spinner-icon"
                          >
                            <svg className="loading-spinner-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <circle cx="12" cy="12" r="10" opacity="0.25"></circle>
                              <path d="M12 2a10 10 0 0 1 10 10" opacity="0.75"></path>
                            </svg>
                          </motion.div>
                          Processing...
                        </span>
                      ) : (
                        "Submit Feedback"
                      )}
                    </motion.button>
                  ) : (
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        console.log("📤 FOLLOW-UP BUTTON CLICKED");
                        if (!loading) {
                          handleFollowUpSend();
                        }
                      }}
                      disabled={false}
                      className="submit-btn submit-btn-secondary"
                      type="button"
                      style={{ cursor: loading ? 'not-allowed' : 'pointer', position: 'relative', zIndex: 1000, opacity: loading ? 0.6 : 1 }}
                    >
                      {loading ? (
                        <span className="loading-content">
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                            className="loading-spinner-icon"
                          >
                            <svg className="loading-spinner-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <circle cx="12" cy="12" r="10" opacity="0.25"></circle>
                              <path d="M12 2a10 10 0 0 1 10 10" opacity="0.75"></path>
                            </svg>
                          </motion.div>
                          Sending...
                        </span>
                      ) : (
                        "Send Follow-Up"
                      )}
                    </motion.button>
                  )
                ) : (
                  <div className="record-controls">
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        console.log("🎤 BUTTON CLICKED - Start Recording");
                        console.log("Current state - loading:", loading, "score:", score, "isFollowUp:", isFollowUp);
                        
                        if (loading) {
                          console.warn("Button disabled: loading");
                          return;
                        }
                        
                        if (!isFollowUp && (score === null || score === undefined)) {
                          console.warn("Button disabled: no score selected");
                          setError("Please select a score first!");
                          return;
                        }
                        
                        console.log("✅ Calling startRecording()");
                        startRecording();
                      }}
                      disabled={false}
                      className="record-btn"
                      type="button"
                      style={{ cursor: 'pointer', position: 'relative', zIndex: 1000 }}
                    >
                      Start Recording
                    </motion.button>
                    <AnimatePresence>
                      {(conversationHistory.length > 0 || isRecording) && (
                        <motion.button
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            console.log("🛑 STOP button clicked");
                            stopConversation();
                          }}
                          className="stop-btn"
                          type="button"
                          style={{ cursor: 'pointer', position: 'relative', zIndex: 1000 }}
                        >
                          Stop
                        </motion.button>
                      )}
                    </AnimatePresence>
                  </div>
                )
            ) : (
                <div className="control-buttons">
                {!isFollowUp ? (
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        console.log("✅ SUBMIT BUTTON CLICKED (while recording)");
                        if (!loading) {
                          handleInitialSubmit();
                        }
                      }}
                      disabled={false}
                      className="submit-btn submit-btn-primary"
                      type="button"
                      style={{ cursor: loading ? 'not-allowed' : 'pointer', position: 'relative', zIndex: 1000, opacity: loading ? 0.6 : 1 }}
                    >
                      {loading ? (
                        <span className="loading-content">
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                            className="loading-spinner-icon"
                          >
                            <svg className="loading-spinner-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <circle cx="12" cy="12" r="10" opacity="0.25"></circle>
                              <path d="M12 2a10 10 0 0 1 10 10" opacity="0.75"></path>
                            </svg>
                          </motion.div>
                          Processing...
                        </span>
                      ) : (
                        "Submit Feedback"
                      )}
                    </motion.button>
                  ) : (
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        console.log("📤 FOLLOW-UP BUTTON CLICKED (while recording)");
                        if (!loading) {
                          handleFollowUpSend();
                        }
                      }}
                      disabled={false}
                      className="submit-btn submit-btn-secondary"
                      type="button"
                      style={{ cursor: loading ? 'not-allowed' : 'pointer', position: 'relative', zIndex: 1000, opacity: loading ? 0.6 : 1 }}
                    >
                      {loading ? (
                        <span className="loading-content">
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                            className="loading-spinner-icon"
                          >
                            <svg className="loading-spinner-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <circle cx="12" cy="12" r="10" opacity="0.25"></circle>
                              <path d="M12 2a10 10 0 0 1 10 10" opacity="0.75"></path>
                            </svg>
                          </motion.div>
                          Sending...
                        </span>
                      ) : (
                        "Send Follow-Up"
                      )}
                    </motion.button>
                  )}
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      console.log("⏹ STOP BUTTON CLICKED");
                      stopRecording();
                    }}
                    className="stop-btn"
                    type="button"
                    style={{ cursor: 'pointer', position: 'relative', zIndex: 1000 }}
                >
                  Stop
                  </motion.button>
              </div>
            )}
          </div>

            {/* Error Message */}
            <AnimatePresence>
          {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="error-message"
                >
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

          {/* Success Message */}
            <AnimatePresence>
          {currentResponse && !requiresFollowUp && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="success-message"
                >
                  <p className="success-title">
                    <motion.div
                      animate={{ rotate: [0, 360], scale: [1, 1.2, 1] }}
                      transition={{ duration: 0.5 }}
                      className="success-icon"
                    >
                      <svg className="success-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M20 6L9 17l-5-5"></path>
                      </svg>
                    </motion.div>
                    Conversation Complete!
                  </p>
                  {currentResponse.saved_conversation_file && (
                    <p className="success-detail">
                      Saved to: {currentResponse.saved_conversation_file}
                    </p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

        {/* Conversation History */}
          <AnimatePresence>
        {conversationHistory.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 50 }}
                className="history-card"
              >
                <h2 className="history-title">
                  <svg className="history-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                  </svg>
                  Conversation History
                </h2>
                <div className="history-list">
              {conversationHistory.map((msg, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.1 }}
                      className="history-item"
                    >
                  {msg.type === "initial" && (
                        <div className="history-badges">
                          <span className="badge badge-primary">
                        Initial Feedback • Score: {msg.score}/10
                      </span>
                      {msg.sentiment && (
                            <span className={`badge ${msg.sentiment.toLowerCase().includes('positive') ? 'badge-success' : msg.sentiment.toLowerCase().includes('negative') ? 'badge-error' : 'badge-neutral'}`}>
                          {msg.sentiment}
                        </span>
                      )}
                    </div>
                  )}
                  {msg.type === "followup" && (
                        <span className="badge badge-followup">
                      Follow-up #{conversationHistory.filter((x, i) => i < idx && x.type === "followup").length + 1}
                    </span>
                  )}
                  
                      <div className="history-messages">
                        <div className="message-item">
                          <span className="message-label message-user">You:</span>
                          <p className="message-text">{msg.transcription}</p>
                    </div>
                        <div className="message-item gemini-response">
                          <span className="message-label message-ai">Gemini AI:</span>
                          <p className="message-text message-ai-text gemini-response-text">{msg.aiResponse}</p>
                    </div>
                  </div>

                  {msg.feedback && msg.feedback.length > 0 && (
                        <div className="feedback-section">
                          <p className="feedback-title">Key Points:</p>
                          <ul className="feedback-list">
                        {msg.feedback.map((point, i) => (
                              <li key={i} className="feedback-item">{point}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                    </motion.div>
              ))}
            </div>
              </motion.div>
        )}
          </AnimatePresence>

        {/* Current Response Details */}
          <AnimatePresence>
        {currentResponse && (
              <motion.div
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 50 }}
                className="response-card"
              >
                <h3 className="response-title">Latest Response</h3>
                <div className="response-details">
              {currentResponse.sentiment && (
                    <div className="response-item">
                      <span className="response-label">Sentiment:</span>
                      <span className={`badge ${currentResponse.sentiment.toLowerCase().includes('positive') ? 'badge-success' : currentResponse.sentiment.toLowerCase().includes('negative') ? 'badge-error' : 'badge-neutral'}`}>
                    {currentResponse.sentiment}
                  </span>
                </div>
              )}
                  <div className="response-item">
                    <span className="response-label">Status:</span>
                    <span className={`badge ${currentResponse.conversationComplete || !currentResponse.requiresFollowUp ? 'badge-success' : 'badge-warning'}`}>
                  {currentResponse.conversationComplete || !currentResponse.requiresFollowUp ? (
                    <span className="badge-content">
                      <svg className="badge-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M20 6L9 17l-5-5"></path>
                      </svg>
                      Complete
                    </span>
                  ) : (
                    <span className="badge-content">
                      <svg className="badge-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                      </svg>
                      Needs Follow-up
                    </span>
                  )}
                </span>
              </div>
            </div>
              </motion.div>
        )}
          </AnimatePresence>
          </div>
      </div>
    </div>
  );
}

export default VoiceNPSChat;