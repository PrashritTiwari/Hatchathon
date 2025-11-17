import "./Navbar.css";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faMicrophone, faHome, faBars, faTimes, faArrowRight } from "@fortawesome/free-solid-svg-icons";
import { useState } from "react";

export default function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const scrollToSection = (sectionId) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
      setIsMenuOpen(false);
    }
  };

  return (
    <div className="navbar-container">
      <div className="nav-cont">
        <div className="logo-container" onClick={() => scrollToSection('hero')}>
          <FontAwesomeIcon icon={faMicrophone} className="microphone-icon" />
          <span className="logo-text">VoiceAI</span>
        </div>

        <div className={`routing-links ${isMenuOpen ? 'active' : ''}`}>
          <button onClick={() => scrollToSection('hero')} className="nav-link">
            <FontAwesomeIcon icon={faHome} className="nav-icon" />
            <span>Home</span>
          </button>
          <button onClick={() => scrollToSection('hero')} className="nav-btn-get-started">
            Get Started
            <FontAwesomeIcon icon={faArrowRight} className="nav-arrow-icon" />
          </button>
        </div>

        <button className="menu-toggle" onClick={() => setIsMenuOpen(!isMenuOpen)}>
          <FontAwesomeIcon icon={isMenuOpen ? faTimes : faBars} />
        </button>
      </div>
    </div>
  );
}