import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc, arrayUnion, Timestamp, collection, query, where, getDocs } from 'firebase/firestore';
import { db, auth } from '../../firebaseConfig';
import { onAuthStateChanged } from 'firebase/auth';
import BottomBar from '../BottomBar';
import styles from './IssueTicket.module.css';
import BackButton from '../BackButton/back-button.js';

const IssueTicket = () => {
  const { ticketId } = useParams();
  const [ticket, setTicket] = useState({});
  const [clientName, setClientName] = useState('');
  const [message, setMessage] = useState('');
  const navigate = useNavigate();
  const chatLogRef = useRef(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const clientQuery = doc(db, 'Clients', user.uid);
          const clientSnapshot = await getDoc(clientQuery);
          if (clientSnapshot.exists()) {
            const clientData = clientSnapshot.data();
            setClientName(clientData.full_name);
            await fetchTicket(clientData.client_id);
          } else {
            console.error('Client document does not exist');
          }
        } catch (error) {
          console.error('Error fetching client document:', error);
        }
      }
    });

    return () => unsubscribe();
  }, [ticketId]);

  const fetchTicket = async (clientId) => {
    try {
      const ticketQuery = query(collection(db, 'Tickets'), where('client_id', '==', clientId), where('status', '==', 'open'));
      const ticketSnapshot = await getDocs(ticketQuery);
      if (!ticketSnapshot.empty) {
        const ticketDoc = ticketSnapshot.docs[0];
        const ticketData = ticketDoc.data();
        setTicket({ id: ticketDoc.id, ...ticketData });
  
        // Check if issue_description is already in chat_log
        const issueInChatLog = ticketData.chat_log && ticketData.chat_log.some(log => log.message === ticketData.issue_description);
  
        // Push initial issue description to chat_log if not already present
        if (!issueInChatLog) {
          const issueDescriptionLog = {
            message: ticketData.issue_description,
            timestamp: Timestamp.now(),
            sender: ticketData.client_id
          };
  
          await updateDoc(ticketDoc.ref, {
            chat_log: arrayUnion(issueDescriptionLog),
            updated_at: Timestamp.now()
          });
  
          setTicket(prevTicket => ({
            ...prevTicket,
            chat_log: [...(prevTicket.chat_log || []), issueDescriptionLog]
          }));
        }
      } else {
        console.error('No open ticket for this client!');
      }
    } catch (error) {
      console.error('Error fetching ticket:', error);
    }
  };
  

  const handlePostComment = async () => {
    if (message.trim() === '') return;

    try {
      const ticketRef = doc(db, 'Tickets', ticketId);
      const newMessage = {
        message: message,
        timestamp: Timestamp.now(),
        sender: clientName
      };
      await updateDoc(ticketRef, {
        chat_log: arrayUnion(newMessage),
        updated_at: Timestamp.now()
      });
      setTicket((prevTicket) => ({
        ...prevTicket,
        chat_log: [...prevTicket.chat_log, newMessage]
      }));
      setMessage('');
      // Scroll to the bottom of the chat log
      if (chatLogRef.current) {
        chatLogRef.current.scrollTop = chatLogRef.current.scrollHeight;
      }
    } catch (error) {
      console.error('Error posting comment:', error);
    }
  };

  const handleCloseTicket = async () => {
    try {
      const ticketRef = doc(db, 'Tickets', ticketId);
      await updateDoc(ticketRef, {
        status: 'closed',
        updated_at: Timestamp.now()
      });
      navigate('/Home');
    } catch (error) {
      console.error('Error closing ticket:', error);
    }
  };
  

  useEffect(() => {
    // Scroll to the bottom of the chat log initially
    if (chatLogRef.current) {
      chatLogRef.current.scrollTop = chatLogRef.current.scrollHeight;
    }
  }, [ticket]);

  return (
    <div className={styles.issueTicket}>
      <button className={styles.backButtonIssueTicket} onClick={() => navigate(-1)}>Back</button>
    
      <div className={styles.ticketDetail}>
        <div className={styles.clientResponse}>
          <div className={styles.clientInfo}>
            <span>{clientName} ({ticket.id})</span>
          </div>
        </div>
        <div className={styles.chatLog} ref={chatLogRef}>
          {ticket.chat_log && ticket.chat_log.map((log, index) => (
            <div 
              key={index} 
              className={`${styles.chatMessageIssue} ${log.sender === clientName ? styles.clientMessage : styles.agentMessage}`}
            >
              <span>{log.message}</span>
              <span className={styles.timestamp}>{log.timestamp.toDate().toLocaleString()}</span>
            </div>
          ))}
        </div>
        <div className={styles.agentResponse}>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type your response here..."
          />
          <button onClick={handlePostComment}>Post Comment</button>
          <button onClick={handleCloseTicket}>Close Ticket</button>
        </div>
      </div>
      <BottomBar />
    </div>
  );
};

export default IssueTicket;
