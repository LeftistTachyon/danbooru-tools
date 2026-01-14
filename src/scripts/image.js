import "./tesseract-worker/index.js";

const tesseract = require("tesseract.js");
console.log(tesseract);
const worker = await tesseract.createWorker(
  ["eng", "chi_sim", "chi_tra", "jpn"],
  1,
  {
    logger: console.log.bind(console),
    // workerPath: "./scripts/tesseract-worker/index.js",
  }
);

document.addEventListener("paste", async (e) => {
  e.preventDefault();

  for (const clipboardItem of e.clipboardData.files) {
    // if image
    if (clipboardItem.type.startsWith("image/")) {
      console.log(clipboardItem);
      const { data } = await worker.recognize(clipboardItem);
      console.log(data.text);
    }
  }
});
