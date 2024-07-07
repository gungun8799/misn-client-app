import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FaArrowLeft } from 'react-icons/fa';
import './back-button.css';

const BackButton = () => {
  const navigate = useNavigate();

  return (
    <button
      className="back-button-component"
      
      onClick={() => navigate(-1)}
    >
      <FaArrowLeft className="back-icon-component" /> Back
    </button>
  );
};

export default BackButton;
