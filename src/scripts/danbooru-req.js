// initialize reused variables
const domain =
  "https://" + (localStorage.getItem("general.domain") || "danbooru.donmai.us");

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

  const result = await profileResponse.json();
  console.log("Logged in as:", result);
  return "success";
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
  console.log("Attaching form listeners...");
  document
    .getElementById("get-posts-form")
    .addEventListener("submit", async (e) => {
      e.preventDefault();
      console.log("Fetching posts...");

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

      const posts = await postsResponse.json();
      console.log(posts[0]);
    });
});
