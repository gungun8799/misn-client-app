import React, { useState, useEffect } from 'react';
import { auth, db, storage } from '../../firebaseConfig';
import { createUserWithEmailAndPassword, sendEmailVerification } from 'firebase/auth';
import { doc, setDoc, Timestamp, collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useNavigate } from 'react-router-dom';
import './Signup.css';
import BackButton from '../BackButton/back-button.js';

const allCounties = [
  "Albany", "Allegany", "Bronx", "Broome", "Cattaraugus", "Cayuga", "Chautauqua",
  "Chemung", "Chenango", "Clinton", "Columbia", "Cortland", "Delaware", "Dutchess",
  "Erie", "Essex", "Franklin", "Fulton", "Genesee", "Greene", "Hamilton", "Herkimer",
  "Jefferson", "Kings", "Lewis", "Livingston", "Madison", "Monroe", "Montgomery",
  "Nassau", "New York", "Niagara", "Oneida", "Onondaga", "Ontario", "Orange",
  "Orleans", "Oswego", "Otsego", "Putnam", "Queens", "Rensselaer", "Richmond",
  "Rockland", "St. Lawrence", "Saratoga", "Schenectady", "Schoharie", "Schuyler",
  "Seneca", "Steuben", "Suffolk", "Sullivan", "Tioga", "Tompkins", "Ulster",
  "Warren", "Washington", "Wayne", "Westchester", "Wyoming", "Yates"
];
function Signup() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [address, setAddress] = useState({ address_line_1: '', address_line_2: '', city: '', zip: '' });
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [age, setAge] = useState('');
  const [county, setCounty] = useState('');
  const [countyOptions, setCountyOptions] = useState([]);
  const [languagePreference, setLanguagePreference] = useState('');
  const [nationality, setNationality] = useState('');
  const [profilePhoto, setProfilePhoto] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchCountyData = async () => {
      try {
          const response = await fetch('https://data.ny.gov/api/views/juva-r6g2/rows.json?accessType=DOWNLOAD&sorting=true');
          const data = await response.json();
          const rows = data.data;

          const zipToCountyMap = new Map();

          rows.forEach(row => {
              const zipCode1 = row[11]; // ZIP code from the 12th column
              const zipCode2 = row[12]; // ZIP code from the 13th column
              const county = row[8]; // County name

              if (zipCode1) {
                  if (!zipToCountyMap.has(zipCode1)) {
                      zipToCountyMap.set(zipCode1, []);
                  }
                  zipToCountyMap.get(zipCode1).push(county);
              }

              if (zipCode2) {
                  if (!zipToCountyMap.has(zipCode2)) {
                      zipToCountyMap.set(zipCode2, []);
                  }
                  zipToCountyMap.get(zipCode2).push(county);
              }
          });

          console.log('County options fetched:', zipToCountyMap);

          setCountyOptions(zipToCountyMap);
      } catch (error) {
          console.error('Error fetching county options:', error);
      }
  };



    fetchCountyData();
  }, []);

  const validateEmail = (email) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(String(email).toLowerCase());
  };

  const validatePhoneNumber = (phoneNumber) => {
    const re = /^\+?[1-9]\d{1,14}$/;
    return re.test(String(phoneNumber));
  };

  const handleProfilePhotoChange = (e) => {
    if (e.target.files[0]) {
      setProfilePhoto(e.target.files[0]);
    }
  };

  const getNextClientId = async () => {
    const clientsRef = collection(db, 'Clients');
    const q = query(clientsRef, orderBy('client_id', 'desc'), limit(1));
    const querySnapshot = await getDocs(q);
    let lastClientId = "000000";
    querySnapshot.forEach((doc) => {
      lastClientId = doc.data().client_id;
    });
    const nextClientId = (parseInt(lastClientId, 10) + 1).toString().padStart(6, '0');
    return nextClientId;
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setErrorMessage(''); // Clear previous error messages

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match');
      return;
    }

    if (!validateEmail(email)) {
      setErrorMessage('Invalid email format');
      return;
    }

    if (!validatePhoneNumber(phoneNumber)) {
      setErrorMessage('Invalid phone number format');
      return;
    }

    try {
      console.log('Creating user...');
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      console.log('User created:', user.uid);

      // Upload profile photo to Firebase Storage
      const storageRef = ref(storage, `profile_photos/${user.uid}`);
      let profilePhotoUrl = '';
      if (profilePhoto) {
        console.log('Uploading profile photo...');
        await uploadBytes(storageRef, profilePhoto);
        profilePhotoUrl = await getDownloadURL(storageRef);
        console.log('Profile photo uploaded:', profilePhotoUrl);
      }

      const clientId = await getNextClientId();
      console.log('Next client ID:', clientId);

      // Add client data to Firestore
      console.log('Adding client data to Firestore...');
      await setDoc(doc(db, 'Clients', user.uid), {
        client_id: clientId,
        email: user.email,
        full_name: `${firstName} ${lastName}`,
        date_of_birth: dateOfBirth,
        age: age,
        phoneNumber: phoneNumber,
        address: address,
        county: county,
        language_preference: languagePreference,
        nationality: nationality,
        profile_photo_url: profilePhotoUrl,
        status: 'unallocated',
        created_at: Timestamp.fromDate(new Date()),
        updated_at: Timestamp.fromDate(new Date()),
        uploaded_personal_documents_path: '',
        assigned_agent_id: '',
      });
      console.log('Client data added to Firestore');

      // Send email verification with continue URL
      const actionCodeSettings = {
        url: `${window.location.origin}/VerifyEmail`,
        handleCodeInApp: true,
      };

      await sendEmailVerification(user, actionCodeSettings);
      alert('A verification email has been sent to your email address. Please verify your email before logging in.');
      navigate('/VerifyEmail');
    } catch (error) {
      console.error('Error during signup process:', error);
      if (error.code === 'auth/email-already-in-use') {
        setErrorMessage('Email already in use. Please use a different email or login.');
      } else if (error.code === 'auth/invalid-email') {
        setErrorMessage('Invalid email address.');
      } else if (error.code === 'auth/weak-password') {
        setErrorMessage('Password is too weak. Please use a stronger password.');
      } else {
        setErrorMessage(`Signup failed: ${error.message}`);
      }
    }
  };

  const handleAddressChange = async (e) => {
    const { name, value } = e.target;
    setAddress((prevAddress) => ({
      ...prevAddress,
      [name]: value,
    }));

    if (name === 'zip' && value.length === 5) {
      console.log('ZIP code entered:', value);
      const counties = countyOptions.get(value);
      if (counties) {
        console.log('Counties for ZIP code:', counties);
        setCounty(counties[0]); // Set the first county as the default value
      } else {
        console.log('No counties found for ZIP code:', value);
        setCounty('');
      }
    }
  };

  return (
    <div className="signup-container">
      <form onSubmit={handleSignup} className="signup-form">
        <BackButton />
        <h2 className="signup-title">Sign up</h2>
        <label>First Name</label>
        <input
          type="text"
          placeholder="First name"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          required
        />
        <label>Last Name</label>
        <input
          type="text"
          placeholder="Last name"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          required
        />
        <label>Email</label>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <label>Phone Number</label>
        <input
          type="text"
          placeholder="Phone Number"
          value={phoneNumber}
          onChange={(e) => setPhoneNumber(e.target.value)}
          required
        />
        <label>Create a password</label>
        <input
          type="password"
          placeholder="Create a password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <label>Confirm password</label>
        <input
          type="password"
          placeholder="Confirm password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
        />
        <label>Date of Birth</label>
        <input
          type="date"
          value={dateOfBirth}
          onChange={(e) => setDateOfBirth(e.target.value)}
          required
        />
        <label>Age</label>
        <input
          type="number"
          placeholder="Age"
          value={age}
          onChange={(e) => setAge(e.target.value)}
          required
        />
        <label>Address Line 1</label>
        <input
          type="text"
          name="address_line_1"
          placeholder="Address Line 1"
          value={address.address_line_1}
          onChange={handleAddressChange}
          required
        />
        <label>Address Line 2</label>
        <input
          type="text"
          name="address_line_2"
          placeholder="Address Line 2"
          value={address.address_line_2}
          onChange={handleAddressChange}
        />
        <label>City</label>
        <input
          type="text"
          name="city"
          placeholder="City"
          value={address.city}
          onChange={handleAddressChange}
          required
        />
        <label>Zip Code</label>
        <input
          type="text"
          name="zip"
          placeholder="Zip Code"
          value={address.zip}
          onChange={handleAddressChange}
          required
        />
        
        <label>County</label>
        <select className="county-select" value={county} onChange={(e) => setCounty(e.target.value)} required>
          <option value="">Select County</option>
          {allCounties.map((countyName, index) => (
            <option key={index} value={countyName}>
              {countyName}
            </option>
          ))}
        </select>

        
        <label>Language Preference</label>
        <input
          type="text"
          placeholder="Language Preference"
          value={languagePreference}
          onChange={(e) => setLanguagePreference(e.target.value)}
        />
        <label>Nationality</label>
        <input
          type="text"
          placeholder="Nationality"
          value={nationality}
          onChange={(e) => setNationality(e.target.value)}
          required
        />
        <label>Profile Photo</label>
        <input className="profile-photo-input"
          type="file"
          accept="image/*"
          onChange={handleProfilePhotoChange}
        />
        {errorMessage && <p className="error-message">{errorMessage}</p>}
        <button type="submit" className="signup-button">
          Signup
        </button>
      </form>
    </div>
  );
}

export default Signup;


