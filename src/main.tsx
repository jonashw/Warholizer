import { GoogleOAuthProvider } from '@react-oauth/google';
import ReactDOM from 'react-dom/client'
import './index.css';
import './App.css';
import {
  createBrowserRouter,
  RouterProvider,
} from "react-router-dom";
import { routeConfig } from './routeConfig.tsx';

const googleAuthClientId = import.meta.env.VITE_GOOGLE_AUTH_CLIENT_ID;
if(googleAuthClientId === undefined) {
  throw new Error("GOOGLE_AUTH_CLIENT_ID environment variable must be set");
}
const router = createBrowserRouter(routeConfig);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <GoogleOAuthProvider clientId={googleAuthClientId}>
    <RouterProvider router={router} />
  </GoogleOAuthProvider>
);