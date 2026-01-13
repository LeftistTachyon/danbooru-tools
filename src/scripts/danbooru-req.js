// initialize reused variables
const domain =
  "https://" + (localStorage.getItem("general.domain") || "danbooru.donmai.us");
const headers = new Headers({
  Authorization:
    "Basic " +
    btoa(
      localStorage.getItem("api.danbooru.username") +
        ":" +
        localStorage.getItem("api.danbooru.key")
    ),
  "Content-Type": "application/json",
});
let deeplClient = undefined; // initialize later if api key set
let postList = [],
  fetchedNum = 0,
  currIdx = 0,
  translationDict = {};

// for showing error messages below search box
function showError(message) {
  document.getElementById("infoMsg").style.display = "none";

  const errorMsg = document.getElementById("errorMsg");
  errorMsg.style.display = "block";
  errorMsg.textContent = message;
}
// for showing info messages below search box
function showInfo(message) {
  document.getElementById("errorMsg").style.display = "none";

  const infoMsg = document.getElementById("infoMsg");
  infoMsg.style.display = "block";
  infoMsg.textContent = message;
}

async function attemptLoad() {
  // check for login details
  if (
    !localStorage.getItem("api.danbooru.username") ||
    !localStorage.getItem("api.danbooru.key")
  ) {
    return "noLogin";
  }

  try {
    // test api
    const profileResponse = await fetch(`${domain}/profile.json`, {
      method: "GET",
      headers,
    });
    if (!profileResponse.ok || profileResponse.status === 401) {
      return "badLogin";
    }

    const result = await profileResponse.json();
    console.log("Logged in as:", result.name);
    return result.name === localStorage.getItem("api.danbooru.username")
      ? "success"
      : "badLogin";
  } catch (err) {
    return "badLogin";
  }
}

async function updateView() {
  // unfocus active element
  document.activeElement.blur();

  // update counters & buttons
  const postCounter = document.getElementById("post-counter");
  postCounter.textContent = `${currIdx + 1} / ${postList.length} (${fetchedNum})`;
  document.getElementById("first-post").disabled = currIdx <= 0;
  document.getElementById("prev-post").disabled = currIdx <= 0;
  document.getElementById("next-post").disabled =
    currIdx >= postList.length - 1;
  document.getElementById("last-post").disabled =
    currIdx >= postList.length - 1;

  // pull in commentary data
  const post = postList[currIdx];
  if (!post) return;
  document.getElementById("original-title").value =
    post.artist_commentary.original_title || "";
  document.getElementById("original-description").value =
    post.artist_commentary.original_description || "";
  document.getElementById("translated-title").value =
    post.artist_commentary.translated_title || "";
  document.getElementById("translated-description").value =
    post.artist_commentary.translated_description || "";
  document.getElementById("deepl-title").value = "Translating...";
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
  if (deeplClient) {
    if (post.artist_commentary.original_title) {
      if (post.artist_commentary.original_description) {
        const translated = await deeplClient.translateText(
          [
            post.artist_commentary.original_title,
            post.artist_commentary.original_description,
          ],
          null,
          "en-US"
        );

        document.getElementById("deepl-title").value = translated[0].text || "";
        document.getElementById("deepl-description").value =
          translated[1].text || "";
        post.detectedLang = translated[1].detectedSourceLang;
      } else {
        const translated = await deeplClient.translateText(
          post.artist_commentary.original_title,
          null,
          "en-US"
        );
        document.getElementById("deepl-title").value = translated.text || "";
        document.getElementById("deepl-description").value = "";
        post.detectedLang = translated.detectedSourceLang;
      }
    } else {
      // assume only description populated
      const translated = await deeplClient.translateText(
        post.artist_commentary.original_description,
        null,
        "en-US"
      );
      document.getElementById("deepl-title").value = "";
      document.getElementById("deepl-description").value =
        translated.text || "";
      post.detectedLang = translated.detectedSourceLang;
    }
  } else {
    document.getElementById("deepl-title").value = "<no Deepl API key set>";
    document.getElementById("deepl-description").value =
      "<set one in settings>";
  }
}

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
  const requestOptions = {
    method: "PUT",
    headers,
    body: JSON.stringify({ artist_commentary }),
  };
  const resp = await fetch(
    `${domain}/artist_commentaries/create_or_update.json`,
    requestOptions
  );

  if (!resp.ok) {
    const json = await resp.json();
    showError(
      `Failed to submit translation (${resp.status}). ${json.message || "Please try again."}`
    );
  } else {
    showInfo("Translation submitted successfully!");
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  // attach form listeners
  // console.log("Attaching form listeners...");
  document
    .getElementById("get-posts-form")
    .addEventListener("submit", async (e) => {
      e.preventDefault();
      // console.log("Fetching posts...");

      // get form values
      const tagString =
        document.getElementById("tag-string").value + " -commentary";
      const postLimit = document.getElementById("post-limit").value;
      const includePartial = document.getElementById("include-partial").checked;

      // fetch posts
      const postsResponse = await fetch(
        `${domain}/posts.json?tags=${encodeURIComponent(tagString)}&limit=${postLimit}&only=id,artist_commentary,tag_string_meta`,
        { headers }
      );
      const posts = await postsResponse.json();
      if (!postsResponse.ok) {
        showError(
          "Failed to fetch posts. " +
            (posts.message || "Please check your tag string and try again.") +
            `(${postsResponse.status})`
        );
        return;
      }
      console.log("Sample post:", posts[0]);

      // filter posts
      fetchedNum = posts.length;
      postList = posts.filter(
        (post) =>
          post.artist_commentary &&
          (includePartial ||
            (!post.artist_commentary.translated_title &&
              !post.artist_commentary.translated_description))
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
    if (e.key === "\n" && e.ctrlKey === true) {
      console.log("Submit translation");
      submitTranslation();
      return;
    }

    if (e.target !== document.body) return; // ignore if focused on inputs
    console.log("Key pressed:", e.key, e.ctrlKey, e.shiftKey, e.metaKey);

    switch (e.key) {
      case "a":
        if (confirmUnsaved()) {
          console.log("Prev post");
          currIdx = Math.max(0, currIdx - 1);
          updateView();
        }
        break;
      case "A":
        if (confirmUnsaved()) {
          console.log("First post");
          currIdx = 0;
          updateView();
        }
        break;
      case "d":
        if (confirmUnsaved()) {
          console.log("Next post");
          currIdx = Math.min(postList.length - 1, currIdx + 1);
          updateView();
        }
        break;
      case "D":
        if (confirmUnsaved()) {
          console.log("Last post");
          currIdx = postList.length - 1;
          updateView();
        }
        break;
      case "\u{0004}":
        // Ctrl-D
        // special next unique logic
        break;
      case "\u{000F}":
        // Ctrl-O
        console.log("Open in browser");
        nw.Shell.openExternal(`${domain}/posts/${postList[currIdx].id}`);
        break;
      case "\u{0005}":
        // Ctrl-E
        console.log("Overwrite previous translation");
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
    default:
      break; // do nothing
  }

  // finally, load deepl client
  const deepl = require("deepl-node");
  const deeplKey = localStorage.getItem("api.deepl");
  deeplClient = deeplKey ? new deepl.Translator(deeplKey) : null;
});
