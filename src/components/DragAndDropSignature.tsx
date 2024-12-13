import React, { useEffect, useRef, useState } from "react";
import PSPDFKit, { Instance } from "pspdfkit";

const PDFViewerWithSignature = (props: any) => {
  const containerRef = useRef(null);
  const [instance, setInstance] = useState(null);

  const onDragStart = (event: any) => {
    event.dataTransfer.setData("text/plain", `don%don@example.com%Signature`);
    event.target.style.opacity = "0.8";
  };

  const onDragEnd = (event: any) => {
    event.target.style.opacity = "1";
  };

  const handleDrop = async (event:any, inst: Instance) => {
    event.preventDefault();
    const [name, email] = event.dataTransfer.getData("text").split("%");

    const instantId = PSPDFKit.generateInstantId();
    const rect = new PSPDFKit.Geometry.Rect({
      left: event.clientX - 125,
      top: event.clientY - 50,
      width: 185,
      height: 100,
    });

    console.log(rect, "recttt");

    const pageRect = inst.transformContentClientToPageSpace(rect, 0);

    console.log(pageRect, "pageRect");

    const widget = new PSPDFKit.Annotations.WidgetAnnotation({
      boundingBox: pageRect,
      formFieldName: `DigitalSignature-${instantId}`,
      id: instantId,
      pageIndex: 0,
      // additionalActions: {
      //   onFocus: new PSPDFKit.Actions.JavaScriptAction({
      //     script: "alert('onFocus')"
      //   })
      // }
    });

    const formField = new PSPDFKit.FormFields.SignatureFormField({
      annotationIds: PSPDFKit.Immutable.List([widget.id]),
      name: `DigitalSignature-${instantId}`,
      id: instantId,
    });

    await inst.create([widget, formField]);

    // Store widget bounding box in session storage
    const existingBoxes = JSON.parse(sessionStorage.getItem("widgetBoxes") || "[]");
    existingBoxes.push({ id: instantId, boundingBox: widget.boundingBox });
    sessionStorage.setItem("widgetBoxes", JSON.stringify(existingBoxes));

    console.log("Digital Signature created", widget, formField);
  };

  const loadStoredWidgets = async (inst: Instance) => {
    const storedBoxes = JSON.parse(sessionStorage.getItem("widgetBoxes") || "[]");

    for (const { id, boundingBox } of storedBoxes) {
      const widget = new PSPDFKit.Annotations.WidgetAnnotation({
        boundingBox: new PSPDFKit.Geometry.Rect(boundingBox),
        formFieldName: `DigitalSignature-${id}`,
        id: id,
        pageIndex: 0,
        isEditable: false,
      });

      const formField = new PSPDFKit.FormFields.SignatureFormField({
        annotationIds: PSPDFKit.Immutable.List([widget.id]),
        name: `DigitalSignature-${id}`,
        id: id,
      });

      await inst.create([widget, formField]);
    }
  };

  useEffect(() => {
    const loadPSPDFKit = async () => {
      try {
        const inst = await PSPDFKit.load({
          container: containerRef.current,
          document: props.document,
          baseUrl: `${window.location.protocol}//${window.location.host}/${import.meta.env.BASE_URL}`,
        });
        setInstance(inst);

        console.log(inst.contentDocument, "instance contentDocument")

        inst.contentDocument.host.ondrop = (event:any) => handleDrop(event, inst);

        await loadStoredWidgets(inst); // Load saved widgets on component load

        inst.addEventListener("annotations.update", (updatedAnnotations) => {
          updatedAnnotations.forEach((annotation) => {
            console.log("Updated annotation:", annotation.boundingBox);
          });
        });
      } catch (error) {
        console.error("Error loading PSPDFKit:", error);
      }
    };

    loadPSPDFKit();

    return () => {
      if (containerRef.current) {
        PSPDFKit.unload(containerRef.current);
      }
    };
  }, [props.document]);

  return (
    <div>
      <div
        ref={containerRef}
        style={{ height: "100vh", width: "100%" }}
        onDragOver={(e) => e.preventDefault()}
      />
      <div
        style={{
          position: "absolute",
          top: "60px",
          left: "20px",
          padding: "5px",
          display: "flex",
          flexDirection: "column",
          gap: "50px",
        }}
      >
        <button
          style={{ border: "2px solid", textAlign: "center" }}
          draggable
          onDragStart={(e) => onDragStart(e)}
          onDragEnd={onDragEnd}
        >
          Drag to apply
        </button>
      </div>
    </div>
  );
};

export default PDFViewerWithSignature;