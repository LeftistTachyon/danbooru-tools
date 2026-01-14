// console.log(Tesseract);
const worker = await Tesseract.createWorker(
  ["eng", "chi_sim", "chi_tra", "jpn"],
  1,
  {
    // logger: console.log.bind(console),
  }
);

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

document.addEventListener("paste", async (e) => {
  e.preventDefault();

  for (const clipboardItem of e.clipboardData.files) {
    // if image
    if (clipboardItem.type.startsWith("image/")) {
      // console.log(clipboardItem);
      const img = document.getElementById("preview");
      img.file = clipboardItem;

      const reader = new FileReader();
      reader.onload = (e) => {
        img.src = e.target.result;
        showImage();
      };
      reader.readAsDataURL(clipboardItem);

      const { data } = await worker.recognize(clipboardItem);
      console.log(data);

      const imageParent = document.getElementById("with-image");
      for (const block of data.blocks) {
        const bbox = document.createElement("div");
        bbox.classList.add("bbox");
        bbox.style.top = block.bbox.x0 + "px";
        bbox.style.left = block.bbox.y0 + "px";
        bbox.style.width = block.bbox.x1 - block.bbox.x0 + "px";
        bbox.style.height = block.bbox.y1 - block.bbox.y0 + "px";

        imageParent.appendChild(bbox);
      }

      // process no more files
      break;
    }
  }
});
