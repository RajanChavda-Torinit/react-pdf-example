/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useRef, useState } from "react";
import PSPDFKit from "pspdfkit";

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

const PDFViewerWithSignature = (props: any) => {
  const containerRef = useRef(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null); // Start as null
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [instance, setInstance] = useState<any>(null);
  const [currentPdfKey, setCurrentPdfKey] = useState<string | null>(null); // Store the current PDF key

  useEffect(() => {
    if (pdfUrl && currentPdfKey) {
      (async () => {
        try {
          const instance = await PSPDFKit.load({
            container: containerRef.current,
            document: pdfUrl,
            baseUrl: `${window.location.protocol}//${window.location.host}/${
              import.meta.env.BASE_URL
            }`,
          });

          setInstance(instance);

        //await validateSignatures(instance);

          console.log(PSPDFKit, "pspdfkit");

          const container = instance.contentDocument?.host;

          container.addEventListener(
            "dragover",
            (e: React.DragEvent<HTMLDivElement>) => e.preventDefault()
          );
          container.addEventListener(
            "drop",
            async (e: React.DragEvent<HTMLDivElement>) => {
              console.log("Drop event detected!");
              await handleDrop(e, instance, PSPDFKit);
            }
          );

          // Restore stored signature coordinates if available
          const storedCoordinates = getStoredSignatureData(currentPdfKey);
          if (storedCoordinates && storedCoordinates.length > 0) {
            console.log(storedCoordinates, "storedcoordinates");
            for (let coordinates of storedCoordinates) {
              const widget = new PSPDFKit.Annotations.TextAnnotation({
                boundingBox: new PSPDFKit.Geometry.Rect({
                  left: coordinates.left,
                  top: coordinates.top,
                  width: coordinates.width,
                  height: coordinates.height,
                }),
                text: { format: "plain", value: "Sign for TestUser" },
                formFieldName: "DigitalSignature",
                font: "Helvetica",
                fontSize: 14,
                horizontalAlign: "center",
                verticalAlign: "center",
                id: PSPDFKit.generateInstantId(),
                pageIndex: coordinates.pageIndex,
                customData: { type: "ds" },
              });

              await instance.create([widget]);
            }
          }

          // Listen for annotation position changes to update session storage
          instance.addEventListener(
            "annotations.update",
            (changedAnnotations) => {
              updateSignatureCoordinates(changedAnnotations);
            }
          );
        } catch (error) {
          console.error("Error loading PSPDFKit:", error);
        }
      })();
    }

    return () => {
      if (pdfUrl) PSPDFKit.unload(containerRef.current);
    };
  }, [pdfUrl, currentPdfKey]);

  const storeSignatureData = (pdfKey: string, coordinates: any) => {
    const existingData =  sessionStorage.getItem("pdfSignatureData");

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
      console.log(storedData, "storrreedddddd");
      const parsedData = JSON.parse(storedData);
      return parsedData[pdfKey] || [];
    }
    return [];
  };

  // Update session storage with new coordinates when annotation changes
  const updateSignatureCoordinates = (annotations: any) => {
    if (!currentPdfKey) return;

    console.log(annotations, "changed annotations");

    const updatedCoordinates = annotations.map((annotation: any) => ({
      left: annotation.boundingBox.left,
      top: annotation.boundingBox.top,
      width: annotation.boundingBox.width,
      height: annotation.boundingBox.height,
      pageIndex: annotation.pageIndex,
    }));

    console.log(updatedCoordinates, "updatedCoordinates");

    // Store the updated coordinates
    sessionStorage.setItem(
      "pdfSignatureData",
      JSON.stringify({ [currentPdfKey]: updatedCoordinates })
    );
  };

  const onDragStart = (
    event: React.DragEvent<HTMLDivElement>,
    type: string
  ) => {
    console.log("Drag started...");
    const instantId = PSPDFKit.generateInstantId();
    const data = `rajan%rajan%${instantId}%${type}`;

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

    console.log(dataArray, "dataArrayyyy");
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

    if (currentPdfKey) {
      storeSignatureData(currentPdfKey, {
        left: pageRect.left,
        top: pageRect.top,
        width: pageRect.width,
        height: pageRect.height,
        pageIndex: pageIndex,
      });
    }

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
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const fileArray = Array.from(files);
      setUploadedFiles((prev) => [...prev, ...fileArray]);

      const base64Pdf = await fileToBase64(fileArray[0]);
      const pdfKey = generatePdfKey(fileArray[0]);

      setCurrentPdfKey(pdfKey); // Update current PDF key
      setPdfUrl(base64Pdf);
      console.log(pdfKey, "pdfKey");
    }
  };

  const handleFileClick = (file: File) => {
    fileToBase64(file).then((base64Pdf) => {
      const pdfKey = generatePdfKey(file);
      setCurrentPdfKey(pdfKey); // Update current PDF key
      setPdfUrl(base64Pdf); // Load the clicked PDF file
    });
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
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <h4>Please upload a file</h4>
        </div>
      )}
    </div>
  );
};

export default PDFViewerWithSignature;