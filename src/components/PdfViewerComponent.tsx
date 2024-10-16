import React, { useEffect, useRef, useState } from "react";
import PSPDFKit from "pspdfkit";
import axios from "axios";

// Convert a file to a base64 string
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

// Utility to generate a unique key for each PDF based on its name or content
const generatePdfKey = (file: File | string) => {
  if (typeof file === "string") return file; // For base64 strings or URLs
  return file.name; // Use the file name as the key
};

async function imageToBlob(imageUrl: string): Promise<Blob> {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error("Network response was not ok");
    }
    const blob = await response.blob();
    return blob;
  } catch (error) {
    console.error("Error fetching image:", error);
    throw error;
  }
}

const PDFViewerWithSignature = (props: any) => {
  const containerRef = useRef(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null); // Start as null
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [instance, setInstance] = useState<any>(null);
  const [currentPdfKey, setCurrentPdfKey] = useState<string | null>(null); // Store the current PDF key

  
  // Store multiple signature coordinates for each PDF
const storeSignatureData = (pdfKey: string, coordinates: any) => {
  const existingData = sessionStorage.getItem("pdfSignatureData");
  const signatureData = existingData ? JSON.parse(existingData) : {};

  if (!signatureData[pdfKey]) {
    signatureData[pdfKey] = []; // Initialize array if not present
  }

  signatureData[pdfKey].push(coordinates); // Store the new signature box
  sessionStorage.setItem("pdfSignatureData", JSON.stringify(signatureData));
};


 // Retrieve all stored signature coordinates for a specific PDF
const getStoredSignatureData = (pdfKey: string) => {
  const storedData = sessionStorage.getItem("pdfSignatureData");
  if (storedData) {
    const parsedData = JSON.parse(storedData);
    return parsedData[pdfKey] || [];
  }
  return [];
};


  const onDragStart = (
    event: React.DragEvent<HTMLDivElement>,
    type: string
  ) => {
    console.log("Drag started...");
    const instantId = PSPDFKit.generateInstantId();
    const data = `don%don%${instantId}%${type}`;

    (event.target as HTMLDivElement).style.opacity = "0.8";
    const img = document.getElementById(`${type}-icon`);
    if (img) {
      event.dataTransfer.setDragImage(img, 10, 10);
    }
    event.dataTransfer.setData("text/plain", data);
    event.dataTransfer.dropEffect = "move";
  };

  const onDragEnd = (event: React.DragEvent<HTMLDivElement>) => {
    (event.target as HTMLDivElement).style.opacity = "1";
    console.log("Drag Ended...");
  };

  const handleDrop = async (e: any, inst: any, PSPDFKit: any) => {
    e.preventDefault();
    e.stopPropagation();

    console.log("handleDrop...");

    const dataArray = e.dataTransfer.getData("text").split("%");

    console.log(dataArray, "dataArrayyyy")
    let [name, email, instantId, annotationType] = dataArray;
    instantId = PSPDFKit.generateInstantId();
    const pageIndex = 0;
    const rectWidth = 250;
    const rectHeight = 100;

    const clientRect = new PSPDFKit.Geometry.Rect({
      left: e.clientX - rectWidth / 2,
      top: e.clientY - rectHeight / 2,
      width: rectWidth,
      height: rectHeight,
    });

    const pageRect = inst.transformContentClientToPageSpace(
      clientRect,
      pageIndex
    ) as any;

    // Store the signature box coordinates specific to this PDF
    if (currentPdfKey) {
      storeSignatureData(currentPdfKey, {
        left: pageRect.left,
        top: pageRect.top,
        width: pageRect.width,
        height: pageRect.height,
        pageIndex: pageIndex,
      });
    }

    if (annotationType === "ds") {
      console.log(pageRect, "PageRect");
      const widget = new PSPDFKit.Annotations.TextAnnotation({
        boundingBox: pageRect,
        text: { format: "plain", value: "Sign for TestUser" },
        formFieldName: "DigitalSignature",
        id: instantId,
        pageIndex,
        name: instantId,
        customData: { signerEmail: email, type: annotationType },
        font: "Helvetica",
        fontSize: 14,
        horizontalAlign: "center",
        verticalAlign: "center",
        isEditable: false,
      });

      const formField = new PSPDFKit.FormFields.SignatureFormField({
        annotationIds: PSPDFKit.Immutable.List([widget.id]),
        name: "DigitalSignature",
        id: instantId,
      });

      await inst.create([widget, formField]);
    }
  };

  useEffect(() => {
    if (pdfUrl && currentPdfKey) {
      (async () => {
        try {
          const instance = await PSPDFKit.load({
            container: containerRef.current,
            document: pdfUrl,
            baseUrl: `${window.location.protocol}//${window.location.host}/${import.meta.env.BASE_URL}`,
          });

          setInstance(instance);

          const container = instance.contentDocument?.host;

          container.addEventListener("dragover", (e) => e.preventDefault());
          container.addEventListener("drop", async (e) => {
            console.log("Drop event detected!");
            await handleDrop(e, instance, PSPDFKit);
          });

          // Restore stored signature coordinates if available
          const storedCoordinates = getStoredSignatureData(currentPdfKey);

          if (storedCoordinates) {
            console.log("Restoring coordinates for current PDF:", storedCoordinates);
            const widget = new PSPDFKit.Annotations.TextAnnotation({
              boundingBox: storedCoordinates,
              text: { format: "plain", value: "Sign for TestUser" },
              formFieldName: "DigitalSignature",
              id: PSPDFKit.generateInstantId(),
              pageIndex: storedCoordinates.pageIndex,
              customData: { type: "ds" },
            });
            const formField = new PSPDFKit.FormFields.SignatureFormField({
              annotationIds: PSPDFKit.Immutable.List([widget.id]),
              name: "DigitalSignature",
              id: PSPDFKit.generateInstantId(),
            });
            await instance.create([widget, formField]);
          }
        } catch (error) {
          console.error("Error loading PSPDFKit:", error);
        }
      })();
    }

    return () => {
      if (pdfUrl) PSPDFKit.unload(containerRef.current);
    };
  }, [pdfUrl, currentPdfKey]);

  // const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
  //   const files = e.target.files;
  //   if (files) {
  //     const fileArray = Array.from(files);
  //     setUploadedFiles((prev) => [...prev, ...fileArray]);

  //     const base64Pdf = await fileToBase64(fileArray[0]);
  //     const pdfKey = generatePdfKey(fileArray[0]);
  //     setCurrentPdfKey(pdfKey); // Update current PDF key
  //     setPdfUrl(base64Pdf);
  //   }
  // };


  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const files = e.target.files;
  if (files) {
    const fileArray = Array.from(files);
    setUploadedFiles((prev) => [...prev, ...fileArray]);

    const file = fileArray[0];
    const base64Pdf = await fileToBase64(file);
    const pdfKey = generatePdfKey(file);

    setCurrentPdfKey(pdfKey); // Update current PDF key
    setPdfUrl(base64Pdf); // Load the clicked PDF file

    // Wait for the PDF to load in PSPDFKit
    const instance = await PSPDFKit.load({
      container: containerRef.current,
      document: base64Pdf,
      baseUrl: `${window.location.protocol}//${window.location.host}/${import.meta.env.BASE_URL}`,
    });

    setInstance(instance); // Store the PSPDFKit instance

    // Retrieve and display the signature boxes for this PDF if any exist
    const storedCoordinates = getStoredSignatureData(pdfKey);

    if (storedCoordinates.length > 0 && instance) {
      console.log("Restoring signature widgets for PDF:", storedCoordinates);

      for (const signature of storedCoordinates) {
        const widget = new PSPDFKit.Annotations.TextAnnotation({
          boundingBox: new PSPDFKit.Geometry.Rect({
            left: signature.left,
            top: signature.top,
            width: signature.width,
            height: signature.height,
          }),
          text: { format: "plain", value: "Sign for TestUser" },
          formFieldName: "DigitalSignature",
          id: PSPDFKit.generateInstantId(),
          pageIndex: signature.pageIndex,
          customData: { type: "ds" },
        });

        const formField = new PSPDFKit.FormFields.SignatureFormField({
          annotationIds: PSPDFKit.Immutable.List([widget.id]),
          name: "DigitalSignature",
          id: PSPDFKit.generateInstantId(),
        });

        await instance.create([widget, formField]); // Apply to the PDF
      }
    }
  }
};


  // const handleFileClick = (file: File) => {
  //   fileToBase64(file).then((base64Pdf) => {
  //     const pdfKey = generatePdfKey(file);
  //     setCurrentPdfKey(pdfKey); // Update current PDF key
  //     setPdfUrl(base64Pdf); // Load the clicked PDF file
  //   });
  // };

  const handleFileClick = async (file: File) => {
    const base64Pdf = await fileToBase64(file);
    const pdfKey = generatePdfKey(file);
    console.log(pdfKey,base64Pdf, "pdfkeyyy");
    setCurrentPdfKey(pdfKey); // Update current PDF key
    setPdfUrl(base64Pdf); // Load the clicked PDF file
  
    // Wait for PSPDFKit to load the document
    await PSPDFKit.load({
      container: containerRef.current,
      document: pdfKey,
      baseUrl: `${window.location.protocol}//${window.location.host}/${import.meta.env.BASE_URL}`,
    });
  
    // Retrieve the stored coordinates for the PDF and re-apply them
    const storedCoordinates = getStoredSignatureData(pdfKey);
  
    if (storedCoordinates.length > 0 && instance) {
      console.log("Restoring signature widgets for PDF:", storedCoordinates);
  
      // Loop over each stored signature and create the corresponding annotation
      for (const signature of storedCoordinates) {
        const widget = new PSPDFKit.Annotations.TextAnnotation({
          boundingBox: new PSPDFKit.Geometry.Rect({
            left: signature.left,
            top: signature.top,
            width: signature.width,
            height: signature.height,
          }),
          text: { format: "plain", value: "Sign for TestUser" },
          formFieldName: "DigitalSignature",
          id: PSPDFKit.generateInstantId(),
          pageIndex: signature.pageIndex,
          customData: { type: "ds" },
        });
  
        const formField = new PSPDFKit.FormFields.SignatureFormField({
          annotationIds: PSPDFKit.Immutable.List([widget.id]),
          name: "DigitalSignature",
          id: PSPDFKit.generateInstantId(),
        });
  
        // Create the annotation and form field in PSPDFKit
        await instance.create([widget, formField]);
      }
    }
  };
  

  const applySignature = async () => {
    try {
      const doc = await instance.exportPDF();
      const pdfBlob = new Blob([doc], { type: "application/pdf" });

      const imageBlob = await imageToBlob(
        `${window.location.protocol}//${window.location.host}/signed/watermark.jpg`
      );
      const formData = new FormData();
      formData.append("file", pdfBlob);
      formData.append("image", imageBlob);

      const apiToken = "pdf_live_HMW6A2Em0GwyjjMP8szdDtHqe5hXEQ6SFys13krYmSP";
      const res = await axios.post("https://api.pspdfkit.com/sign", formData, {
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "multipart/form-data",
        },
        responseType: "arraybuffer",
      });

      if (res.data) {
        const signedBlob = new Blob([res.data], { type: "application/pdf" });
        setPdfUrl(URL.createObjectURL(signedBlob));
      } else {
        alert("Error signing the document.");
      }
    } catch (error) {
      console.error("Error applying signature:", error);
    }
  };

  return (
    <div>
      <div
        style={{
          position: "absolute",
          top: "45px",
          right: "0px",
          width: "20%",
          padding: "10px",
        }}
      >
        <input type="file" multiple onChange={handleFileChange} />
        <h3>Uploaded Files:</h3>
        <ul>
          {uploadedFiles.map((file, index) => (
            <li
              key={index}
              onClick={() => handleFileClick(file)}
              style={{ cursor: "pointer" }}
            >
              {file.name}
            </li>
          ))}
        </ul>
      </div>

      {pdfUrl ? (
        <>
          <div ref={containerRef} style={{ height: "100vh", width: "77%" }} />
          <div
            style={{
              position: "absolute",
              top: "60px",
              left: "20px",
              display: "flex",
              flexDirection: "column",
              gap: "20px",
            }}
          >
            <button onClick={applySignature}>Apply Signature</button>
            <div
              draggable
              onDragStart={(e) => onDragStart(e, "ds")}
              onDragEnd={onDragEnd}
            >
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
