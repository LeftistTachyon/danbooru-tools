// console.log(Tesseract);
const worker = await Tesseract.createWorker("jpn", 1, {
  // logger: console.log.bind(console),
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

let imgWidth, imgHeight;
const reader = new FileReader();

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

document.addEventListener("paste", async (e) => {
  e.preventDefault();

  for (const clipboardItem of e.clipboardData.files) {
    // if image
    if (clipboardItem.type.startsWith("image/")) {
      // console.log(clipboardItem);
      const img = document.getElementById("preview");
      // img.file = clipboardItem;

      const [, data] = await Promise.all([
        (async () => {
          // console.log("reading image file...");
          await readImageFile(clipboardItem);
          // imgWidth = imageData.width;
          // imgHeight = imageData.height;
          showImage();

          for (const bbox of document.getElementsByClassName("bbox")) {
            bbox.remove();
          }
          // console.log("finished reading image file");
        })(),
        (async () => {
          // console.log("running ocr...");
          const { data } = await worker.recognize(clipboardItem);
          console.log("data:", data);
          return data;
        })(),
      ]);

      const imageParent = document.getElementById("with-image");
      for (const block of data.blocks) {
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
      document.getElementById("original").value = data.text;

      // process no more files
      break;
    }
  }
});

document.getElementById("lang").addEventListener("change", async (e) => {
  console.log("New lang:", e.target.value);
  await worker.reinitialize(e.target.value, 1);
});
