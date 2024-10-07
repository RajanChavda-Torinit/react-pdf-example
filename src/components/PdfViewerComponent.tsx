import { useEffect, useRef, useState } from "react";
import PSPDFKit, { Instance } from "pspdfkit";
import axios from "axios";

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
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [pdfUrl, setPdfUrl] = useState(props.document);
  const [initialLoad, setInitialLoad] = useState(true);
  const [instance, setInstance] = useState<Instance | null>(null);
  const [users, setUsers] = useState<any[]>([]); // Store users in state
  const [boxSizes, setBoxSizes] = useState<any[]>([]); // Store bounding boxes for each user

  useEffect(() => {
    const loadPdf = async () => {
      if (containerRef.current) {
        // Ensure it is not null
        try {
          const instance = await PSPDFKit.load({
            container: containerRef.current,
            document: pdfUrl,
            baseUrl: `${window.location.protocol}//${window.location.host}/${
              import.meta.env.BASE_URL
            }`,
          });
          setInstance(instance);
          console.log("PSPDFKit loaded successfully");
        } catch (error) {
          console.error("Error loading PSPDFKit", error);
        }
      }
    };

    loadPdf();

    return () => {
      PSPDFKit.unload(containerRef.current);
    };
  }, [pdfUrl]);

  const applySignature = async (index: number) => {
    if (!instance) {
      alert("PDF instance is not ready. Please try again.");
      return; // Exit the function if instance is null
    }

    try {
      console.log("Start signing for user", users[index].name);

      // Get the current PDF from the instance
      const doc = await instance.exportPDF();
      const pdfBlob = new Blob([doc], { type: "application/pdf" });

      // Get the image for the signature
      const imageBlob = await imageToBlob(
        `${window.location.protocol}//${window.location.host}/signed/watermark.jpg`
      );

      // Prepare form data
      const formData = new FormData();
      formData.append("file", pdfBlob);
      formData.append("image", imageBlob);

      // Signature data specific to the user
      formData.append(
        "data",
        JSON.stringify({
          signatureType: "cades",
          flatten: true,
          cadesLevel: "b-lt",
          appearance: {
            mode: "signatureAndDescription",
          },
          formFieldName: `SignatureField${index}`,
          signatureMetadata: {
            signerName: users[index].name,
            signatureReason: "User-specific digital signature",
            signatureLocation: "Planet Earth",
          },
        })
      );

      // Call the signing API
      const apiToken = "pdf_live_0zn80VlV41NgrPowcDESx5znFUERRzIdMGvjLvhz3QK";
      const res = await axios.post("https://api.pspdfkit.com/sign", formData, {
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "multipart/form-data",
        },
        responseType: "arraybuffer",
      });

      const container = containerRef.current;
      if (container && res.data) {
        const signedPdfBlob = new Blob([res.data], { type: "application/pdf" });
        const newPdfUrl = URL.createObjectURL(signedPdfBlob);
        setInitialLoad(false);
        setPdfUrl(newPdfUrl);
      } else {
        alert("Error in signing");
      }
    } catch (err) {
      console.log(err);
      alert(
        "An error occurred while applying the signature. Please try again."
      );
    }
  };

  const addNew = async () => {
    const name = window.prompt("Enter signee's name:");
    const email = window.prompt("Enter signee's email:");

    if (name && email && instance) {
      const instantId = `PSPDFKit.generateInstantId(${users.length})`;

      const boundingBox = new PSPDFKit.Geometry.Rect({
        left: 50 + users.length * 180, // Create a new box shifted horizontally for each new user
        top: 550, // Y position remains the same for simplicity
        width: 150,
        height: 100,
      });

      // Create a widget for the new user
      const widget = new PSPDFKit.Annotations.WidgetAnnotation({
        formFieldName: `SignatureField${users.length}`,
        name: instantId,
        id: instantId,
        boundingBox: boundingBox,
        pageIndex: 0, // First page
      });

      const formField = new PSPDFKit.FormFields.SignatureFormField({
        name: `SignatureField${users.length}`,
        annotationIds: PSPDFKit.Immutable.List([widget.id]),
        id: instantId,
      });

      await instance.create([widget, formField]);

      setUsers((prevUsers) => [...prevUsers, { name, email }]);
      setBoxSizes((prevBoxSizes) => [...prevBoxSizes, boundingBox]);

      console.log(`Bounding box created for user: ${name}`);
    }
  };

  return (
    <div>
      <div ref={containerRef} style={{ height: "100vh", width: "100%" }} />

      <div
        style={{
          position: "absolute",
          top: "60px",
          left: "20px",
          border: "2px solid",
          borderRadius: "10px",
          padding: "10px",
          width: "200px",
        }}
      >
        <button onClick={addNew} style={{ border: "1px solid" }}>
          Add New
        </button>

        {/* Display all users below the "Add New" button */}
        <div style={{ marginTop: "20px" }}>
          {users.length === 0 ? (
            <p>No users added yet.</p>
          ) : (
            users.map((user, index) => (
              <div key={index} style={{ marginBottom: "10px" }}>
                <button
                  onClick={() => applySignature(index)}
                  style={{
                    width: "100%",
                    padding: "5px",
                    backgroundColor: "#f0f0f0",
                    border: "1px solid #ccc",
                    borderRadius: "5px",
                  }}
                >
                  Sign for {user.name}
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default PDFViewerWithSignature;
