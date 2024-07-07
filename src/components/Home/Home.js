import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { signOut } from 'firebase/auth';
import { auth, db } from '../../firebaseConfig';
import { doc, getDoc, collection, getDocs, query, orderBy, setDoc, Timestamp } from 'firebase/firestore';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSignOutAlt } from '@fortawesome/free-solid-svg-icons'; // Import the logout icon
import logo from '../../assets/misn-logo-Photoroom.png';
import englishFlag from '../../assets/english.png';
import spanishFlag from '../../assets/spain.png';
import chineseFlag from '../../assets/china.png';
import russianFlag from '../../assets/russia.png';
import italianFlag from '../../assets/italy.png';
import thaiFlag from '../../assets/thai.png';
import { FaRobot } from 'react-icons/fa'; // Add this line to import the robot icon
import './Home.css';
import BottomBar from '../BottomBar';

function Home() {
  const [clientData, setClientData] = useState(null);
  const [newsUpdates, setNewsUpdates] = useState([]);
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const currentUser = auth.currentUser;
  const [selectedLanguage, setSelectedLanguage] = useState(i18n.language);
  const [isLanguageSelectorCollapsed, setIsLanguageSelectorCollapsed] = useState(true);
  const [showChat, setShowChat] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');

  useEffect(() => {
    const fetchClientData = async () => {
      if (currentUser) {
        const clientDoc = doc(db, 'Clients', currentUser.uid);
        const clientSnapshot = await getDoc(clientDoc);
        if (clientSnapshot.exists()) {
          setClientData(clientSnapshot.data());
        }
      }
    };

    const fetchNewsUpdates = async () => {
      const newsCollection = collection(db, 'News');
      const newsQuery = query(newsCollection, orderBy('timestamp', 'desc'));
      const newsSnapshot = await getDocs(newsQuery);
      const newsList = newsSnapshot.docs.map(doc => doc.data());
      setNewsUpdates(newsList);
    };

    fetchClientData();
    fetchNewsUpdates();
  }, [currentUser]);

  const handleLanguageChange = (lng) => {
    i18n.changeLanguage(lng);
    setSelectedLanguage(lng);
    setIsLanguageSelectorCollapsed(true);
    localStorage.setItem('selectedLanguage', lng);  // Store selected language in localStorage
  };

  const handleNavigation = (path) => {
    navigate(path);
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/login');
    } catch (error) {
      console.error('Error logging out:', error);
      alert('Logout failed. Please try again.');
    }
  };

  const getTranslatedText = (newsItem, field) => {
    const lang = i18n.language;
    return newsItem[`${field}_${lang}`] || newsItem[`${field}_en`]; // Fallback to English if translation is missing
  };

  const toggleLanguageSelector = () => {
    setIsLanguageSelectorCollapsed(!isLanguageSelectorCollapsed);
  };

  const getLanguageIcon = (lang) => {
    switch (lang) {
      case 'en':
        return englishFlag;
      case 'es':
        return spanishFlag;
      case 'zh':
        return chineseFlag;
      case 'ru':
        return russianFlag;
      case 'it':
        return italianFlag;
      case 'th':
        return thaiFlag;
      default:
        return englishFlag;
    }
  };

  const handleSubmitClick = async () => {
    if (!clientData.client_id) {
      alert('Client ID not found. Please log in again.');
      return;
    }
  
    try {
      const applicationsRef = collection(db, 'Applications');
      const querySnapshot = await getDocs(applicationsRef);
  
      const applicationIds = querySnapshot.docs
        .map(doc => doc.id)
        .filter(id => id.startsWith(`${clientData.client_id}_`));
  
      console.log("Existing application IDs:", applicationIds);
  
      const highestNumber = applicationIds.reduce((max, id) => {
        const number = parseInt(id.split('_').pop(), 10);
        return number > max ? number : max;
      }, 0);
  
      console.log("Highest number found:", highestNumber);
  
      const newDocId = `${clientData.client_id}_${highestNumber + 1}`;
  
      console.log("New document ID:", newDocId);
  
      const formScreeningRef = doc(db, 'FormsScreening', 'MISN_form');
      const formScreeningDoc = await getDoc(formScreeningRef);
  
      if (!formScreeningDoc.exists()) {
        throw new Error('MISN_form document does not exist in FormsScreening collection');
      }
  
      const formScreeningData = formScreeningDoc.data();
      console.log("Form Screening Data:", formScreeningData);
  
      const applicationData = {
        ...formScreeningData,
        agent_comment: {
          agent_comment_response: [""],
          client_comment_response: [""]
        },
        agent_service_submit: ["", "", "", ""],
        ai_evaluation: "submitted",
        application_summary: "",
        auto_filled_form_data: {
          agent_comment: [""],
          client_id: clientData.client_id,
          created_at: Timestamp.now(),
          field1: "",
          final_program_name: "",
          pre_approved_reason: "",
          pre_rejected_reason: "",
          recorded_voice_path: "",
          status: "submitted",
          updated_at: Timestamp.now(),
          uploaded_documents_path: [""]
        },
        reason_approve: {
          reason_1: "",
          reason_2: "",
          reason_3: ""
        },
        reason_reject: {
          reason_1: "",
          reason_2: "",
          reason_3: ""
        },
        system_matched_services: ["", "", ""],
        system_suggest_program: "",
        uploaded_documents_path: {
          doc_2: ["", ""],
          doc_3: ["", ""],
          doc_4: ["", ""]
        }
      };
  
      await setDoc(doc(db, 'Applications', newDocId), applicationData);
  
      navigate(`/requestsubmission/${newDocId}`);
    } catch (error) {
      console.error('Error submitting request:', error);
      alert('Failed to submit request. Please try again.');
    }
  };

  const toggleChat = () => {
    setShowChat(!showChat);
  };

  const handleSendMessage = async () => {
    if (input.trim() === '') return;

    setMessages((prevMessages) => [...prevMessages, { sender: 'client', text: input }]);

    try {
      const response = await fetch('http://localhost:8000/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ transcription: input }),
      });

      const data = await response.json();
      const botResponse = data.response;

      setMessages((prevMessages) => [...prevMessages, { sender: 'bot', text: botResponse }]);
      setInput('');
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages((prevMessages) => [...prevMessages, { sender: 'bot', text: "Sorry, I couldn't process your request." }]);
    }
  };

  return (
    <div className="home-container">
      <div className="header">
        <img src={logo} alt="MiSN Logo" className="logo" />
        <button onClick={handleLogout} className="logout-button">
          <FontAwesomeIcon icon={faSignOutAlt} className="logout-icon" />
          Logout
        </button>
      </div>
      <p className="client-title">Welcome Back {clientData ? clientData.full_name : 'Loading...'} !</p>
      <div className={`language-selector ${isLanguageSelectorCollapsed ? 'collapsed' : ''}`} onClick={toggleLanguageSelector}>
        <h3>
          Choose language
          <img src={getLanguageIcon(selectedLanguage)} alt="Current Language" className="current-language-icon" />
        </h3>
        {!isLanguageSelectorCollapsed && (
          <div className="language-options">
            <button onClick={() => handleLanguageChange('en')} className={`language-button ${selectedLanguage === 'en' ? 'selected' : ''}`}>
              <img src={englishFlag} alt="English" />
              <span>English</span>
            </button>
            <button onClick={() => handleLanguageChange('es')} className={`language-button ${selectedLanguage === 'es' ? 'selected' : ''}`}>
              <img src={spanishFlag} alt="Española" />
              <span>Española</span>
            </button>
            <button onClick={() => handleLanguageChange('zh')} className={`language-button ${selectedLanguage === 'zh' ? 'selected' : ''}`}>
              <img src={chineseFlag} alt="中文" />
              <span>中文</span>
            </button>
            <button onClick={() => handleLanguageChange('ru')} className={`language-button ${selectedLanguage === 'ru' ? 'selected' : ''}`}>
              <img src={russianFlag} alt="русский язык" />
              <span>русский язык</span>
            </button>
            <button onClick={() => handleLanguageChange('it')} className={`language-button ${selectedLanguage === 'it' ? 'selected' : ''}`}>
              <img src={italianFlag} alt="lingua italiana" />
              <span>lingua italiana</span>
            </button>
            <button onClick={() => handleLanguageChange('th')} className={`language-button ${selectedLanguage === 'th' ? 'selected' : ''}`}>
              <img src={thaiFlag} alt="ภาษาไทย" />
              <span>ภาษาไทย</span>
            </button>
          </div>
        )}
      </div>
      <div className="main-content">
        <button onClick={handleSubmitClick} className="nav-button submit-request">{t('submitRequest')}</button>
        <h3>What we do ?</h3>
        <div className="news-updates">
          {newsUpdates && newsUpdates.length > 0 ? newsUpdates.map((news, index) => (
            <div key={index} className="news-card">
              <h2>{getTranslatedText(news, 'title')}</h2>
              {news.newsItems && news.newsItems.map((item, idx) => (
                <div key={idx} className="news-item">
                  {item.type === 'text' && <div dangerouslySetInnerHTML={{ __html: getTranslatedText(item, 'content') }} />}
                  {item.type === 'image' && <img src={item.url} alt="News" />}
                  {item.type === 'video' && <iframe src={item.url} width="640" height="480" allow="autoplay"></iframe>}
                </div>
              ))}
            </div>
          )) : <p>No news updates available.</p>}
        </div>
      </div>
      <div className={`chatbot ${showChat ? 'show' : ''}`}>
        {showChat && (
          <div className="chat-window">
            <div className="messages">
              {messages.map((msg, index) => (
                <div key={index} className={`message ${msg.sender}`}>
                  {typeof msg.text === 'string' ? msg.text : JSON.stringify(msg.text)}
                </div>
              ))}
            </div>
            <div className="input-container">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type a message..."
              />
              <button onClick={handleSendMessage} className="send-button">Send</button>
            </div>
          </div>
        )}
        <button onClick={toggleChat} className="chatbot-toggle">
          <FaRobot />
        </button>
      </div>
      <BottomBar />
    </div>
  );
}

export default Home;
