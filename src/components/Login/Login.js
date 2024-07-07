import React, { useState, useEffect } from 'react';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import { auth, db } from '../../firebaseConfig';
import { signInWithCredential, GoogleAuthProvider, sendEmailVerification, onAuthStateChanged, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, Timestamp, setDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import './Login.css';
import logo from '../../assets/misn-logo-Photoroom.png';

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const handleResize = () => {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);
    };

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userDoc = doc(db, 'Clients', user.uid);
        const userSnapshot = await getDoc(userDoc);
        if (user.emailVerified || userSnapshot.exists()) {
          navigate('/home');
        } else {
          navigate('/verify-email');
        }
      }
    });

    window.addEventListener('resize', handleResize);
    handleResize(); // Set the initial value

    return () => {
      window.removeEventListener('resize', handleResize);
      unsubscribe();
    };
  }, [navigate]);

  const handleUserProfile = async (user) => {
    try {
      const userDoc = doc(db, 'Clients', user.uid);
      const userSnapshot = await getDoc(userDoc);
      if (!userSnapshot.exists()) {
        await setDoc(userDoc, {
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
          createdAt: Timestamp.fromDate(new Date()),
          lastLogin: Timestamp.fromDate(new Date()),
        });
        if (!user.emailVerified) {
          await sendEmailVerification(user);
          navigate('/verify-email');
        } else {
          navigate('/home');
        }
      } else {
        await setDoc(userDoc, {
          lastLogin: Timestamp.fromDate(new Date()),
        }, { merge: true });
        navigate('/home');
      }
    } catch (error) {
      console.error('Error handling user profile:', error);
    }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    const credential = GoogleAuthProvider.credential(credentialResponse.credential);
    try {
      const result = await signInWithCredential(auth, credential);
      await handleUserProfile(result.user);
    } catch (error) {
      console.error('Error logging in with Google:', error);
      alert(`Google login failed: ${error.message}`);
    }
  };

  const handleGoogleFailure = (error) => {
    console.error('Google login failed:', error);
    alert('Google login failed. Please try again.');
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      const userDoc = doc(db, 'Clients', user.uid);
      const userSnapshot = await getDoc(userDoc);

      if (userSnapshot.exists()) {
        navigate('/home');
      } else {
        setErrorMessage('Username or password does not match our records.');
      }
    } catch (error) {
      setErrorMessage('Username or password does not match our records.');
    }
  };

  return (
    <div className="login-container">
      <form className="login-form" onSubmit={handleLogin}>
        <img src={logo} alt="MiSN Logo" className="logo-login" />
        <input
          type="email"
          placeholder="username/email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {errorMessage && <p className="error-message">{errorMessage}</p>}
        <button type="submit" className="login-button">
          Login
        </button>
        {/* <GoogleOAuthProvider clientId="769756513526-ser5bolt3t738aotnju6l9hu1cqk7mv6.apps.googleusercontent.com">
          <div className="google-login">
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={handleGoogleFailure}
              className="google-login"
            />
          </div>
        </GoogleOAuthProvider> */}
        <button type="button" className="signup" onClick={() => navigate('/signup')}>
          Signup
        </button>
      </form>
    </div>
  );
}

export default Login;
