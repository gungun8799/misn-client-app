import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { collection, doc, getDoc, updateDoc, addDoc, query, where, getDocs, arrayUnion, Timestamp, deleteDoc } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../firebaseConfig';
import './detail-my-service.css';
import BackButton from '../BackButton/back-button.js';
import BottomBar from '../BottomBar';

const DetailMyService = () => {
  const { serviceId } = useParams();
  const [serviceData, setServiceData] = useState({});
  const [responseText, setResponseText] = useState('');
  const [file, setFile] = useState(null);
  const [documentName, setDocumentName] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadMessage, setUploadMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [showAnimation, setShowAnimation] = useState(false);
  const [isBasicInfoCollapsed, setIsBasicInfoCollapsed] = useState(false);
  const [reviewAgent, setReviewAgent] = useState('');
  const [availableTimes, setAvailableTimes] = useState([]);
  const [dateTimeInput, setDateTimeInput] = useState('');
  const [confirmMessage, setConfirmMessage] = useState('');
  const [programDetail, setProgramDetail] = useState('');
  const navigate = useNavigate();

  const fetchServiceData = async () => {
    const serviceRef = doc(db, 'Applications', serviceId);
    const serviceSnap = await getDoc(serviceRef);
    if (serviceSnap.exists()) {
      const serviceData = serviceSnap.data();
      setServiceData(serviceData);

      const availableSlots = serviceData.agent_contact_back?.timestamps || [];
      setAvailableTimes(availableSlots.map(slot => slot.toDate()));

      const clientId = serviceData.auto_filled_form_data?.client_id;
      if (clientId) {
        const clientQuery = query(collection(db, 'Clients'), where('client_id', '==', clientId));
        const clientSnapshot = await getDocs(clientQuery);
        if (!clientSnapshot.empty) {
          clientSnapshot.forEach((doc) => {
            const clientData = doc.data();
            setReviewAgent(clientData.assigned_agent_id || 'No assigned agent');
          });
        }
      }

      // Fetch program details if status is "program_approved"
      if (serviceData.auto_filled_form_data?.status === 'approved') {
        const programName = serviceData.auto_filled_form_data.final_program_name;
        const programRef = doc(db, 'Programs', programName);
        const programSnap = await getDoc(programRef);
        if (programSnap.exists()) {
          setProgramDetail(programSnap.data().program_detail);
        }
      }
    }
  };

  useEffect(() => {
    fetchServiceData();
  }, [serviceId]);

  const handleResponseSubmit = async () => {
    const serviceRef = doc(db, 'Applications', serviceId);
    try {
      await updateDoc(serviceRef, {
        'agent_comment.agent_comment_response': arrayUnion(responseText)
      });
      setResponseText('');
      const updatedServiceSnap = await getDoc(serviceRef);
      if (updatedServiceSnap.exists()) {
        setServiceData(updatedServiceSnap.data());
      }
    } catch (error) {
      console.error('Error submitting response:', error);
    }
  };

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleFileUpload = () => {
    if (!file || !documentName) {
      setErrorMessage('Please enter the document name.');
      return;
    }
    setErrorMessage('');

    const storageRef = ref(storage, `documents/${file.name}`);
    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on('state_changed',
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        setUploadProgress(progress);
      },
      (error) => {
        console.error('Error uploading file:', error);
      },
      () => {
        getDownloadURL(uploadTask.snapshot.ref).then((downloadURL) => {
          const serviceRef = doc(db, 'Applications', serviceId);

          const existingDocs = serviceData.uploaded_documents_path || {};
          let maxKeyIndex = 0;
          Object.keys(existingDocs).forEach(key => {
            const keyIndex = parseInt(key.split('_')[1]);
            if (keyIndex > maxKeyIndex) {
              maxKeyIndex = keyIndex;
            }
          });
          const newDocKey = `doc_${maxKeyIndex + 1}`;

          updateDoc(serviceRef, {
            [`uploaded_documents_path.${newDocKey}`]: [documentName, downloadURL]
          }).then(() => {
            setUploadMessage('Document uploaded');
            setUploadProgress(0);
            setDocumentName('');
            setFile(null);
            setErrorMessage('');

            getDoc(serviceRef).then((updatedServiceSnap) => {
              if (updatedServiceSnap.exists()) {
                setServiceData(updatedServiceSnap.data());
              }
            });
          }).catch((error) => {
            console.error('Error updating document path:', error);
          });
        });
      }
    );
  };

  const handleDeleteDocument = async (documentKey) => {
    const serviceRef = doc(db, 'Applications', serviceId);
    try {
      const updatedDocs = { ...serviceData.uploaded_documents_path };
      delete updatedDocs[documentKey];
      await updateDoc(serviceRef, {
        uploaded_documents_path: updatedDocs
      });
      const updatedServiceSnap = await getDoc(serviceRef);
      if (updatedServiceSnap.exists()) {
        setServiceData(updatedServiceSnap.data());
      }
    } catch (error) {
      console.error('Error deleting document:', error);
    }
  };

  const updateStatus = (status) => {
    const serviceRef = doc(db, 'Applications', serviceId);
    updateDoc(serviceRef, {
      'auto_filled_form_data.status': status
    }).then(() => {
      if (status === 'service_received') {
        setShowAnimation(true);
        setTimeout(() => {
          setShowAnimation(false);
          navigate('/my-service');
        }, 3000);
      }
    }).catch((error) => {
      console.error('Error updating status:', error);
    });
  };

  const handleServiceReceived = () => {
    updateStatus('service_received');
  };

  const handleRaiseIssueTicket = async () => {
    try {
      const newTicket = {
        agent_id: reviewAgent,
        chat_log: [],
        client_id: serviceData.auto_filled_form_data?.client_id,
        created_at: Timestamp.now(),
        issue_description: "",
        status: "open",
        updated_at: Timestamp.now()
      };

      const ticketRef = await addDoc(collection(db, 'Tickets'), newTicket);

      navigate(`/IssueTicket/${ticketRef.id}`);
    } catch (error) {
      console.error('Error creating issue ticket:', error);
      alert('Failed to raise issue ticket. Please try again.');
    }
  };

  const getStatusMessage = () => {
    const status = serviceData.auto_filled_form_data?.status;
    switch (status) {
      case 'submitted':
        return 'Waiting for agent review';
      case 'request_docs':
      case 'request_additional_docs':
        return 'Documents requested';
      case 'approved':
        return 'Service matching in-progress';
      case 'service_submitted':
        return 'Service approved';
      case 'rejected':
        return 'Please put in your available slot for agent to contact you back';
      case 'service_received':
        return 'Service has been received';
      case 'program_approved':
        return 'Program approved';
      default:
        return 'Unknown status';
    }
  };

  const getStatusClass = () => {
    const status = serviceData.auto_filled_form_data?.status;
    switch (status) {
      case 'submitted':
        return 'status-waiting-for-agent-review';
      case 'request_docs':
      case 'request_additional_docs':
      case 'rejected':
        return 'status-documents-requested';
      case 'approved':
      case 'service_submitted':
        return 'status-service-approved';
      case 'service_received':
        return 'status-service-received';
      case 'program_approved':
        return 'status-program-approved';
      default:
        return '';
    }
  };

  const handleDateTimeChange = (e) => {
    setDateTimeInput(e.target.value);
  };

  const handleConfirmTimeSlot = async () => {
    const selectedDateTime = new Date(dateTimeInput);
    const currentTime = new Date();

    if (selectedDateTime < currentTime) {
      alert('Please select a future date and time.');
      return;
    }

    const newAvailableTimes = [...availableTimes, selectedDateTime];
    setAvailableTimes(newAvailableTimes);
    setDateTimeInput('');

    const serviceRef = doc(db, 'Applications', serviceId);
    const clientId = serviceData.auto_filled_form_data?.client_id;

    try {
      // Fetch the client's full name
      const clientQuery = query(collection(db, 'Clients'), where('client_id', '==', clientId));
      const clientSnapshot = await getDocs(clientQuery);
      let clientFullName = '';

      if (!clientSnapshot.empty) {
        clientSnapshot.forEach((doc) => {
          clientFullName = doc.data().full_name;
        });
      } else {
        console.error('No such client!');
        return;
      }

      // Update the agent_contact_back.timestamps
      const timestamps = newAvailableTimes.map((time) => Timestamp.fromDate(time));
      await updateDoc(serviceRef, {
        'agent_contact_back.timestamps': arrayUnion(...timestamps)
      });

      // Create documents in the Visits collection
      const visitsPromises = newAvailableTimes.map(async (time) => {
        const newVisit = {
          agent_id: reviewAgent,
          client_id: clientId,
          created_at: Timestamp.now(),
          scheduled_date: Timestamp.fromDate(time),
          start_time: time.toLocaleTimeString('en-US', { hour12: false }),
          end_time: new Date(time.getTime() + 60 * 60 * 1000).toLocaleTimeString('en-US', { hour12: false }),
          status: 'proposed',
          initiated_by: 'client',
          topic: `Contact client ${clientFullName}`,
          updated_at: Timestamp.now(),
        };
        await addDoc(collection(db, 'Visits'), newVisit);
      });

      await Promise.all(visitsPromises);
      setConfirmMessage('Agent will contact you back!');
    } catch (error) {
      console.error('Error updating available times or creating visits:', error);
    }
  };

  const handleDeleteTimeSlot = async (index) => {
    const selectedDateTime = availableTimes[index];
    const updatedTimes = [...availableTimes];
    updatedTimes.splice(index, 1);
    setAvailableTimes(updatedTimes);

    // Update Firestore
    const serviceRef = doc(db, 'Applications', serviceId);
    const updatedTimestamps = updatedTimes.map((time) => Timestamp.fromDate(time));

    try {
      await updateDoc(serviceRef, {
        'agent_contact_back.timestamps': updatedTimestamps
      });

      // Find and delete the corresponding visit document
      const clientId = serviceData.auto_filled_form_data?.client_id;
      const visitQuery = query(
        collection(db, 'Visits'),
        where('client_id', '==', clientId),
        where('scheduled_date', '==', Timestamp.fromDate(selectedDateTime))
      );
      const visitSnapshot = await getDocs(visitQuery);
      visitSnapshot.forEach(async (doc) => {
        await deleteDoc(doc.ref);
      });

      setConfirmMessage('Time slot and corresponding visit deleted successfully');
    } catch (error) {
      console.error('Error deleting time slot or visit document:', error);
    }
  };

  const navigateToChat = () => {
    const clientId = serviceData.auto_filled_form_data?.client_id;
    navigate(`/client-chat/${clientId}`);
  };

  const formatDate = (date) => {
    const options = { month: '2-digit', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true };
    return new Intl.DateTimeFormat('en-US', options).format(date);
  };

  return (
    <div className="detail-my-service">
      <BackButton />
      <h2 className='service-details-title'>Service Details</h2>

      {serviceData.auto_filled_form_data?.status === 'approved' && (
        <div className="approved-program-box">
          <h3 className="program-name-title">Approved Program</h3>
          <p className="final-program-name">{serviceData.auto_filled_form_data.final_program_name}</p>
        </div>
      )}

      <div className={`basic-info ${isBasicInfoCollapsed ? 'collapsed' : ''}`} onClick={() => setIsBasicInfoCollapsed(!isBasicInfoCollapsed)}>
        <h3 className="basic-info-title">Basic Information</h3> 
        
        {!isBasicInfoCollapsed && (
          <>
            <p><strong>Status:</strong> <span className={getStatusClass()}>{getStatusMessage()}</span></p>
            <p><strong>Review Agent:</strong> {reviewAgent}</p>
            <p><strong>Request Summary:</strong> {serviceData.application_summary}</p>
          </>
        )}
      </div>

      {serviceData.auto_filled_form_data?.status === 'approved' && (
        <div className="program-onboard-card">
          <h3 className="program-name-title">Program Onboard</h3>
          <p className="final-program-name-2">Welcome to our {serviceData.auto_filled_form_data.final_program_name} program !</p>
          <p className="program-detail">{programDetail}</p>
          <p className="screening-message">Our agent will do our best to find you the best match service. Please provide additional information by answering the screening questions.</p>
          <button className="screening-button" onClick={() => navigate(`/FormSubmission/${serviceId}`)}>Answer Screening Questions</button>
        </div>
      )}

      {serviceData.auto_filled_form_data?.status === 'request_docs' && (
        <div className="documents-section">
          <h3 className="my-documents-title">My Documents</h3>
          <ul className="documents-list">
            {Object.entries(serviceData.uploaded_documents_path || {}).map(([key, document], index) => (
              <li className="document-item-list" key={index}>
                <a href={document[1]} target="_blank" rel="noopener noreferrer">{document[0]}</a>
                <button className="delete-button-DMS" onClick={() => handleDeleteDocument(key)}>Delete</button>
              </li>
            ))}
          </ul>
      
          <input className="file-input-DMS" type="file" onChange={handleFileChange} />
          <input
            type="text"
            value={documentName}
            onChange={(e) => setDocumentName(e.target.value)}
            placeholder="Document Name"
            className="document-name-input"
          />
          {errorMessage && <p className="error-message">{errorMessage}</p>}
          <button onClick={handleFileUpload} className="upload-button">Upload Document</button>
          {uploadProgress > 0 && <progress value={uploadProgress} max="100" className="upload-progress"></progress>}
          {uploadMessage && <p className="upload-message-DMS">{uploadMessage}</p>}
        </div>
      )}

      {serviceData.auto_filled_form_data?.status === 'service_submitted' && (
        <>
          <h3>Approved Service Details</h3>
          <ul>
            {serviceData.agent_service_submit && serviceData.agent_service_submit.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
          <button className="received-service-button" onClick={handleServiceReceived}>I've already received the service</button>
          <button className="raise-issue-button" onClick={handleRaiseIssueTicket}>Raise Issue Ticket</button>
        </>
      )}
      
      {serviceData.auto_filled_form_data?.status === 'rejected' && (
        <div className="contact-back-information">
          <h3>Provide Available Time Slots and Agent will contact back</h3>
          <ul>
            {availableTimes.map((time, index) => (
              <li key={index}>
                {formatDate(time)}
                <button className="delete-slot-button" onClick={() => handleDeleteTimeSlot(index)}>remove</button>
              </li>
            ))}
          </ul>
          <input
            type="datetime-local"
            value={dateTimeInput}
            onChange={handleDateTimeChange}
          />
          <button className="confirm-slot-button" onClick={handleConfirmTimeSlot}>Confirm</button>
          {confirmMessage && <p>{confirmMessage}</p>}
          <button className="chat-with-agent-button" onClick={navigateToChat}>Chat with Agent</button>
        </div>
      )}

      {serviceData.auto_filled_form_data?.status === 'service_received' && (
        <div className="received-service-details-container">
          <h3 className="received-service-details-title">Received Service Details</h3>
          <ul>
            {serviceData.agent_service_submit && serviceData.agent_service_submit.map((item, index) => (
              <li className="received-service-item" key={index}>{item}</li>
            ))}
          </ul>
        </div>
      )}
      
      {showAnimation && (
        <div className="animation-overlay">
          <div className="animation-content">
            <div className="checkmark-circle">
              <div className="checkmark"></div>
            </div>
            <p>Service Received</p>
          </div>
        </div>
      )}
      <BottomBar />
    </div>
  );
};

export default DetailMyService;
