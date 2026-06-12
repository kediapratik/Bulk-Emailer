export const BASE_URL =
  process.env.REACT_APP_API_URL || "http://localhost:5000";
export const API_ENDPOINTS = {
  SEND_EMAILS: `${BASE_URL}/send-emails`,
  GRANT_ACCESS: `${BASE_URL}/grant-access`,
  REVOKE_ACCESS: `${BASE_URL}/revoke-access`,
  TOGGLE_ADMIN: `${BASE_URL}/toggle-admin`,
  AUTHORIZED_USERS: `${BASE_URL}/authorized-users`,
  EMAIL_LISTS: `${BASE_URL}/api/lists`,
};