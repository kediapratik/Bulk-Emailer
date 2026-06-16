import React from 'react'
import { useNavigate } from 'react-router-dom';

const Unauthorized = () => {
  const navigate = useNavigate();
  const adminEmail = process.env.REACT_APP_MAIN_ADMIN_EMAIL;

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
        <h1 className="text-2xl font-bold text-red-600 mb-4">Access Denied</h1>
        <p className="text-gray-600 mb-4">
          Your email is not authorized to access this application. 
        </p>
        <div className="space-y-4">
          <p className="text-gray-600">
            Please contact the administrator:
          </p>
          <div className="flex items-center space-x-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-600" viewBox="0 0 20 20" fill="currentColor">
              <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
              <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
            </svg>
            <a href={`mailto:${adminEmail}`} className="text-blue-600 hover:underline">
              {adminEmail}
            </a>
          </div>
        </div>
        <button 
          onClick={() => navigate('/')}
          className="mt-6 w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors duration-200"
        >
          Back to Login
        </button>
      </div>
    </div>
  )
}

export default Unauthorized