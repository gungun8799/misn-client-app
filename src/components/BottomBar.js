import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faHome, faCube, faUsers, faCalendarAlt } from '@fortawesome/free-solid-svg-icons';
import { collection, doc, onSnapshot, getDoc } from 'firebase/firestore';
import { db, auth } from '../firebaseConfig';
import { onAuthStateChanged } from 'firebase/auth';
import './BottomBar.css';

const BottomBar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [activePath, setActivePath] = useState('/home'); // default path
  const [unreadMessages, setUnreadMessages] = useState(0);

  useEffect(() => {
    const handleResize = () => {
      if (window.visualViewport.height < window.innerHeight) {
        setIsKeyboardVisible(true);
      } else {
        setIsKeyboardVisible(false);
      }
    };

    window.visualViewport.addEventListener('resize', handleResize);
    handleResize();

    return () => {
      window.visualViewport.removeEventListener('resize', handleResize);
    };
  }, []);

  useEffect(() => {
    const savedPath = localStorage.getItem('activePath');
    if (savedPath) {
      setActivePath(savedPath);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const clientRef = doc(collection(db, 'Clients'), user.uid);
        const clientSnapshot = await getDoc(clientRef);
        if (clientSnapshot.exists()) {
          const clientData = clientSnapshot.data();
          subscribeToChat(clientData.client_id);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  const subscribeToChat = (clientId) => {
    const chatRef = doc(db, 'AgentChat', clientId);
    const unsubscribe = onSnapshot(chatRef, (snapshot) => {
      if (snapshot.exists()) {
        const agentChat = snapshot.data().Agent_chat || [];
        const newUnreadMessages = agentChat.filter(chat => !chat.read).length;
        setUnreadMessages(newUnreadMessages);
      }
    });
    return unsubscribe;
  };

  const handleNavigate = (path) => {
    if (location.pathname !== path) {
      setActivePath(path);
      localStorage.setItem('activePath', path);
      navigate(path);
    }
  };

  const getActiveClass = (path) => {
    return activePath === path ? 'active' : '';
  };

  return (
    <div className={`bottom-bar ${isKeyboardVisible ? 'hidden' : ''}`}>
      <button onClick={() => handleNavigate('/home')} className={`bottom-bar-button ${getActiveClass('/home')}`}>
        <FontAwesomeIcon icon={faHome} />
        <span>Home</span>
      </button>
      <button onClick={() => handleNavigate('/my-service')} className={`bottom-bar-button ${getActiveClass('/my-service')}`}>
        <FontAwesomeIcon icon={faCube} />
        <span>My service</span>
      </button>
      <button onClick={() => handleNavigate('/my-agent')} className={`bottom-bar-button ${getActiveClass('/my-agent')}`}>
        <FontAwesomeIcon icon={faUsers} />
        <span>My agent</span>
        {unreadMessages > 0 && <span className="notification-badge">{unreadMessages}</span>}
      </button>
      <button onClick={() => handleNavigate('/visit-schedule')} className={`bottom-bar-button ${getActiveClass('/visit-schedule')}`}>
        <FontAwesomeIcon icon={faCalendarAlt} />
        <span>Routine visit</span>
      </button>
    </div>
  );
};

export default BottomBar;
