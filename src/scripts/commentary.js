import {
  domain,
  fetchPosts,
  fetchProfile,
  hasLogin,
  updateArtistCommentary,
} from "./danbooru.js";
import { instantiated, translate } from "./deepl.js";
import {
  createChineseMenu,
  createDefaultMenu,
  createJapaneseMenu,
} from "./translating-contextmenu.js";

// initialize reused variables
let postList = [],
  fetchedNum = 0,
  currIdx = 0,
  translationDict = {};

/**
 * Displays an error message below the search box.
 * @param {string} message the error message to display
 */
function showError(message) {
  document.getElementById("infoMsg").style.display = "none";

  const errorMsg = document.getElementById("errorMsg");
  errorMsg.style.display = "block";
  errorMsg.textContent = message;
}
/**
 * Displays an info message below the search box.
 * @param {string} message the message to display
 */
function showInfo(message) {
  document.getElementById("errorMsg").style.display = "none";

  const infoMsg = document.getElementById("infoMsg");
  infoMsg.style.display = "block";
  infoMsg.textContent = message;
}

/**
 * Attempts to log into Danbooru with saved credentials.
 *
 * @returns whether the operation was successful or not with various codes
 */
async function attemptLoad() {
  // check for login details
  if (!hasLogin()) {
    return "noLogin";
  }

  try {
    // test api
    const result = await fetchProfile();
    console.log("Logged in as:", result.name);
    return result &&
      result.name === localStorage.getItem("api.danbooru.username")
      ? "success"
      : "badLogin";
  } catch (err) {
    return "badLogin";
  }
}

/**
 * Updates the view with the current post's data.
 * @returns nothing
 */
function updateView() {
  // unfocus active element
  document.activeElement.blur();

  // update counters & buttons
  const postCounter = document.getElementById("post-counter");
  postCounter.textContent = `${currIdx + 1} / ${postList.length} (${fetchedNum})`;
  document.getElementById("first-post").disabled = document.getElementById(
    "prev-post"
  ).disabled = currIdx <= 0;
  document.getElementById("next-post").disabled =
    document.getElementById("next-unique-post").disabled =
    document.getElementById("last-post").disabled =
      currIdx >= postList.length - 1;

  // note if title and desc are changing
  const post = postList[currIdx];
  const identicalTitle =
      document
        .getElementById("original-title")
        .value.replaceAll("\r\n", "\n") === // dang windows
      post.artist_commentary.original_title.replaceAll("\r\n", "\n"),
    identicalDesc =
      document
        .getElementById("original-description")
        .value.replaceAll("\r\n", "\n") === // why do you have to replace /n with /r/n
      post.artist_commentary.original_description.replaceAll("\r\n", "\n");
  // function findFirstDiffPos(a, b) {
  //   // console.log(a, "vs", b, a.localeCompare(b, "ja"));
  //   var i = 0;
  //   if (a === b) return -1;
  //   while (a[i] === b[i]) i++;
  //   console.log(`@${i}:`, a[i], "vs", b[i]);
  //   console.log(a.codePointAt(i), "vs", b.codePointAt(i));
  // }
  // if (!identicalDesc) {
  //   findFirstDiffPos(
  //     document.getElementById("original-description").value,
  //     post.artist_commentary.original_description
  //   );
  // }

  // pull in commentary data
  if (!post) return;
  document.getElementById("original-title").value =
    post.artist_commentary.original_title || "";
  document.getElementById("original-description").value =
    post.artist_commentary.original_description || "";
  document.getElementById("translated-title").value =
    post.artist_commentary.translated_title || "";
  document.getElementById("translated-description").value =
    post.artist_commentary.translated_description || "";
  if (!identicalTitle)
    document.getElementById("deepl-title").value = "Translating...";
  if (!identicalDesc)
    document.getElementById("deepl-description").value = "Translating...";

  // pull in tag data
  document.getElementById("commentary").checked = /[^_]commentary[^_]/g.test(
    post.tag_string_meta
  );
  document.getElementById("commentary_request").checked =
    post.tag_string_meta.includes("commentary_request");
  document.getElementById("commentary_check").checked =
    post.tag_string_meta.includes("commentary_check");
  document.getElementById("partial_commentary").checked =
    post.tag_string_meta.includes("partial_commentary");

  // perform deepl translation
  if (instantiated()) {
    if (
      !identicalTitle &&
      !identicalDesc &&
      post.artist_commentary.original_title &&
      post.artist_commentary.original_description
    ) {
      // double translate, should reduce lag & look better
      (async () => {
        // translate
        const translated = await translate([
          post.artist_commentary.original_title,
          post.artist_commentary.original_description,
        ]);
        document.getElementById("deepl-title").value = translated[0].text || "";
        document.getElementById("deepl-description").value =
          translated[1].text || "";
        post.detectedLang = translated[1].detectedSourceLang;
      })();
    } else {
      // translate one-by-one
      (async () => {
        if (identicalTitle) return; // don't retranslate
        if (post.artist_commentary.original_title) {
          // translate
          const translated = await translate(
            post.artist_commentary.original_title
          );
          document.getElementById("deepl-title").value = translated.text || "";
          if (!post.artist_commentary.original_description)
            post.detectedLang = translated.detectedSourceLang;
        } else {
          document.getElementById("deepl-title").value = "";
        }
      })();
      (async () => {
        if (identicalDesc) return; // don't retranslate
        if (post.artist_commentary.original_description) {
          // translate
          const translated = await translate(
            post.artist_commentary.original_description
          );
          document.getElementById("deepl-description").value =
            translated.text || "";
          post.detectedLang = translated.detectedSourceLang;
        } else {
          document.getElementById("deepl-description").value = "";
        }
      })();
    }
  } else {
    document.getElementById("deepl-title").value = "<no Deepl API key set>";
    document.getElementById("deepl-description").value =
      "<set one in settings>";
  }
}

