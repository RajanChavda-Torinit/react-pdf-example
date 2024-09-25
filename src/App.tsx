import React from 'react';
import PdfViewerComponent from './components/PdfViewerComponent';

const App: React.FC = () => {

  // const documentUrl = "";
const preFillData = {
  "name3[first]": "John Doe",
  "name3[last]": "Torinit"
  // "TextField3": "2024-09-25"
};

  return (
    <div className="App" style={{ width: "100vw" }}>
      <div className="PDF-viewer">
        <PdfViewerComponent document={"document.pdf"} preFillData={preFillData}/>
      </div>
    </div>
  );
}

export default App;
