import React from 'react';
import './App.css';
import Warholizer from './Warholizer/Warholizer';

function App() {
  return (
    <div className="App">
    <Warholizer 
      initialRowSize={4}
      initialThreshold={121}
      initialThresholdIsInEffect={true}
      initialImgSrc="/warhol.jpg"/>
    </div>
  );
}

export default App;
