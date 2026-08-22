import React, { useState } from 'react';
import { BrowserRouter as Router, Switch, Route, Redirect } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import People from './pages/People';
import Projects from './pages/Projects';
import Users from './pages/Users';
import TasksPage from './pages/Tasks';
import Profile from './pages/Profile';
import Shell from './components/Shell';
import Placeholder from './pages/Placeholder';
import NotFound from './pages/NotFound';
import SetupAccount from './pages/SetupAccount';
import { getUser, setUser as persistUser, clearAuth } from './services/auth';

const PLACEHOLDER_PAGES = [
  { path: '/organization', title: 'Organization' }
];

const RoleRoute = ({ user, roles, ...props }) =>
  user && roles.includes(user.role) ? <Route {...props} /> : <Redirect to="/dashboard" />;

function App() {
  const [user, setUser] = useState(() => getUser());

  const handleLogin = (loggedInUser) => setUser(loggedInUser);

  const handleUserUpdated = (updatedUser) => {
    setUser(updatedUser);
    persistUser(updatedUser);
  };

  const handleLogout = () => {
    clearAuth();
    setUser(null);
  };

  return (
    <Router>
      <Switch>
        <Route exact path="/login" render={() => (user ? <Redirect to="/dashboard" /> : <Login onLogin={handleLogin} />)} />
        <Route exact path="/setup-account" render={() => <SetupAccount />} />
        <Route path="/" render={() =>
          user ? (
            <Shell user={user} onLogout={handleLogout}>
              <Switch>
                <Route exact path="/dashboard" render={() => <Dashboard user={user} />} />
                <Route exact path="/profile" render={() => <Profile user={user} onUserUpdated={handleUserUpdated} />} />
                <RoleRoute user={user} roles={['boss', 'lead']} exact path="/people" render={() => <People />} />
                <RoleRoute user={user} roles={['boss', 'lead']} exact path="/projects" render={() => <Projects />} />
                <RoleRoute user={user} roles={['boss']} exact path="/users" render={() => <Users />} />
                <RoleRoute user={user} roles={['boss', 'lead', 'engineer']} exact path="/tasks" render={() => <TasksPage user={user} />} />
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