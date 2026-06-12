import React, { useEffect } from "react";

import "firebaseui/dist/firebaseui.css"; // FirebaseUI styles
import * as firebaseui from "firebaseui";
import { GoogleAuthProvider, getAuth } from "firebase/auth";
import { app } from "../utils/firebase";
import { Link } from "react-router-dom";

const Login = () => {
  useEffect(() => {
    const uiConfig = {
      signInSuccessUrl: "/home",
      signInOptions: [GoogleAuthProvider.PROVIDER_ID],
      signInFlow: "popup",
    };

    const ui =
      firebaseui.auth.AuthUI.getInstance() ||
      new firebaseui.auth.AuthUI(getAuth(app));
    ui.start("#firebaseui-auth-container", uiConfig);
  }, []);

    return (
      <div className="min-h-screen animated-gradient flex items-center justify-center">
      <div className="bg-white p-8 rounded-lg shadow-2xl w-96">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800">Welcome Back</h1>
          <p className="text-gray-600 mt-2">Sign in to continue</p>
        </div>
        
        <div id="firebaseui-auth-container" className="mt-6"></div>
        
        <div className="mt-8 text-center text-sm text-gray-600">
          <p>By signing in, you agree to our</p>
          <p className="mt-1">
            <Link to="/Terms" className="text-blue-500 hover:text-blue-700">Terms of Service</Link>
            {" & "}
            <Link to="/Privacy" className="text-blue-500 hover:text-blue-700">Privacy Policy</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
