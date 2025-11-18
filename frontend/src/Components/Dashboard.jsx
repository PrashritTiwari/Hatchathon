import React, { useState, useEffect } from "react";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import "./Dashboard.css";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://127.0.0.1:8000";


function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [timeframe, setTimeframe] = useState("all");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [appliedRangeLabel, setAppliedRangeLabel] = useState("All time");

  useEffect(() => {
    applyPresetRange(timeframe);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeframe]);

  const formatDate = (date) => date.toISOString().split("T")[0];

  const applyPresetRange = (preset) => {
    const now = new Date();
    let start = null;
    let end = null;
    let label = "All time";

    switch (preset) {
      case "7d":
        start = formatDate(new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000));
        label = "Last 7 days";
        break;
      case "30d":
        start = formatDate(new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000));
        label = "Last 30 days";
        break;
      case "custom":
        return;
      default:
        start = null;
        end = null;
        label = "All time";
    }

    fetchAnalytics({ start_date: start, end_date: end, label });
  };

  const fetchAnalytics = async ({ start_date = null, end_date = null, label = "All time" } = {}) => {
    try {
      setLoading(true);
      setError("");
      const params = {};
      if (start_date) params.start_date = start_date;
      if (end_date) params.end_date = end_date;
      const response = await axios.get(`${BACKEND_URL}/analytics/summary`, { params });
      setData(response.data);
      setAppliedRangeLabel(label);
    } catch (err) {
      console.error("Error fetching analytics:", err);
      if (err.response?.status === 404) {
        if (err.response?.data?.detail?.includes("No saved conversations")) {
          setError("No conversations found yet. Submit some feedback first!");
        } else if (err.response?.data?.detail?.includes("No conversations found for the selected timeframe")) {
          setError("No conversations found for the selected date range. Try selecting 'All time'.");
        } else {
          setError("No conversations found. Try selecting a different date range.");
        }
      } else if (err.code === 'ECONNREFUSED' || err.message?.includes('Network Error')) {
        setError(`Cannot connect to backend at ${BACKEND_URL}. Make sure the backend server is running.`);
      } else {
        setError(err.response?.data?.detail || err.message || "Failed to load analytics");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleApplyCustomRange = () => {
    if (!customStart || !customEnd) {
      setError("Please select both start and end dates for the custom range.");
      return;
    }
    if (new Date(customStart) > new Date(customEnd)) {
      setError("Start date must be before end date.");
      return;
    }
    fetchAnalytics({
      start_date: customStart,
      end_date: customEnd,
      label: `Custom: ${customStart} → ${customEnd}`,
    });
  };

  const calculateNPS = () => {
    if (!data?.conversations) return 0;
    let promoters = 0;
    let detractors = 0;
    data.conversations.forEach((conv) => {
      const score = conv.score || 0;
      if (score >= 9) promoters++;
      else if (score <= 6) detractors++;
    });
    const total = data.conversations.length;
    if (total === 0) return 0;
    return Math.round(((promoters / total) - (detractors / total)) * 100);
  };

  const prepareRatingData = () => {
    if (!data?.conversations) return [];
    const categories = { High: 0, Medium: 0, Low: 0 };
    data.conversations.forEach((conv) => {
      const score = conv.score || 0;
      if (score >= 9) categories.High++;
      else if (score >= 7) categories.Medium++;
      else categories.Low++;
    });
    return Object.entries(categories).map(([name, value]) => ({ name, value }));
  };

  const prepareSentimentData = () => {
    if (!data?.summary?.sentiment_breakdown) return [];
    return Object.entries(data.summary.sentiment_breakdown).map(([name, value]) => ({
      name,
      value,
    }));
  };

  const prepareScoreTrend = () => {
    if (!data?.conversations) return [];
    return data.conversations
      .filter((c) => c.saved_at)
      .sort((a, b) => new Date(a.saved_at) - new Date(b.saved_at))
      .map((conv, index) => ({
        date: new Date(conv.saved_at).toLocaleDateString(),
        score: conv.score || 0,
        index: index + 1,
      }));
  };

  const prepareTopFeedback = () => {
    if (!data?.top_feedback) return [];
    return data.top_feedback.slice(0, 10).map((item) => ({
      name: item.text.length > 30 ? item.text.substring(0, 30) + "..." : item.text,
      count: item.count,
      fullText: item.text,
    }));
  };

  if (loading) {
    return (
      <div className="dashboard-container">
        <div className="content-wrapper">
          <div className="content-inner">
            <div className="loading-screen">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                className="loading-spinner"
              ></motion.div>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="loading-text"
              >
                Loading analytics...
              </motion.p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-container">
        <div className="content-wrapper">
          <div className="content-inner">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="error-card"
            >
              <div className="error-icon">
                <svg className="error-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
              </div>
              <h2 className="error-title">Error Loading Dashboard</h2>
              <p className="error-message">{error}</p>
              <div className="error-actions">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => applyPresetRange(timeframe)}
                  className="error-btn error-btn-primary"
          >
            Retry
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    setTimeframe("all");
                    applyPresetRange("all");
                  }}
                  className="error-btn error-btn-secondary"
                >
                  Try All Time
                </motion.button>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const summary = data.summary || {};
  const ratingData = prepareRatingData();
  const sentimentData = prepareSentimentData();
  const scoreTrend = prepareScoreTrend();
  const topFeedback = prepareTopFeedback();
  const npsScore = calculateNPS();

  const sentimentColors = {
    Positive: "#22C55E",
    Negative: "#EF4444",
    Neutral: "#8B5CF6",
    Frustrated: "#F97316",
    Confused: "#FACC15",
    Unknown: "#94A3B8",
  };

  return (
    <div className="dashboard-container">
      <div className="content-wrapper">
        <div className="content-inner">
        {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="dashboard-header"
          >
            <div className="header-content">
              <div>
                <h1 className="dashboard-title">Analytics Dashboard</h1>
                <p className="dashboard-subtitle">
                  Customer feedback insights and trends
                  <span className="range-label"> ({appliedRangeLabel})</span>
                </p>
              </div>
              <div className="header-controls">
                <select
                  value={timeframe}
                  onChange={(e) => setTimeframe(e.target.value)}
                  className="timeframe-select"
                >
                  <option value="all">All time</option>
                  <option value="30d">Last 30 days</option>
                  <option value="7d">Last 7 days</option>
                  <option value="custom">Custom range</option>
                </select>
                {timeframe !== "custom" && (
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => applyPresetRange(timeframe)}
                    className="refresh-btn"
                  >
                    <svg className="refresh-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="23 4 23 10 17 10"></polyline>
                      <polyline points="1 20 1 14 7 14"></polyline>
                      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                    </svg>
                    Refresh
                  </motion.button>
                )}
              </div>
            </div>

            {timeframe === "custom" && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="custom-range-card"
              >
                <div className="custom-range-inputs">
                  <div className="date-input-group">
                    <label>Start date</label>
                  <input
                    type="date"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                      className="date-input"
                  />
                </div>
                  <div className="date-input-group">
                    <label>End date</label>
                  <input
                    type="date"
                    value={customEnd}
                    max={new Date().toISOString().split("T")[0]}
                    onChange={(e) => setCustomEnd(e.target.value)}
                      className="date-input"
                  />
                </div>
                  <div className="date-input-actions">
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    onClick={handleApplyCustomRange}
                      className="apply-btn"
                  >
                    Apply
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      setCustomStart("");
                      setCustomEnd("");
                        setTimeframe("all");
                    }}
                      className="reset-btn"
                  >
                    Reset
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            )}
          </motion.div>

        {/* Summary Cards */}
          <div className="summary-grid">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="summary-card summary-card-blue"
            >
              <div className="summary-card-content">
              <div>
                  <p className="summary-label">Total Conversations</p>
                  <p className="summary-value">
                    {summary.total_conversations || 0}
                </p>
              </div>
                <div className="summary-icon">
                  <svg className="summary-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                  </svg>
            </div>
          </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="summary-card summary-card-green"
            >
              <div className="summary-card-content">
              <div>
                  <p className="summary-label">Average Rating</p>
                  <p className="summary-value">{summary.avg_score || "N/A"}</p>
                {summary.median_score && (
                    <p className="summary-sublabel">Median: {summary.median_score}</p>
                  )}
                </div>
                <div className="summary-icon">
                  <svg className="summary-icon-svg" viewBox="0 0 24 24" fill="currentColor">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                  </svg>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="summary-card summary-card-purple"
            >
              <div className="summary-card-content">
                <div>
                  <p className="summary-label">NPS Score</p>
                  <p className={`summary-value ${npsScore >= 50 ? 'nps-high' : npsScore >= 0 ? 'nps-medium' : 'nps-low'}`}>
                    {npsScore}
                  </p>
                </div>
                <div className="summary-icon">
                  <svg className="summary-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <line x1="18" y1="20" x2="18" y2="10"></line>
                    <line x1="12" y1="20" x2="12" y2="4"></line>
                    <line x1="6" y1="20" x2="6" y2="14"></line>
                  </svg>
            </div>
          </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="summary-card summary-card-orange"
            >
              <div className="summary-card-content">
              <div>
                  <p className="summary-label">Avg Conversation Turns</p>
                  <p className="summary-value">{summary.avg_turns || 0}</p>
                  {summary.max_turns && (
                    <p className="summary-sublabel">Max: {summary.max_turns}</p>
                  )}
                </div>
                <div className="summary-icon">
                  <svg className="summary-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                    <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                    <line x1="12" y1="22.08" x2="12" y2="12"></line>
                  </svg>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Charts Grid */}
          <div className="charts-grid">
            {/* Rating Distribution */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 }}
              className="chart-card"
            >
              <h2 className="chart-title">Rating Distribution</h2>
              <div className="chart-content">
                <div className="pie-chart-container">
                  <svg viewBox="0 0 200 200" className="pie-chart-svg">
                    {ratingData.reduce((acc, item, index) => {
                      const total = ratingData.reduce((sum, d) => sum + d.value, 0);
                      if (total === 0) return acc;
                      const percent = (item.value / total) * 100;
                      const startAngle = acc.currentAngle;
                      const endAngle = startAngle + (percent / 100) * 360;
                      const largeArc = percent > 50 ? 1 : 0;
                      
                      const x1 = 100 + 80 * Math.cos((startAngle * Math.PI) / 180);
                      const y1 = 100 + 80 * Math.sin((startAngle * Math.PI) / 180);
                      const x2 = 100 + 80 * Math.cos((endAngle * Math.PI) / 180);
                      const y2 = 100 + 80 * Math.sin((endAngle * Math.PI) / 180);
                      
                      const pathData = [
                        `M 100 100`,
                        `L ${x1} ${y1}`,
                        `A 80 80 0 ${largeArc} 1 ${x2} ${y2}`,
                        `Z`,
                      ].join(' ');
                      
                      const colors = { High: "#22C55E", Medium: "#FACC15", Low: "#F87171" };
                      
                      acc.elements.push(
                        <path
                          key={index}
                          d={pathData}
                          fill={colors[item.name] || "#94A3B8"}
                          className="pie-segment"
                        />
                      );
                      
                      acc.currentAngle = endAngle;
                      return acc;
                    }, { currentAngle: 0, elements: [] }).elements}
                  </svg>
                </div>
                <div className="chart-legend">
                  {ratingData.map((item) => {
                    const total = ratingData.reduce((sum, d) => sum + d.value, 0);
                    const percent = total > 0 ? ((item.value / total) * 100).toFixed(0) : 0;
                    const colors = { High: "#22C55E", Medium: "#FACC15", Low: "#F87171" };
                    return (
                      <div key={item.name} className="legend-item">
                        <span
                          className="legend-color"
                          style={{ backgroundColor: colors[item.name] || "#94A3B8" }}
                        ></span>
                        <span className="legend-label">{item.name}: {percent}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>

            {/* Sentiment Breakdown */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.4 }}
              className="chart-card"
            >
              <h2 className="chart-title">Sentiment Analysis</h2>
              <div className="sentiment-cloud">
                {sentimentData.length === 0 ? (
                  <p className="no-data">No sentiment data available</p>
                ) : (
                  sentimentData.map((item, index) => {
                    const total = sentimentData.reduce((sum, d) => sum + d.value, 0);
                    const percent = total > 0 ? ((item.value / total) * 100).toFixed(0) : 0;
                    const size = Math.max(14, 20 + (item.value / total) * 30);
                    return (
                      <motion.div
                        key={item.name}
                        initial={{ opacity: 0, scale: 0 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.5 + index * 0.1 }}
                        className="sentiment-tag"
                        style={{
                          fontSize: `${size}px`,
                          backgroundColor: sentimentColors[item.name] || "#94A3B8",
                          color: "white",
                        }}
                      >
                        {item.name} ({percent}%)
                      </motion.div>
                    );
                  })
                )}
              </div>
            </motion.div>
          </div>

          {/* Score Trend */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="chart-card chart-card-full"
          >
            <h2 className="chart-title">Rating Trend Over Time</h2>
            <div className="trend-container">
              {scoreTrend.length === 0 ? (
                <p className="no-data">No trend data available</p>
              ) : (
                <div className="trend-line">
                  {scoreTrend.map((point, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, scale: 0 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.6 + index * 0.05 }}
                      className="trend-point"
                      style={{
                        left: `${(index / (scoreTrend.length - 1 || 1)) * 100}%`,
                        bottom: `${(point.score / 10) * 100}%`,
                      }}
                      title={`${point.date}: ${point.score}/10`}
                    >
                      <div className="trend-dot"></div>
                    </motion.div>
                  ))}
          </div>
              )}
        </div>
          </motion.div>

          {/* Top Feedback Themes */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="chart-card"
          >
            <h2 className="chart-title">Top Feedback Themes</h2>
            <div className="feedback-list">
              {topFeedback.length === 0 ? (
                <p className="no-data">No feedback themes available</p>
              ) : (
                topFeedback.map((item, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.7 + index * 0.1 }}
                    className="feedback-item"
                  >
                    <div className="feedback-text">{item.fullText}</div>
                    <div className="feedback-count">{item.count}</div>
                  </motion.div>
                ))
              )}
          </div>
          </motion.div>

        {/* Conversations Table */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="table-card"
          >
            <h2 className="chart-title">Recent Conversations</h2>
            <div className="table-container">
              <table className="conversations-table">
              <thead>
                  <tr>
                    <th>Date</th>
                    <th>Score</th>
                    <th>Sentiment</th>
                    <th>Turns</th>
                    <th>Initial Feedback</th>
                    <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.conversations?.slice(0, 20).map((conv, idx) => (
                    <motion.tr
                    key={idx}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.8 + idx * 0.05 }}
                      className="table-row"
                    >
                      <td>
                      {conv.saved_at
                        ? new Date(conv.saved_at).toLocaleDateString()
                        : "N/A"}
                    </td>
                      <td>
                      <span
                          className={`score-badge ${
                          conv.score >= 9
                              ? "score-high"
                            : conv.score >= 7
                              ? "score-medium"
                              : "score-low"
                        }`}
                      >
                        {conv.score || "N/A"}
                      </span>
                    </td>
                      <td>
                      <span
                          className={`sentiment-badge sentiment-${conv.sentiment || "Unknown"}`}
                          style={{
                            backgroundColor:
                              sentimentColors[conv.sentiment || "Unknown"] || "#94A3B8",
                          }}
                      >
                        {conv.sentiment || "Unknown"}
                      </span>
                    </td>
                      <td>{conv.total_turns || 0}</td>
                      <td className="table-feedback">
                      {conv.initial_transcription || "N/A"}
                    </td>
                      <td>
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                        onClick={() => setSelectedConversation(conv)}
                          className="view-btn"
                      >
                        View
                        </motion.button>
                    </td>
                    </motion.tr>
                ))}
              </tbody>
            </table>
            </div>
          </motion.div>
          </div>
        </div>

        {/* Conversation Detail Modal */}
      <AnimatePresence>
        {selectedConversation && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="modal-overlay"
            onClick={() => setSelectedConversation(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="modal-content"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header">
                <h3>Conversation Details</h3>
                <button
                  onClick={() => setSelectedConversation(null)}
                  className="modal-close"
                >
                  ×
                </button>
              </div>
              <div className="modal-body">
                <div className="modal-grid">
                  <div className="modal-item">
                    <label>Score</label>
                    <p>{selectedConversation.score || "N/A"}</p>
                  </div>
                  <div className="modal-item">
                    <label>Sentiment</label>
                    <p>{selectedConversation.sentiment || "Unknown"}</p>
                  </div>
                  <div className="modal-item">
                    <label>Total Turns</label>
                    <p>{selectedConversation.total_turns || 0}</p>
                  </div>
                  <div className="modal-item">
                    <label>Date</label>
                    <p>
                      {selectedConversation.saved_at
                        ? new Date(selectedConversation.saved_at).toLocaleString()
                        : "N/A"}
                    </p>
                  </div>
                </div>
                <div className="modal-section">
                  <label>Initial Transcription</label>
                  <p className="modal-text">
                    {selectedConversation.initial_transcription || "N/A"}
                  </p>
                </div>
                {selectedConversation.initial_feedback_points?.length > 0 && (
                  <div className="modal-section">
                    <label>Key Feedback Points</label>
                    <ul className="modal-list">
                      {selectedConversation.initial_feedback_points.map((point, i) => (
                        <li key={i}>{point}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default Dashboard;
