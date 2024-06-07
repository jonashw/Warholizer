import { Outlet, RouteObject } from "react-router-dom"
import App from "./App";
import Gallery from "./Gallery";
import PureGallery from "./PureGallery";
import PureEditor from "./PureEditor";
import { GraphViewerDemo } from "./GraphViewerDemo";
import { GraphEditorDemo } from "./GraphEditorDemo";
import { OperatorEditorDemo } from "./OperatorEditorDemo";
import { ProgressiveApplicationDemo } from "./ProgressiveApplicationDemo";

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
          {href:'/pure-editor',label:'Pure Editor'},
          {href:'/graph-viewer-demo',label:'Graph Viewer'},
          {href:'/graph-editor',label:'Graph Editor'},
          {href:'/operator-editor-demo',label:'Op Editor Demo'},
          {href:'/progressive-application-demo',label:'Progressive App Demo'}
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
        path: 'gallery',
        element: <Gallery/>
      },
      {
        path: 'pure-gallery',
        element: <PureGallery/>
      },
      {
        path: 'pure-editor',
        element: <PureEditor/>
      },
      {
        path: 'graph-viewer-demo',
        element: <GraphViewerDemo/>
      },
      {
        path: 'graph-editor',
        element: <GraphEditorDemo/>
      },
      {
        path: 'operator-editor-demo',
        element: <OperatorEditorDemo/>
      },
      {
        path: 'progressive-application-demo',
        element: <ProgressiveApplicationDemo/>
      }
    ]
  }
];