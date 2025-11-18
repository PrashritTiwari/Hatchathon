import { useState } from "react";
import VoiceFeedbackChat from "../Components/RateUs";
import Dashboard from "../Components/Dashboard";

export default function HomePage() {
  const [currentView, setCurrentView] = useState("rating"); // "rating" or "dashboard"

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Navigation Bar */}
      <nav className="bg-white shadow-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <svg className="w-6 h-6 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 11a7 7 0 0 1-7 7m0 0a7 7 0 0 1-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 0 1-3-3V5a3 3 0 1 1 6 0v6a3 3 0 0 1-3 3z"></path>
              </svg>
              <h1 className="text-xl font-bold text-gray-900">Voice NPS Feedback</h1>
            </div>
            <div className="flex gap-4">
              <button
                onClick={() => setCurrentView("rating")}
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  currentView === "rating"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                Submit Feedback
              </button>
              <button
                onClick={() => setCurrentView("dashboard")}
                className={`px-4 py-2 rounded-lg font-medium transition flex items-center gap-2 ${
                  currentView === "dashboard"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 3v18h18"></path>
                  <path d="M18 17V9"></path>
                  <path d="M13 17V5"></path>
                  <path d="M8 17v-3"></path>
                </svg>
                Dashboard
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Content */}
      <div className="py-4">
        {currentView === "rating" ? <VoiceFeedbackChat /> : <Dashboard />}
      </div>
    </div>
  );
}
