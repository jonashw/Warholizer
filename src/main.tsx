import ReactDOM from 'react-dom/client'
import './index.css';
import './App.css';
import {
  createBrowserRouter,
  RouterProvider,
} from "react-router-dom";
import { routeConfig } from './routeConfig.tsx';

const router = createBrowserRouter(routeConfig);

ReactDOM.createRoot(document.getElementById('root')!).render(
    <RouterProvider router={router} />
);