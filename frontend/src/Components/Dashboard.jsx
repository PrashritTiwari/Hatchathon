import React, { useState, useEffect, useRef, useMemo, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faComments, faStar, faSync, faChartLine, faHome } from "@fortawesome/free-solid-svg-icons";
import { Canvas, useFrame } from "@react-three/fiber";
import { Stars } from "@react-three/drei";
import * as THREE from "three";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";
import "./Dashboard.css";

const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL || "http://127.0.0.1:8000";

// Color constants - No yellowish colors in elements
const RATING_COLORS = {
  High: "#10B981", // Green
  Medium: "#6366F1", // Blue
  Low: "#EF4444", // Red
};
const SENTIMENT_COLORS = [
  "#10B981", // Green
  "#EF4444", // Red
  "#6366F1", // Blue
  "#8B5CF6", // Purple
  "#EC4899", // Pink
  "#14B8A6", // Teal
  "#F97316", // Orange
  "#3B82F6", // Blue
];

// String with Sound Waves - Like RateUs
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
        color="#FFF8DC"
        transparent
        opacity={0.4}
        linewidth={5}
      />
    </line>
  );
}

function StringCurtain({ position, stringCount = 15 }) {
  const strings = useMemo(() => {
    return Array.from({ length: stringCount }).map((_, i) => ({
      z: (i - stringCount / 2) * 0.4,
      waveSpeed: 0.5 + (i % 3) * 0.3,
      waveAmplitude: 0.3 + (i % 2) * 0.2,
      delay: i * 0.2,
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

function Scene3D() {
  return (
    <>
      <ambientLight intensity={0.3} />
      <pointLight position={[10, 10, 10]} intensity={0.5} color="#FFF8DC" />
      <pointLight position={[-10, -10, -10]} intensity={0.3} color="#FEF9C3" />
      <Stars radius={100} depth={50} count={5000} factor={4} fade speed={1} />
      <StringCurtain position={[-8, 2, -10]} stringCount={12} />
      <StringCurtain position={[8, -2, -10]} stringCount={12} />
      <StringCurtain position={[0, 4, -12]} stringCount={10} />
    </>
  );
}

function Dashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [topFocusAreas, setTopFocusAreas] = useState(null);
  const [timeframe, setTimeframe] = useState("30d");
  const [appliedRangeLabel, setAppliedRangeLabel] = useState("Last 30 days");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkBackend = async () => {
      try {
        const response = await axios.get(`${BACKEND_URL}/health`, { timeout: 5000 });
        console.log("✅ Backend connected:", response.data);
      } catch (err) {
        console.warn("⚠️ Backend not reachable:", BACKEND_URL);
      }
    };
    checkBackend();
  }, []);

  useEffect(() => handlePreset(timeframe), [timeframe]);

  const toISODate = (d) => d.toISOString().split("T")[0];

  const handlePreset = (range) => {
    if (range === "custom") return;

    const now = new Date();
    const presets = {
      "7d": { start: toISODate(new Date(now - 6 * 86400000)), label: "Last 7 days" },
      "30d": { start: toISODate(new Date(now - 29 * 86400000)), label: "Last 30 days" },
      all: { start: null, label: "All time" },
    };

    const selected = presets[range] || presets["all"];
    fetchData({ start_date: selected.start, label: selected.label });
  };

  const getDemoData = () => {
    const now = new Date();
    const conversations = [];
    for (let i = 0; i < 15; i++) {
      const date = new Date(now - i * 86400000);
      conversations.push({
        filename: `demo_conversation_${i}.json`,
        saved_at: date.toISOString(),
        score: Math.floor(Math.random() * 11),
        sentiment: ["Positive", "Negative", "Neutral", "Frustrated", "Happy"][Math.floor(Math.random() * 5)],
        requires_followup: Math.random() > 0.5,
        conversation_complete: Math.random() > 0.3,
        total_turns: Math.floor(Math.random() * 5) + 1,
        initial_transcription: `Demo feedback ${i + 1}: Great service overall.`,
        final_transcription: `Demo feedback ${i + 1}: Great service overall.`,
        final_response: "Thank you for your feedback!",
        initial_feedback_points: ["Great service", "Fast response", "Helpful staff"]
      });
    }

    const scores = conversations.map(c => c.score);
    const avgScore = (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1);
    const followupCount = conversations.filter(c => c.requires_followup).length;
    const followupPct = ((followupCount / conversations.length) * 100).toFixed(1);
    const avgTurns = (conversations.reduce((sum, c) => sum + c.total_turns, 0) / conversations.length).toFixed(1);

    const sentimentBreakdown = {};
    conversations.forEach(c => {
      sentimentBreakdown[c.sentiment] = (sentimentBreakdown[c.sentiment] || 0) + 1;
    });

    return {
      summary: {
        total_conversations: conversations.length,
        avg_score: parseFloat(avgScore),
        median_score: 7.0,
        sentiment_breakdown: sentimentBreakdown,
        followup_required_pct: parseFloat(followupPct),
        completed_pct: 85.0,
        avg_turns: parseFloat(avgTurns),
        max_turns: 5
      },
      top_feedback: [
        { text: "Great service and fast response", count: 8 },
        { text: "Helpful and friendly staff", count: 6 },
        { text: "Excellent product quality", count: 5 },
        { text: "Quick delivery time", count: 4 },
        { text: "Easy to use interface", count: 3 }
      ],
      conversations: conversations
    };
  };

  const fetchTopFocusAreas = async ({ start_date = null, end_date = null }) => {
    try {
      const response = await axios.get(`${BACKEND_URL}/analytics/top-focus-areas`, {
        params: { ...(start_date && { start_date }), ...(end_date && { end_date }) },
        timeout: 10000, // Longer timeout for AI processing
      });
      setTopFocusAreas(response.data);
    } catch (error) {
      console.warn("Failed to fetch top focus areas:", error);
      // Set demo data if backend unavailable
      if (error.code === 'ECONNREFUSED' || error.message?.includes('Network Error') || error.message?.includes('Failed to fetch')) {
        setTopFocusAreas({
          top_focus_areas: [
            { title: "Improve Customer Support Response Time", explanation: "Multiple customers mentioned slow response times. Quicker support would significantly improve satisfaction." },
            { title: "Enhance Product Quality", explanation: "Several feedback points highlighted quality concerns. Focusing on product improvements is crucial." },
            { title: "Streamline User Experience", explanation: "Users mentioned usability issues. Simplifying the interface could reduce friction." }
          ]
        });
      } else if (error.response?.status === 404 && error.response?.data?.detail?.includes("No negative or frustrated feedback")) {
        // No negative feedback found - don't show the section
        setTopFocusAreas(null);
      } else {
        setTopFocusAreas(null);
      }
    }
  };

  const fetchData = async ({ start_date = null, end_date = null, label = "All Time" }) => {
    try {
      setLoading(true);
      setErrorMsg("");

      const response = await axios.get(`${BACKEND_URL}/analytics/summary`, {
        params: { ...(start_date && { start_date }), ...(end_date && { end_date }) },
        timeout: 5000,
      });

      setData(response.data);
      setAppliedRangeLabel(label);
      
      // Also fetch top focus areas
      await fetchTopFocusAreas({ start_date, end_date });
    } catch (error) {
      if (error.code === 'ECONNREFUSED' || error.message?.includes('Network Error') || error.message?.includes('Failed to fetch') || error.code === 'ECONNABORTED') {
        const demoData = getDemoData();
        setData(demoData);
        setAppliedRangeLabel("Demo Mode - " + label);
        setErrorMsg("");
        // Fetch demo focus areas too
        await fetchTopFocusAreas({ start_date, end_date });
      } else if (error.response?.status === 404) {
        const detail = error.response?.data?.detail || "";
        if (detail.includes("No saved conversations")) {
          setErrorMsg("No conversations found yet. Submit some feedback first!");
        } else {
          setErrorMsg(detail || "No data available for the selected timeframe.");
        }
      } else {
        setErrorMsg(error?.response?.data?.detail || error.message || "Failed to load analytics.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCustomApply = () => {
    if (!customStart || !customEnd) return setErrorMsg("Both dates required");
    if (new Date(customStart) > new Date(customEnd))
      return setErrorMsg("Invalid range");

    fetchData({
      start_date: customStart,
      end_date: customEnd,
      label: `Custom: ${customStart} → ${customEnd}`,
    });
    // fetchTopFocusAreas is already called inside fetchData
  };

  const ratingCategory = (score) => (score >= 9 ? "High" : score >= 7 ? "Medium" : "Low");

  const ratingData = data?.conversations
    ? ["High", "Medium", "Low"].map((cat) => ({
        name: cat,
        value: data.conversations.filter((c) => ratingCategory(c.score) === cat).length,
      }))
    : [];

  const sentimentData = data?.summary?.sentiment_breakdown
    ? Object.entries(data.summary.sentiment_breakdown).map(([name, value]) => ({ name, value }))
    : [];

  const trendData = data?.conversations
    ? data.conversations
      .filter((c) => c.saved_at)
      .sort((a, b) => new Date(a.saved_at) - new Date(b.saved_at))
        .map((c) => ({
          date: new Date(c.saved_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
          score: c.score || 0,
        }))
    : [];

  const topFeedback = data?.top_feedback
    ? data.top_feedback.slice(0, 8).map((i) => ({
        name: i.text.length > 40 ? i.text.slice(0, 40) + "..." : i.text,
        count: i.count,
        full: i.text,
      }))
    : [];

  const turnsData = data?.conversations
    ? Object.entries(
        data.conversations.reduce((acc, c) => {
          const t = c.total_turns || 0;
          acc[t] = (acc[t] || 0) + 1;
          return acc;
        }, {})
      )
      .map(([turns, count]) => ({
        turns: Number(turns),
          label: `${turns} turn${turns > 1 ? "s" : ""}`,
        count,
      }))
        .sort((a, b) => a.turns - b.turns)
    : [];

  if (loading)
    return (
      <div className="dashboard-container">
        <div className="animated-background"></div>
        <div className="three-d-background">
          <Canvas camera={{ position: [0, 0, 5], fov: 75 }}>
            <Suspense fallback={null}>
              <Scene3D />
            </Suspense>
          </Canvas>
        </div>
        <div className="content-wrapper">
          <div className="content-inner">
            <div className="loading-screen">
              <div className="loading-spinner"></div>
              <div className="loading-text">Loading analytics...</div>
            </div>
          </div>
        </div>
      </div>
    );

  if (errorMsg)
    return (
      <div className="dashboard-container">
        <div className="animated-background"></div>
        <div className="three-d-background">
          <Canvas camera={{ position: [0, 0, 5], fov: 75 }}>
            <Suspense fallback={null}>
              <Scene3D />
            </Suspense>
          </Canvas>
        </div>
        <div className="content-wrapper">
          <div className="content-inner">
            <div className="error-card">
              <div className="error-icon">
                <FontAwesomeIcon icon={faComments} className="error-icon-svg" />
              </div>
              <h2 className="error-title">Connection Error</h2>
              <p className="error-message">{errorMsg}</p>
              <div className="error-actions">
                <button className="error-btn error-btn-primary" onClick={() => fetchData({})}>
              Retry
            </button>
                <button className="error-btn error-btn-secondary" onClick={() => navigate('/')}>
                  Go Home
            </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );

  if (!data) return null;

  const summary = data.summary || {};

    return (
    <div className="dashboard-container">
      {/* Animated Background Gradient */}
      <div className="animated-background"></div>
      
      {/* 3D Background */}
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
          <Header appliedLabel={appliedRangeLabel} timeframe={timeframe} setTimeframe={setTimeframe} navigate={navigate} />

          {/* Custom Range */}
          {timeframe === "custom" && (
            <CustomRange
              start={customStart}
              end={customEnd}
              setStart={setCustomStart}
              setEnd={setCustomEnd}
              onApply={handleCustomApply}
            />
          )}

          {/* Top 3 Focus Areas */}
          {topFocusAreas && topFocusAreas.top_focus_areas && (
            <TopFocusSection focusAreas={topFocusAreas.top_focus_areas} />
          )}

          {/* Stats Grid */}
          <div className="summary-grid">
            <StatCard label="Total Conversations" value={summary?.total_conversations || 0} iconComponent={faComments} />
            <StatCard
              label="Average Rating"
              value={summary?.avg_score ? summary.avg_score.toFixed(1) : "N/A"}
              iconComponent={faStar}
              trend={summary?.avg_score && summary.avg_score >= 7 ? "up" : "down"}
            />
            <StatCard label="Follow-ups Needed" value={`${summary?.followup_required_pct || 0}%`} iconComponent={faSync} />
            <StatCard label="Avg Turns" value={summary?.avg_turns ? summary.avg_turns.toFixed(1) : "0.0"} iconComponent={faChartLine} />
          </div>

          {/* Charts Grid */}
          <div className="charts-grid">
            <PieSection title="Rating Distribution" data={ratingData} colors={RATING_COLORS} />
            <PieSection title="Sentiment Breakdown" data={sentimentData} colors={SENTIMENT_COLORS} />
          </div>

          {/* Full Chart */}
          <FullChart title="Rating Trend">
            <ResponsiveContainer width="100%" height={350}>
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="lineColor" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.7} />
                    <stop offset="50%" stopColor="#6366F1" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#EF4444" stopOpacity={0.15} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" opacity={0.6} />
                <XAxis dataKey="date" stroke="#475569" fontSize={11} fontWeight="500" />
                <YAxis domain={[0, 10]} stroke="#475569" fontSize={11} fontWeight="500" />
                <Tooltip contentStyle={ttStyle} />
                <Area dataKey="score" stroke="#6366F1" strokeWidth={2} fill="url(#lineColor)" />
              </AreaChart>
            </ResponsiveContainer>
          </FullChart>

          {/* Bar Charts */}
          <div className="charts-grid">
            <BarSection title="Top Feedback" data={topFeedback} dataKey="count" nameKey="name" />
            <BarSection title="Turns Distribution" data={turnsData} dataKey="count" nameKey="label" />
          </div>
        </div>
        </div>
      </div>
    );
  }

const ttStyle = {
  backgroundColor: "rgba(255,255,255,0.98)",
  border: "2px solid #E2E8F0",
  borderRadius: "12px",
  color: "#1E293B",
  boxShadow: "0 10px 25px rgba(0,0,0,0.1)",
  padding: "12px 14px",
  fontSize: "12px",
  fontWeight: "500",
};

function Header({ appliedLabel, timeframe, setTimeframe, navigate }) {
  const presets = [
    { key: "7d", label: "7 Days" },
    { key: "30d", label: "30 Days" },
    { key: "all", label: "All Time" },
    { key: "custom", label: "Custom" },
  ];

  return (
    <header className="dashboard-header">
      <div className="header-content">
              <div>
          <div className="header-title-wrapper">
            <button onClick={() => navigate('/')} className="home-btn">
              <FontAwesomeIcon icon={faHome} className="home-icon" />
              Home
            </button>
            <h1 className="dashboard-title">Analytics Dashboard</h1>
          </div>
          <div className="range-label">{appliedLabel.replace("Demo Mode - ", "")}</div>
              </div>
        <div className="header-controls">
          {presets.map((preset) => (
                  <button
              key={preset.key}
              onClick={() => setTimeframe(preset.key)}
              className={`timeframe-select ${timeframe === preset.key ? "active" : ""}`}
                  >
              {preset.label}
                  </button>
          ))}
              </div>
            </div>
    </header>
  );
}

function CustomRange({ start, end, setStart, setEnd, onApply }) {
  return (
    <div className="custom-range-card">
      <div className="custom-range-inputs">
        <div className="date-input-group">
          <label>Start Date</label>
                  <input
                    type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="date-input"
                  />
                </div>
        <div className="date-input-group">
          <label>End Date</label>
                  <input
                    type="date"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            className="date-input"
                  />
                </div>
        <div className="date-input-actions">
          <button onClick={onApply} className="apply-btn">
                    Apply
                  </button>
                  <button
                    onClick={() => {
              setStart("");
              setEnd("");
                    }}
            className="reset-btn"
                  >
                    Reset
                  </button>
                </div>
              </div>
    </div>
  );
}

function StatCard({ label, value, iconComponent, trend }) {
  const getColorClass = () => {
    if (trend === "up") return "summary-card-green";
    if (trend === "down") return "summary-card-orange";
    return "summary-card-blue";
  };

  return (
    <div className={`summary-card ${getColorClass()}`}>
      <div className="summary-card-content">
        <div>
          <div className="summary-label">{label}</div>
          <div className={`summary-value ${trend === "up" ? "nps-high" : trend === "down" ? "nps-low" : ""}`}>
            {value}
          </div>
        </div>
        <div className="summary-icon">
          <FontAwesomeIcon icon={iconComponent} className="summary-icon-svg" />
            </div>
          </div>
        </div>
  );
}

function PieSection({ title, data, colors }) {
  const COLORS_ARRAY = Object.values(colors);

  return (
    <div className="chart-card">
      <h3 className="chart-title">{title}</h3>
      <div className="chart-content">
        <div className="pie-chart-container">
          <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                data={data}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS_ARRAY[index % COLORS_ARRAY.length]} />
                  ))}
                </Pie>
              <Tooltip contentStyle={ttStyle} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
          </div>
  );
}

function BarSection({ title, data, dataKey, nameKey }) {
  const colors = ["#6366F1", "#10B981", "#EF4444", "#8B5CF6", "#EC4899", "#14B8A6", "#F97316"];

  return (
    <div className="chart-card">
      <h3 className="chart-title">{title}</h3>
      <div className="chart-content">
          <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" opacity={0.6} />
            <XAxis dataKey={nameKey} stroke="#475569" fontSize={11} fontWeight="500" />
            <YAxis stroke="#475569" fontSize={11} fontWeight="500" />
            <Tooltip contentStyle={ttStyle} />
            <Bar dataKey={dataKey} fill="#6366F1" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
      </div>
    </div>
  );
}

function FullChart({ title, children }) {
  return (
    <div className="chart-card chart-card-full">
      <h3 className="chart-title">{title}</h3>
      <div className="chart-content">{children}</div>
    </div>
  );
}

function TopFocusSection({ focusAreas }) {
  return (
    <div className="top-focus-section">
      <div className="top-focus-header">
        <h2 className="top-focus-title">Top 3 Things to Focus On</h2>
        <p className="top-focus-subtitle">AI-generated insights based on negative and frustrated customer feedback</p>
      </div>
      <div className="top-focus-grid">
        {focusAreas.map((area, index) => (
          <div key={index} className="top-focus-card">
            <div className="top-focus-number">{index + 1}</div>
            <div className="top-focus-content">
              <h3 className="top-focus-card-title">{area.title}</h3>
              <p className="top-focus-card-explanation">{area.explanation}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Dashboard;