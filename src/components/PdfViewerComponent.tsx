import { useEffect, useRef, useState } from "react";
import PSPDFKit, { Instance } from "pspdfkit";
import axios from "axios";

// Helper function to convert an image URL to a Blob
async function imageToBlob(imageUrl: string): Promise<Blob> {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) throw new Error("Network response was not ok");
    return response.blob();
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
  const [users, setUsers] = useState<any[]>([]);
  const [boxSizes, setBoxSizes] = useState<any[]>([]);


  const fetchCertificates = async (): Promise<(string | ArrayBuffer)[]> => {
    try {
      const apiToken = "pdf_live_edhWMQdqBzrIOh3VxFLhuFXtMP53XPxr77ye2PKC3lf";
      const response = await fetch('https://api.pspdfkit.com/i/certificates', {
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch certificates: ${response.statusText}`);
      }

      const apiRes = await response.json();
      console.log(apiRes, "Certificate API response");

      // Validate the structure of the response
      const certificates = apiRes?.data?.data?.ca_certificates;

      if (!certificates || certificates.length === 0) {
        console.warn("No certificates found in API response.");
        return [];
      }

      // Decode the first certificate
      const certificate = atob(certificates[0]);

      // setPspdfcertificates([certificate]);

      return [certificate]; // Return as an array
    } catch (error) {
      console.error("Error in fetching certificates:", error);
      return []; // Ensure an empty array is returned on error
    }
  };




  useEffect(() => {
    const storedUsers = sessionStorage.getItem("users");
    const storedBoxSizes = sessionStorage.getItem("boxSizes");
    if (storedUsers) setUsers(JSON.parse(storedUsers));
    if (storedBoxSizes) setBoxSizes(JSON.parse(storedBoxSizes));



    const loadPdf = async () => {
      if (containerRef.current) {
        try {
          const instance = await PSPDFKit.load({
            container: containerRef.current,
            document: pdfUrl,
            baseUrl: `${window.location.protocol}//${window.location.host}/${import.meta.env.BASE_URL
              }`,
            // trustedCAsCallback: async () => {
            //   let arrayBuffer;
            //   try {
            //     const apiToken = "pdf_live_4RnPyPld7kARJ3LnQgLqOMyiNhDoP3AnZ2tlWYZweSV";
            //     const response = await axios.get('https://api.pspdfkit.com/i/certificates', {
            //       headers: {
            //         'Authorization': `Bearer ${apiToken}`,
            //         "Content-Type": "application/json",
            //       },
            //     });

            //     const apiRes = await response.json();
            //     console.log(apiRes);
            //     arrayBuffer = atob(apiRes.data.data.ca_certificates[0]);
            //   } catch (e) {
            //     throw `Error ${e}`;
            //   }
            //   return [arrayBuffer];
            // }
            trustedCAsCallback: fetchCertificates,
          });

          const signaturesInfo = await instance.getSignaturesInfo();
          console.log(signaturesInfo, "Signature Info");

          setInstance(instance);

          instance.setViewState((viewState) =>
            viewState.set(
              "showSignatureValidationStatus",
              PSPDFKit.ShowSignatureValidationStatusMode.IF_SIGNED
            )
          );

          // console.log(await instance.getSignaturesInfo(), "Signature Info");

          if (storedUsers && storedBoxSizes) {
            const usersData = JSON.parse(storedUsers);
            const boxData = JSON.parse(storedBoxSizes);

            usersData.forEach((user: any, index: number) => {
              const boundingBox = new PSPDFKit.Geometry.Rect(boxData[index]);
              const instantId = `PSPDFKit.generateInstantId(${index})`;

              const widget = new PSPDFKit.Annotations.WidgetAnnotation({
                formFieldName: `SignatureField${index}`,
                name: instantId,
                id: instantId,
                boundingBox: boundingBox,
                pageIndex: 0,
              });

              const formField = new PSPDFKit.FormFields.SignatureFormField({
                name: `SignatureField${index}`,
                annotationIds: PSPDFKit.Immutable.List([widget.id]),
                id: instantId,
              });

              instance.create([widget, formField]);
            });
          }
        } catch (error) {
          console.error("Error loading PSPDFKit", error);
        }
      }
    };

    // fetchCertificates();
    loadPdf();



    return () => {
      PSPDFKit.unload(containerRef.current);
    };
  }, [pdfUrl]);

  const applySignature = async (index: number) => {
    if (!instance) {
      alert("PDF instance is not ready. Please try again.");
      return;
    }

    try {
      const certificateBase64 = await fetchCertificates();
      const doc = await instance.exportPDF();
      const pdfBlob = new Blob([doc], { type: "application/pdf" });

      const imageBlob = await imageToBlob(
        `${window.location.protocol}//${window.location.host}/signed/watermark.jpg`
      );

      const formData = new FormData();
      formData.append("file", pdfBlob);
      formData.append("image", imageBlob);
      formData.append(
        "data",
        JSON.stringify({
          signatureType: "cades",
          flatten: true,
          cadesLevel: "b-lt",
          hashAlgorithm: "sha256",
          appearance: {
            mode: "signatureAndDescription",
          },
          certificates: certificateBase64, // Embed certificate here
          formFieldName: `SignatureField${index}`,
          signatureContainer: "pkcs7",
          signingToken: "user-1-with-rights",
          signatureMetadata: {
            signerName: users[index].name,
            signatureReason: "User-specific digital signature",
            signatureLocation: "Earth",
            signingTime: new Date().toISOString(),
          },
        })
      );

      const apiToken = "pdf_live_edhWMQdqBzrIOh3VxFLhuFXtMP53XPxr77ye2PKC3lf";
      const res = await axios.post("https://api.pspdfkit.com/sign", formData, {
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "multipart/form-data",
        },
        responseType: "arraybuffer",
      });

      // console.log(await instance.getSignaturesInfo(), "Signature Info");
      // console.log(await instance.getFormFields(), "Form Fields Info");


      if (containerRef.current && res.data) {
        const signedPdfBlob = new Blob([res.data], { type: "application/pdf" });
        const newPdfUrl = URL.createObjectURL(signedPdfBlob);
        setInitialLoad(false);
        setPdfUrl(newPdfUrl);

        const updatedUsers = [...users];
        updatedUsers[index].signed = true;
        setUsers(updatedUsers);
        sessionStorage.setItem("users", JSON.stringify(updatedUsers));
      } else {
        alert("Error in signing");
      }

    } catch (err) {
      console.error(err);
      alert("An error occurred while applying the signature. Please try again.");
    }
  };

  const addNew = async () => {
    const name = window.prompt("Enter signee's name:");
    const email = window.prompt("Enter signee's email:");

    if (name && email && instance) {
      const instantId = `PSPDFKit.generateInstantId(${users.length})`;

      const boundingBox = new PSPDFKit.Geometry.Rect({
        left: 50 + users.length * 180,
        top: 550,
        width: 150,
        height: 100,
      });

      const widget = new PSPDFKit.Annotations.WidgetAnnotation({
        formFieldName: `SignatureField${users.length}`,
        name: instantId,
        id: instantId,
        boundingBox: boundingBox,
        pageIndex: 0,
      });

      const formField = new PSPDFKit.FormFields.SignatureFormField({
        name: `SignatureField${users.length}`,
        annotationIds: PSPDFKit.Immutable.List([widget.id]),
        id: instantId,
      });

      await instance.create([widget, formField]);

      const updatedUsers = [...users, { name, email, signed: false }];
      const updatedBoxSizes = [...boxSizes, boundingBox];

      setUsers(updatedUsers);
      setBoxSizes(updatedBoxSizes);

      sessionStorage.setItem("users", JSON.stringify(updatedUsers));
      sessionStorage.setItem("boxSizes", JSON.stringify(updatedBoxSizes));
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const newPdfUrl = URL.createObjectURL(file);
      setPdfUrl(newPdfUrl);
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

        <div style={{ marginTop: "20px" }}>
          <input
            type="file"
            accept="application/pdf"
            onChange={handleFileUpload}
          />
        </div>
      </div>
    </div>
  );
};

export default PDFViewerWithSignature;
