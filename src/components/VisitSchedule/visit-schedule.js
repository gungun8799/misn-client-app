import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc, Timestamp, arrayUnion } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../../firebaseConfig';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { useNavigate } from 'react-router-dom';
import './visit-schedule.css';
import BottomBar from '../BottomBar';
import BackButton from '../BackButton/back-button.js';

const VisitSchedule = () => {
  const [clientData, setClientData] = useState({});
  const [appointments, setAppointments] = useState([]);
  const [selectedDateAppointments, setSelectedDateAppointments] = useState([]);
  const [date, setDate] = useState(new Date());
  const [showPopup, setShowPopup] = useState(false);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [topic, setTopic] = useState('');
  const [agentData, setAgentData] = useState({});
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
            fetchAppointments(client.client_id);
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

  const fetchAppointments = async (clientId) => {
    try {
      const appointmentsQuery = query(collection(db, 'Visits'), where('client_id', '==', clientId));
      const appointmentsSnapshot = await getDocs(appointmentsQuery);
      const appointmentsList = appointmentsSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
      const sortedAppointments = appointmentsList.sort((a, b) => b.created_at.toMillis() - a.created_at.toMillis());
      setAppointments(sortedAppointments);
      filterAppointmentsByDate(date, sortedAppointments);
    } catch (error) {
      console.error('Error fetching appointments:', error);
    }
  };

  const handleDateChange = (date) => {
    setDate(date);
    filterAppointmentsByDate(date, appointments);
  };

  const filterAppointmentsByDate = (date, appointmentsList) => {
    const filteredAppointments = appointmentsList.filter(appointment => {
      const appointmentDate = appointment.scheduled_date.toDate();
      return (
        appointmentDate.getDate() === date.getDate() &&
        appointmentDate.getMonth() === date.getMonth() &&
        appointmentDate.getFullYear() === date.getFullYear()
      );
    });
    setSelectedDateAppointments(filteredAppointments);
  };

  const handleStartTimeChange = (e) => {
    setStartTime(e.target.value);
  };

  const handleEndTimeChange = (e) => {
    setEndTime(e.target.value);
  };

  const handleTopicChange = (e) => {
    setTopic(e.target.value);
  };

  const handleAddAppointment = async () => {
    if (!startTime || !endTime || !topic) {
      alert('Please provide start and end times and add a topic.');
      return;
    }

    try {
      const assignedAgentId = clientData.assigned_agent_id;  // Get assigned agent ID

      if (!assignedAgentId) {
        alert('Assigned agent not found.');
        return;
      }

      const newAppointment = {
        agent_id: assignedAgentId,
        client_id: clientData.client_id,  // Use client_id instead of email
        created_at: Timestamp.now(),
        scheduled_date: Timestamp.fromDate(date),
        start_time: startTime,
        end_time: endTime,
        topic: topic,
        status: 'proposed',
        updated_at: Timestamp.now(),
        initiated_by: 'client'  // Track who initiated the appointment
      };

      await addDoc(collection(db, 'Visits'), newAppointment);
      
      // Update the agent_contact_back field in Applications collection
      const applicationQuery = query(collection(db, 'Applications'), where('client_id', '==', clientData.client_id));
      const applicationSnapshot = await getDocs(applicationQuery);
      if (!applicationSnapshot.empty) {
        const applicationDoc = applicationSnapshot.docs[0];
        const applicationRef = doc(db, 'Applications', applicationDoc.id);
        await updateDoc(applicationRef, {
          'agent_contact_back.timestamps': arrayUnion({
            timestamp: Timestamp.now(),
            topic: `Contact client ${clientData.full_name}`
          })
        });
      }
      
      fetchAppointments(clientData.client_id);  // Use client_id instead of email
      setShowPopup(false);
      alert('Appointment proposed successfully.');
    } catch (error) {
      console.error('Error adding appointment:', error);
      alert('Failed to propose appointment.');
    }
  };

  const handleConfirmAppointment = async (id) => {
    try {
      const appointmentRef = doc(db, 'Visits', id);
      await updateDoc(appointmentRef, {
        status: 'confirmed',
        updated_at: Timestamp.now(),
      });
      fetchAppointments(clientData.client_id);  // Use client_id instead of email
      alert('Appointment confirmed successfully.');
    } catch (error) {
      console.error('Error confirming appointment:', error);
      alert('Failed to confirm appointment.');
    }
  };

  const handleRejectAppointment = async (id) => {
    try {
      const appointmentRef = doc(db, 'Visits', id);
      await updateDoc(appointmentRef, {
        status: 'rejected',
        updated_at: Timestamp.now(),
      });
      fetchAppointments(clientData.client_id);  // Use client_id instead of email
      alert('Appointment rejected successfully.');
    } catch (error) {
      console.error('Error rejecting appointment:', error);
      alert('Failed to reject appointment.');
    }
  };

  const handleProposeNewTime = (id) => {
    // Implement the logic to propose a new time
  };

  const handleDeleteAppointment = async (id) => {
    try {
      await deleteDoc(doc(db, 'Visits', id));
      fetchAppointments(clientData.client_id);  // Use client_id instead of email
      alert('Appointment deleted successfully.');
    } catch (error) {
      console.error('Error deleting appointment:', error);
      alert('Failed to delete appointment.');
    }
  };

  const handleDoneAppointment = async (id) => {
    try {
      const appointmentRef = doc(db, 'Visits', id);
      await updateDoc(appointmentRef, {
        status: 'visited',
        updated_at: Timestamp.now(),
      });
      fetchAppointments(clientData.client_id);  // Use client_id instead of email
      alert('Appointment marked as done.');
    } catch (error) {
      console.error('Error marking appointment as done:', error);
      alert('Failed to mark appointment as done.');
    }
  };

  const tileContent = ({ date, view }) => {
    if (view === 'month') {
      const hasAppointment = appointments.some(appointment => {
        const appointmentDate = appointment.scheduled_date.toDate();
        return (
          appointmentDate.getDate() === date.getDate() &&
          appointmentDate.getMonth() === date.getMonth() &&
          appointmentDate.getFullYear() === date.getFullYear()
        );
      });
      return hasAppointment ? <div className="highlight"></div> : null;
    }
  };

  return (
    <div className="visit-schedule">
      <BackButton />
      <h2 className="visit-schedule-title">Visit Schedule</h2>
      <div className="calendar-container">
        <Calendar
          onChange={handleDateChange}
          value={date}
          tileContent={tileContent}
        />
      </div>
      <button className="add-appointment-button" onClick={() => setShowPopup(true)}>+</button>
      <h3 className="appointments-title">Appointments on {date.toDateString()}</h3>
      <div className="appointments-list">
        
        {selectedDateAppointments.map((appointment) => (
          <div key={appointment.id} className="appointment-item">
            <div className="appointment-info">
              <p><strong>{agentData.displayName}</strong></p>
              <p>{appointment.scheduled_date.toDate().toLocaleString()}</p>
              <p>{appointment.start_time} - {appointment.end_time}</p>
              <p><strong>Topic:</strong> {appointment.topic}</p>
              <p className={`appointment-status-visit ${appointment.status === 'proposed' ? 'proposed' : appointment.status === 'confirmed' ? 'confirmed' : appointment.status === 'waiting for agent confirm' ? 'waiting-for-agent-confirm' : appointment.status === 'rejected' ? 'rejected' : ''}`}>
  {appointment.status}
</p>
            </div>
            {appointment.status === 'proposed' && appointment.initiated_by === 'agent' && (
              <>
                <button className="confirm-button" onClick={() => handleConfirmAppointment(appointment.id)}>Confirm</button>
                <button className="reject-button-visit" onClick={() => handleRejectAppointment(appointment.id)}>Reject</button>
                {/* <button className="propose-new-time-button" onClick={() => handleProposeNewTime(appointment.id)}>Propose New Time</button> */}
              </>
            )}
            {appointment.status === 'proposed' && appointment.initiated_by !== 'agent' && (
              <>
                <p></p>
                <button className="delete-button-visit" onClick={() => handleDeleteAppointment(appointment.id)}>Delete</button>
              </>
            )}
            {appointment.status === 'confirmed' && (
              <>
                <button className="done-button" onClick={() => handleDoneAppointment(appointment.id)}>Done</button>
                <button className="delete-button-visit" onClick={() => handleDeleteAppointment(appointment.id)}>Delete</button>
              </>
            )}
          </div>
        ))}
      </div>
      {showPopup && (
        <div className="popup">
          <div className="popup-content">
            <h3>Add Appointment</h3>
            <input className="start-time-input-visit"
              type="time"
              value={startTime}
              onChange={handleStartTimeChange}
              placeholder="Start Time"
            />
            <input className="end-time-input-visit"
              type="time"
              value={endTime}
              onChange={handleEndTimeChange}
              placeholder="End Time"
            />
            <input
              type="text"
              value={topic}
              onChange={handleTopicChange}
              placeholder="Topic"
              className="topic-input"
            />
            <div className="buttons-container">
              <button className="add-button-cancel-visit" onClick={() => setShowPopup(false)}>Cancel</button>
              <button className="add-button-visit" onClick={handleAddAppointment}>Add Appointment</button>
            </div>
          </div>
        </div>
      )}
      <BottomBar />
    </div>
  );
};

export default VisitSchedule;
