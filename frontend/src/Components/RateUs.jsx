import React, { useState, useRef, useEffect } from "react";
import axios from "axios";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://127.0.0.1:8000";

function VoiceNPSChat() {
  const [score, setScore] = useState(null);
  const [transcription, setTranscription] = useState("");
  const [conversationHistory, setConversationHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState("");
  const [recordingTime, setRecordingTime] = useState(0);
  const [currentResponse, setCurrentResponse] = useState(null);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const streamRef = useRef(null);
  const recognitionRef = useRef(null);
  const timerRef = useRef(null);

  // Format time helper
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Cleanup on unmount
  useEffect(() => {
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

  // ---------------------- START RECORDING + STT --------------------------
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];
      setTranscription("");
      setError("");

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      // Browser STT
      const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRec) {
        recognitionRef.current = new SpeechRec();
        recognitionRef.current.lang = "en-US";
        recognitionRef.current.continuous = true;
        recognitionRef.current.interimResults = false;

        recognitionRef.current.onresult = (event) => {
          const result = event.results[event.results.length - 1];
          if (result.isFinal) {
            const text = result[0].transcript.trim();
            setTranscription(prev => (prev + " " + text).trim());
          }
        };

        recognitionRef.current.onerror = () => {};
        recognitionRef.current.start();
      }

      mediaRecorderRef.current.start();
      setIsRecording(true);
      setRecordingTime(0);

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (err) {
      setError("Microphone permission required. Please allow access.");
      console.error(err);
    }
  };

  // ---------------------- STOP RECORDING ---------------------------------
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

  // ---------------------- SUBMIT INITIAL FEEDBACK ------------------------
  const handleInitialSubmit = async () => {
    if (!score && score !== 0) {
      setError("Please select a score first");
      return;
    }

    setLoading(true);
    setError("");
    setCurrentResponse(null);

    try {
      const audioBlob = await stopRecording();

      const formData = new FormData();
      formData.append("score", score.toString());

      if (transcription.trim()) {
        formData.append("transcription", transcription.trim());
      } else {
        formData.append("audio_data", audioBlob, "initial.webm");
      }

      const res = await axios.post(`${BACKEND_URL}/submit_feedback`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const data = res.data;
      const botReply = data.conversationalResponse ?? data.response ?? "No response";

      setConversationHistory([
        {
          type: "initial",
          score,
          transcription: transcription.trim() || data.transcription || "[Audio message]",
          aiResponse: botReply,
          sentiment: data.sentiment,
          feedback: data.feedback
        }
      ]);

      setCurrentResponse(data);
      setTranscription("");

    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || "Error submitting initial feedback");
    } finally {
      setLoading(false);
    }
  };

  // ---------------------- SUBMIT FOLLOW-UP -------------------------------
  const handleFollowUpSend = async () => {
    if (!conversationHistory.length) {
      setError("Submit initial feedback first!");
      return;
    }

    setLoading(true);
    setError("");
    setCurrentResponse(null);

    try {
      const audioBlob = await stopRecording();

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

      if (transcription.trim()) {
        formData.append("transcription", transcription.trim());
      } else {
        formData.append("audio_data", audioBlob, "followup.webm");
      }

      const res = await axios.post(`${BACKEND_URL}/submit_followup`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const data = res.data;
      const botReply = data.conversationalResponse ?? data.response ?? "No response";

      setConversationHistory(prev => [
        ...prev,
        {
          type: "followup",
          transcription: transcription.trim() || data.transcription || "[Voice Message]",
          aiResponse: botReply,
        }
      ]);

      setCurrentResponse(data);
      setTranscription("");

    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || "Error sending follow-up");
    } finally {
      setLoading(false);
    }
  };

  // ---------------------- UI ---------------------------------------------
  const isFollowUp = conversationHistory.length > 0;
  const requiresFollowUp = currentResponse?.requiresFollowUp || false;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Voice NPS Feedback
          </h1>
          <p className="text-gray-600">
            Share your experience with us through voice
          </p>
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-2xl shadow-xl p-6 md:p-8 mb-6">
          {/* Score Selector - Only show if no conversation started */}
          {!isFollowUp && (
            <div className="mb-8">
              <label className="block text-lg font-semibold text-gray-800 mb-4">
                How likely are you to recommend us? (0-10)
              </label>
              <div className="flex flex-wrap justify-center gap-2">
                {Array.from({ length: 11 }, (_, i) => i).map(num => (
                  <button
                    key={num}
                    onClick={() => {
                      setScore(num);
                      setError("");
                      setCurrentResponse(null);
                    }}
                    className={`
                      w-12 h-12 rounded-full font-semibold text-lg
                      transition-all duration-200 transform hover:scale-110
                      ${score === num
                        ? "bg-gradient-to-br from-blue-600 to-purple-600 text-white shadow-lg scale-110"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }
                    `}
                  >
                    {num}
                  </button>
                ))}
              </div>
              <div className="flex justify-between text-xs text-gray-500 mt-2 px-2">
                <span>Not likely</span>
                <span>Very likely</span>
              </div>
            </div>
          )}

          {/* Follow-up Question Display */}
          {isFollowUp && currentResponse && requiresFollowUp && (
            <div className="mb-6 p-5 bg-gradient-to-r from-yellow-50 to-orange-50 border-l-4 border-yellow-400 rounded-lg">
              <div className="flex items-start gap-3">
                <div className="text-2xl">💬</div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-yellow-800">
                      Follow-up Question #{conversationHistory.filter(x => x.type === "followup").length + 1}
                    </span>
                  </div>
                  <p className="text-gray-800 font-medium">
                    {currentResponse.conversationalResponse}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Transcription Preview */}
          {isRecording && (
            <div className="mb-6 p-4 bg-blue-50 border-2 border-blue-200 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                <span className="text-sm font-semibold text-blue-800">
                  Recording... {formatTime(recordingTime)}
                </span>
              </div>
              {transcription && (
                <p className="text-sm text-gray-700 mt-2 italic">
                  "{transcription}"
                </p>
              )}
            </div>
          )}

          {/* Recording Controls */}
          <div className="flex flex-col items-center gap-4 mb-6">
            {!isRecording ? (
              <button
                onClick={startRecording}
                disabled={loading || (!score && score !== 0 && !isFollowUp)}
                className="px-8 py-4 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-full font-semibold text-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center gap-2"
              >
                <span className="text-2xl">🎤</span>
                Start Recording
              </button>
            ) : (
              <div className="flex gap-3">
                {!isFollowUp ? (
                  <button
                    onClick={handleInitialSubmit}
                    disabled={loading}
                    className="px-8 py-4 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-full font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? "Processing..." : "Submit Feedback"}
                  </button>
                ) : (
                  <button
                    onClick={handleFollowUpSend}
                    disabled={loading}
                    className="px-8 py-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-full font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? "Sending..." : "Send Follow-Up"}
                  </button>
                )}
                <button
                  onClick={stopRecording}
                  className="px-6 py-4 bg-gray-500 text-white rounded-full font-semibold hover:bg-gray-600 transition-all duration-200"
                >
                  Stop
                </button>
              </div>
            )}
          </div>

          {/* Error Display */}
          {error && (
            <div className="mb-4 p-4 bg-red-50 border-l-4 border-red-400 rounded-lg">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Success Message */}
          {currentResponse && !requiresFollowUp && (
            <div className="mb-4 p-4 bg-green-50 border-l-4 border-green-400 rounded-lg">
              <p className="text-sm font-semibold text-green-800 mb-1">✅ Conversation Complete!</p>
              <p className="text-sm text-green-700">
                {currentResponse.saved_conversation_file && 
                  `Saved to: ${currentResponse.saved_conversation_file}`
                }
              </p>
            </div>
          )}
        </div>

        {/* Conversation History */}
        {conversationHistory.length > 0 && (
          <div className="bg-white rounded-2xl shadow-xl p-6 md:p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
              <span>💭</span>
              Conversation History
            </h2>
            <div className="space-y-6">
              {conversationHistory.map((msg, idx) => (
                <div key={idx} className="border-l-4 border-blue-500 pl-4 py-2">
                  {msg.type === "initial" && (
                    <div className="mb-3">
                      <span className="inline-block px-3 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded-full mb-2">
                        Initial Feedback • Score: {msg.score}/10
                      </span>
                      {msg.sentiment && (
                        <span className={`inline-block px-3 py-1 ml-2 text-xs font-semibold rounded-full ${
                          msg.sentiment.toLowerCase().includes('positive') 
                            ? 'bg-green-100 text-green-800'
                            : msg.sentiment.toLowerCase().includes('negative')
                            ? 'bg-red-100 text-red-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {msg.sentiment}
                        </span>
                      )}
                    </div>
                  )}
                  {msg.type === "followup" && (
                    <span className="inline-block px-3 py-1 bg-purple-100 text-purple-800 text-xs font-semibold rounded-full mb-2">
                      Follow-up #{conversationHistory.filter((x, i) => i < idx && x.type === "followup").length + 1}
                    </span>
                  )}
                  
                  <div className="mb-3">
                    <div className="flex items-start gap-2 mb-2">
                      <span className="text-sm font-semibold text-gray-600 min-w-[60px]">You:</span>
                      <p className="text-gray-800 flex-1">{msg.transcription}</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-sm font-semibold text-blue-600 min-w-[60px]">AI:</span>
                      <p className="text-blue-800 flex-1">{msg.aiResponse}</p>
                    </div>
                  </div>

                  {msg.feedback && msg.feedback.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-gray-200">
                      <p className="text-xs font-semibold text-gray-600 mb-1">Key Points:</p>
                      <ul className="list-disc list-inside space-y-1">
                        {msg.feedback.map((point, i) => (
                          <li key={i} className="text-xs text-gray-600">{point}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Current Response Details */}
        {currentResponse && (
          <div className="mt-6 bg-white rounded-2xl shadow-xl p-6 md:p-8">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Latest Response</h3>
            <div className="space-y-3">
              {currentResponse.sentiment && (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-gray-600">Sentiment:</span>
                  <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                    currentResponse.sentiment.toLowerCase().includes('positive')
                      ? 'bg-green-100 text-green-800'
                      : currentResponse.sentiment.toLowerCase().includes('negative')
                      ? 'bg-red-100 text-red-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {currentResponse.sentiment}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-gray-600">Status:</span>
                <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                  currentResponse.conversationComplete || !currentResponse.requiresFollowUp
                    ? 'bg-green-100 text-green-800'
                    : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {currentResponse.conversationComplete || !currentResponse.requiresFollowUp
                    ? '✅ Complete'
                    : '💬 Needs Follow-up'
                  }
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default VoiceNPSChat;
