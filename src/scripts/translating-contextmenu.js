const { pinyin } = require("pinyin");
const Kuroshiro = require("kuroshiro");
const KuromojiAnalyzer = require("kuroshiro-analyzer-kuromoji");

const kuroshiro = new Kuroshiro.default();
const kuroshiroReady = kuroshiro.init(new KuromojiAnalyzer());

function getSelection(e) {
  return document.getSelection().toString() || e.target.value;
}
function getSelectionURL(e) {
  return encodeURI(getSelection(e).replaceAll("?", "%3F"));
}

export function createDefaultMenu(e) {
  const menu = new nw.Menu();

  menu.append(
    new nw.MenuItem({
      label: "Open in Google Translate...",
      click: () => {
        console.log("Opening GTranslate...");
        nw.Shell.openExternal(
          `https://translate.google.com/?sl=auto&tl=en&text=${getSelectionURL(e)}&op=translate`,
        );
      },
      key: "g",
    }),
  );
  menu.append(
    new nw.MenuItem({
      label: "Search with Wiktionary...",
      click: () => {
        nw.Shell.openExternal(
          `https://en.wiktionary.org/wiki/${getSelectionURL(e)}`,
        );
      },
      key: "i",
    }),
  );
  menu.append(
    new nw.MenuItem({
      label: "Search on web...",
      click: () => {
        nw.Shell.openExternal(
          `https://duckduckgo.com/?q=${getSelectionURL(e)}`,
        );
      },
      key: "w",
    }),
  );

  return menu;
}

export function createChineseMenu(e) {
  const menu = createDefaultMenu(e);

  const pinyinArray = pinyin(getSelection(e), {
    segment: true,
    group: true,
  });
  const pinyinText = pinyinArray.map((arr) => arr[0]).join(" ");

  menu.insert(
    new nw.MenuItem({
      label: pinyinText,
      enabled: false,
    }),
    0,
  );
  menu.insert(new nw.MenuItem({ type: "separator" }), 1);
  menu.append(
    new nw.MenuItem({
      label: "Search with ZH Wikipedia...",
      click: () => {
        nw.Shell.openExternal(
          `https://zh.wikipedia.org/w/index.php?search=${getSelectionURL(e)}`,
        );
      },
      key: "k",
    }),
  );

  return menu;
}

export async function createJapaneseMenu(e) {
  const menu = createDefaultMenu(e);

  await kuroshiroReady;
  const romajiText = await kuroshiro.convert(getSelection(e), {
    to: "romaji",
    mode: "spaced",
  });

  menu.insert(
    new nw.MenuItem({
      label: romajiText,
      enabled: false,
    }),
    0,
  );
  menu.insert(new nw.MenuItem({ type: "separator" }), 1);
  menu.append(
    new nw.MenuItem({
      label: "Open in Jisho...",
      click: () => {
        nw.Shell.openExternal(`https://jisho.org/search/${getSelectionURL(e)}`);
      },
      key: "j",
    }),
  );
  menu.append(
    new nw.MenuItem({
      label: "Search with JP Wikipedia...",
      click: () => {
        nw.Shell.openExternal(
          `https://ja.wikipedia.org/w/index.php?search=${getSelectionURL(e)}`,
        );
      },
      key: "k",
    }),
  );

  return menu;
}
