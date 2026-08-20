import React, { useState } from 'react';
import { BrowserRouter as Router, Switch, Route, Redirect } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import People from './pages/People';
import Users from './pages/Users';
import Profile from './pages/Profile';
import Shell from './components/Shell';
import Placeholder from './pages/Placeholder';
import NotFound from './pages/NotFound';
import { getUser, clearAuth } from './services/auth';

const PLACEHOLDER_PAGES = [
  { path: '/tasks', title: 'Tasks' },
  { path: '/projects', title: 'Projects' },
  { path: '/organization', title: 'Organization' }
];

const RoleRoute = ({ user, roles, ...props }) =>
  user && roles.includes(user.role) ? <Route {...props} /> : <Redirect to="/dashboard" />;

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
                <Route exact path="/profile" render={() => <Profile user={user} />} />
                <RoleRoute user={user} roles={['boss', 'lead']} exact path="/people" render={() => <People />} />
                <RoleRoute user={user} roles={['boss']} exact path="/users" render={() => <Users />} />
                {PLACEHOLDER_PAGES.map(page => (
                  <RoleRoute key={page.path} user={user} roles={['boss', 'lead']} exact path={page.path} render={() => <Placeholder title={page.title} />} />
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