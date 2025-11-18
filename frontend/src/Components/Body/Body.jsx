import "./Body.css";
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faMicrophone, faArrowRight, faStar, faChartBar, faComments, faChartLine, faClock, faShield, faUsers, faBrain, faCheckCircle, faGlobe, faRocket, faBuilding, faHospital, faStore, faUtensils } from "@fortawesome/free-solid-svg-icons";

export default function Body(){
    const navigate = useNavigate();
    
    const businessCategories = [
        { id: "medical", name: "Medical", icon: faHospital, description: "Healthcare & Medical Services", color: "#10B981" },
        { id: "ecommerce", name: "E-commerce", icon: faStore, description: "Online Shopping & Retail", color: "#3B82F6" },
        { id: "restaurant", name: "Restaurant", icon: faUtensils, description: "Food & Hospitality", color: "#F59E0B" }
    ];

    const handleCategoryClick = (categoryId) => {
        navigate(`/feedback?category=${categoryId}`);
    };

    const features = [
        { icon: faMicrophone, title: "Natural Conversation", desc: "Speak naturally and let our AI understand your feedback in real-time." },
        { icon: faChartBar, title: "Real-Time Analysis", desc: "Get instant insights from voice feedback with advanced sentiment analysis." },
        { icon: faComments, title: "Interactive Experience", desc: "Engage in meaningful conversations with our intelligent assistant." },
        { icon: faChartLine, title: "Actionable Insights", desc: "Transform voice data into comprehensive reports and visualizations." },
        { icon: faClock, title: "Quick & Efficient", desc: "Save time with voice feedback that's faster than traditional surveys." },
        { icon: faShield, title: "Secure & Private", desc: "Your voice data is encrypted and protected with enterprise-grade security." }
    ];

    const stats = [
        { value: "3+", label: "Business Categories", icon: faBuilding },
        { value: "AI-Powered", label: "Voice Analysis", icon: faMicrophone },
        { value: "Real-Time", label: "Feedback Processing", icon: faClock },
        { value: "100%", label: "Free to Use", icon: faStar }
    ];

    const testimonials = [
        {
            name: "Sarah Johnson",
            role: "Product Manager",
            company: "TechCorp",
            text: "This voice feedback system has revolutionized how we collect customer insights. The AI understands context perfectly!",
            rating: 5
        },
        {
            name: "Michael Chen",
            role: "UX Designer",
            company: "DesignStudio",
            text: "The natural conversation flow makes customers feel heard. It's like talking to a real person who truly listens.",
            rating: 5
        },
        {
            name: "Emily Rodriguez",
            role: "Customer Success",
            company: "StartupXYZ",
            text: "Real-time analysis helps us respond to issues instantly. Our customer satisfaction has improved dramatically.",
            rating: 5
        }
    ];

    return(
        <div className="body-container">
            {/* Hero Section */}
            <section id="hero" className="hero-section">
                <div className="hero-content-wrapper">
                    <div className="hero-left">
                        <div className="hero-badge">
                            <FontAwesomeIcon icon={faStar} className="sparkle-icon" />
                            <span>AI-Powered Voice Assistant</span>
                        </div>
                        <h1 className="hero-title">
                            <span className="title-line-1">Transform Customer Feedback with</span>
                            <span className="title-line-2">
                                <span className="word-voice">Voice</span>
                                <span className="word-intelligence">Intelligence</span>
                            </span>
                        </h1>
                        <p className="hero-description">
                            Experience the future of customer insights through our AI-powered voice assistant. 
                            Collect, analyze, and understand customer experiences like never before.
                        </p>
                        <div className="hero-actions">
                            <button 
                                className="btn-primary-action"
                                onClick={() => {
                                    const element = document.getElementById('popular-business-categories');
                                    if (element) {
                                        element.scrollIntoView({ behavior: 'smooth' });
                                    }
                                }}
                            >
                                <div className="btn-icon-wrapper">
                                    <FontAwesomeIcon icon={faArrowRight} className="btn-icon" />
                                </div>
                                <span className="btn-text">Get Started</span>
                                <div className="btn-shine"></div>
                            </button>
                        </div>
                        <div className="hero-stats-mini">
                            <div className="stat-mini">
                                <div className="stat-mini-icon-wrapper">
                                    <div className="stat-mini-icon-bg"></div>
                                    <FontAwesomeIcon icon={faBuilding} className="stat-mini-icon" />
                                </div>
                                <div className="stat-mini-content">
                                    <div className="stat-mini-value">
                                        <span className="stat-number">3</span>
                                        <span className="stat-plus">+</span>
                                    </div>
                                    <div className="stat-mini-label">Categories</div>
                                </div>
                                <div className="stat-glow"></div>
                            </div>
                            <div className="stat-mini">
                                <div className="stat-mini-icon-wrapper">
                                    <div className="stat-mini-icon-bg"></div>
                                    <FontAwesomeIcon icon={faMicrophone} className="stat-mini-icon" />
                                </div>
                                <div className="stat-mini-content">
                                    <div className="stat-mini-value">
                                        <span className="stat-number">AI</span>
                                    </div>
                                    <div className="stat-mini-label">Powered</div>
                                </div>
                                <div className="stat-glow"></div>
                            </div>
                            <div className="stat-mini">
                                <div className="stat-mini-icon-wrapper">
                                    <div className="stat-mini-icon-bg"></div>
                                    <FontAwesomeIcon icon={faClock} className="stat-mini-icon" />
                                </div>
                                <div className="stat-mini-content">
                                    <div className="stat-mini-value">
                                        <span className="stat-number">Real</span>
                                    </div>
                                    <div className="stat-mini-label">Time</div>
                                </div>
                                <div className="stat-glow"></div>
                            </div>
                        </div>
                    </div>
                    <div className="hero-right">
                        <div className="phone-mockup">
                            <div className="phone-frame">
                                <div className="phone-screen">
                                    <div className="screen-header">
                                        <div className="status-bar">
                                            <span>9:41</span>
                                            <div className="status-icons">
                                                <span>📶</span>
                                                <span>📶</span>
                                                <span>🔋</span>
                                            </div>
                                        </div>
                                        <div className="app-header">
                                            <h3>Voice Feedback</h3>
                                            <div className="header-wave"></div>
                                        </div>
                                    </div>
                                    <div className="screen-content">
                                        <div className="voice-card">
                                            <div className="voice-icon-large">
                                                <FontAwesomeIcon icon={faMicrophone} />
                                            </div>
                                            <h4>Start Your Feedback</h4>
                                            <p>Tap the microphone and speak naturally about your experience</p>
                                            <div className="voice-indicators">
                                                <div className="indicator"></div>
                                                <div className="indicator"></div>
                                                <div className="indicator"></div>
                                            </div>
                                        </div>
                                        <div className="feedback-preview">
                                            <div className="preview-item">
                                                <FontAwesomeIcon icon={faCheckCircle} className="check-icon" />
                                                <span>Real-time Analysis</span>
                                            </div>
                                            <div className="preview-item">
                                                <FontAwesomeIcon icon={faCheckCircle} className="check-icon" />
                                                <span>Sentiment Detection</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="screen-footer">
                                        <div className="nav-tabs">
                                            <div className="tab active">Home</div>
                                            <div className="tab">Feedback</div>
                                            <div className="tab">Analytics</div>
                                            <div className="tab">Profile</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Stats Section */}
            <section className="stats-section">
                <div className="stats-grid">
                    {stats.map((stat, index) => (
                        <div key={index} className="stat-item">
                            <div className="stat-icon-box">
                                <FontAwesomeIcon icon={stat.icon} className="stat-icon" />
                            </div>
                            <div className="stat-content">
                                <div className="stat-value">{stat.value}</div>
                                <div className="stat-label">{stat.label}</div>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* Features Section */}
            <section id="features" className="features-section">
                <div className="section-container">
                    <div className="section-header">
                        <h2 className="section-title">Why Choose Voice Feedback?</h2>
                        <p className="section-subtitle">Revolutionary features that make feedback collection effortless</p>
                    </div>
                    <div className="features-grid">
                        {features.map((feature, index) => (
                            <div key={index} className="feature-card">
                                <div className="feature-icon-wrapper">
                                    <FontAwesomeIcon icon={feature.icon} className="feature-icon" />
                                </div>
                                <h3 className="feature-title">{feature.title}</h3>
                                <p className="feature-description">{feature.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Popular Business Categories Section - Above How It Works */}
            <section id="popular-business-categories" className="business-categories-section" style={{ padding: "80px 0", background: "linear-gradient(to bottom, rgba(59, 130, 246, 0.05), transparent)" }}>
                <div className="section-container">
                    <div className="section-header">
                        <h2 className="section-title">Popular Business Categories</h2>
                        <p className="section-subtitle">Select your industry to get tailored feedback responses</p>
                    </div>
                    <div className="business-categories-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "30px", marginTop: "50px" }}>
                        {businessCategories.map((category) => (
                            <div 
                                key={category.id}
                                onClick={() => handleCategoryClick(category.id)}
                                style={{
                                    background: "white",
                                    borderRadius: "20px",
                                    padding: "40px 30px",
                                    textAlign: "center",
                                    cursor: "pointer",
                                    transition: "all 0.3s ease",
                                    boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
                                    border: "2px solid transparent"
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.transform = "translateY(-10px)";
                                    e.currentTarget.style.boxShadow = "0 10px 25px rgba(0, 0, 0, 0.15)";
                                    e.currentTarget.style.borderColor = category.color;
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.transform = "translateY(0)";
                                    e.currentTarget.style.boxShadow = "0 4px 6px rgba(0, 0, 0, 0.1)";
                                    e.currentTarget.style.borderColor = "transparent";
                                }}
                            >
                                <div style={{ 
                                    fontSize: "48px", 
                                    color: category.color, 
                                    marginBottom: "20px",
                                    display: "flex",
                                    justifyContent: "center"
                                }}>
                                    <FontAwesomeIcon icon={category.icon} />
                                </div>
                                <h3 style={{ fontSize: "24px", fontWeight: "bold", marginBottom: "10px", color: "#1F2937" }}>
                                    {category.name}
                                </h3>
                                <p style={{ color: "#6B7280", fontSize: "14px" }}>{category.description}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* How It Works Section */}
            <section className="how-it-works-section">
                <div className="section-container">
                    <div className="section-header">
                        <h2 className="section-title">How It Works</h2>
                        <p className="section-subtitle">Get started in three simple steps</p>
                    </div>
                    <div className="steps-wrapper">
                        <div className="step-card">
                            <div className="step-number">1</div>
                            <h3 className="step-title">Start Conversation</h3>
                            <p className="step-description">
                                Click the microphone button and begin speaking. Our AI assistant 
                                will guide you through the feedback process.
                            </p>
                        </div>
                        <div className="step-card">
                            <div className="step-number">2</div>
                            <h3 className="step-title">Share Your Experience</h3>
                            <p className="step-description">
                                Talk naturally about your experience. The assistant understands 
                                context and asks follow-up questions when needed.
                            </p>
                        </div>
                        <div className="step-card">
                            <div className="step-number">3</div>
                            <h3 className="step-title">Get Insights</h3>
                            <p className="step-description">
                                Receive instant analysis and comprehensive reports of your 
                                feedback, ready for action.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

        </div>
    );
}