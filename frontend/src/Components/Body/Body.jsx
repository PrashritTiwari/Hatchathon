import "./Body.css";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faMicrophone, faArrowRight, faStar, faChartBar, faComments, faChartLine, faClock, faShield, faUsers, faBrain, faCheckCircle, faGlobe, faRocket, faBuilding } from "@fortawesome/free-solid-svg-icons";

export default function Body(){
    const features = [
        { icon: faMicrophone, title: "Natural Conversation", desc: "Speak naturally and let our AI understand your feedback in real-time." },
        { icon: faChartBar, title: "Real-Time Analysis", desc: "Get instant insights from voice feedback with advanced sentiment analysis." },
        { icon: faComments, title: "Interactive Experience", desc: "Engage in meaningful conversations with our intelligent assistant." },
        { icon: faChartLine, title: "Actionable Insights", desc: "Transform voice data into comprehensive reports and visualizations." },
        { icon: faClock, title: "Quick & Efficient", desc: "Save time with voice feedback that's faster than traditional surveys." },
        { icon: faShield, title: "Secure & Private", desc: "Your voice data is encrypted and protected with enterprise-grade security." }
    ];

    const stats = [
        { value: "$2.5B+", label: "Market Potential", icon: faChartLine },
        { value: "500M+", label: "Potential Users", icon: faUsers },
        { value: "95%", label: "Time Saved", icon: faClock },
        { value: "100+", label: "Industries", icon: faBuilding }
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
                            <button className="btn-primary-action">
                                <div className="btn-icon-wrapper">
                                    <FontAwesomeIcon icon={faArrowRight} className="btn-icon" />
                                </div>
                                <span className="btn-text">Get Started</span>
                                <div className="btn-shine"></div>
                            </button>
                            <button className="btn-secondary-action">
                                <span className="btn-text">Explore Features</span>
                                <div className="btn-icon-wrapper-secondary">
                                    <FontAwesomeIcon icon={faArrowRight} className="arrow-icon" />
                                </div>
                                <div className="btn-border-animation"></div>
                            </button>
                        </div>
                        <div className="hero-stats-mini">
                            <div className="stat-mini">
                                <div className="stat-mini-icon-wrapper">
                                    <div className="stat-mini-icon-bg"></div>
                                    <FontAwesomeIcon icon={faChartLine} className="stat-mini-icon" />
                                </div>
                                <div className="stat-mini-content">
                                    <div className="stat-mini-value">
                                        <span className="stat-number">$2.5B</span>
                                        <span className="stat-plus">+</span>
                                    </div>
                                    <div className="stat-mini-label">Market Potential</div>
                                </div>
                                <div className="stat-glow"></div>
                            </div>
                            <div className="stat-mini">
                                <div className="stat-mini-icon-wrapper">
                                    <div className="stat-mini-icon-bg"></div>
                                    <FontAwesomeIcon icon={faRocket} className="stat-mini-icon" />
                                </div>
                                <div className="stat-mini-content">
                                    <div className="stat-mini-value">
                                        <span className="stat-number">500M</span>
                                        <span className="stat-plus">+</span>
                                    </div>
                                    <div className="stat-mini-label">Scalable Market</div>
                                </div>
                                <div className="stat-glow"></div>
                            </div>
                            <div className="stat-mini">
                                <div className="stat-mini-icon-wrapper">
                                    <div className="stat-mini-icon-bg"></div>
                                    <FontAwesomeIcon icon={faBuilding} className="stat-mini-icon" />
                                </div>
                                <div className="stat-mini-content">
                                    <div className="stat-mini-value">
                                        <span className="stat-number">100</span>
                                        <span className="stat-plus">+</span>
                                    </div>
                                    <div className="stat-mini-label">Industries</div>
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