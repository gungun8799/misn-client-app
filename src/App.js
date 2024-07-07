import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from './i18n';
import Login from './components/Login/Login';
import Home from './components/Home/Home';
import Signup from './components/Signup/Signup';
import VerifyEmail from './components/VerifyEmail/VerifyEmail';
import Mypage from './components/Mypage/my-page';
import VisitSchedule from './components/VisitSchedule/visit-schedule';
import MyAgent from './components/MyAgent/my-agent';
import ClientChat from './components/ClientChat/client-chat';
import MyService from './components/MyService/my-service';
import DetailMyService from './components/DetailMyService/detail-my-service';
import RequestSubmission from './components/RequestSubmission/RequestSubmission'; // Import RequestSubmission
import IssueTicket from './components/IssueTicket/IssueTicket'; // Import RequestSubmission
import FormSubmission from './components/FormSubmission/FormSubmission'; // Import RequestSubmission

function App() {
  return (
    <I18nextProvider i18n={i18n}>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/home" element={<Home />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/VerifyEmail" element={<VerifyEmail />} />
          <Route path="/my-page" element={<Mypage />} />
          <Route path="/visit-schedule" element={<VisitSchedule />} />
          <Route path="/my-agent" element={<MyAgent />} />
          <Route path="/client-chat/:client_id" element={<ClientChat />} />
          <Route path="/my-service" element={<MyService />} />
          <Route path="/detail-my-service/:serviceId" element={<DetailMyService />} />
          <Route path="/requestsubmission/:applicationId" element={<RequestSubmission />} /> {/* Add route for RequestSubmission */}
          <Route path="/IssueTicket/:ticketId" element={<IssueTicket />} /> {/* Add route for RequestSubmission */}
          <Route path="/FormSubmission/:serviceId" element={<FormSubmission />} /> {/* Add route for RequestSubmission */}


        </Routes>
      </Router>
    </I18nextProvider>
  );
}

export default App;
