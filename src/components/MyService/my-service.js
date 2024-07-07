import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../../firebaseConfig';
import { useNavigate } from 'react-router-dom';
import './my-service.css';
import BottomBar from '../BottomBar';

const MyService = () => {
  const [services, setServices] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          console.log('Logged in user email:', user.email); // Debugging line
          const clientQuery = query(collection(db, 'Clients'), where('email', '==', user.email));
          const clientSnapshot = await getDocs(clientQuery);
          if (!clientSnapshot.empty) {
            const clientData = clientSnapshot.docs[0].data();
            console.log('Client Data:', clientData); // Debugging line
            subscribeToServices(clientData.client_id);
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

  const subscribeToServices = (clientId) => {
    console.log('Subscribing to services for client ID:', clientId); // Debugging line
    const servicesQuery = query(collection(db, 'Applications'), where('auto_filled_form_data.client_id', '==', clientId));
    const unsubscribe = onSnapshot(servicesQuery, (servicesSnapshot) => {
      const servicesList = servicesSnapshot.docs.map(doc => {
        const data = doc.data();
        console.log('Detected matched Client ID from Applications collection:', data.auto_filled_form_data.client_id); // Debugging line
        return { ...data, id: doc.id };
      });
      console.log('Services List:', servicesList); // Debugging line
      setServices(servicesList);
    }, (error) => {
      console.error('Error fetching services:', error);
    });

    return unsubscribe;
  };

  const getStatus = (service) => {
    const status = service.auto_filled_form_data.status;

    // Check if there are timestamps in agent_contact_back
    if (service.agent_contact_back && service.agent_contact_back.timestamps && service.agent_contact_back.timestamps.length > 0) {
      return 'In-progress';
    }

    // Check if uploaded_documents_path is not empty when status is request_docs or request_additional_docs
    if ((status === 'request_docs' || status === 'request_additional_docs') && service.uploaded_documents_path && Object.keys(service.uploaded_documents_path).length > 0) {
      return 'In-progress';
    }

    // Determine status based on auto_filled_form_data.status
    if (status === 'submitted') return 'In-progress';
    if (status === 'request_docs' || status === 'request_additional_docs') return 'Action Required';
    if (status === 'service_submitted') return 'Application Approved';
    if (status === 'rejected') return 'Action required';
    if (status === 'service_received') return 'Received';
    if (status === 'approved') return 'Service Approved';
    if (status === 'submitted') return 'Service Received';
    return 'Unknown';
  };

  const handleCardClick = (serviceId) => {
    navigate(`/detail-my-service/${serviceId}`);
  };

  return (
    <div className="my-service">
      <h2 className="my-service-title">My Services</h2>
      <div className="space"></div>
      <div className="service-list">
        {services.length === 0 ? (
          <p>No services found.</p>
        ) : (
          services.map((service) => (
            <div 
              key={service.id} 
              className={`service-item ${getStatus(service).replace(' ', '-').toLowerCase()}`}
              onClick={() => handleCardClick(service.id)}
            >
              <h3>Application ID: {service.id}</h3>
              <p>Service Name: {service.auto_filled_form_data.application_summary}</p>
              <p>Status: <span>{getStatus(service)}</span></p>
            </div>
          ))
        )}
      </div>
      <BottomBar />
    </div>
  );
};

export default MyService;
