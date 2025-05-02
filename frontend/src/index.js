import './styles/tailwind.css';
import './styles/index.css'; // Global styles
import React from 'react';
import App from './App';

// New (React 16)
import ReactDOM from 'react-dom';
ReactDOM.render(<React.StrictMode><App /></React.StrictMode>, document.getElementById('root'));