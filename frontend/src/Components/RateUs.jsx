import React, { useState, useRef, useEffect, useMemo, Suspense } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
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
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const businessCategory = searchParams.get("category") || "";
  
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
  const speechSynthesisRef = useRef(null);
  const [displayedText, setDisplayedText] = useState("");
  const typewriterTimeoutRef = useRef(null);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Text-to-Speech function
  // Typewriter effect with voice sync
  const typewriterEffect = (text, onComplete) => {
    if (!text || typeof text !== 'string') {
      return;
    }

    // Clear any existing timeout
    if (typewriterTimeoutRef.current) {
      clearTimeout(typewriterTimeoutRef.current);
    }

    setDisplayedText("");
    let currentIndex = 0;
    const typingSpeed = 30; // milliseconds per character

    const typeNextChar = () => {
      if (currentIndex < text.length) {
        setDisplayedText(text.slice(0, currentIndex + 1));
        currentIndex++;
        typewriterTimeoutRef.current = setTimeout(typeNextChar, typingSpeed);
      } else {
        if (onComplete) onComplete();
      }
    };

    // Start typing immediately
    typeNextChar();
    
    // Start speaking after a short delay (when first few chars are typed)
    setTimeout(() => {
      speakText(text);
    }, typingSpeed * 3);
  };

  const speakText = (text) => {
    // Stop any ongoing speech
    if (speechSynthesisRef.current) {
      window.speechSynthesis.cancel();
    }

    if (!text || typeof text !== 'string') {
      console.warn("No valid text to speak");
      return;
    }

    try {
      const utterance = new SpeechSynthesisUtterance(text);
      
      // Configure voice settings for sweet and fast speech
      utterance.rate = 1.3; // Faster speed (1.3x normal)
      utterance.pitch = 1.15; // Slightly higher pitch for sweeter tone
      utterance.volume = 1.0; // Full volume
      utterance.lang = 'en-US';

      // Try to use a sweeter, more pleasant voice if available (prioritize female voices)
      const voices = window.speechSynthesis.getVoices();
      const preferredVoices = voices.filter(voice => 
        voice.lang.startsWith('en') && 
        (voice.name.includes('Samantha') || 
         voice.name.includes('Victoria') ||
         voice.name.includes('Karen') ||
         voice.name.includes('Kate') ||
         voice.name.includes('Fiona') ||
         voice.name.includes('Tessa') ||
         voice.name.includes('Google UK English Female') ||
         voice.name.includes('Google US English Female') ||
         voice.name.includes('Microsoft Zira') ||
         voice.name.includes('Natural') ||
         voice.name.includes('Enhanced'))
      );
      
      if (preferredVoices.length > 0) {
        utterance.voice = preferredVoices[0];
      } else if (voices.length > 0) {
        // Fallback to first English voice
        const englishVoice = voices.find(voice => voice.lang.startsWith('en'));
        if (englishVoice) {
          utterance.voice = englishVoice;
        }
      }

      // Event handlers
      utterance.onstart = () => {
        console.log("🔊 Speaking:", text);
        speechSynthesisRef.current = utterance;
      };

      utterance.onend = () => {
        console.log("✅ Finished speaking");
        speechSynthesisRef.current = null;
      };

      utterance.onerror = (event) => {
        console.error("❌ Speech synthesis error:", event);
        speechSynthesisRef.current = null;
      };

      // Load voices if not already loaded (some browsers need this)
      if (voices.length === 0) {
        window.speechSynthesis.onvoiceschanged = () => {
          const updatedVoices = window.speechSynthesis.getVoices();
          const preferred = updatedVoices.filter(voice => 
            voice.lang.startsWith('en') && 
            (voice.name.includes('Samantha') || 
             voice.name.includes('Victoria') ||
             voice.name.includes('Karen') ||
             voice.name.includes('Kate') ||
             voice.name.includes('Fiona') ||
             voice.name.includes('Tessa') ||
             voice.name.includes('Google UK English Female') ||
             voice.name.includes('Google US English Female') ||
             voice.name.includes('Microsoft Zira'))
          );
          if (preferred.length > 0) {
            utterance.voice = preferred[0];
          }
          // Ensure speed and pitch are set
          utterance.rate = 1.3;
          utterance.pitch = 1.15;
          window.speechSynthesis.speak(utterance);
        };
      } else {
        window.speechSynthesis.speak(utterance);
      }
    } catch (error) {
      console.error("Error with text-to-speech:", error);
    }
  };

  useEffect(() => {
    // Check backend connection on mount
    const checkBackendConnection = async () => {
      try {
        const response = await axios.get(`${BACKEND_URL}/health`, { timeout: 5000 });
        console.log("✅ Backend connected:", response.data);
        console.log("🌐 Backend URL:", BACKEND_URL);
        // Clear any previous connection errors
        if (error && error.includes("Cannot connect to backend")) {
          setError("");
        }
      } catch (err) {
        console.error("❌ Backend not reachable at", BACKEND_URL);
        console.error("Error details:", err.message);
        console.warn("Make sure backend server is running: python backend/server.py");
        // Only set error if it's a real connection issue, not just a check
        if (err.code === 'ECONNREFUSED' || err.message?.includes('Network Error') || err.message?.includes('Failed to fetch')) {
          setError(`Cannot connect to backend at ${BACKEND_URL}. Please ensure the backend server is running.`);
        }
      }
    };
    
    checkBackendConnection();
    
    // Log business category
    if (businessCategory) {
      console.log("🏢 Business category from URL:", businessCategory);
    } else {
      console.warn("⚠️ No business category found in URL params");
    }

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
      // Stop any ongoing speech when component unmounts
      if (speechSynthesisRef.current) {
        window.speechSynthesis.cancel();
      }
      // Stop typewriter effect
      if (typewriterTimeoutRef.current) {
        clearTimeout(typewriterTimeoutRef.current);
      }
    };
  }, []);

  // Trigger typewriter effect when currentResponse changes
  useEffect(() => {
    if (currentResponse?.conversationalResponse) {
      const responseText = currentResponse.conversationalResponse;
      // Only start typewriter if text is different from what's displayed
      if (responseText !== displayedText || displayedText === "") {
        typewriterEffect(responseText);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentResponse]);

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

      if (businessCategory) {
        formData.append("business_category", businessCategory);
        console.log("📤 Sending with business category:", businessCategory);
      } else {
        console.log("⚠️ No business category in URL");
      }

      // Ensure at least one is provided
      if (!transcriptionText && !audioBlob) {
        setError("Please provide either text feedback or record audio");
        setLoading(false);
        return;
      }

      console.log("📤 Sending initial feedback to backend:", BACKEND_URL);
      console.log("📦 FormData contents - Score:", score, "Category:", businessCategory, "Has transcription:", !!transcriptionText, "Has audio:", !!audioBlob);

      const res = await axios.post(`${BACKEND_URL}/submit_feedback`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 60000, // 60 second timeout for AI processing
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

      // Start typewriter effect with voice sync
      if (botReply) {
        typewriterEffect(botReply);
      }

    } catch (err) {
      console.error("❌ Error submitting initial feedback:", err);
      console.error("Error details:", err.response?.data || err.message);
      if (err.code === 'ECONNREFUSED' || err.message?.includes('Network Error') || err.message?.includes('Failed to fetch')) {
        setError(`❌ Cannot connect to backend at ${BACKEND_URL}. Please make sure the backend server is running: python backend/server.py`);
      } else if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
        setError(`⏱️ Request timed out. The AI is taking too long to respond. Please try again.`);
      } else if (err.response?.status === 400) {
        setError(err.response?.data?.detail || "Invalid request. Please check your input.");
      } else if (err.response?.status === 500) {
        setError(err.response?.data?.detail || "Server error. Please check backend logs and try again.");
      } else {
        setError(err.response?.data?.detail || err.message || "Error submitting feedback. Please try again.");
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

      if (businessCategory) {
        formData.append("business_category", businessCategory);
        console.log("📤 Sending followup with business category:", businessCategory);
      } else {
        console.log("⚠️ No business category in URL for followup");
      }

      // Ensure at least one is provided
      if (!transcriptionText && !audioBlob) {
        setError("Please provide either text feedback or record audio");
        setLoading(false);
        return;
      }

      console.log("📤 Sending follow-up to backend:", BACKEND_URL);
      console.log("📦 Followup FormData - Score:", currentScore, "Category:", businessCategory, "Has transcription:", !!transcriptionText, "Has audio:", !!audioBlob);

      const res = await axios.post(`${BACKEND_URL}/submit_followup`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 60000, // 60 second timeout for AI processing
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

      // Start typewriter effect with voice sync
      if (botReply) {
        typewriterEffect(botReply);
      }

    } catch (err) {
      console.error("❌ Error sending follow-up:", err);
      console.error("Error details:", err.response?.data || err.message);
      if (err.code === 'ECONNREFUSED' || err.message?.includes('Network Error') || err.message?.includes('Failed to fetch')) {
        setError(`❌ Cannot connect to backend at ${BACKEND_URL}. Please make sure the backend server is running: python backend/server.py`);
      } else if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
        setError(`⏱️ Request timed out. The AI is taking too long to respond. Please try again.`);
      } else if (err.response?.status === 400) {
        setError(err.response?.data?.detail || "Invalid request. Please check your input.");
      } else if (err.response?.status === 500) {
        setError(err.response?.data?.detail || "Server error. Please check backend logs and try again.");
      } else {
        setError(err.response?.data?.detail || err.message || "Error sending follow-up. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const stopConversation = async () => {
    console.log("🛑 Stopping conversation");
    
    // Stop typewriter effect
    if (typewriterTimeoutRef.current) {
      clearTimeout(typewriterTimeoutRef.current);
      typewriterTimeoutRef.current = null;
    }
    setDisplayedText("");
    
    // Stop any ongoing speech
    if (speechSynthesisRef.current) {
      window.speechSynthesis.cancel();
      speechSynthesisRef.current = null;
    }
    
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
            {/* Navigation Buttons */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
              style={{
                display: "flex",
                gap: "12px",
                justifyContent: "center",
                marginBottom: "20px",
                flexWrap: "wrap"
              }}
            >
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate('/')}
                style={{
                  padding: "10px 20px",
                  borderRadius: "12px",
                  border: "2px solid rgba(59, 130, 246, 0.3)",
                  background: "rgba(255, 255, 255, 0.1)",
                  backdropFilter: "blur(10px)",
                  color: "#3B82F6",
                  fontWeight: "600",
                  fontSize: "14px",
                  cursor: "pointer",
                  transition: "all 0.3s ease",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(59, 130, 246, 0.2)";
                  e.currentTarget.style.borderColor = "rgba(59, 130, 246, 0.5)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)";
                  e.currentTarget.style.borderColor = "rgba(59, 130, 246, 0.3)";
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                  <polyline points="9 22 9 12 15 12 15 22"></polyline>
                </svg>
                Home
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate('/dashboard')}
                style={{
                  padding: "10px 20px",
                  borderRadius: "12px",
                  border: "2px solid rgba(139, 92, 246, 0.3)",
                  background: "rgba(255, 255, 255, 0.1)",
                  backdropFilter: "blur(10px)",
                  color: "#8B5CF6",
                  fontWeight: "600",
                  fontSize: "14px",
                  cursor: "pointer",
                  transition: "all 0.3s ease",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(139, 92, 246, 0.2)";
                  e.currentTarget.style.borderColor = "rgba(139, 92, 246, 0.5)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)";
                  e.currentTarget.style.borderColor = "rgba(139, 92, 246, 0.3)";
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 3v18h18"></path>
                  <path d="M18 7L9 16l-4-4"></path>
                </svg>
                Dashboard
              </motion.button>
            </motion.div>
            
            <motion.h1
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              className="main-title"
            >
            Voice NPS Feedback
            </motion.h1>
            {businessCategory && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 }}
                style={{
                  display: "inline-block",
                  marginTop: "8px",
                  padding: "6px 16px",
                  borderRadius: "20px",
                  background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
                  color: "white",
                  fontSize: "13px",
                  fontWeight: "600",
                  textTransform: "capitalize",
                  boxShadow: "0 4px 12px rgba(99, 102, 241, 0.3)"
                }}
              >
                {businessCategory === "medical" ? "Medical" : businessCategory === "ecommerce" ? "E-commerce" : businessCategory === "restaurant" ? "Restaurant" : businessCategory}
              </motion.div>
            )}
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

            {/* AI Response Display - Moved Up */}
            <AnimatePresence>
              {(currentResponse?.conversationalResponse) && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="ai-response-container"
                  style={{
                    marginTop: "24px",
                    marginBottom: "24px",
                    padding: "24px",
                    background: "rgba(255, 255, 255, 0.95)",
                    borderRadius: "20px",
                    border: "2px solid rgba(139, 92, 246, 0.2)",
                    boxShadow: "0 8px 32px rgba(109, 40, 217, 0.1)"
                  }}
                >
                  <div className="ai-response-content">
                    <p 
                      className="ai-response-text"
                      style={{
                        fontSize: "1.1rem",
                        lineHeight: "1.7",
                        color: "#4c1d95",
                        fontWeight: "500",
                        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                        letterSpacing: "0.3px"
                      }}
                    >
                      {displayedText || currentResponse.conversationalResponse}
                      {displayedText && displayedText.length < (currentResponse.conversationalResponse?.length || 0) && (
                        <motion.span
                          animate={{ opacity: [1, 0] }}
                          transition={{ repeat: Infinity, duration: 0.8 }}
                          style={{ marginLeft: "2px" }}
                        >
                          |
                        </motion.span>
                      )}
                    </p>
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

          {/* Success Message - No green background */}
            <AnimatePresence>
          {currentResponse && !requiresFollowUp && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  style={{
                    marginTop: "16px",
                    padding: "16px",
                    background: "rgba(255, 255, 255, 0.6)",
                    borderRadius: "16px",
                    border: "2px solid rgba(139, 92, 246, 0.15)",
                    textAlign: "center"
                  }}
                >
                  <p style={{ 
                    fontSize: "0.9rem", 
                    color: "#6d28d9", 
                    fontWeight: "600",
                    marginBottom: "8px"
                  }}>
                    ✓ Conversation Complete!
                  </p>
                  {currentResponse.saved_conversation_file && (
                    <p style={{ 
                      fontSize: "0.75rem", 
                      color: "#8b5cf6",
                      marginTop: "4px"
                    }}>
                      Saved to: {currentResponse.saved_conversation_file}
                    </p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

                </div>
      </div>
    </div>
  );
}

export default VoiceNPSChat;