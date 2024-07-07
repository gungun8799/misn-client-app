import React, { useState, useEffect, useRef } from 'react';
import { collection, doc, getDoc, onSnapshot, updateDoc, arrayUnion, Timestamp, setDoc, query, where, getDocs } from 'firebase/firestore';
import { db, auth } from '../../firebaseConfig';
import { onAuthStateChanged } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import './client-chat.css';

const ClientChat = () => {
  const [clientData, setClientData] = useState({});
  const [agentData, setAgentData] = useState({});
  const [chatData, setChatData] = useState([]);
  const [message, setMessage] = useState('');
  const chatContainerRef = useRef(null);
  const inputRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const clientQuery = doc(collection(db, 'Clients'), user.uid);
          const clientSnapshot = await getDoc(clientQuery);
          if (clientSnapshot.exists()) {
            const client = clientSnapshot.data();
            setClientData(client);
            fetchAgentData(client.assigned_agent_id);
            subscribeToChat(client.client_id);
          } else {
            console.error('Client document does not exist');
          }
        } catch (error) {
          console.error('Error fetching client document:', error);
        }
      }
    });

    window.addEventListener('resize', handleResize);

    return () => {
      unsubscribe();
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [chatData]);

  const fetchAgentData = async (agentId) => {
    try {
      const agentQuery = query(collection(db, 'Agents'), where('displayName', '==', agentId));
      const agentSnapshot = await getDocs(agentQuery);
      if (!agentSnapshot.empty) {
        setAgentData(agentSnapshot.docs[0].data());
      } else {
        console.error('Agent document does not exist');
      }
    } catch (error) {
      console.error('Error fetching agent document:', error);
    }
  };

  const subscribeToChat = (clientId) => {
    const chatRef = doc(db, 'AgentChat', clientId);
    const unsubscribe = onSnapshot(chatRef, async (snapshot) => {
      if (snapshot.exists()) {
        const agentChat = snapshot.data().Agent_chat || [];
        const clientChat = snapshot.data().Client_chat || [];
        setChatData([...agentChat, ...clientChat].sort((a, b) => a.timestamp.seconds - b.timestamp.seconds));

        // Mark Agent_chat messages as read
        const unreadAgentMessages = agentChat.filter(chat => !chat.read);
        if (unreadAgentMessages.length > 0) {
          const updatedAgentChat = agentChat.map(chat => ({ ...chat, read: true }));
          await updateDoc(chatRef, { Agent_chat: updatedAgentChat });
        }
      } else {
        console.error('Chat document does not exist');
      }
    });
    return unsubscribe;
  };

  const handleSendMessage = async () => {
    if (message.trim() === '') return;
    const chatRef = doc(db, 'AgentChat', clientData.client_id);

    const chatData = {
      message: message,
      timestamp: Timestamp.now(),
      sender: clientData.full_name,
      read: false // Set read to false when client sends a message
    };

    try {
      const docSnap = await getDoc(chatRef);
      if (docSnap.exists()) {
        await updateDoc(chatRef, {
          Client_chat: arrayUnion(chatData)
        });
      } else {
        await setDoc(chatRef, {
          Agent_chat: [],
          Client_chat: [chatData]
        });
      }
      setMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const handleResize = () => {
    if (inputRef.current) {
      inputRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  };

  const scrollToBottom = () => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  };

  return (
    <div className="client-chat">
      <div className="chat-header">
        <button className="back-button-chat" onClick={() => navigate(-1)}>Back</button>
        <h3 className="agent-name-chat">{agentData.displayName}</h3>
      </div>
      <div className="chat-container" ref={chatContainerRef}>
        <div className="chat-messages">
          {chatData.map((chat, index) => (
            <div key={index} className={`chat-message ${chat.sender === clientData.full_name ? 'sent' : 'received'}`}>
              <span>{chat.message}</span>
              <span className="chat-timestamp">{chat.timestamp.toDate().toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="chat-input" ref={inputRef}>
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Type your message..."
          onFocus={handleResize}
        />
        <button onClick={handleSendMessage}>Send</button>
      </div>
    </div>
  );
};

export default ClientChat;
