import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ChatProvider } from './contexts/ChatContext';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import SpaceView from './pages/SpaceView';
import AdminPanel from './pages/AdminPanel';
import Chatrooms from './pages/Chatrooms';
import ChatroomView from './pages/ChatroomView';
import Messages from './pages/Messages';
import Avatars from './pages/Avatars';
import Elements from './pages/Elements';
import ProtectedRoute from './components/ProtectedRoute';
import Navbar from './components/Navbar';
import './App.css';

function App() {
  return (
    <AuthProvider>
      <ChatProvider>
        <Router>
          <div className="App">
            <Navbar />
            <main className="main-content">
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route 
                  path="/dashboard" 
                  element={
                    <ProtectedRoute>
                      <Dashboard />
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/space/:spaceId" 
                  element={
                    <ProtectedRoute>
                      <SpaceView />
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/admin" 
                  element={
                    <ProtectedRoute requireAdmin>
                      <AdminPanel />
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/chatrooms" 
                  element={
                    <ProtectedRoute>
                      <Chatrooms />
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/chatroom/:chatroomId" 
                  element={
                    <ProtectedRoute>
                      <ChatroomView />
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/messages" 
                  element={
                    <ProtectedRoute>
                      <Messages />
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/avatars" 
                  element={
                    <ProtectedRoute>
                      <Avatars />
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/elements" 
                  element={
                    <ProtectedRoute>
                      <Elements />
                    </ProtectedRoute>
                  } 
                />
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
              </Routes>
            </main>
          </div>
        </Router>
      </ChatProvider>
    </AuthProvider>
  );
}

export default App;
