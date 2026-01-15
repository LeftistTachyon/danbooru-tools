// handle readout changes
document.getElementById("slider-readout").innerHTML =
  localStorage.getItem("ocr.confidence") + "%";
document.getElementById("confidence").addEventListener("input", (e) => {
  document.getElementById("slider-readout").innerHTML = e.target.value + "%";
});

/**
 * Show the image panel
 */
function showImage() {
  document.getElementById("no-image").style.display = "none";
  document.getElementById("with-image").style.display = "block";
}
/**
 * Hide the image panel
 */
function hideImage() {
  document.getElementById("with-image").style.display = "none";
  document.getElementById("no-image").style.display = "block";
}

let imgWidth, imgHeight, prevImgFile;
const reader = new FileReader(),
  bboxes = [];

/**
 * Reads a copy/pasted file
 *
 * @param {File} file the file to extract the image from
 * @param {HTMLImageElement} img an image element to put the image file into
 * @returns the source, width, and height of the image
 */
async function readImageFile(file, img = document.getElementById("preview")) {
  return new Promise((resolve) => {
    reader.onload = (e) => {
      img.onload = () => {
        resolve({
          src: e.target.result,
          width: (imgWidth = img.naturalWidth),
          height: (imgHeight = img.naturalHeight),
        });
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * A wrapper function for worker.recognize
 * @returns OCR data
 */
async function recognize(file) {
  // console.log("running ocr...");
  const { data } = await worker.recognize(file);
  console.log("data:", data);
  return data;
}

/**
 * Clears all visuals and data of visaul boxes.
 */
function clearBBoxes() {
  bboxes.length = 0;
  for (const bbox of Array.from(document.getElementsByClassName("bbox"))) {
    // console.log(bbox);
    bbox.parentNode.removeChild(bbox);
  }
}

/**
 * Shows bboxes
 */
function showBBoxes() {
  document.getElementById("with-image").classList.remove("hide-bbox");
}
/**
 * Hides bboxes
 */
function hideBBoxes() {
  document.getElementById("with-image").classList.add("hide-bbox");
}
/**
 * Toggles visibility of bboxes
 */
function toggleBBoxes() {
  document.getElementById("with-image").classList.toggle("hide-bbox");
}

/**
 * Handles images being pasted or selected
 * @param {File} file the file to handle
 */
async function handleNewImageFile(file) {
  // set cache
  prevImgFile = file;

  // extract data from image file
  const [, data] = await Promise.all([
    (async () => {
      // console.log("reading image file...");
      await readImageFile(file);
      // imgWidth = imageData.width;
      // imgHeight = imageData.height;

      clearBBoxes();
      showImage();
      // console.log("finished reading image file");
    })(),
    recognize(file),
  ]);

  await displayOCRData(data);
}

/**
 * Displays the OCR data from {@link recognize} to the user
 * @param {*} data the OCR data from {@link recognize}
 */
async function displayOCRData(data) {
  // show all viable OCR readings
  const imageParent = document.getElementById("with-image");
  const minConfidence = localStorage.getItem("ocr.confidence");
  const confidentBlocks = data.blocks.filter(
    (block) => block.confidence >= minConfidence
  );
  for (const block of confidentBlocks) {
    const bbox = document.createElement("div");
    bbox.classList.add("bbox");
    bbox.style.inset = `${(block.bbox.y0 / imgHeight) * 100}%
        ${(1 - block.bbox.x1 / imgWidth) * 100}%
        ${(1 - block.bbox.y1 / imgHeight) * 100}%
        ${(block.bbox.x0 / imgWidth) * 100}%`;

    bbox.addEventListener("click", () => {
      document.getElementById("original").value = block.text;
    });

    imageParent.appendChild(bbox);
  }

  // clear original textbox
  document.getElementById("original").value = "";
}

// handle normal pastes
document.addEventListener("paste", (e) => {
  e.preventDefault();

  for (const clipboardItem of e.clipboardData.files) {
    // if image
    if (clipboardItem.type.startsWith("image/")) {
      // process no more files
      handleNewImageFile(clipboardItem);
      break;
    }
  }
});
// handle paste from button click
document.getElementById("paste-btn").addEventListener("click", async () => {
  console.log("paste button clicked");
  try {
    for (const clipboardItem of await navigator.clipboard.read()) {
      // console.log("clipboard item:", clipboardItem);
      const imageType = clipboardItem.types.find((type) =>
        type.startsWith("image/")
      );
      if (imageType) {
        const blob = await clipboardItem.getType(imageType);
        await handleNewImageFile(blob);

        // finish
        break;
      }
    }
  } catch (err) {
    console.error(err.name, err.message);
  }
});
// handle open file
document.getElementById("file-btn").addEventListener("click", async () => {
  try {
    const [fileHandle] = await window.showOpenFilePicker({
      types: [
        {
          description: "Images",
          accept: {
            "image/*": [".png", ".gif", ".jpeg", ".jpg"],
          },
        },
      ],
      excludeAcceptAllOption: true,
      multiple: false,
    });

    const file = await fileHandle.getFile();
    // console.log(file);
    await handleNewImageFile(file);
  } catch (e) {
    // aborted
    console.warn("User aborted request/error occurred");
  }
});
// handle link button
document.getElementById("link-btn").addEventListener("click", async () => {
  const url = prompt("Enter the image URL below.");
  if (!url) return;

  try {
    const res = await fetch(url);
    const blob = await res.blob();
    await handleNewImageFile(blob);
  } catch (e) {
    alert("An error occurred while processing the image:\n" + e.message);
  }
});
// handle rerun button
document.getElementById("rerun-btn").addEventListener("click", async () => {
  if (prevImgFile) {
    clearBBoxes();
    const data = await recognize(prevImgFile);
    await displayOCRData(data);
  }
});
// handle clear boxes button
document
  .getElementById("clear-boxes-btn")
  .addEventListener("click", clearBBoxes);
// handle clear img button
document.getElementById("clear-img-btn").addEventListener("click", () => {
  // hide image
  hideImage();

  // delete previous data
  clearBBoxes();
  prevImgFile = undefined;
});
// handle showing and hiding bboxes
document.getElementById("preview").addEventListener("click", toggleBBoxes);

// handle dropping things
// shoutouts to https://stackoverflow.com/questions/11972963/accept-drag-drop-of-image-from-another-browser-window
const dropbox = document.getElementById("image-container");
dropbox.addEventListener("drop", (evt) => {
  evt.stopPropagation();
  evt.preventDefault();
  dropbox.classList.remove("dragover");

  // console.log(evt.dataTransfer.files);
  const imageFile = Array.from(evt.dataTransfer.files).find((file) =>
    file.type.startsWith("image/")
  );

  if (imageFile) handleNewImageFile(imageFile);
});

/**
 * Ignores the drag event
 * @param {DragEvent} evt the drag event generated
 * @returns whether the dragged item is an accepted item or not
 */
function noopHandler(evt) {
  // console.log(
  //   new Array(evt.dataTransfer.items).length,
  //   evt.dataTransfer.items[0]
  // );
  // evt.dataTransfer.items[0].getAsString(console.log.bind(console));
  evt.stopPropagation();
  evt.preventDefault();
  // return;

  // console.log(Array.from(evt.dataTransfer.items));
  // const fileItems = Array.from(evt.dataTransfer.items).filter(
  //   (item) => item.kind === "file"
  // );

  // if (fileItems.length > 0) {
  //   evt.stopPropagation();
  //   evt.preventDefault();

  //   if (fileItems.some((item) => item.type.startsWith("image/"))) {
  //     evt.dataTransfer.dropEffect = "copy";
  //     return true;
  //   } else {
  //     evt.dataTransfer.dropEffect = "none";
  //     return false;
  //   }
  // }
  // // console.log(evt.dataTransfer.items?.[0]);
}
dropbox.addEventListener("dragleave", (evt) => {
  noopHandler(evt);
  if (evt.target === dropbox) dropbox.classList.remove("dragover");
  console.log("dragleave", evt.target);
});
dropbox.addEventListener("dragenter", (evt) => {
  noopHandler(evt);
  dropbox.classList.add("dragover");
  console.log("dragenter", evt.target);
});
// dropbox.addEventListener("dragenter", noopHandler);
// dropbox.addEventListener("dragexit", noopHandler);
dropbox.addEventListener("dragover", noopHandler);

// handle changing languages
document.getElementById("lang").addEventListener("change", async (e) => {
  console.log("New lang:", e.target.value);
  await worker.reinitialize(e.target.value, 1);
});

// load tesseract.js last
// console.log(Tesseract);
const worker = await Tesseract.createWorker(
  localStorage.getItem("ocr.lang") || "jpn",
  1,
  {
    // logger: console.log.bind(console),
  }
);
// console.log(Tesseract.PSM);
await worker.setParameters({
  tessedit_pageseg_mode: Tesseract.PSM.SPARSE_TEXT_OSD,
});
