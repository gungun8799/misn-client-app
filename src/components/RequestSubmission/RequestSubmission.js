import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { db, auth, storage } from '../../firebaseConfig';
import { doc, getDoc, updateDoc, collection, getDocs } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'; // Import necessary functions from Firebase Storage
import styles from './RequestSubmission.module.css';

const RequestSubmission = () => {
  const [clientId, setClientId] = useState('');
  const [instructionText, setInstructionText] = useState('');
  const [displayedText, setDisplayedText] = useState('');
  const [isDisplayingText, setIsDisplayingText] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState('');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [formQuestions, setFormQuestions] = useState([]);
  const [recording, setRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [audioChunks, setAudioChunks] = useState([]);
  const navigate = useNavigate();
  const { applicationId } = useParams();
  const [showStartInterviewButton, setShowStartInterviewButton] = useState(false); // Initially hidden
  const [showInstructionButton, setShowInstructionButton] = useState(true); // Initially hidden
  const [showRecordingButton, setShowRecordingButton] = useState(false); // Initially hidden
  const [showNextQuestionButton, setShowNextQuestionButton] = useState(false); // Add this line
  const [hasInstructionBeenDisplayed, setHasInstructionBeenDisplayed] = useState(false);
  const [loading, setLoading] = useState(false); // For loading animation
  const [noiseLevel, setNoiseLevel] = useState(0); // State to track noise level

  useEffect(() => {
    const fetchClientData = async () => {
      const user = auth.currentUser;
      if (user) {
        try {
          const clientDocRef = doc(db, 'Clients', user.uid);
          const clientDoc = await getDoc(clientDocRef);
          if (clientDoc.exists()) {
            const clientId = clientDoc.data().client_id;
            setClientId(clientId);
          } else {
            console.error('Client document does not exist');
          }
        } catch (error) {
          console.error('Error fetching client document:', error);
        }
      } else {
        console.error('No user is currently logged in');
      }
    };

    fetchClientData();
  }, []);

  useEffect(() => {
    if (formQuestions.length > 0) {
      askQuestion(0);
    }
  }, [formQuestions]);

  const handleBackClick = () => {
    navigate(-1);
  };

  const handleInterviewInstruction = async () => {
    try {
      const instructionCollectionRef = collection(db, 'instruction');
      const instructionSnapshot = await getDocs(instructionCollectionRef);

      if (instructionSnapshot.empty) {
        console.error('Instruction collection does not contain any documents');
        return;
      }

      const instructionDoc = instructionSnapshot.docs[0];
      const instructionData = instructionDoc.data();
      const instructionText = instructionData.instruction_text;
      const language = localStorage.getItem('selectedLanguage') || 'en';

      const translateResponse = await axios.post('http://localhost:8000/translate', { text: instructionText, target_language: language });
      const translatedText = translateResponse.data.translated_text;

      setInstructionText(translatedText);
      displayTextWordByWord(translatedText, 100);

      const ttsResponse = await axios.post('http://localhost:8000/tts', { text: translatedText, language });
      const audioURL = ttsResponse.data.audio_url;
      const audio = new Audio(audioURL);
      audio.play();
    } catch (error) {
      console.error('Error generating TTS for instruction:', error);
    }
  };

  const displayTextWordByWord = (text, intervalTime = 20) => {
    setIsDisplayingText(true);
    setDisplayedText('');
    const characters = Array.from(text);
    let index = -1;
    const interval = setInterval(() => {
      if (index < characters.length) {
        setDisplayedText(prev => prev + characters[index]);
        index++;
      } else {
        clearInterval(interval);
        setIsDisplayingText(false);
        setDisplayedText(prev => prev.endsWith('undefined') ? prev.slice(0, -9) : prev); // Ensure 'undefined' is not appended

        if (!hasInstructionBeenDisplayed) {
          setShowStartInterviewButton(true);
          setShowInstructionButton(false);
          setHasInstructionBeenDisplayed(true);
        }
      }
    }, intervalTime);
  };

  const handleStartInterview = async () => {
    setShowStartInterviewButton(false); // Hide the Start Interview button permanently
    setDisplayedText('');

    try {
      const applicationRef = doc(db, 'Applications', applicationId);
      const applicationSnap = await getDoc(applicationRef);

      if (!applicationSnap.exists()) {
        console.error('Application document does not exist');
        return;
      }

      const applicationData = applicationSnap.data();
      const formScreeningData = applicationData.form_screening_data;

      if (!formScreeningData || formScreeningData.length === 0) {
        console.error('form_screening_data is empty or does not exist');
        return;
      }

      setFormQuestions(formScreeningData);
      askQuestion(0);
    } catch (error) {
      console.error('Error starting interview:', error);
    }
  };

  const askQuestion = async (index) => {
    if (index >= formQuestions.length) {
      return;
    }

    const questionData = formQuestions[index];
    const question = questionData.Question;
    const language = localStorage.getItem('selectedLanguage') || 'en';

    try {
      const translateResponse = await axios.post('http://localhost:8000/translate', { text: question, target_language: language });
      let translatedText = translateResponse.data.translated_text;

      if (translatedText === 'N/A') {
        translatedText = question;
      }

      setCurrentQuestion(translatedText);
      displayTextWordByWord(translatedText);

      const ttsResponse = await axios.post('http://localhost:8000/tts', { text: translatedText, language });
      const audioURL = ttsResponse.data.audio_url;
      const audio = new Audio(audioURL);
      audio.play();

      setShowRecordingButton(true);
    } catch (error) {
      console.error('Error asking question:', error);
    }
  };

  const uploadAudioAndGetURL = async (audioBlob, applicationId, currentQuestionIndex) => {
    const audioFile = new File([audioBlob], 'recorded_audio.mp3', { type: 'audio/mp3' });
    const storageRef = ref(storage, `audio_files/${applicationId}/${Date.now()}_recorded_audio.mp3`);
    await uploadBytes(storageRef, audioFile);
    const audioURL = await getDownloadURL(storageRef);
    return audioURL;
  };

  const handleStartRecording = async () => {
    setRecording(true);
    setShowRecordingButton(false);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      setMediaRecorder(mediaRecorder);

      const audioChunks = [];
      mediaRecorder.ondataavailable = event => {
        audioChunks.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/mp3' });
        const audioURL = await uploadAudioAndGetURL(audioBlob, applicationId, currentQuestionIndex);

        const formData = new FormData();
        formData.append('file', new File([audioBlob], 'recorded_audio.mp3', { type: 'audio/mp3' }));
        const language = localStorage.getItem('selectedLanguage') || 'en';
        formData.append('target_language', language);
        setLoading(true);
        try {
          // Transcribe the recorded audio
          const response = await axios.post('http://localhost:8000/transcribe', formData, {
            headers: {
              'Content-Type': 'multipart/form-data'
            }
          });

          const { native_text, detected_language } = response.data;
          console.log('Transcribed Text:', native_text);
          console.log('Detected language:', detected_language);

          // Translate the transcribed text to English
          const translateResponse = await axios.post('http://localhost:8000/translate', {
            text: native_text,
            target_language: 'en'
          });

          const translatedText = translateResponse.data.translated_text;
          console.log('Translated Text:', translatedText);

          // Send transcription to Gemini for form filling
          const questionData = formQuestions[currentQuestionIndex];
          const prompt = questionData.Prompt;

          const geminiResponse = await axios.post('http://localhost:8000/send-to-gemini', {
            prompt: { [questionData.Question]: prompt },
            transcription: translatedText,
            form_data: {}
          });

          const filled_form = geminiResponse.data.filled_form;

          // Update form data with the filled response
          await updateFormData(currentQuestionIndex, filled_form, audioURL, translatedText);

          setShowRecordingButton(false);
          setRecording(false);
          setShowNextQuestionButton(true);
          setLoading(false);
        } catch (error) {
          console.error('Error processing response:', error);
        }
      };

      mediaRecorder.start();

      let silenceStart = Date.now();
      let silenceThreshold = -50; // Adjust threshold for environment noise
      let maxVolume = silenceThreshold;

      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(2048, 1, 1);

      processor.onaudioprocess = (event) => {
        const input = event.inputBuffer.getChannelData(0);
        let total = 0;
        for (let i = 0; i < input.length; i++) {
          total += input[i] * input[i];
        }
        const rms = Math.sqrt(total / input.length);
        const volume = 20 * Math.log10(rms);

        console.log(`Current noise level: ${volume}`); // Log the noise level

        if (volume > maxVolume) {
          maxVolume = volume;
          silenceThreshold = maxVolume - 10; // Adjust threshold
        }

        if (volume < silenceThreshold) {
          if (Date.now() - silenceStart > 5000) {
            mediaRecorder.stop();
            processor.disconnect();
            source.disconnect();
          }
        } else {
          silenceStart = Date.now();
        }
      };

      source.connect(processor);
      processor.connect(audioContext.destination);
    } catch (error) {
      console.error('Error starting recording:', error);
    }
  };

  const handleStopRecording = () => {
    setRecording(false);
    if (mediaRecorder) {
      mediaRecorder.stop();
    }
  };

  const updateFormData = async (index, data, audioURL, transcribedText) => {
    try {
      const applicationRef = doc(db, 'Applications', applicationId);
      const applicationSnap = await getDoc(applicationRef);
      if (!applicationSnap.exists()) {
        console.error('Application document does not exist');
        return;
      }
  
      const applicationData = applicationSnap.data();
      const formScreeningData = applicationData.form_screening_data;
  
      const questionData = formScreeningData[index];
      if (questionData) {
        questionData.Answer = data[questionData.Question] || 'N/A';
        questionData.audio_url = audioURL;
        questionData.transcribed_text = transcribedText;
      }
  
      // Set application_summary to the Answer of the first question
      const applicationSummary = formScreeningData.length > 0 ? formScreeningData[0].Answer : '';
  
      await updateDoc(applicationRef, {
        form_screening_data: formScreeningData,
        application_summary: applicationSummary
      });
    } catch (error) {
      console.error('Error updating form data:', error);
    }
  };
  

  const handleNextQuestion = () => {
    const nextIndex = currentQuestionIndex + 1;
    setCurrentQuestionIndex(nextIndex);
    setShowNextQuestionButton(false); // Hide the next question button until recording is done
    askQuestion(nextIndex);
  };

  return (
    <div className={styles.requestSubmissionContainer}>
      <h1>Submit Request</h1>
      {showInstructionButton && (
        <button className={styles.instructionButton} onClick={handleInterviewInstruction} disabled={isDisplayingText}>Interview Instruction</button>
      )}
      <div className={styles.instructionTextContainer}>
        <span className={styles.instructionText}>{displayedText}</span>
      </div>
      {showStartInterviewButton && (
        <button className={styles.startInterviewButton} onClick={handleStartInterview}>Start Interview</button>
      )}
      {currentQuestion && (
        <div className={styles.questionContainer}>
          {showRecordingButton && !recording && (
            <button className={styles.recordingButton} onClick={handleStartRecording}>Start Recording</button>
          )}
          {recording && (
            <button className={styles.recordingButton} onClick={handleStopRecording}>Stop Recording</button>
          )}
          {recording && <span>Recording...</span>}
          {!recording && showNextQuestionButton && (
            <button className={styles.nextQuestionButton} onClick={handleNextQuestion}>Next Question</button>
          )}
        </div>
      )}
      {loading && ( // Conditionally render the loading animation
        <div className={styles.loadingOverlay}>
          <div className={styles.spinner}>
            <div></div>
            <div></div>
            <div></div>
            <div></div>
            <div></div>
            <div></div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RequestSubmission;
