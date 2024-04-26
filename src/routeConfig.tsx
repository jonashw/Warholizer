import { Outlet, RouteObject } from "react-router-dom"
import App from "./App";
import TilingPatternGallery from "./TilingPatternGallery";
import Gallery from "./Gallery";
import OperationEditorDemo from "./OperationEditorDemo";
import PureGallery from "./PureGallery";

export const routeConfig: RouteObject[] = [
  {
    path:'/',
    element: (
      <div>
        <div className="nav nav-pills nav-fill mb-3" style={{
          zIndex:'1000'
        }}>{[
          {href:'/',label:'Warholizer'},
          {href:'/gallery',label:'Gallery'},
          {href:'/pure-gallery',label:'Pure Gallery'},
          {href:'/tiling-patterns',label:'Tiling Patterns'},
          {href:'/edit',label:'Operation Editor Demo'}
        ].map(route => (
          <li className="nav-item" key={route.label}>
            <a 
              className={"nav-link " + (window.location.pathname === route.href ? "active" : "")}
              href={route.href}
            >{route.label}</a>
          </li>
        ))}</div>
        <div>
          <Outlet/>
        </div>
      </div>
    ),
    children: [
      {
        path: '',
        element: <App />,
      },
      {
        path: 'tiling-patterns',
        element: <TilingPatternGallery/>
      },
      {
        path: 'gallery',
        element: <Gallery/>
      },
      {
        path: 'pure-gallery',
        element: <PureGallery/>
      },
      {
        path: 'edit',
        element: <OperationEditorDemo/>
      }
    ]
  }
];