import { useEffect, useRef, useState } from "react";
import PSPDFKit, { Instance } from "pspdfkit";
import axios from "axios";

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
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [pdfUrl, setPdfUrl] = useState(props.document);
  const [initialLoad, setInitialLoad] = useState(true);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [instance, setInstance] = useState<Instance | null>(null);
  const [currentPdfKey, setCurrentPdfKey] = useState<string | null>(null); // Store the current PDF key
  const [users, setUsers] = useState<any[]>([]);
  const [boxSizes, setBoxSizes] = useState<any[]>([]);


  const fetchCertificates = async (): Promise<(string | ArrayBuffer)[]> => {
    try {
      const apiToken = "pdf_live_L5jp5MzQUIqlauGbnUEdBfoNor3GxVyg2a6xKUdyKBe";
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
      // console.log(apiRes, "Certificate API response");

      const certificates = apiRes?.data?.data?.ca_certificates;

      if (!certificates || certificates.length === 0) {
        console.warn("No certificates found in API response.");
        return [];
      }

      const certificate = atob(certificates[0]);

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

          await PSPDFKit.unload(containerRef.current);

          const instance = await PSPDFKit.load({
            container: containerRef.current,
            document: pdfUrl,
            baseUrl: `${window.location.protocol}//${window.location.host}/${import.meta.env.BASE_URL}`,
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

          // if (users.length > 0) {
          //   users.forEach((user, index) => {
          //     if (user.signed) applySignature(index); // Reapply signature if already signed
          //   });
          // }

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

    loadPdf();

    return () => {
      if (containerRef.current) {
        PSPDFKit.unload(containerRef.current)
      }
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
      console.log(doc, "docccc");
      const pdfBlob = new Blob([doc], { type: "application/pdf" });

      console.log(doc,pdfBlob, "doc and pdfblob")

      const imageBlob = await imageToBlob(
        `${window.location.protocol}//${window.location.host}/signed/watermark.jpg`
      );

      console.log(imageBlob, "imageBlob")

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

      

      const apiToken = "pdf_live_L5jp5MzQUIqlauGbnUEdBfoNor3GxVyg2a6xKUdyKBe";
      const res = await axios.post("https://api.pspdfkit.com/sign", formData, {
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "multipart/form-data",
        },
        responseType: "arraybuffer",
      });

      console.log(res, "response");

      if (containerRef.current && res.data) {
        const signedPdfBlob = new Blob([res.data], { type: "application/pdf" });
        const newPdfUrl = URL.createObjectURL(signedPdfBlob);
        console.log(newPdfUrl, "newPdfUrl")
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
      // console.error(err);
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
      <div ref={containerRef} style={{ height: "100vh", width: "100%" }} />

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
