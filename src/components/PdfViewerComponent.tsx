import { useEffect, useRef } from "react";

interface PdfViewerComponentProps {
  document: string; // Adjust this type based on the actual type of `document`, e.g., URL or Uint8Array
  preFillData?: { [key: string]: any }; // Key-value pairs for pre-filling form fields
  onSave?: (pdf: Blob) => void; // Callback to handle the signed PDF
}

export default function PdfViewerComponent(props: PdfViewerComponentProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    let PSPDFKit: any;
    let instance: any;

    (async function () {
      PSPDFKit = await import("pspdfkit");

      // Ensure that there's only one PSPDFKit instance.
      if (container) {
        PSPDFKit.unload(container);

        instance = await PSPDFKit.load({
          container,
          document: props.document,
          baseUrl: `${window.location.protocol}//${window.location.host}/${import.meta.env.BASE_URL}`,
        });

        // Pre-fill form fields if preFillData is provided
        if (props.preFillData) {
          await instance.setFormFieldValues(props.preFillData);
        }

        // Add a digital signature field with a different boundingBox
        const signatureFieldName = "SignatureField1";
        const signatureField = {
          id: signatureFieldName,
          fieldName: signatureFieldName,
          fieldType: "signature",
          formFieldType: "signature",
          widgetName: `${signatureFieldName}Widget`,
          annotationName: `${signatureFieldName}Annotation`,
          pageIndex: 0, // Page index starts at 0, adjust if needed
          boundingBox: new PSPDFKit.Geometry.Rect({
            left: 100,   // Adjust the positioning based on your document layout
            top: 100,    // Start at a visible position for testing
            width: 200,
            height: 50,
          }),
        };

        await instance.createFormField(signatureField);

        // Allow users to sign the form field by clicking on it
        instance.addEventListener("formFieldSubmit", async (event: any) => {
          if (event.field.formFieldType === "signature") {
            const pdf = await instance.exportPDF();
            // Optionally, handle the signed PDF (save to server, download, etc.)
            if (props.onSave) {
              props.onSave(new Blob([pdf], { type: "application/pdf" }));
            }
          }
        });
      }
    })();

    return () => {
      if (PSPDFKit && container) {
        PSPDFKit.unload(container);
      }
    };
  }, [props.document, props.preFillData, props.onSave]);

  return <div ref={containerRef} style={{ width: "100%", height: "100vh" }} />;
}
