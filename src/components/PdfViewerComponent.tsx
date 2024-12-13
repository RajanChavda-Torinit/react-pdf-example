import { useEffect, useRef, useState } from "react";
import PSPDFKit, { FormField, Instance } from "pspdfkit";
import { AnnotationTypeEnum, User } from "./types";
import {
  getAnnotationRenderers,
  handleAnnotatitonCreation,
  RedCircleIcon,
  signSVG,
} from "./helper";

// const initialUsers: User[] = [];

const Signusers: User[] = [
  {
    id: 1,
    name: "Admin",
    email: "admin@email.com",
    role: "Editor",
  },
  {
    id: 2,
    name: "Signer 1",
    email: "signer1@email.com",
    role: "Signer",
  },
];

const PdfViewerComponent = (props: any) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [pdfUrl, setPdfUrl] = useState(props.document);
  const [instance, setInstance] = useState<Instance | null>(null);
  const [users, setUsers] = useState<any[]>(Signusers);
  const [sessionSignatures, setSessionSignatures] = useState<any>([]);
  const [sessionInitials, setSessionInitials] = useState<any>([]);
  // const [isTextAnnotationMovable, setIsTextAnnotationMovable] = useState(false);
  // const isTextAnnotationMovableRef = useRef(isTextAnnotationMovable);
  // isTextAnnotationMovableRef.current = isTextAnnotationMovable;
  const [currSignee, setCurrSignee] = useState<User>(
    users.find((user) => user.role !== "Editor")
  );
  const currSigneeRef = useRef(currSignee);
  currSigneeRef.current = currSignee;
  let isCreateInitial: boolean = false;
  const mySignatureIdsRef = useRef([]);
  const [signatureAnnotationIds, setSignatureAnnotationIds] = useState<
    string[]
  >([]);
  const [onPageIndex, setOnPageIndex] = useState<number>(0);
  const onPageIndexRef = useRef(onPageIndex);
  onPageIndexRef.current = onPageIndex;
  const [isVisible, setIsVisible] = useState(
    Signusers[0].role == "Editor" ? true : false
  );
  const [currUser, setCurrUser] = useState<User>(Signusers[0]);
  const currUserRef = useRef(currUser);
  currUserRef.current = currUser;
  const [readyToSign, setReadyToSign] = useState<boolean>(false);

  useEffect(() => {
    if (PSPDFKit) {
      Signusers.forEach((user) => {
        user.color = randomColor(PSPDFKit);
      });
    }
    setUsers(Signusers);
    console.log(currSignee, "currSignee");
    console.log(users, "userss");
  }, []);

  function onDragStart(event: React.DragEvent<HTMLDivElement>, type: string) {
    console.log(currSignee, "data");
    const instantId = "PSPDFKit.generateInstantId()";
    let data =
      currSignee.name + // value from select, name of signer
      "%" + // % is an invalid email character so we can use it as a delimiter
      currSignee.email + // value from select, email of signer
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
    console.log(instantId, "instandID");
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    console.log("handleDragOver");
    e.preventDefault();
  };

  const handleDrop = async (e: any, inst: any, PSPDFKit: any) => {
    console.log("handleDrop");
    e.preventDefault();
    e.stopPropagation();
    const dataArray = e.dataTransfer.getData("text").split("%");
    let [name, email, instantId, annotationType] = dataArray;
    instantId = PSPDFKit.generateInstantId();
    const signee = currSigneeRef.current;
    // const user = currUserRef.current;
    const pageIndex = onPageIndexRef.current;
    let rectWidth = 120;
    let rectHeight = 40;
    switch (annotationType) {
      case AnnotationTypeEnum.SIGNATURE:
        rectWidth = 120;
        rectHeight = 60;
        break;

      default:
        break;
    }
    const clientRect = new PSPDFKit.Geometry.Rect({
      left: e.clientX - rectWidth / 2,
      top: e.clientY - rectHeight / 2,
      height: rectHeight,
      width: rectWidth,
    });

    console.log(instantId, "instantId");

    const pageRect = inst.transformContentClientToPageSpace(
      clientRect,
      pageIndex
    ) as any;
    if (
      annotationType === AnnotationTypeEnum.SIGNATURE ||
      annotationType === AnnotationTypeEnum.INITIAL
    ) {
      const widget = new PSPDFKit.Annotations.WidgetAnnotation({
        boundingBox: pageRect,
        formFieldName: instantId,
        id: instantId,
        pageIndex,
        name: instantId,
        customData: {
          signerID: signee.id,
          signerEmail: email,
          type: annotationType,
          signerColor: signee.color,
          // isInitial: annotationType === AnnotationTypeEnum.INITIAL,
        },
        backgroundColor: signee.color,
      });
      const formField = new PSPDFKit.FormFields.SignatureFormField({
        annotationIds: PSPDFKit.Immutable.List([widget.id]),
        name: instantId,
        id: instantId,
      });
      await inst.create([widget, formField]);
    } else {
      const text = new PSPDFKit.Annotations.TextAnnotation({
        pageIndex,
        boundingBox: pageRect,
        text: {
          format: "plain",
          value: annotationType === "name" ? name : new Date().toDateString(),
        },
        name: name,
        customData: {
          signerEmail: email,
          type: annotationType,
          signerColor: signee.color,
        },
        font: "Helvetica",
        fontSize: 14,
        horizontalAlign: "center",
        verticalAlign: "center",
        isEditable: false,
        backgroundColor: signee.color,
      });
      await inst.create(text);
    }

    // @ts-ignore
    inst.setOnAnnotationResizeStart((eve) => {
      if (eve.annotation instanceof PSPDFKit.Annotations.WidgetAnnotation) {
        return {
          maxWidth: 250,
          maxHeight: 100,
          minWidth: 70,
          minHeight: 30,
        };
      }
    });
  };

  function onDragEnd(event: React.DragEvent<HTMLDivElement>) {
    (event.target as HTMLDivElement).style.opacity = "1";
    console.log("onDragEnd");
  }

  const [isTextAnnotationMovable, setIsTextAnnotationMovable] = useState(false);
  const isTextAnnotationMovableRef = useRef(isTextAnnotationMovable);
  isTextAnnotationMovableRef.current = isTextAnnotationMovable;

  const onChangeReadyToSign = async (
    value: boolean,
    user: User,
    PSPDFKit: any
  ) => {
    if (instance) {
      setReadyToSign(value);
      if (user.role == "Editor") {
        if (value) {
          instance.setViewState((viewState: any) =>
            viewState.set("interactionMode", PSPDFKit.InteractionMode.PAN)
          );
          setIsTextAnnotationMovable(false);
        } else {
          instance.setViewState((viewState: any) =>
            viewState.set(
              "interactionMode",
              PSPDFKit.InteractionMode.FORM_CREATOR
            )
          );
          setIsTextAnnotationMovable(true);
        }
      } else {
        instance.setViewState((viewState: any) =>
          viewState.set("interactionMode", PSPDFKit.InteractionMode.PAN)
        );
        setIsTextAnnotationMovable(false);
      }
    }
  };

  const addSignee = () => {
    if (typeof window !== "undefined") {
      const name = window.prompt("Enter signee's name:");
      const email = window.prompt("Enter signee's email:");

      let id = Math.floor(Math.random() * 1000000);
      while (id && users.find((user) => user.id === id)) {
        console.log("Non unique" + id);
        id = Math.floor(Math.random() * 1000000);
      }
      console.log("Unique id" + id);

      if (name && email && instance) {
        const newUser = {
          id: id,
          name: name,
          email: email,
          color: randomColor(PSPDFKit),
          role: "Signer",
        } as User;

        setUsers((prevState) => [...prevState, newUser]);
        setCurrSignee(newUser); // Set the newly added user as the current signee
        setSelectedSignee(newUser); // Update the selected signee as well
      } else {
        alert("Please enter both name and email.");
      }
    }
  };

  const randomColor = (PSPDFKit: any) => {
    const colors: any = [
      PSPDFKit.Color.LIGHT_GREY,
      PSPDFKit.Color.LIGHT_GREEN,
      PSPDFKit.Color.LIGHT_YELLOW,
      PSPDFKit.Color.LIGHT_ORANGE,
      PSPDFKit.Color.LIGHT_RED,
      PSPDFKit.Color.LIGHT_BLUE,
      PSPDFKit.Color.fromHex("#0ffcf1"),
    ];
    const usedColors = users.map((signee) => signee.color);
    const availableColors = colors.filter(
      (color: any) => !usedColors.includes(color as any)
    );
    const randomIndex = Math.floor(Math.random() * availableColors.length);
    return availableColors[randomIndex];
  };

  const userChange = async (user: User, PSPDFKit: any) => {
    // setCurrUser(user);
    console.log(user, "user changes");
    if (instance) {
      const formFields = await instance.getFormFields();
      const signatureFormFields = formFields.filter(
        (field: any) => field instanceof PSPDFKit.FormFields.SignatureFormField
      );
      const signatureAnnotations = async () => {
        let annotations: any[] = [];
        for (let i = 0; i < instance.totalPageCount; i++) {
          let ann = await instance.getAnnotations(i);
          ann.forEach((annotation: any) => {
            if (
              annotation.customData &&
              annotation.customData.signerID == user.id
            ) {
              annotations.push(annotation.id);
            }
          });
        }
        return annotations;
      };
      const userFieldIds = await signatureAnnotations();
      const readOnlyFormFields = signatureFormFields
        .map((it: any) => {
          if (userFieldIds.includes(it.id)) {
            return it.set("readOnly", false);
          } else {
            return it.set("readOnly", true);
          }
        })
        .filter(Boolean); // Filter out undefined values
      await instance.update(readOnlyFormFields);
      // User with role Editor can edit the document
      if (user.role == "Editor") {
        instance.setViewState((viewState: any) =>
          viewState.set("showToolbar", true)
        );
        setIsVisible(true);
        onChangeReadyToSign(false, user, PSPDFKit);
      } else {
        instance.setViewState((viewState: any) =>
          viewState.set("showToolbar", false)
        );
        setIsVisible(false);
        onChangeReadyToSign(true, user, PSPDFKit);
      }
    }
    console.log(currUser, "currUser");
  };

  useEffect(() => {
    const loadPdf = async () => {
      if (containerRef.current) {
        try {
          await PSPDFKit.unload(containerRef.current);

          const instance = await PSPDFKit.load({
            container: containerRef.current,
            document: pdfUrl,
            baseUrl: `${window.location.protocol}//${window.location.host}/${
              import.meta.env.BASE_URL
            }`,

            // customRenderers: {
            //   Annotation: ({ annotation }: any) => {
            //     return getAnnotationRenderers({ annotation });
            //   },
            // },
            styleSheets: ["/styles.css"],
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

          //@ts-ignore
          const cont = instance.contentDocument.host;
          cont.ondrop = async function (e: any) {
            await handleDrop(e, instance, PSPDFKit);
          };

          instance.addEventListener("annotations.press", (event: any) => {
            let lastFormFieldClicked = event.annotation;

            let annotationsToLoad;
            if (
              lastFormFieldClicked.customData &&
              lastFormFieldClicked.customData.isInitial === true
            ) {
              annotationsToLoad = sessionInitials;

              isCreateInitial = true;
            } else {
              annotationsToLoad = sessionSignatures;

              isCreateInitial = false;
            }
            instance.setStoredSignatures(
              PSPDFKit.Immutable.List(annotationsToLoad)
            );

            if (
              !isTextAnnotationMovableRef.current &&
              event.annotation instanceof PSPDFKit.Annotations.TextAnnotation
            ) {
              //@ts-ignore
              event.preventDefault();
            }
          });

          let formDesignMode = !1;

          instance.setToolbarItems((items: any) => [
            ...items,
            { type: "form-creator" },
          ]);
          instance.addEventListener("viewState.change", (viewState: any) => {
            formDesignMode = viewState.formDesignMode === true;
          });

          instance.addEventListener(
            "storedSignatures.create",
            async (annotation: any) => {
              // Logic for showing signatures and intials in the UI
              if (isCreateInitial) {
                setSessionInitials([...sessionInitials, annotation]);
              } else {
                setSessionSignatures([...sessionSignatures, annotation]);
              }
            }
          );

          // **** Handling Signature / Initial fields appearance ****

          instance.addEventListener(
            "annotations.load",
            async function (loadedAnnotations: any) {
              for await (const annotation of loadedAnnotations) {
                await handleAnnotatitonCreation(
                  instance,
                  annotation,
                  mySignatureIdsRef,
                  setSignatureAnnotationIds,
                  currSignee.email
                );
              }
            }
          );

          instance.addEventListener(
            "annotations.create",
            async function (createdAnnotations: any) {
              const annotation = createdAnnotations.get(0);
              await handleAnnotatitonCreation(
                instance,
                annotation,
                mySignatureIdsRef,
                setSignatureAnnotationIds,
                currSignee.email
              );
            }
          );

          instance.setViewState((viewState: any) =>
            viewState.set(
              "interactionMode",
              PSPDFKit.InteractionMode.FORM_CREATOR
            )
          );
          setIsTextAnnotationMovable(true);
        } catch (error) {
          console.error("Error loading PSPDFKit", error);
        }
      }
    };

    loadPdf();

    return () => {
      if (containerRef.current) {
        PSPDFKit.unload(containerRef.current);
      }
    };
  }, [pdfUrl]);

  const signeeChanged = (signee: User) => {
    console.log("user changed");
    setCurrSignee(signee);
    setSelectedSignee(signee);
  };

  const [selectedSignee, setSelectedSignee] = useState(currSigneeRef.current);

  return (
    <div>
      <div
        onDragOver={handleDragOver}
        ref={containerRef}
        style={{ height: "100vh", width: "100%" }}
      />

      <div style={{ gap: "18px" }}>
        <div
          style={{
            position: "absolute",
            top: "200px",
            left: "40px",
            border: "2px solid",
            borderRadius: "10px",
            padding: "10px",
            width: "300px",
          }}
        >
          <h4>Signers</h4>
          <button onClick={addSignee} style={{ border: "1px solid" }}>
            Add New
          </button>
          <div>
            <div>
              {users?.map((user) => {
                if (user.role !== "Editor") {
                  const isLastClicked = selectedSignee.id === user.id;
                  return (
                    <div
                      className={`heading-custom-style_hover ${
                        isLastClicked ? "highlight-signee" : ""
                      }`}
                      key={user?.id}
                      onClick={(e) => {
                        signeeChanged(user);
                      }}
                    >
                      <RedCircleIcon color={user.color?.toString()} />
                      {user?.name.length > 10
                        ? user?.name.slice(0, 10) + "..."
                        : user?.name}
                      <span
                        className="cross"
                        // onClick={(e) => {
                        //   e.stopPropagation();
                        //   deleteUser(user);
                        // }}
                      >
                        <svg
                          width="10"
                          height="9"
                          viewBox="0 0 10 9"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            d="M4.99991 5.43337L1.73324 8.70003C1.61102 8.82225 1.45547 8.88337 1.26658 8.88337C1.07769 8.88337 0.922133 8.82225 0.79991 8.70003C0.677688 8.57781 0.616577 8.42225 0.616577 8.23337C0.616577 8.04448 0.677688 7.88892 0.79991 7.7667L4.06658 4.50003L0.79991 1.23337C0.677688 1.11114 0.616577 0.955588 0.616577 0.766699C0.616577 0.57781 0.677688 0.422255 0.79991 0.300033C0.922133 0.17781 1.07769 0.116699 1.26658 0.116699C1.45547 0.116699 1.61102 0.17781 1.73324 0.300033L4.99991 3.5667L8.26658 0.300033C8.3888 0.17781 8.54435 0.116699 8.73324 0.116699C8.92213 0.116699 9.07769 0.17781 9.19991 0.300033C9.32213 0.422255 9.38324 0.57781 9.38324 0.766699C9.38324 0.955588 9.32213 1.11114 9.19991 1.23337L5.93324 4.50003L9.19991 7.7667C9.32213 7.88892 9.38324 8.04448 9.38324 8.23337C9.38324 8.42225 9.32213 8.57781 9.19991 8.70003C9.07769 8.82225 8.92213 8.88337 8.73324 8.88337C8.54435 8.88337 8.3888 8.82225 8.26658 8.70003L4.99991 5.43337Z"
                            fill="#EF4444"
                          />
                        </svg>
                      </span>
                    </div>
                  );
                }
              })}
            </div>
          </div>
        </div>

        <div
          style={{
            position: "absolute",
            top: "600px",
            left: "40px",
            border: "2px solid",
            borderRadius: "10px",
            padding: "10px",
            width: "300px",
          }}
        >
          <DraggableAnnotation
            className="mt-5"
            type={AnnotationTypeEnum.SIGNATURE}
            label="Signature"
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            userColor={currSignee.color}
          />
        </div>

        <div
          style={{
            position: "absolute",
            top: "800px",
            left: "40px",
            border: "2px solid",
            borderRadius: "10px",
            padding: "10px",
            width: "300px",
          }}
        >
          <h4>External Stakeholders</h4>
          <div>
            <select
              className="dropdown-custom-style"
              value={selectedSignee?.id?.toString() || ""} // Default to "Select" if no signee is selected
              onChange={(event) => {
                const selectedId = event.target.value;
                if (selectedId) {
                  userChange(
                    users.find(
                      (user) => user.id.toString() === selectedId
                    ) as User,
                    PSPDFKit
                  );
                }
              }}
            >
              <option value="Select">
                Select
              </option>

              {/* User options */}
              {users
                .filter((user) => user.role !== "Editor") // Exclude "Editor" users
                .map((user) => (
                  <option
                    key={user.id}
                    value={user.id.toString()}
                    className={
                      selectedSignee?.id === user.id ? "highlight-signee" : ""
                    }
                  >
                    {user.name.length > 15
                      ? `${user.name.slice(0, 15)}...`
                      : user.name}
                  </option>
                ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
};
export default PdfViewerComponent;

export const DraggableAnnotation = ({
  className,
  type,
  label,
  onDragStart,
  onDragEnd,
  userColor,
}: {
  className: string;
  type: string;
  label: string;
  onDragStart: any;
  onDragEnd: any;
  userColor: any;
}) => {
  const id = `${type}-icon`;
  let icon = signSVG;
  switch (type) {
    case AnnotationTypeEnum.SIGNATURE:
      icon = signSVG;
      break;
    default:
      break;
  }

  return (
    <div
      draggable={true}
      onDragStart={async (e) => await onDragStart(e, type)}
      onDragEnd={(e) => onDragEnd(e, type)}
      style={{
        margin: "15px 0px",
        padding: "0rem 0px",
        cursor: "move",
      }}
    >
      <div className="heading-custom-style">
        <span
          style={{
            border: "1px solid #d7dce4",
            borderRadius: "5px",
            marginInlineEnd: "8px",
            padding: "3px 5px",
            backgroundColor: userColor
              ? `rgb(${userColor.r},${userColor.g},${userColor.b})`
              : `white`,
          }}
        >
          {icon}
        </span>

        <span style={{ margin: "0px 0.5rem" }}>{label}</span>
      </div>
    </div>
  );
};
