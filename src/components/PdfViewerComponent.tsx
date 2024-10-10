import React, { useEffect, useRef, useState } from "react";
import PSPDFKit from "pspdfkit";
import axios from "axios";

async function imageToBlob(imageUrl: string): Promise<Blob> {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error('Network response was not ok');
    }
    const blob = await response.blob();
    return blob;
  } catch (error) {
    console.error('Error fetching image:', error);
    throw error;
  }
}

const PDFViewerWithSignature = (props: any) => {
  const containerRef = useRef(null);
  const [pdfUrl,setPdfUrl] = useState(props.document);
  const [initialLoad,setInitialLoad] = useState(true)
  const [instance,setInstance] = useState(null);

  function onDragStart(event: React.DragEvent<HTMLDivElement>, type: string) {
    console.log(event.dataTransfer,"type")
    const instantId = "PSPDFKit.generateInstantId()";
    let data = 
      'don' + // value from select, name of signer
      "%" + // % is an invalid email character so we can use it as a delimiter
      'don' + // value from select, email of signer
      "%" +
      instantId +
      "%" +
      type;

    (event.target as HTMLDivElement).style.opacity = "0.8";
    const img = document.getElementById(`${type}-icon`);
    if (img) {
      event.dataTransfer.setDragImage(img, 10, 10);
    }
    event.dataTransfer.setData("text/plain", data);
    event.dataTransfer.dropEffect = "move";
  }

  function onDragEnd(event: React.DragEvent<HTMLDivElement>) {
    (event.target as HTMLDivElement).style.opacity = "1";
  }

  const handleDrop = async (e: any, inst: any, PSPDFKit: any) => {
    console.log(e)
    e.preventDefault();
    e.stopPropagation();
    const dataArray = e.dataTransfer.getData("text").split("%");
    let [name, email, instantId, annotationType] = dataArray;
    instantId = PSPDFKit.generateInstantId();
    const signee = 'don';
    const user = 'don';
    const pageIndex = 0;
    let rectWidth = 250;
    let rectHeight = 100;
    // switch (annotationType) {
    //   case AnnotationTypeEnum.INITIAL:
    //     rectWidth = 70;
    //     rectHeight = 40;
    //     break;

    //   case AnnotationTypeEnum.SIGNATURE:
    //     rectWidth = 120;
    //     rectHeight = 60;
    //     break;
      
    //   case AnnotationTypeEnum.DS:
    //     rectWidth = 250;
    //     rectHeight = 100;
    //     break;
    
    //   default:
    //     break;
    //   }
    const clientRect = new PSPDFKit.Geometry.Rect({
      left: e.clientX - rectWidth / 2,
      top: e.clientY - rectHeight / 2,
      height: rectHeight,
      width: rectWidth,
    });
    const pageRect = inst.transformContentClientToPageSpace(
      clientRect,
      pageIndex
    ) as any;
     if(annotationType ==="ds"){
      console.log(clientRect, "clientREcttttt");
      console.log(pageRect, "pagerecttttt");
      const widget = new PSPDFKit.Annotations.TextAnnotation({
        boundingBox: pageRect,
        text: {
          format: "plain",
          value: annotationType === "name" ? name : "Sign for TestUser",
        },
        formFieldName: "DigitalSignature",
        id: instantId,
        pageIndex,
        name: instantId,
        customData: {
          // createdBy: user.id,
          // signerID: user.id,
          signerEmail: email,
          type: annotationType,
          signerColor: PSPDFKit.Color.WHITE,
          isInitial: false,
        },
        font: "Helvetica",
        fontSize: 14,
        horizontalAlign: "center",
        verticalAlign: "center",
        isEditable: false,
        //backgroundColor: signee.color,
      });
      const formField = new PSPDFKit.FormFields.SignatureFormField({
        annotationIds: PSPDFKit.Immutable.List([widget.id]),
        name: 'DigitalSignature',
        id: instantId,
        // readOnly: signee.id != user.id,
      });
      const created = await inst.create([widget, formField]);
      console.log("Digital Signature created", created);
    } 
    else {
      // const text = new PSPDFKit.Annotations.TextAnnotation({
      //   pageIndex,
      //   boundingBox: pageRect,
      //   text: {
      //     format: "plain",
      //     value: annotationType === "name" ? name : new Date().toDateString(),
      //   },
      //   name: name,
      //   customData: {
      //     signerEmail: email,
      //     type: annotationType,
      //     // signerColor: signee.color,
      //   },
      //   font: "Helvetica",
      //   fontSize: 14,
      //   horizontalAlign: "center",
      //   verticalAlign: "center",
      //   isEditable: false,
      //   // backgroundColor: signee.color,
      // });
      // await inst.create(text);
      console.log("Not created")
    }
    // set the viewer to form creator mode so that the user can place the field
    // inst.setViewState((viewState) =>
    //   viewState.set("interactionMode", PSPDFKit.InteractionMode.FORM_CREATOR)
    // );

    // @ts-ignore
    inst.setOnAnnotationResizeStart((eve) => {
      console.log(eve)
      if (eve.annotation instanceof PSPDFKit.Annotations.WidgetAnnotation) {
        return {
          //maintainAspectRatio: true,
          //responsive: false,
          maxWidth: 250,
          maxHeight: 100,
          minWidth: 70,
          minHeight: 30,
        };
      } else if (
        eve.annotation instanceof PSPDFKit.Annotations.TextAnnotation
      ) {
        return {
          //maintainAspectRatio: true,
          //responsive: false,
          maxWidth: 250,
          maxHeight: 100,
          minWidth: 70,
          minHeight: 30,
        };
      }
    });
  };

  useEffect(() => {
    (async () => {
      try {
        console.log(PSPDFKit, "pspdfkit")
        // Load PSPDFKit with the specified PDF document and license key
        const instance = await PSPDFKit.load({
          container: containerRef.current,
          document: pdfUrl, // Path to your PDF file
          // licenseKey: "YOUR_LICENSE_KEY_HERE", 
          baseUrl: `${window.location.protocol}//${window.location.host}/${
            import.meta.env.BASE_URL
          }`,
        });
        setInstance(instance);
        const cont = instance.contentDocument?.host;
        console.log(instance.contentDocument,cont, "jvgdfsavivbf");

          cont.ondrop = async function (e: any) {
            console.log("handle drop")
            await handleDrop(e, instance, PSPDFKit);
          };
        console.log("PSPDFKit loaded successfully");

        // Create a signature form field
        const instantId = "PSPDFKit.generateInstantId()";

        // Create the widget annotation for the signature field
      //   if(initialLoad){
      //   const widget = new PSPDFKit.Annotations.WidgetAnnotation({
      //     formFieldName: "SignatureField",
      //     name: instantId,
      //     id: instantId,
      //     boundingBox: new PSPDFKit.Geometry.Rect({
      //       left: 150, // X position
      //       top: 150, // Y position
      //       width: 150, // Width of the signature box
      //       height: 100, // Height of the signature box
      //     }),
      //     pageIndex: 0, // The page where the signature should appear (starting from 0)
      //   });

      //   const formField = new PSPDFKit.FormFields.SignatureFormField({
      //     name: "SignatureField", // The form field name
      //     annotationIds: PSPDFKit.Immutable.List([widget.id]),
      //     id: instantId,
      //   });
      //   // Add both the form field and the widget to the PDF instance
      //   await instance.create([widget, formField]);
      // }

        console.log("Signature field and widget created successfully"); 
      } catch (error) {
        console.error(
          "Error loading PSPDFKit or creating signature field",
          error
        );
      }
    })();

    return () => {
      PSPDFKit.unload(containerRef.current);
    };
  }, [pdfUrl]);



  // useEffect(()=>

  //   // Clean up when the component unmounts
  //   return () => PSPDFKit.unload(containerRef.current);
  // }, []);

  const applySignature = async () => {
    try{
    console.log("Start signing");
      const doc = await instance.exportPDF();
      console.log("PDF exported and sending for signing ", doc instanceof ArrayBuffer);
      const pdfBlob = new Blob([doc], { type: "application/pdf" });
      const imageBlob = await imageToBlob(`${window.location.protocol}//${window.location.host}/signed/watermark.jpg`);
      const formData = new FormData();
      formData.append('file', pdfBlob);
      formData.append('image', imageBlob);
      //formData.append('graphicImage', imageBlob)
      //res = await applyDigitalSignature(formData);
      // const res = await fetch('./api/digitalSigningLite', {
      //   method:'POST',
      //   body: formData
      // })
      // const res = await fetch('http://localhost:5000/sign', {
      //   method:'POST',
      //   body: formData
      // })
      formData.append('data', JSON.stringify({
        signatureType: "cades",
        flatten: true,
        cadesLevel: "b-lt",
        appearance : {
          mode: "signatureAndDescription"
        },
        formFieldName: "SignatureField",
        signatureMetadata:{
          signerName: "Signing Demo",
          signatureReason: "Demo digital signature using PSPDFKit",
          signatureLocation: "Planet Earth"
        },
      }));
  
      const apiToken = "pdf_live_HMW6A2Em0GwyjjMP8szdDtHqe5hXEQ6SFys13krYmSP";
      const res = await axios.post('https://api.pspdfkit.com/sign', formData, {
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'multipart/form-data',
        },
        responseType: 'arraybuffer'
      });
      const container = containerRef.current; // This `useRef` instance will render the PDF.
      if(container && res.data){
        console.log('res: ', res);
        // const pdfBlob = await res.data.blob();
        const pdfBlob =  new Blob([res.data], { type: "application/pdf" })
        const newPdfUrl = URL.createObjectURL(pdfBlob);
        console.log(newPdfUrl,"newPdfUrl")
        // Load the new PDF into the viewer
        setInitialLoad(false)
        setPdfUrl(newPdfUrl);
      }
      else{
        alert("Error in signing");
      }
      console.log("Response from signing", res);
    }catch(err){
      console.log(err)
    }
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  return (
    <div>
      <div ref={containerRef} style={{ height: "100vh", width: "100%" }} onDragOver={handleDragOver} />
      <div
        style={{
          position: "absolute",
          top: "60px",
          left: "20px",
          borderRadius: "10px",
          overflow: "hidden",
          display:'flex',
          flexDirection:'column',
          gap:'50px',
          padding:'5px'
        }}
      >
        <button style={{ border: "2px solid"}} onClick={applySignature}>Apply signature</button>
        <div style={{ border: "2px solid",textAlign:'center'}} draggable={true}
      onDragStart={ (e) =>  onDragStart(e, 'ds')}
      onDragEnd={(e) => onDragEnd(e)}>Drag to apply</div>
      </div>
    </div>
  );
};

export default PDFViewerWithSignature;