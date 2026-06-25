import axios from 'axios';

// Create an axios instance that points to the TeleCRM backend running locally
const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

export default api;
