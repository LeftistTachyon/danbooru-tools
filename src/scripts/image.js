console.log(Tesseract);
const worker = await Tesseract.createWorker(
  ["eng", "chi_sim", "chi_tra", "jpn"],
  1,
  {
    // logger: console.log.bind(console),
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
