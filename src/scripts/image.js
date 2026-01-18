import { translate } from "./deepl.js";
import {
  createChineseMenu,
  createDefaultMenu,
  createJapaneseMenu,
} from "./translating-contextmenu.js";

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
// the last translated language as detected by DeepL
let lastLang;
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
  await worker.setParameters({
    tessedit_pageseg_mode: Tesseract.PSM.SPARSE_TEXT_OSD,
  });
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
 * Handles images being pasted or selected
 * @param {File} file the file to handle
 */
async function handleNewImageFile(file) {
  // set cache & start loading animatic
  const imageContainer = document.getElementById("image-container");
  imageContainer.classList.add("rotate");
  prevImgFile = file;

  if (document.getElementById("autorun").checked) {
    // extract data from image file
    console.log("autorun ON");
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
  } else {
    console.log("autorun OFF");

    // just load the file
    await readImageFile(file);
    // imgWidth = imageData.width;
    // imgHeight = imageData.height;

    clearBBoxes();
    showImage();
  }

  // stop loading animatic
  imageContainer.classList.remove("rotate");
}

/**
 * Creates a bounding box element with the associated OCR data
 *
 * @param {number} idx the idx # in the bbox data array to assign to this bbox
 * @returns the created {@link HTMLDivElement} that acts as a bounding box
 */
function createBBox(idx) {
  const bbox = document.createElement("div");
  bbox.classList.add("bbox");
  bbox.style.inset = `${(bboxes[idx].bbox.y0 / imgHeight) * 100}%
        ${(1 - bboxes[idx].bbox.x1 / imgWidth) * 100}%
        ${(1 - bboxes[idx].bbox.y1 / imgHeight) * 100}%
        ${(bboxes[idx].bbox.x0 / imgWidth) * 100}%`;
  bbox.setAttribute("data-idx", idx);

  // right click menu
  const menu = new nw.Menu();
  menu.append(
    new nw.MenuItem({
      label: (bbox.title = `Confidence: ${bboxes[idx].confidence.toFixed(2)}%`),
      enabled: false,
    }),
  );
  menu.append(
    new nw.MenuItem({
      label: "Delete this box",
      click() {
        delete bboxes[idx];
        bbox.remove();
      },
    }),
  );

  // handle LClick
  bbox.addEventListener("click", async () => {
    const bboxData = bboxes[idx];
    document.getElementById("original").value = bboxData.original;
    if (bboxData.translated) {
      // previously translated
      document.getElementById("deepl").value = bboxData.translated;
      lastLang = bboxData.lang;
    } else {
      // start translation
      const output = document.getElementById("deepl");
      output.value = "Translating...";

      const translated = await translate(bboxData.original);
      output.value = bboxData.translated = translated.text || "";
      lastLang = bboxData.lang = translated.detectedSourceLang;

      if (lastLang === "ja" || lastLang === "zh") {
        // remove spaces by default if the language is detected as one that doesn't use spaces
        const original = bboxData.original;
        bboxData.original = bboxData.original.replaceAll(" ", "");
        if (document.getElementById("original").value === original)
          // replace if still on this
          document.getElementById("original").value = bboxData.original;
      }
    }
  });
  // handle RClick
  bbox.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    menu.popup(e.x, e.y);
    return false;
  });

  return bbox;
}

/**
 * Displays the OCR data from {@link recognize} to the user
 * @param {*} data the OCR data from {@link recognize}
 */
