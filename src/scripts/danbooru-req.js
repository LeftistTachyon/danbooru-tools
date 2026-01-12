const deepl = require("deepl-node");

// initialize reused variables
const domain =
  "https://" + (localStorage.getItem("general.domain") || "danbooru.donmai.us");
const deeplClient = (() => {
  const deeplKey = localStorage.getItem("api.deepl");
  return deeplKey ? new deepl.Translator(deeplKey) : null;
})();
let postList,
  fetchedNum = 0,
  currIdx = 0,
  translatedRecord = {};

async function attemptLoad() {
  // check for login details
  const username = localStorage.getItem("api.danbooru.username");
  const apiKey = localStorage.getItem("api.danbooru.key");
  if (!username || !apiKey) {
    return "noLogin";
  }

  // test api
  const profileResponse = await fetch(
    `${domain}/profile.json?login=${username}&api_key=${apiKey}`
  );
  if (!profileResponse.ok || profileResponse.status === 401) {
    return "badLogin";
  }

  // const result = await profileResponse.json();
  // console.log("Logged in as:", result);
  return "success";
}

async function updateView() {
  // unfocus active element
  document.activeElement.blur();

  // update counters & buttons
  const postCounter = document.getElementById("post-counter");
  postCounter.textContent = `${currIdx + 1} / ${postList.length} (${fetchedNum})`;
  document.getElementById("prev-post").disabled = currIdx <= 0;
  document.getElementById("next-post").disabled =
    currIdx >= postList.length - 1;

  // pull in commentary data
  const post = postList[currIdx];
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

  // perform deepl translation
  if (deeplClient) {
    if (post.artist_commentary.original_title) {
      if (post.post.artist_commentary.original_description) {
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
      } else {
        const translated = await deeplClient.translateText(
          post.artist_commentary.original_title,
          null,
          "en-US"
        );
        document.getElementById("deepl-title").value = translated.text || "";
        document.getElementById("deepl-description").value = "";
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
    }
  } else {
    document.getElementById("deepl-title").value = "<no Deepl API key set>";
    document.getElementById("deepl-description").value =
      "<set one in settings>";
  }
}

async function submitTranslation() {
  // build request
  const body = {
    post_id: postList[currIdx].id,
    translated_title: document.getElementById("translated-title").value,
    translated_description: document.getElementById("translated-description")
      .value,
  };

  // handle tags
  if (document.getElementById("commentary").checked) {
    body.add_commentary_tag = true;
  } else {
    body.remove_commentary_tag = true;
  }
  if (document.getElementById("commentary_request").checked) {
    body.add_commentary_request_tag = true;
  } else {
    body.remove_commentary_request_tag = true;
  }
  if (document.getElementById("commentary_check").checked) {
    body.add_commentary_check_tag = true;
  } else {
    body.remove_commentary_check_tag = true;
  }
  if (document.getElementById("partial_commentary").checked) {
    body.add_partial_commentary_tag = true;
  } else {
    body.remove_partial_commentary_tag = true;
  }

  // send request
  const requestOptions = {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
  const resp = await fetch(
    `${domain}/artist_commentaries/create_or_update.json`,
    requestOptions
  );

  if (!resp.ok) {
    errorMsg.style.display = "block";
    errorMsg.textContent = `Failed to submit translation (${resp.status}). Please try again.`;
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  // load credentials and test
  const result = await attemptLoad();
  const errorMsg = document.getElementById("errorMsg");

  // display any errors
  switch (result) {
    case "noLogin":
      errorMsg.style.display = "block";
      errorMsg.textContent =
        "Your Danbooru login details are not set. Please go to the settings tab to set them.";
      break;
    case "badLogin":
      errorMsg.style.display = "block";
      errorMsg.textContent =
        "Your Danbooru login details are incorrect. Please go to the settings tab to fix them.";
      break;
    default:
      errorMsg.style.display = "block";
      errorMsg.textContent = "lol. lmao, even";
      break; // do nothing
  }

  // attach form listeners
  // console.log("Attaching form listeners...");
  document
    .getElementById("get-posts-form")
    .addEventListener("submit", async (e) => {
      e.preventDefault();
      // console.log("Fetching posts...");

      // get form values
      const tagString =
        document.getElementById("tag-string").value + " -commentary:translated";
      const postLimit = document.getElementById("post-limit").value;
      const includePartial = document.getElementById("include-partial").checked;

      // fetch posts
      const postsResponse = await fetch(
        `${domain}/posts.json?tags=${encodeURIComponent(tagString)}&limit=${postLimit}&only=id,artist_commentary`
      );
      if (!postsResponse.ok) {
        errorMsg.style.display = "block";
        errorMsg.textContent =
          "Failed to fetch posts. Please check your tag string and try again.";
        return;
      }

      // filter posts
      const posts = await postsResponse.json();
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

  // attach navigation listeners
  document.addEventListener("keypress", (e) => {
    if (e.key === "Enter" && e.ctrlKey === true) {
      submitTranslation();
      return;
    }
    if (e.target !== document.body) return; // ignore if focused on inputs
    if (e.key === "a") {
      console.log("Prev post");
    } else if (e.key === "d") {
      console.log("Next post");
    }
  });
});
