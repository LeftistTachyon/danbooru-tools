const { pinyin } = require("pinyin");
const Kuroshiro = require("kuroshiro");
const KuromojiAnalyzer = require("kuroshiro-analyzer-kuromoji");

const kuroshiro = new Kuroshiro.default();
const kuroshiroReady = kuroshiro.init(new KuromojiAnalyzer());

export function createDefaultMenu() {
  const menu = new nw.Menu();

  menu.append(
    new nw.MenuItem({
      label: "Open in Google Translate...",
      click: () => {
        console.log("Opening GTranslate...");
        nw.Shell.openExternal(
          `https://translate.google.com/?sl=auto&tl=en&text=${encodeURI(document.getSelection().toString())}&op=translate`
        );
      },
      key: "g",
    })
  );
  menu.append(
    new nw.MenuItem({
      label: "Search with Wiktionary...",
      click: () => {
        nw.Shell.openExternal(
          `https://en.wiktionary.org/wiki/${encodeURI(document.getSelection().toString())}`
        );
      },
      key: "i",
    })
  );
  menu.append(
    new nw.MenuItem({
      label: "Search on web...",
      click: () => {
        nw.Shell.openExternal(
          `https://duckduckgo.com/?q=${encodeURI(document.getSelection().toString())}`
        );
      },
      key: "w",
    })
  );

  return menu;
}

export function createChineseMenu() {
  const menu = createDefaultMenu();

  const pinyinArray = pinyin(document.getSelection().toString(), {
    segment: true,
    group: true,
  });
  const pinyinText = pinyinArray.map((arr) => arr[0]).join(" ");

  menu.insert(
    new nw.MenuItem({
      label: pinyinText,
      enabled: false,
    }),
    0
  );
  menu.insert(new nw.MenuItem({ type: "separator" }), 1);
  menu.append(
    new nw.MenuItem({
      label: "Search with ZH Wikipedia...",
      click: () => {
        nw.Shell.openExternal(
          `https://zh.wikipedia.org/w/index.php?search=${encodeURI(document.getSelection().toString())}`
        );
      },
      key: "k",
    })
  );

  return menu;
}

export async function createJapaneseMenu() {
  const menu = createDefaultMenu();

  await kuroshiroReady;
  const romajiText = await kuroshiro.convert(
    document.getSelection().toString(),
    {
      to: "romaji",
      mode: "spaced",
    }
  );

  menu.insert(
    new nw.MenuItem({
      label: romajiText,
      enabled: false,
    }),
    0
  );
  menu.insert(new nw.MenuItem({ type: "separator" }), 1);
  menu.append(
    new nw.MenuItem({
      label: "Open in Jisho...",
      click: () => {
        nw.Shell.openExternal(
          `https://jisho.org/search/${encodeURI(document.getSelection().toString())}`
        );
      },
      key: "j",
    })
  );
  menu.append(
    new nw.MenuItem({
      label: "Search with JP Wikipedia...",
      click: () => {
        nw.Shell.openExternal(
          `https://ja.wikipedia.org/w/index.php?search=${encodeURI(document.getSelection().toString())}`
        );
      },
      key: "k",
    })
  );

  return menu;
}
