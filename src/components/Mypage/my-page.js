// src/components/MyPage/MyPage.js
import React from 'react';
import { useNavigate } from 'react-router-dom';
import logo from '../../assets/misn-logo-Photoroom.png';
import './my-page.css';


const MyPage = () => {
  const navigate = useNavigate();

  const handleNavigation = (path) => {
    navigate(path);
  };
  
  return (
    <div className="my-page-container">
        <button className="back-button-my-page" onClick={() => navigate(-1)}>Back</button>
      <img src={logo} alt="MiSN Logo" className="logo" />

      <button onClick={() => handleNavigation('/submit-request')} className="nav-button">Submit Request</button>
      <button onClick={() => handleNavigation('/my-service')} className="nav-button">My Service</button>
      <button onClick={() => handleNavigation('/my-agent')} className="nav-button">My Agent</button>
      <button onClick={() => handleNavigation('/visit-schedule')} className="nav-button">Routine Visit</button>
    </div>
  );
};

export default MyPage;
