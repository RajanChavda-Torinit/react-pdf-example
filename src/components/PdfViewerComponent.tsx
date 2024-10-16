/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useRef, useState, DragEvent, ChangeEvent } from "react";
import PSPDFKit from "pspdfkit";

// Helper to convert a file to a base64 string
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

// Generate a unique key for each PDF based on its name or path
const generatePdfKey = (file: File | string): string => 
  typeof file === "string" ? file : file.name;

interface SignatureCoordinate {
  left: number;
  top: number;
  width: number;
  height: number;
  pageIndex: number;
}

const PDFViewerWithSignature = () => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [instance, setInstance] = useState<PSPDFKit.Instance | null>(null);
  const [currentPdfKey, setCurrentPdfKey] = useState<string | null>(null);

  // Load PSPDFKit and render the PDF document
  useEffect(() => {
    if (!pdfUrl || !currentPdfKey) return;

    (async () => {
      try {
        const loadedInstance = await PSPDFKit.load({
          container: containerRef.current!,
          document: pdfUrl,
          baseUrl: `${window.location.protocol}//${window.location.host}/${import.meta.env.BASE_URL}`,
        });

        setInstance(loadedInstance);
        setupDragAndDrop(loadedInstance);

        const storedCoordinates = getStoredSignatureData(currentPdfKey);
        if (storedCoordinates.length > 0) {
          restoreSignatures(loadedInstance, storedCoordinates);
        }
      } catch (error) {
        console.error("Error loading PSPDFKit:", error);
      }
    })();

    return () => {
      PSPDFKit.unload(containerRef.current!);
    };
  }, [pdfUrl, currentPdfKey]);

  // Set up drag-and-drop events on the PDF container
  const setupDragAndDrop = (inst: PSPDFKit.Instance) => {
    const container = inst.contentDocument?.host;

    container?.addEventListener("dragover", (e) => e.preventDefault());
    container?.addEventListener("drop", async (e) => {
      await handleDrop(e, inst);
    });
  };

  // Store signature coordinates for a PDF in session storage
  const storeSignatureData = (pdfKey: string, coordinates: SignatureCoordinate) => {
    const existingData = JSON.parse(sessionStorage.getItem("pdfSignatureData") || "{}");
    const updatedData = { ...existingData, [pdfKey]: [...(existingData[pdfKey] || []), coordinates] };
    sessionStorage.setItem("pdfSignatureData", JSON.stringify(updatedData));
  };

  // Retrieve stored signature coordinates for a PDF
  const getStoredSignatureData = (pdfKey: string): SignatureCoordinate[] => {
    const data = JSON.parse(sessionStorage.getItem("pdfSignatureData") || "{}");
    return data[pdfKey] || [];
  };

  // Restore previously stored signatures on the PDF
  const restoreSignatures = async (inst: PSPDFKit.Instance, coordinates: SignatureCoordinate[]) => {
    for (const coord of coordinates) {
      const widget = new PSPDFKit.Annotations.TextAnnotation({
        boundingBox: new PSPDFKit.Geometry.Rect(coord),
        text: { format: "plain", value: "Sign for TestUser" },
        formFieldName: "DigitalSignature",
        id: PSPDFKit.generateInstantId(),
        pageIndex: coord.pageIndex,
        customData: { type: "ds" },
      });
      await inst.create([widget]);
    }
  };

  // Handle PDF upload and render the selected file
  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setUploadedFiles((prev) => [...prev, ...files]);

    if (files[0]) {
      const base64Pdf = await fileToBase64(files[0]);
      const pdfKey = generatePdfKey(files[0]);
      setCurrentPdfKey(pdfKey);
      setPdfUrl(base64Pdf);
    }
  };

  // Switch between uploaded files for viewing
  const handleFileClick = async (file: File) => {
    const base64Pdf = await fileToBase64(file);
    const pdfKey = generatePdfKey(file);
    setCurrentPdfKey(pdfKey);
    setPdfUrl(base64Pdf);
  };

  // Handle drag start event for a signature widget
  const onDragStart = (e: DragEvent<HTMLDivElement>, type: string) => {
    const instantId = PSPDFKit.generateInstantId();
    e.dataTransfer.setData("text/plain", `signature%${instantId}%${type}`);
    e.dataTransfer.dropEffect = "move";
    e.currentTarget.style.opacity = "0.8";
  };

  const onDragEnd = (e: DragEvent<HTMLDivElement>) => {
    e.currentTarget.style.opacity = "1";
  };

  // Handle drop event and create a signature annotation
  const handleDrop = async (e: DragEvent<HTMLDivElement>, inst: PSPDFKit.Instance) => {
    e.preventDefault();
    const [_, instantId, type] = e.dataTransfer.getData("text/plain").split("%");
    const pageIndex = 0;

    const rect = new PSPDFKit.Geometry.Rect({
      left: e.clientX - 125,
      top: e.clientY - 50,
      width: 250,
      height: 100,
    });

    const pageRect = inst.transformContentClientToPageSpace(rect, pageIndex);

    if (currentPdfKey) {
      storeSignatureData(currentPdfKey, { ...pageRect, pageIndex });
    }

    const widget = new PSPDFKit.Annotations.TextAnnotation({
      boundingBox: pageRect,
      text: { format: "plain", value: "Sign for TestUser" },
      formFieldName: "DigitalSignature",
      id: instantId,
      pageIndex,
      customData: { type },
    });

    const formField = new PSPDFKit.FormFields.SignatureFormField({
      annotationIds: PSPDFKit.Immutable.List([widget.id]),
      name: "DigitalSignature",
      id: instantId,
    });

    await inst.create([widget, formField]);
  };

  return (
    <div>
      <div style={{ position: "absolute", top: "45px", right: "0", width: "20%", padding: "10px" }}>
        <input type="file" multiple onChange={handleFileChange} />
        <h3>Uploaded Files:</h3>
        <ul>
          {uploadedFiles.map((file, index) => (
            <li key={index} onClick={() => handleFileClick(file)} style={{ cursor: "pointer" }}>
              {file.name}
            </li>
          ))}
        </ul>
      </div>

      {pdfUrl ? (
        <>
          <div ref={containerRef} style={{ height: "100vh", width: "77%" }} />
          <div style={{ position: "absolute", top: "60px", left: "20px", display: "flex", flexDirection: "column", gap: "20px" }}>
            <div draggable onDragStart={(e) => onDragStart(e, "ds")} onDragEnd={onDragEnd}>
              Drag to apply
            </div>
          </div>
        </>
      ) : (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          <h4>Please upload a file</h4>
        </div>
      )}
    </div>
  );
};

export default PDFViewerWithSignature;
