import React from 'react';
import PdfViewerComponent from './components/PdfViewerComponent';
// import DragAndDropSignature from './components/DragAndDropSignature';

const App: React.FC = () => {

  return (
    <div className="App" style={{ width: "100vw" }}>
      <div className="PDF-viewer">
        <PdfViewerComponent document={"document.pdf"} />
        {/* <DragAndDropSignature document={"document.pdf"}/> */}
      </div>
    </div>
  );
}

export default App;
