// src/Components/Pages/Profile/Profile.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../../../services/api';
import './Profile.css';

const Profile = () => {
  const [activeTab, setActiveTab] = useState('info'); // 'info' or 'password'
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  
  const navigate = useNavigate();

  // User data
  const [userData, setUserData] = useState({
    id: '',
    name: '',
    email: '',
    taxID: '',
    homeAddress: ''
  });

  // Form data for editing
  const [formData, setFormData] = useState({
    name: '',
    taxID: '',
    homeAddress: ''
  });

  // Password change data
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  // Load user data on mount
  useEffect(() => {
    const token = sessionStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }

    // Get user from localStorage
    const userStr = sessionStorage.getItem('user');
    if (userStr) {
      const user = JSON.parse(userStr);
      
      // Fetch full user data from backend
      fetchUserData(user.id);
    } else {
      navigate('/login');
    }
  }, [navigate]);

  const fetchUserData = async (userId) => {
    try {
      const response = await API.get(`/users/${userId}`);
      const user = response.data;
      
      setUserData({
        id: user._id || '',
        name: user.name || '',
        email: user.email || '',
        taxID: user.taxID || '',
        homeAddress: user.homeAddress || ''
      });
      
      setFormData({
        name: user.name || '',
        taxID: user.taxID || '',
        homeAddress: user.homeAddress || ''
      });
      
      setLoading(false);
    } catch (error) {
      console.error('Fetch user error:', error);
      setMessage({ type: 'error', text: 'Failed to load profile data' });
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage({ type: '', text: '' });

    try {
      const userStr = sessionStorage.getItem('user');
      const user = JSON.parse(userStr);

      const response = await API.put(`/users/${user.id}`, formData);
      
      // Update local storage
      sessionStorage.setItem('user', JSON.stringify({
        ...user,
        name: response.data.name
      }));

      setUserData({
        ...userData,
        ...formData
      });
      
      setIsEditing(false);
      setMessage({ type: 'success', text: 'Profile updated successfully!' });
      
      // Clear message after 3 seconds
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    } catch (error) {
      console.error('Update error:', error);
      setMessage({ 
        type: 'error', 
        text: error.response?.data?.message || 'Failed to update profile' 
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setFormData({
      name: userData.name,
      taxID: userData.taxID,
      homeAddress: userData.homeAddress
    });
    setIsEditing(false);
    setMessage({ type: '', text: '' });
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });

    // Validation
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setMessage({ type: 'error', text: 'New passwords do not match' });
      return;
    }

    if (passwordData.newPassword.length < 6) {
      setMessage({ type: 'error', text: 'Password must be at least 6 characters' });
      return;
    }

    setSaving(true);

    try {
      const userStr = sessionStorage.getItem('user');
      const user = JSON.parse(userStr);

      await API.put(`/users/${user.id}/password`, {
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword
      });

      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });

      setMessage({ type: 'success', text: 'Password changed successfully!' });
      
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    } catch (error) {
      console.error('Password change error:', error);
      setMessage({ 
        type: 'error', 
        text: error.response?.data?.message || 'Failed to change password' 
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="profile-page">
        <h1>Loading...</h1>
      </div>
    );
  }

  return (
    <div className="profile-page">
      <div className="profile-header">
        <h1>My Profile</h1>
        <p>Manage your account information and settings</p>
      </div>

      <div className="profile-content">
        {/* Tabs */}
        <div className="profile-tabs">
          <button
            className={`tab-button ${activeTab === 'info' ? 'active' : ''}`}
            onClick={() => setActiveTab('info')}
          >
            Profile Information
          </button>
          <button
            className={`tab-button ${activeTab === 'password' ? 'active' : ''}`}
            onClick={() => setActiveTab('password')}
          >
            Change Password
          </button>
        </div>

        {/* Tab Content */}
        <div className="tab-content">
          {/* Profile Info Tab */}
          {activeTab === 'info' && (
            <div className="profile-info-section">
              {message.text && (
                <div className={`${message.type}-message`}>
                  {message.text}
                </div>
              )}

              {!isEditing ? (
                <>
                  <div className="info-grid">
                    <div className="info-item">
                      <span className="info-label">Full Name</span>
                      <span className="info-value">{userData.name}</span>
                    </div>

                    <div className="info-item">
                      <span className="info-label">User ID</span>
                      <span className="info-value">{userData.id}</span>
                    </div>

                    <div className="info-item">
                      <span className="info-label">Email Address</span>
                      <span className="info-value">{userData.email}</span>
                    </div>

                    <div className="info-item">
                      <span className="info-label">Tax ID</span>
                      <span className={`info-value ${!userData.taxID ? 'empty' : ''}`}>
                        {userData.taxID || 'Not provided'}
                      </span>
                    </div>

                    <div className="info-item">
                      <span className="info-label">Home Address</span>
                      <span className={`info-value ${!userData.homeAddress ? 'empty' : ''}`}>
                        {userData.homeAddress || 'Not provided'}
                      </span>
                    </div>
                  </div>

                  <button 
                    className="edit-profile-btn"
                    onClick={() => setIsEditing(true)}
                  >
                    Edit Profile
                  </button>
                </>
              ) : (
                <form onSubmit={handleSaveProfile} className="profile-edit-form">
                  <div className="form-group">
                    <label>Full Name *</label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Email Address</label>
                    <input
                      type="email"
                      value={userData.email}
                      disabled
                      style={{ background: '#f0f0f0', cursor: 'not-allowed' }}
                    />
                    <small style={{ color: '#666', fontSize: '12px' }}>
                      Email cannot be changed
                    </small>
                  </div>

                  <div className="form-group">
                    <label>Tax ID</label>
                    <input
                      type="text"
                      name="taxID"
                      value={formData.taxID}
                      onChange={handleInputChange}
                      placeholder="Enter your tax ID"
                    />
                  </div>

                  <div className="form-group">
                    <label>Home Address</label>
                    <textarea
                      name="homeAddress"
                      value={formData.homeAddress}
                      onChange={handleInputChange}
                      placeholder="Enter your full address"
                      rows="3"
                    />
                  </div>

                  <div className="form-actions">
                    <button 
                      type="submit" 
                      className="save-btn"
                      disabled={saving}
                    >
                      {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                    <button 
                      type="button" 
                      className="cancel-btn"
                      onClick={handleCancelEdit}
                      disabled={saving}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* Password Tab */}
          {activeTab === 'password' && (
            <div className="password-section">
              {message.text && (
                <div className={`${message.type}-message`}>
                  {message.text}
                </div>
              )}

              <div className="password-info">
                <p>
                  <strong>Password Requirements:</strong> Minimum 6 characters
                </p>
              </div>

              <form onSubmit={handleChangePassword}>
                <div className="form-group">
                  <label>Current Password *</label>
                  <input
                    type="password"
                    name="currentPassword"
                    value={passwordData.currentPassword}
                    onChange={handlePasswordChange}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>New Password *</label>
                  <input
                    type="password"
                    name="newPassword"
                    value={passwordData.newPassword}
                    onChange={handlePasswordChange}
                    required
                    minLength="6"
                  />
                </div>

                <div className="form-group">
                  <label>Confirm New Password *</label>
                  <input
                    type="password"
                    name="confirmPassword"
                    value={passwordData.confirmPassword}
                    onChange={handlePasswordChange}
                    required
                    minLength="6"
                  />
                </div>

                <div className="form-actions">
                  <button 
                    type="submit" 
                    className="save-btn"
                    disabled={saving}
                  >
                    {saving ? 'Changing...' : 'Change Password'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Profile;