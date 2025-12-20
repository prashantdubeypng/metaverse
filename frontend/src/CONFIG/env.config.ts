// LOGIN_URL:
// SIGNUP_URL:
// PROFILE_URL:
// DASHBOARD_URL:
// USER_GROUP:
// SEARCH_ROOM:
// CREATE_ROOM:

export const ENDPOINTS = {
  auth: {
    login: '/api/v1/auth/login',
    signup: '/api/v1/auth/signup',
    forgetPassword: '/api/v1/auth/forgot-password',
    resetPassword: '/api/v1/auth/reset-password',
  },
  user: {
    profile: '/api/v1/user/profile',
    dashboard: '/api/v1/user/dashboard',
  },
  // Add other endpoints as needed
};
