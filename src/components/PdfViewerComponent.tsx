import { useEffect, useRef } from "react";

interface PdfViewerComponentProps {
  document: string; // Adjust this type based on the actual type of `document`, e.g., URL or Uint8Array
  preFillData?: { [key: string]: any }; // Key-value pairs for pre-filling form fields
}

export default function PdfViewerComponent(props: PdfViewerComponentProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current; // This `useRef` instance will render the PDF.
    let PSPDFKit: any;
    let instance: any;

    (async function () {
      PSPDFKit = await import("pspdfkit");

      // Ensure that there's only one PSPDFKit instance.
      if (container) {
        PSPDFKit.unload(container);

        instance = await PSPDFKit.load({
          // Container where PSPDFKit should be mounted.
          container,
          // The document to open.
          document: props.document,
          // Use the public directory URL as a base URL. PSPDFKit will download its library assets from here.
          baseUrl: `${window.location.protocol}//${window.location.host}/${import.meta.env.BASE_URL}`,
        });

        // Pre-fill form fields if preFillData is provided
        if (props.preFillData) {
          await instance.setFormFieldValues(props.preFillData);
        }
      }
    })();

    return () => {
      if (PSPDFKit && container) {
        PSPDFKit.unload(container);
      }
    };
  }, [props.document, props.preFillData]); // Add props.preFillData to the dependency array

  // This div element will render the document to the DOM.
  return <div ref={containerRef} style={{ width: "100%", height: "100vh" }} />;
}