async function displayOCRData(data) {
  // filter for >=ocr.confidence
  const minConfidence = localStorage.getItem("ocr.confidence");
  const confidentBlocks = data.blocks.filter(
    (block) => block.confidence >= minConfidence,
  );

  // add data to bboxes
  bboxes.push(
    ...confidentBlocks.map((block) => ({
      original: block.text.trim().replaceAll("\n", ""),
      translated: "",
      confidence: block.confidence,
      lang: null,
      bbox: block.bbox,
    })),
  );
  // console.log("total bboxes:", bboxes);

  const imageParent = document.getElementById("with-image");
  for (
    let idx = bboxes.length - confidentBlocks.length;
    idx < bboxes.length;
    ++idx
  ) {
    imageParent.appendChild(createBBox(idx));
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
        type.startsWith("image/"),
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
    // start loading animation
    const imageContainer = document.getElementById("image-container");
    imageContainer.classList.add("rotate");

    // do the OCR
    clearBBoxes();
    const data = await recognize(prevImgFile);
    await displayOCRData(data);

    // remove loading animation
    imageContainer.classList.remove("rotate");
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
// handle retranslate requests
document
  .getElementById("retranslate-btn")
  .addEventListener("click", async () => {
    const output = document.getElementById("deepl");
    output.value = "Translating...";

    const translated = await translate(
      document.getElementById("original").value,
    );
    output.value = translated.text || "";
    lastLang = translated.detectedSourceLang;
  });

// handle dropping things
// shoutouts to https://stackoverflow.com/questions/11972963/accept-drag-drop-of-image-from-another-browser-window
const dropbox = document.getElementById("image-container");
dropbox.addEventListener("drop", (evt) => {
  evt.stopPropagation();
  evt.preventDefault();
  dropbox.classList.remove("dragover");

  // console.log(evt.dataTransfer.files);
  const imageFile = Array.from(evt.dataTransfer.files).find((file) =>
    file.type.startsWith("image/"),
  );

  if (imageFile) handleNewImageFile(imageFile);
});

/**
 * Ignores the drag event
 * @param {DragEvent} evt the drag event generated
 * @returns whether the dragged item is an accepted item or not
 */
function noopHandler(evt) {
  evt.stopPropagation();
  evt.preventDefault();
}
dropbox.addEventListener("dragleave", (evt) => {
  noopHandler(evt);
  if (evt.fromElement === document.documentElement)
    dropbox.classList.remove("dragover");
  // console.log("dragleave", evt);
});
dropbox.addEventListener("dragenter", (evt) => {
  noopHandler(evt);
  dropbox.classList.add("dragover");
  // console.log("dragenter", evt);
});
dropbox.addEventListener("dragover", noopHandler);

// handle changing languages
document.getElementById("lang").addEventListener("change", async (e) => {
  console.log("New lang:", e.target.value);
  await worker.reinitialize(e.target.value, 1);
});

// handle right click menu on the original language textbox
document
  .getElementById("original")
  .addEventListener("contextmenu", async (e) => {
    e.preventDefault();
    // console.log(
    //   lastLang,
    //   document.getSelection().toString()
    // );

    switch (lastLang) {
      case "ja":
        (await createJapaneseMenu()).popup(e.x, e.y);
        break;
      case "zh":
        createChineseMenu().popup(e.x, e.y);
        break;
      default:
        createDefaultMenu().popup(e.x, e.y);
        break;
    }

    return false;
  });

// handle toggling box drawing mode
let nMode = false,
  cMode = false;
document.addEventListener("keypress", (e) => {
  const imageContainer = document.getElementById("image-container");
  if (e.key === "n") {
    // disable c mode
    imageContainer.classList.remove("green-border");
    cMode = false;

    // toggle n mode
    imageContainer.classList.toggle("blue-border");
    nMode = !nMode;
  } else if (e.key === "c") {
    // disable n mode
    imageContainer.classList.remove("blue-border");
    nMode = false;

    // toggle c mode
    imageContainer.classList.toggle("green-border");
    cMode = !cMode;

    // make sure bboxes are visible
    document.getElementById("with-image").classList.remove("hide-bbox");
  }
});
// handle drawing boxes over an image
const previewNode = document.getElementById("preview");
let drawingBox = null,
  initialX,
  initialY,
  loading = false;

previewNode.addEventListener("dragstart", (e) => {
  e.stopPropagation();
  e.preventDefault();

  if (nMode || cMode) {
    // console.log(`starting box drawing @ (${e.x}, ${e.y})`);
    const outerBBox = previewNode.getBoundingClientRect();
    initialX = e.clientX;
    initialY = e.clientY;

    // create blueish bbox for designating scan area
    drawingBox = document.createElement("div");
    if (nMode) drawingBox.id = "blue-bbox";
    if (cMode) drawingBox.id = "green-bbox";
    drawingBox.classList.add("bbox");
    drawingBox.style.left = e.clientX - outerBBox.left + "px";
    drawingBox.style.top = e.clientY - outerBBox.top + "px";
    drawingBox.style.width = "0";
    drawingBox.style.height = "0";

    // add to parent and disable pointer events to avoid weirdness
    const parent = document.getElementById("with-image");
    parent.classList.add("no-pointer");
    parent.appendChild(drawingBox);
  }
});
previewNode.addEventListener("mousemove", (e) => {
  if (drawingBox && !loading) {
    // console.log(`drawing box @ (${e.x}, ${e.y})`);

    // update position
    const outerBBox = previewNode.getBoundingClientRect();
    if (e.clientX > initialX) {
      drawingBox.style.left = initialX - outerBBox.left + "px";
      drawingBox.style.width = e.clientX - initialX + "px";
    } else {
      drawingBox.style.left = e.clientX - outerBBox.left + "px";
      drawingBox.style.width = initialX - e.clientX + "px";
    }
    if (e.clientY > initialY) {
      drawingBox.style.top = initialY - outerBBox.top + "px";
      drawingBox.style.height = e.clientY - initialY + "px";
    } else {
      drawingBox.style.top = e.clientY - outerBBox.top + "px";
      drawingBox.style.height = initialY - e.clientY + "px";
    }
  }
});
previewNode.addEventListener("mouseup", async (e) => {
  const parent = document.getElementById("with-image");

  if (drawingBox) {
    // console.log(`ending box drawing @ (${e.x}, ${e.y})`);

    // figure out scaled pixel values for the drawn rectangle
    const outerBBox = previewNode.getBoundingClientRect();
    const left = Math.floor(
        ((Math.min(initialX, e.clientX) - outerBBox.left) / outerBBox.width) *
          imgWidth,
      ),
      top = Math.floor(
        ((Math.min(initialY, e.clientY) - outerBBox.top) / outerBBox.height) *
          imgHeight,
      ),
      width = Math.ceil(
        (Math.abs(e.clientX - initialX) / outerBBox.width) * imgWidth,
      ),
      height = Math.ceil(
        (Math.abs(e.clientY - initialY) / outerBBox.height) * imgHeight,
      );
    const rectangle = { left, top, width, height };
    // console.log("scaled params:", rectangle);

    // start loading animation
    const imageContainer = document.getElementById("image-container");
    imageContainer.classList.add("rotate");

    if (nMode) {
      // run recognition
      loading = true;
      // vert mode
      await worker.setParameters({
        tessedit_pageseg_mode: Tesseract.PSM.SINGLE_BLOCK_VERT_TEXT,
      });
      const { data: dataVert } = await worker.recognize(prevImgFile, {
        rectangle,
      });
      // horiz mode
      await worker.setParameters({
        tessedit_pageseg_mode: Tesseract.PSM.SINGLE_BLOCK,
      });
      const { data: dataHoriz } = await worker.recognize(prevImgFile, {
        rectangle,
      });
      // console.log(dataVert, "vs", dataHoriz);
      await displayOCRData(
        dataVert.confidence > dataHoriz.confidence ? dataVert : dataHoriz,
      );
    }
    if (cMode) {
      // combine any boxes inside
      const toCombine = [];
      for (let i = 0; i < bboxes.length; ++i) {
        if (
          bboxes[i] &&
          bboxes[i].bbox.x0 >= left &&
          bboxes[i].bbox.x1 <= left + width &&
          bboxes[i].bbox.y0 >= top &&
          bboxes[i].bbox.y1 <= top + height
        ) {
          // console.log("inside:", bboxes[i]);
          toCombine.push(bboxes[i]);

          delete bboxes[i];
          document.querySelector(`div[data-idx="${i}"]`).remove();
        }
      }

      // get the text direction & sort the bboxes accordingly
      const textDirection = document.getElementById("dir").value;
      switch (textDirection) {
        case "ltr":
          toCombine.sort((a, b) => a.bbox.x0 - b.bbox.x0);
          break;
        case "rtl":
          toCombine.sort((a, b) => b.bbox.x1 - a.bbox.x1);
          break;
        case "ttb":
          toCombine.sort((a, b) => a.bbox.y0 - b.bbox.y0);
          break;
      }

      // create the new bbox
      /* {
        original: string,
        translated: string,
        confidence: number,
        lang: string,
        bbox: block.bbox,
      }
      */
      let original = "",
        confidence = 1,
        x0 = Number.MAX_VALUE,
        y0 = Number.MAX_VALUE,
        x1 = Number.MIN_VALUE,
        y1 = Number.MIN_VALUE;
      for (const bbox of toCombine) {
        original += bbox.original + "\n";
        confidence *= bbox.confidence;
        if (bbox.bbox.x0 < x0) x0 = bbox.bbox.x0;
        if (bbox.bbox.x1 > x1) x1 = bbox.bbox.x1;
        if (bbox.bbox.y0 < y0) y0 = bbox.bbox.y0;
        if (bbox.bbox.y1 > y1) y1 = bbox.bbox.y1;
      }

      // add to array
      bboxes[bboxes.length] = {
        original,
        translated: "",
        confidence,
        lang: null,
        bbox: { x0, y0, x1, y1 },
      };

      // add html element
      document
        .getElementById("with-image")
        .appendChild(createBBox(bboxes.length - 1));
    }

    imageContainer.classList.remove("rotate");
    loading = false;
    drawingBox.remove();
    drawingBox = null;
    parent.classList.remove("no-pointer");
    parent.classList.remove("hide-bbox");
  } else {
    parent.classList.toggle("hide-bbox");
  }
});

const upscaler = new Upscaler({
  model: ESRGANThick4x,
});
document.getElementById("upscale-btn").addEventListener("click", async () => {
  // prepare loading labels
  const imageContainer = document.getElementById("image-container"),
    readout = document.getElementById("image-text");
  imageContainer.classList.add("rotate");
  readout.style.display = "block";
  readout.innerHTML = "Upscaling 0.00% complete";

  // upscale the image
  const upscaledImage = await upscaler.upscale(previewNode, {
    patchSize: 256,
    padding: 2,
    progress(percent) {
      readout.innerHTML = `Upscaling ${(percent * 100).toFixed(2)}% complete`;
    },
    progressOutput: "base64",
    awaitNextFrame: true,
  });
  previewNode.src = upscaledImage;

  // update other necessary pieces of info
  imgHeight *= 3;
  imgWidth *= 3;
  for (const bbox of bboxes) {
    bbox.bbox.x0 *= 3;
    bbox.bbox.x1 *= 3;
    bbox.bbox.y0 *= 3;
    bbox.bbox.y1 *= 3;
  }
  const resp = await fetch(previewNode.src);
  prevImgFile = await resp.blob();

  // remove loading labels
  imageContainer.classList.remove("rotate");
  readout.style.display = "none";
});

// load tesseract.js last
// console.log(Tesseract);
const worker = await Tesseract.createWorker(
  localStorage.getItem("ocr.lang") || "jpn",
  1,
  {
    // logger: console.log.bind(console),
  },
);
