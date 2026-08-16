import React, { useState } from 'react';
import { BrowserRouter as Router, Switch, Route, Redirect } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import Shell from './components/Shell';
import Placeholder from './pages/Placeholder';
import NotFound from './pages/NotFound';
import { getUser, clearAuth } from './services/auth';

const PLACEHOLDER_PAGES = [
  { path: '/people', title: 'People' },
  { path: '/tasks', title: 'Tasks' },
  { path: '/projects', title: 'Projects' },
  { path: '/organization', title: 'Organization' }
];

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
        <Route exact path="/login" render={() => (user ? <Redirect to="/dashboard" /> : <Login onLogin={handleLogin} />)} />
        <Route path="/" render={() =>
          user ? (
            <Shell user={user} onLogout={handleLogout}>
              <Switch>
                <Route exact path="/dashboard" render={() => <Dashboard user={user} />} />
                {PLACEHOLDER_PAGES.map(page => (
                  <Route key={page.path} exact path={page.path} render={() => <Placeholder title={page.title} />} />
                ))}
                <Route exact path="/" render={() => <Redirect to="/dashboard" />} />
                <Route component={NotFound} />
              </Switch>
            </Shell>
          ) : (
            <Redirect to="/login" />
          )
        } />
      </Switch>
    </Router>
  );
}

export default App;