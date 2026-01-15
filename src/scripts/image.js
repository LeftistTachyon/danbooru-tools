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

document.addEventListener("paste", async (e) => {
  e.preventDefault();

  for (const clipboardItem of e.clipboardData.files) {
    // if image
    if (clipboardItem.type.startsWith("image/")) {
      // console.log(clipboardItem);
      const img = document.getElementById("preview");
      // img.file = clipboardItem;

      const reader = new FileReader();
      reader.onload = (e) => {
        img.onload = () => {
          imgWidth = img.naturalWidth;
          imgHeight = img.naturalHeight;
        };
        img.src = e.target.result;
        showImage();
      };
      reader.readAsDataURL(clipboardItem);

      const { data } = await worker.recognize(clipboardItem);
      console.log(data);
      document.getElementById("original").value = data.text;

      const imageParent = document.getElementById("with-image");
      for (const block of data.blocks) {
        const bbox = document.createElement("div");
        bbox.classList.add("bbox");
        if (imgWidth && imgHeight) {
          // bbox.style.top = (block.bbox.y0 / imgHeight) * 100 + "%";
          // bbox.style.right = (1 - block.bbox.x1 / imgWidth) * 100 + "%";
          // bbox.style.bottom = (1 - block.bbox.y1 / imgHeight) * 100 + "%";
          // bbox.style.left = (block.bbox.x0 / imgWidth) * 100 + "%";
          bbox.style.inset = `${(block.bbox.y0 / imgHeight) * 100}%
          ${(1 - block.bbox.x1 / imgWidth) * 100}%
          ${(1 - block.bbox.y1 / imgHeight) * 100}%
          ${(block.bbox.x0 / imgWidth) * 100}%`;
        } else {
          bbox.style.left = block.bbox.x0 + "px";
          bbox.style.top = block.bbox.y0 + "px";
          bbox.style.width = block.bbox.x1 - block.bbox.x0 + "px";
          bbox.style.height = block.bbox.y1 - block.bbox.y0 + "px";
        }
        bbox.addEventListener("click", () => {
          document.getElementById("original").value = block.text;
        });

        imageParent.appendChild(bbox);
      }

      // process no more files
      break;
    }
  }
});

document.getElementById("lang").addEventListener("change", async (e) => {
  console.log("New lang:", e.target.value);
  await worker.reinitialize(e.target.value, 1);
});
