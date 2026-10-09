import { Outlet, RouteObject } from "react-router"
import App from "./App";
import Gallery from "./Gallery";
import PureGallery from "./PureGallery";
import PureEditor from "./PureEditor";
import { GraphViewerDemo } from "./GraphViewerDemo";
import { GraphEditorDemo } from "./GraphEditorDemo";
import { OperatorEditorDemo } from "./OperatorEditorDemo";
import { ProgressiveApplicationDemo } from "./ProgressiveApplicationDemo";
import { ImmersiveEditorDemo } from "./ImmersiveEditorDemo";
import GoogleLoginPage from "./GoogleLoginPage";
import GoogleLoginComplete from "./GoogleLoginComplete";
import FileUploadPage from "./FileUploadPage";
import BenchmarkPage from "./BenchmarkPage";
import FilterGalleryPage from "./FilterGalleryPage";
import ComposerPage from "./Composer/ui/ComposerPage";
import PublicPage from "./Composer/ui/PublicPage";

export const routeConfig: RouteObject[] = [
  // Full screen (phone first), outside the demo navigation.
  {
    path: '/composer',
    element: <ComposerPage/>
  },
  // A shared composition's public link (ADR 0001).
  {
    path: '/c/:slug',
    element: <PublicPage/>
  },
  {
    path:'/',
    element: (
      <div className="height-100 d-flex flex-column">
        <div id="top-nav" className="nav nav-pills nav-fill mb-3" style={{
          zIndex:'1000'
        }}>{[
          {href:'/',label:'Warholizer'},
          {href:'/gallery',label:'Gallery'},
          {href:'/google-login',label:'Google Login'},
          {href:'/pure-gallery',label:'Pure Gallery'},
          {href:'/pure-editor',label:'Pure Editor'},
          {href:'/composer',label:'Composer'},
          {href:'/filter-gallery',label:'Filter Gallery'},
          {href:'/graph-viewer-demo',label:'Graph Viewer'},
          {href:'/graph-editor',label:'Graph Editor'},
          {href:'/operator-editor-demo',label:'Op Editor Demo'},
          {href:'/progressive-application-demo',label:'Progressive App Demo'},
          {href:'/immersive-editor-demo',label:'Immersive Editor Demo'}
        ].map(route => (
          <li className="nav-item" key={route.label}>
            <a 
              className={"nav-link " + (window.location.pathname === route.href ? "active" : "")}
              href={route.href}
            >{route.label}</a>
          </li>
        ))}</div>
        <div className="flex-grow-1">
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
        path: 'filter-gallery',
        element: <FilterGalleryPage/>
      },
      {
        path: 'benchmark',
        element: <BenchmarkPage/>
      },
      {
        path: 'file-upload',
        element: <FileUploadPage/>
      },
      {
        path: 'google-login',
        element: <GoogleLoginPage/>
      },
      {
        path: 'google-login-complete',
        element: <GoogleLoginComplete/>
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
      },
      {
        path: 'immersive-editor-demo',
        element: <ImmersiveEditorDemo/>
      }
    ]
  }
];