import { AnnotationTypeEnum } from "./types";

const renderConfigurations: any = {};

export const signSVG = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    width="0.75rem"
    height="0.75rem"
    aria-hidden="true"
    focusable="false"
    data-qa="tab-palette-item-icon"
  >
    <path d="M22 21v1H3v-1zM20.7 4.72a3 3 0 0 1-.58 3.4L8.66 19.59 3 21l1.41-5.66L15.88 3.88A3 3 0 0 1 18 3a3 3 0 0 1 1.28.3L20.59 2 22 3.41zM10.46 15.1 8.9 13.54l-2.77 2.77-.52 2.08 2.08-.52zM19.1 6a1.1 1.1 0 0 0-1.88-.78L9.54 12.9l1.56 1.56 7.68-7.68A1.1 1.1 0 0 0 19.1 6z"></path>
  </svg>
);

export const RedCircleIcon: React.FC<React.SVGProps<SVGSVGElement>> = ({
  color,
}) => {
  const jsonString = color
    ? color.substring(2).replace(/(\w+):/g, '"$1":')
    : "";
  try {
    // Parse the JSON string into an object
    const colorObject = JSON.parse(jsonString);
    //console.log("Color: ", colorObject);
    return (
      <svg width="20" height="20" xmlns="http://www.w3.org/2000/svg">
        <circle
          cx="10"
          cy="10"
          r="10"
          fill={`rgb(${colorObject.r},${colorObject.g},${colorObject.b})`}
        />
      </svg>
    );
  } catch (error) {}
};

//   ***************************************************************************************************************************

function createCustomSignatureNode({ annotation, type }: any) {
  const container = document.createElement("div");

  if (type === AnnotationTypeEnum.SIGNATURE) {
    container.innerHTML = `<div class="custom-annotation-wrapper custom-signature-wrapper" style="background-color: rgb(${annotation.customData?.signerColor.r},${annotation.customData?.signerColor.g},${annotation.customData?.signerColor.b})">
          <div class="custom-signature">
            <div class="custom-signature-label">
               Sign
            </div>
            <svg fill="#000000" width="1.5625rem" height="1.25rem" viewBox="0 0 32 32" version="1.1" xmlns="http://www.w3.org/2000/svg">
              <title>down-round</title>
              <path d="M0 16q0-3.232 1.28-6.208t3.392-5.12 5.12-3.392 6.208-1.28q3.264 0 6.24 1.28t5.088 3.392 3.392 5.12 1.28 6.208q0 3.264-1.28 6.208t-3.392 5.12-5.12 3.424-6.208 1.248-6.208-1.248-5.12-3.424-3.392-5.12-1.28-6.208zM4 16q0 3.264 1.6 6.048t4.384 4.352 6.016 1.6 6.016-1.6 4.384-4.352 1.6-6.048-1.6-6.016-4.384-4.352-6.016-1.632-6.016 1.632-4.384 4.352-1.6 6.016zM10.048 18.4q-0.128-0.576 0.096-1.152t0.736-0.896 1.12-0.352h2.016v-5.984q0-0.832 0.576-1.408t1.408-0.608 1.408 0.608 0.608 1.408v5.984h1.984q0.608 0 1.12 0.352t0.736 0.896q0.224 0.576 0.096 1.152t-0.544 1.024l-4 4q-0.576 0.576-1.408 0.576t-1.408-0.576l-4-4q-0.448-0.416-0.544-1.024z"></path>
            </svg>
          </div>
        </div>`;
  }

  return container;
}

export const getAnnotationRenderers = ({ annotation }: any) => {
  if (annotation.isSignature) {
    // Create a new div element
    const box = document.createElement("div");

    // Apply box styles
    box.className = "signature-box-demo";
    box.innerHTML = `<span class="signature-label-demo">By PSPDFKit</span><span class="signature-id-demo">${
      annotation.id.substring(0, 15) + (annotation.id.length > 15 ? "..." : "")
    }</span>`;
    box.style.height = annotation.boundingBox.height / 16 + "rem";
    box.style.width = annotation.boundingBox.width / 16 + "rem";
    box.style.setProperty(
      "--box-height",
      annotation.boundingBox.height / 16 + "rem"
    );
    //box.style.margin = '0px';
    box.id = annotation.id;

    // Append the annotation to the box
    //box.appendChild(annotation.node);
    let ele = { node: box, append: true };
    // Replace the annotation with the box
    //annotation.node = box;
    return ele;
  }

  if (annotation.name) {
    if (renderConfigurations[annotation.id]) {
      return renderConfigurations[annotation.id];
    }

    renderConfigurations[annotation.id] = {
      node: createCustomSignatureNode({
        annotation,
        type: annotation.customData?.type,
      }),
      append: true,
    };

    return renderConfigurations[annotation.id] || null;
  }
};

export const handleAnnotatitonCreation = async (
  instance: any,
  annotation: any,
  mySignatureIdsRef: any,
  setSignatureAnnotationIds: any,
  myEmail: string
) => {
  if (annotation.isSignature) {
    for (let i = 0; i < instance.totalPageCount; i++) {
      const annotations = await instance.getAnnotations(i);
      for await (const maybeCorrectAnnotation of annotations) {
        if (
          annotation.boundingBox.isRectOverlapping(
            maybeCorrectAnnotation.boundingBox
          )
        ) {
          const newAnnotation = getAnnotationRenderers({
            annotation: maybeCorrectAnnotation,
          });
          if (newAnnotation?.node) {
            newAnnotation.node.className = "signed";
          }
          
        }
      }
    }
    const signatures = [...mySignatureIdsRef.current, annotation.id];
    setSignatureAnnotationIds(signatures);
    mySignatureIdsRef.current = signatures;
  }
};
