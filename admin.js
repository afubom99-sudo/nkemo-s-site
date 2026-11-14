const notice = document.querySelector("#admin-notice");
const loginCard = document.querySelector("#login-card");
const uploadCard = document.querySelector("#upload-card");
const uploadedSection = document.querySelector("#uploaded-section");
const uploadedGrid = document.querySelector("#uploaded-grid");
const loginForm = document.querySelector("#login-form");
const uploadForm = document.querySelector("#upload-form");
const logoutButton = document.querySelector("#logout-button");

function showNotice(message, isError = false) {
  notice.textContent = message;
  notice.classList.toggle("is-error", isError);
  notice.hidden = !message;
}

async function requestJson(url, options) {
  const response = await fetch(url, {
    credentials: "same-origin",
    ...options,
  });
  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error("The server returned an invalid response. Please try again.");
  }

  if (!response.ok) {
    throw new Error(result.error || "Something went wrong. Please try again.");
  }

  return result;
}

function renderUploadedImages(images) {
  uploadedGrid.replaceChildren();
  uploadedSection.hidden = images.length === 0;

  for (const image of images) {
    const card = document.createElement("article");
    card.className = "uploaded-card";

    const preview = document.createElement("img");
    preview.src = image.url;
    preview.alt = image.title;
    preview.loading = "lazy";
    preview.decoding = "async";

    const title = document.createElement("p");
    title.textContent = image.title;

    card.append(preview, title);
    uploadedGrid.append(card);
  }
}

async function loadUploadedImages() {
  const result = await requestJson("/api/images");
  renderUploadedImages(result.images);
}

function setSignedIn(isSignedIn) {
  loginCard.hidden = isSignedIn;
  uploadCard.hidden = !isSignedIn;
}

async function checkSession() {
  if (location.protocol === "file:") {
    setSignedIn(false);
    showNotice("Photo uploads need the Vercel setup described in ADMIN-SETUP.md.", true);
    return;
  }

  try {
    const result = await requestJson("/api/session");
    setSignedIn(result.authenticated);
    if (result.authenticated) await loadUploadedImages();
  } catch (error) {
    setSignedIn(false);
    showNotice(error.message, true);
  }
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = loginForm.querySelector("button");
  button.disabled = true;
  showNotice("Signing in...");

  try {
    const password = new FormData(loginForm).get("password");
    await requestJson("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    loginForm.reset();
    showNotice("");
    setSignedIn(true);
    await loadUploadedImages();
  } catch (error) {
    showNotice(error.message, true);
  } finally {
    button.disabled = false;
  }
});

uploadForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const fileInput = uploadForm.elements.image;
  const file = fileInput.files[0];
  if (!file) {
    showNotice("Choose a photo before uploading.", true);
    return;
  }

  if (file.size > 4 * 1024 * 1024) {
    showNotice("That photo is too large. Choose an image under 4 MB.", true);
    return;
  }

  const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
  if (!allowedTypes.includes(file.type)) {
    showNotice("Choose a JPG, PNG, or WebP image.", true);
    return;
  }

  const button = uploadForm.querySelector('button[type="submit"]');
  button.disabled = true;
  showNotice("Uploading your photo...");

  const enteredTitle = new FormData(uploadForm).get("title").trim();
  const title = enteredTitle || file.name.replace(/\.[^.]+$/, "");

  try {
    await requestJson("/api/upload", {
      method: "POST",
      headers: {
        "Content-Type": file.type,
        "X-Image-Title": encodeURIComponent(title),
      },
      body: file,
    });
    uploadForm.reset();
    showNotice("Photo uploaded and added to your website.");
    await loadUploadedImages();
  } catch (error) {
    showNotice(error.message, true);
  } finally {
    button.disabled = false;
  }
});

logoutButton.addEventListener("click", async () => {
  logoutButton.disabled = true;
  try {
    await requestJson("/api/logout", { method: "POST" });
    setSignedIn(false);
    renderUploadedImages([]);
    showNotice("You have signed out.");
  } catch (error) {
    showNotice(error.message, true);
  } finally {
    logoutButton.disabled = false;
  }
});

checkSession();
