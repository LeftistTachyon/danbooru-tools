const { Translator } = require("deepl-node");

const deeplKey = localStorage.getItem("api.deepl");
const deeplClient = deeplKey ? new Translator(deeplKey) : null;

export async function translate(text, targetLang = "en-US") {
  return deeplClient
    ? await deeplClient.translateText(text, null, targetLang)
    : null;
}

export function instantiated() {
  return deeplClient !== null;
}
