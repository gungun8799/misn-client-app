import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../../firebaseConfig'; // Import your Firebase auth configuration
import logo from '../../assets/misn-logo-Photoroom.png'; // Update the path to your logo image
import './VerifyEmail.css';

function VerifyEmail() {
  const navigate = useNavigate();

  useEffect(() => {
    const checkEmailVerification = async () => {
      auth.onAuthStateChanged((user) => {
        if (user) {
          user.reload().then(() => {
            if (user.emailVerified) {
              navigate('/home');
            }
          });
        }
      });
    };

    checkEmailVerification();
    
    // Polling to check email verification status periodically
    const intervalId = setInterval(checkEmailVerification, 5000); // Check every 5 seconds
    
    // Cleanup the interval on component unmount
    return () => clearInterval(intervalId);
  }, [navigate]);

  return (
    <div className="verify-email-container">
      <img src={logo} alt="MiSN Logo" className="logo" />
      <h1>Email Verification Required</h1>
      <p>
        A verification email has been sent to your email address. Please check your inbox and verify your email to proceed.
      </p>
    </div>
  );
}

export default VerifyEmail;