/**
 * Checks whether unsaved changes are present and confirms with
 * the user that they want to move away from this page despite it
 * having unsaved changes.
 *
 * @returns whether the user consents to the action
 */
function confirmUnsaved() {
  const currPost = postList[currIdx];
  return (
    (currPost &&
      document.getElementById("translated-title").value ===
        currPost.artist_commentary.translated_title &&
      document.getElementById("translated-description").value ===
        currPost.artist_commentary.translated_description) ||
    confirm("You have unsubmitted changes. Continue?")
  );
}

/**
 * Submits a translation of an artist commentary to Danbooru.
 *
 * @param {string} translated_title the translated title to
 * submit (optional, will override textbox value if given)
 * @param {string} translated_description the translated
 * description to submit (optional, will override textarea
 * value if given)
 * @returns whether the submission was successful
 */
async function submitTranslation(
  translated_title = undefined,
  translated_description = undefined
) {
  // set default values
  if (translated_title === undefined)
    translated_title = document.getElementById("translated-title").value;
  if (translated_description === undefined)
    translated_description = document.getElementById(
      "translated-description"
    ).value;

  // save translation to memory
  const currPost = postList[currIdx];
  if (translated_title && currPost.artist_commentary.original_title)
    currPost.artist_commentary.translated_title = translationDict[
      currPost.artist_commentary.original_title
    ] = translated_title;
  if (translated_description && currPost.artist_commentary.original_description)
    currPost.artist_commentary.translated_description = translationDict[
      currPost.artist_commentary.original_description
    ] = translated_description;
  // console.log("translation dictionary:", translationDict);

  // build request
  const artist_commentary = {
    post_id: currPost.id,
  };
  if (translated_title) artist_commentary.translated_title = translated_title;
  if (translated_description)
    artist_commentary.translated_description = translated_description;

  // handle tags
  if (document.getElementById("commentary").checked) {
    artist_commentary.add_commentary_tag = true;
  } else {
    artist_commentary.remove_commentary_tag = true;
  }
  if (document.getElementById("commentary_request").checked) {
    artist_commentary.add_commentary_request_tag = true;
  } else {
    artist_commentary.remove_commentary_request_tag = true;
  }
  if (document.getElementById("commentary_check").checked) {
    artist_commentary.add_commentary_check_tag = true;
  } else {
    artist_commentary.remove_commentary_check_tag = true;
  }
  if (document.getElementById("partial_commentary").checked) {
    artist_commentary.add_partial_commentary_tag = true;
  } else {
    artist_commentary.remove_partial_commentary_tag = true;
  }
  // console.log("Submitting translation for post", currPost.id, body);

  // send request
  const resp = await updateArtistCommentary(artist_commentary);

  if (resp) {
    showError(
      `Failed to submit translation for post #${currPost.id}. ${resp.message || "Please try again."}`
    );
    return false;
  } else {
    showInfo(`Successfully submitted translation for post #${currPost.id}.`);
    return true;
  }
}

