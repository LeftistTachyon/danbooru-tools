// reused constants
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

/**
 * Checks if login credentials are stored
 * @returns true if login credentials are stored, false otherwise
 */
export function hasLogin() {
  return (
    localStorage.getItem("api.danbooru.username") &&
    localStorage.getItem("api.danbooru.key")
  );
}

/**
 * Attempts to log in with the saved username & key
 * @returns the logged in user's profile JSON, or null if not logged in
 */
export async function fetchProfile() {
  const profileResponse = await fetch(`${domain}/profile.json`, {
    method: "GET",
    headers,
  });
  if (!profileResponse.ok || profileResponse.status === 401) {
    return null;
  }

  return await profileResponse.json();
}

/**
 * Fetches a list of posts matching the given tag string.
 * @param {string} tagString The tag string to search for.
 * @param {number} postLimit The maximum number of posts to return.
 * @returns An object containing the response status, error message (if thrown), and fetched posts.
 */
export async function fetchPosts(tagString, postLimit = 100) {
  const postsResponse = await fetch(
    `${domain}/posts.json?tags=${encodeURIComponent(tagString)}&limit=${postLimit}&only=id,artist_commentary,tag_string_meta`,
    { headers }
  );
  const posts = await postsResponse.json();
  return {
    ok: postsResponse.ok,
    message: postsResponse.ok ? null : posts.message,
    posts,
  };
}

/**
 * Updates the given artist commentary with any given partial information
 * @param {Partial<artist_commentary>} artist_commentary any fields of the artist commentary to be updated
 * @returns an error message if an error was thrown, or null on success
 */
export async function updateArtistCommentary(artist_commentary) {
  const resp = await fetch(
    `${domain}/artist_commentaries/create_or_update.json`,
    {
      method: "PUT",
      headers,
      body: JSON.stringify({ artist_commentary }),
    }
  );

  return resp.ok ? null : await resp.json();
}
