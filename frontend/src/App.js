import React, { useState } from 'react';
import { BrowserRouter as Router, Switch, Route, Redirect } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import { getUser, clearAuth } from './services/auth';

function App() {
  const [user, setUser] = useState(() => getUser());

  const handleLogin = (loggedInUser) => setUser(loggedInUser);

  const handleLogout = () => {
    clearAuth();
    setUser(null);
  };

  return (
    <Router>
      <Switch>
        <Route exact path="/login" render={() => (user ? <Redirect to="/" /> : <Login onLogin={handleLogin} />)} />
        <Route exact path="/" render={() => (user ? <Dashboard user={user} onLogout={handleLogout} /> : <Redirect to="/login" />)} />
      </Switch>
    </Router>
  );
}

export default App;