/**
 * Skips to the next post with untranslated commentary.
 * Submits any pretranslated commentaries between the currently
 * shown and the next unique one.
 */
async function goToNextUnique() {
  for (currIdx++; currIdx < postList.length; currIdx++) {
    const currPost = postList[currIdx];
    if (
      (currPost.artist_commentary.original_title &&
        !translationDict[currPost.artist_commentary.original_title]) ||
      (currPost.artist_commentary.original_description &&
        !translationDict[currPost.artist_commentary.original_description])
    ) {
      // not translated yet, show to user
      break;
    }

    if (
      !(await submitTranslation(
        translationDict[currPost.artist_commentary.original_title],
        translationDict[currPost.artist_commentary.original_description]
      ))
    ) {
      // submission failed, stop here
      break;
    }
  }

  // done looping, update view
  showInfo(
    currIdx === postList.length
      ? "No more unique commentaries."
      : `Next unique commentary: post #${postList[currIdx].id}.`
  );
  currIdx = Math.min(postList.length - 1, currIdx); // avoid overflows
  await updateView();
}

// literally load everything
// console.log("Commentary tool script loaded.");
document.addEventListener("DOMContentLoaded", async () => {
  // attach form listeners
  // console.log("Attaching form listeners...");
  document
    .getElementById("get-posts-form")
    .addEventListener("submit", async (e) => {
      e.preventDefault();
      // console.log("Fetching posts...");
      showInfo("Fetching posts...");

      // get form values
      const tagString =
        document.getElementById("tag-string").value + " -commentary";
      const postLimit = document.getElementById("post-limit").value;
      const includePartial = document.getElementById("include-partial").checked;

      // fetch posts
      const { ok, message, posts } = await fetchPosts(tagString, postLimit);
      if (!ok) {
        showError(
          "Failed to fetch posts. " +
            (message || "Please check your tag string and try again.")
        );
        return;
      }
      // console.log("Sample post:", posts[0]);

      // filter posts
      fetchedNum = posts.length;
      postList = posts.filter(
        (post) =>
          post.artist_commentary &&
          post.artist_commentary.original_description.trim().length > 0 &&
          post.artist_commentary.original_description.trim().length > 0 &&
          (includePartial ||
            (!post.artist_commentary.translated_title &&
              !post.artist_commentary.translated_description))
      );
      showInfo(
        `Fetched ${fetchedNum} posts, ${postList.length} matched the filter criteria.`
      );

      // reset index and update view
      currIdx = 0;
      updateView();
      // console.log(postList.map((post) => post.id));

      return false;
    });

  // attach field copy button listeners
  document.getElementById("title-copier").addEventListener("click", () => {
    document.getElementById("translated-title").value =
      document.getElementById("deepl-title").value;
  });
  document
    .getElementById("description-copier")
    .addEventListener("click", () => {
      document.getElementById("translated-description").value =
        document.getElementById("deepl-description").value;
    });

  // attach bottom bar button & key listeners
  // [<<] (go to first)
  document.getElementById("first-post").addEventListener("click", () => {
    if (confirmUnsaved()) {
      currIdx = 0;
      updateView();
    }
  });
  // [<] (go to previous)
  document.getElementById("prev-post").addEventListener("click", () => {
    if (confirmUnsaved()) {
      currIdx = Math.max(0, currIdx - 1);
      updateView();
    }
  });
  // [>] (go to next)
  document.getElementById("next-post").addEventListener("click", () => {
    if (confirmUnsaved()) {
      currIdx = Math.min(postList.length - 1, currIdx + 1);
      updateView();
    }
  });
  // [|>] (go to next unique)
  document.getElementById("next-unique-post").addEventListener("click", () => {
    if (confirmUnsaved()) {
      goToNextUnique();
    }
  });
  // [>>] (go to last)
  document.getElementById("last-post").addEventListener("click", () => {
    if (confirmUnsaved()) {
      currIdx = postList.length - 1;
      updateView();
    }
  });
  // [Open in browser]
  document.getElementById("open-btn").addEventListener("click", () => {
    if (postList[currIdx])
      nw.Shell.openExternal(`${domain}/posts/${postList[currIdx].id}`);
  });
  // [Overwrite previous translation]
  document.getElementById("overwrite-btn").addEventListener("click", () => {
    if (
      postList[currIdx] &&
      confirm(
        "Are you sure you want to overwrite the current translation with a saved version?"
      )
    ) {
      document.getElementById("translated-title").value =
        translationDict[postList[currIdx].id]?.title || "";
      document.getElementById("translated-description").value =
        translationDict[postList[currIdx].id]?.description || "";
    }
  });
  // [Submit]
  document
    .getElementById("submit-btn")
    .addEventListener("click", () => submitTranslation());

  // key listeners
  document.addEventListener("keypress", (e) => {
    // Ctrl+Enter to submit
    if (e.key === "\n" && e.ctrlKey === true) {
      // console.log("Submit translation");
      submitTranslation();
      return;
    }

    if (e.target !== document.body) return; // ignore if focused on inputs
    // console.log("Key pressed:", e.key, e.ctrlKey, e.shiftKey, e.metaKey);

    switch (e.key) {
      case "a":
        if (confirmUnsaved()) {
          // console.log("Prev post");
          currIdx = Math.max(0, currIdx - 1);
          updateView();
        }
        break;
      case "A":
        if (confirmUnsaved()) {
          // console.log("First post");
          currIdx = 0;
          updateView();
        }
        break;
      case "d":
        if (confirmUnsaved()) {
          // console.log("Next post");
          currIdx = Math.min(postList.length - 1, currIdx + 1);
          updateView();
        }
        break;
      case "D":
        if (confirmUnsaved()) {
          // console.log("Last post");
          currIdx = postList.length - 1;
          updateView();
        }
        break;
      case "\u{0004}":
        // Ctrl-D
        // special next unique logic
        if (confirmUnsaved()) {
          goToNextUnique();
        }
        break;
      case "\u{000F}":
        // Ctrl-O
        // console.log("Open in browser");
        nw.Shell.openExternal(`${domain}/posts/${postList[currIdx].id}`);
        break;
      case "\u{0005}":
        // Ctrl-E
        // console.log("Overwrite previous translation");
        if (
          confirm(
            "Are you sure you want to overwrite the current translation with a saved version?"
          )
        ) {
          document.getElementById("translated-title").value =
            translationDict[postList[currIdx].id]?.title || "";
          document.getElementById("translated-description").value =
            translationDict[postList[currIdx].id]?.description || "";
        }
        break;
    }
  });

  // contextmenu listeners
  async function contextmenuListener(e) {
    e.preventDefault();
    console.log(
      postList[currIdx].detectedLang,
      document.getSelection().toString()
    );

    switch (postList[currIdx].detectedLang) {
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
  }
  document
    .getElementById("original-title")
    .addEventListener("contextmenu", contextmenuListener);
  document
    .getElementById("original-description")
    .addEventListener("contextmenu", contextmenuListener);

  // load credentials and test
  const result = await attemptLoad();
  // display any errors
  switch (result) {
    case "noLogin":
      showError(
        "Your Danbooru login details are not set. Please go to the settings tab to set them."
      );
      break;
    case "badLogin":
      showError(
        "Your Danbooru login details are incorrect. Please go to the settings tab to fix them."
      );
      break;
    case "success":
      break; // do nothing
  }
});
