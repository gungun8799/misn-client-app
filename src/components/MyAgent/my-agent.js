// src/components/MyAgent/my-agent.js
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../../firebaseConfig';
import './my-agent.css';
import BottomBar from '../BottomBar';

const MyAgent = () => {
  const [agentData, setAgentData] = useState({});
  const [clientData, setClientData] = useState({});
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const clientQuery = query(collection(db, 'Clients'), where('email', '==', user.email));
          const clientSnapshot = await getDocs(clientQuery);
          if (!clientSnapshot.empty) {
            const client = clientSnapshot.docs[0].data();
            setClientData(client);
            fetchAgentData(client.assigned_agent_id);
          } else {
            console.error('Client document does not exist');
          }
        } catch (error) {
          console.error('Error fetching client document:', error);
        }
      }
    });

    return () => unsubscribe();
  }, []);

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

  return (
    <div className="my-agent-container">
      <div className="my-agent-box">
        {agentData.photoURL && <img src={agentData.photoURL} alt="Agent" className="agent-photo" />}
        <h2>{agentData.displayName}</h2>
        <p>Email: {agentData.email}</p>
        <p>Phone Number: {agentData.phoneNumber}</p>
        <button
          className="chat-button"
          onClick={() => navigate(`/client-chat/${clientData.client_id}`)}
        >
          Chat with Agent
        </button>
      </div>
      <BottomBar className="bottom-bar-container"/>
    </div>
  );
};

export default MyAgent;
