const productGrid = document.querySelector(".product-grid");

function createUploadedProduct(image) {
  const card = document.createElement("article");
  card.className = "product-card uploaded-product";

  const link = document.createElement("a");
  link.className = "product-image";
  link.href = image.url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.setAttribute("aria-label", `View ${image.title}`);

  const photo = document.createElement("img");
  photo.src = image.url;
  photo.alt = image.title;
  photo.loading = "lazy";
  photo.decoding = "async";

  const arrow = document.createElement("span");
  arrow.className = "product-arrow";
  arrow.setAttribute("aria-hidden", "true");
  arrow.textContent = "↗";
  link.append(photo, arrow);

  const meta = document.createElement("div");
  meta.className = "product-meta";

  const category = document.createElement("span");
  category.textContent = "New / Nkemo's finds";

  const action = document.createElement("span");
  action.textContent = "View photo";
  meta.append(category, action);

  const title = document.createElement("h3");
  title.textContent = image.title;
  card.append(link, meta, title);

  return card;
}

async function addUploadedProducts() {
  try {
    const response = await fetch("/api/images");
    if (!response.ok) throw new Error("The new photos could not be loaded.");

    const { images } = await response.json();
    for (const image of images) {
      productGrid.append(createUploadedProduct(image));
    }
  } catch {
    const note = document.createElement("p");
    note.className = "availability-note gallery-error";
    note.setAttribute("role", "status");
    note.textContent = "New photos could not be loaded right now. Please try refreshing.";
    productGrid.after(note);
  }
}

if (productGrid && location.protocol !== "file:") addUploadedProducts();
