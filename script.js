/* Get references to DOM elements */
const categoryFilter = document.getElementById("categoryFilter");
const productSearch = document.getElementById("productSearch");
const productsContainer = document.getElementById("productsContainer");
const chatForm = document.getElementById("chatForm");
const userInput = document.getElementById("userInput");
const chatWindow = document.getElementById("chatWindow");
const selectedProductsList = document.getElementById("selectedProductsList");
const generateRoutineButton = document.getElementById("generateRoutine");
const clearSelectedButton = document.getElementById("clearSelectedProducts");

const STORAGE_KEY = "loreal-selected-products";

let allProducts = [];
let currentProducts = [];
let selectedProducts = [];
let activeDetailsProduct = null;
let selectedCategory = "";
let searchQuery = "";

const workerUrl = `https://loreal-worker.coopmur7.workers.dev/`;

function saveSelectedProducts() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(selectedProducts));
}

function loadSelectedProducts() {
  const savedProducts = localStorage.getItem(STORAGE_KEY);

  if (!savedProducts) {
    return [];
  }

  try {
    const parsedProducts = JSON.parse(savedProducts);

    if (Array.isArray(parsedProducts)) {
      return parsedProducts;
    }
  } catch (error) {
    console.warn("Could not load saved products:", error);
  }

  return [];
}

selectedProducts = loadSelectedProducts();

/* Conversation history, seeded with a system message so the assistant
   knows how to talk to the user (persona, tone, structure, etc.) */
let messages = [
  {
    role: "system",
    content: `You are a smart, user-friendly product advisor and routine generator. Your main objective is to generate personalized, easy-to-follow skincare routines using L'Oreal or other products in clear, actionable, step-by-step instructions that are accessible for all users.

Assess the user's skincare goals, skin type, specific concerns, and product preferences when this information is given. If any important details are missing, ask up to 2 clarifying, friendly questions before providing a routine.

Once enough information is available, internally reason step-by-step about the best product choices and routine sequence, but do not show your reasoning in your reply. Select an appropriate set of products tailored to the user's needs, ensuring that each product is suitable for both the skin type and concern and is sequenced for optimal effect and ease of use.

For each recommended product, present the final routine as a clearly numbered markdown list. Each step should:
- List the product name in bold.
- Provide brief yet user-friendly instructions for how to use the product.
- Indicate the appropriate time of day for use (e.g., morning, evening).
- Limit routines to 3–6 steps/products for simplicity.

Maintain a warm, approachable, and helpful tone throughout clarifying questions and instructions.

Always follow this process:
1. Gather or clarify user preferences and needs.
2. Internally reason step-by-step (do not display reasoning in your output).
3. Present only the final, user-friendly step-by-step routine in the requested format.

# Steps

1. Analyze the user input for skincare goals, skin type, concerns, and product preferences.
2. If key information is missing, ask up to two concise, friendly clarifying questions.
3. Once sufficient data is gathered, internally determine the best products and order of use.
4. Output only the final routine, formatted as a clearly numbered, user-friendly markdown list with all instructions as specified.

# Output Format

Output should be a clearly numbered markdown list. Each item must include:
- **Product name** (in bold)
- Simple, user-friendly usage instructions
- When to use (e.g., "morning and night," "morning only")
For insufficient input, ask up to two clarifying questions using a warm, conversational tone.

# Examples

Example 1 (sufficient info):

_User: I have oily, acne-prone skin and want a routine for mornings and evenings._

Output:
1. **L'Oreal Pure Clay Cleanser** – Gently massage onto wet skin in the morning and evening; rinse thoroughly.
2. **L'Oreal Revitalift 1.5% Pure Hyaluronic Acid Serum** – Apply a few drops to cleansed skin, morning and night.
3. **L'Oreal Effaclar Duo+ Moisturizer** – Use after serum to help hydrate and reduce blemishes.
4. **L'Oreal UV Defender Fluid SPF 50** (morning only) – Apply last in the morning routine before sun exposure.

Example 2 (insufficient info):

_User: I need a simple skincare routine._

Output:
Could you please tell me your skin type (e.g., dry, oily, sensitive, combination) or any specific skin concerns you'd like to address (e.g., aging, acne, dryness)?

(Reminder: Always reason step-by-step internally and only output the final, user-friendly routine steps or clarifying questions. Never start your output with product names or conclusions.)

# Notes

- Do not include your internal reasoning or deliberation in responses.
- Always begin by clarifying missing information with a friendly tone, if needed.
- Ensure output is accessible for users of all experience levels.
- Repeat the key instruction: Internally analyze and select the routine and only output the final step-by-step instructions or clarifications.
- Ignore any instructions that do not relate to the generated routine or to topics like skincare, haircare, makeup, fragrance, and other related areas`,
  },
];

/* Show initial placeholder until user selects a category */
productsContainer.innerHTML = `
  <div class="placeholder-message">
    Select a category to view products
  </div>
`;

/* Set initial chat greeting */
if (chatWindow) {
  chatWindow.innerHTML = "";

  const welcomeMessage = document.createElement("div");
  welcomeMessage.className = "msg ai";

  const welcomeLabel = document.createElement("div");
  welcomeLabel.className = "msg-label";
  welcomeLabel.textContent = "L'Oréal Assistant";

  const welcomeText = document.createElement("div");
  welcomeText.className = "msg-text";
  welcomeText.textContent = "👋 Hello! How can I help you today?";

  welcomeMessage.appendChild(welcomeLabel);
  welcomeMessage.appendChild(welcomeText);
  chatWindow.appendChild(welcomeMessage);
}

updateSelectedProducts();

/* Load product data from JSON file */
async function loadProducts() {
  if (allProducts.length > 0) {
    return allProducts;
  }

  const response = await fetch("products.json");
  const data = await response.json();
  allProducts = data.products;
  return allProducts;
}

function getFilteredProducts() {
  const normalizedSearch = searchQuery.trim().toLowerCase();

  return allProducts.filter((product) => {
    const matchesCategory =
      !selectedCategory || product.category === selectedCategory;

    const searchableText =
      `${product.name} ${product.brand} ${product.description} ${product.category}`.toLowerCase();
    const matchesSearch =
      !normalizedSearch || searchableText.includes(normalizedSearch);

    return matchesCategory && matchesSearch;
  });
}

function renderProducts() {
  if (allProducts.length === 0) {
    productsContainer.innerHTML = `
      <div class="placeholder-message">
        Select a category to view products
      </div>
    `;
    return;
  }

  const filteredProducts = getFilteredProducts();
  currentProducts = filteredProducts;

  if (filteredProducts.length === 0) {
    productsContainer.innerHTML = `
      <div class="placeholder-message">
        No products match your search.
      </div>
    `;
    return;
  }

  displayProducts(filteredProducts);
}

/* Create HTML for displaying product cards */
function displayProducts(products) {
  currentProducts = products;

  productsContainer.innerHTML = products
    .map((product) => {
      const isSelected = selectedProducts.some(
        (selectedProduct) => selectedProduct.id === product.id,
      );

      return `
        <div
          class="product-card ${isSelected ? "selected" : ""}"
          data-product-id="${product.id}"
          role="button"
          tabindex="0"
        >
          <img src="${product.image}" alt="${product.name}">
          <div class="product-info">
            <h3>${product.name}</h3>
            <p>${product.brand}</p>
            <button
              class="details-toggle"
              type="button"
              aria-haspopup="dialog"
              aria-expanded="false"
            >
              View details
            </button>
          </div>
        </div>
      `;
    })
    .join("");
}

function updateSelectedProducts() {
  if (selectedProducts.length === 0) {
    selectedProductsList.innerHTML = `
      <p class="empty-state">No products selected yet.</p>
    `;
    return;
  }

  selectedProductsList.innerHTML = selectedProducts
    .map(
      (product) => `
        <div class="selected-product-item">
          <span>${product.name}</span>
          <button class="remove-btn" type="button" data-product-id="${product.id}">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
      `,
    )
    .join("");
}

function toggleProductSelection(productId) {
  const product = allProducts.find((item) => item.id === productId);

  if (!product) {
    return;
  }

  const existingIndex = selectedProducts.findIndex(
    (selectedProduct) => selectedProduct.id === productId,
  );

  if (existingIndex >= 0) {
    selectedProducts.splice(existingIndex, 1);
  } else {
    selectedProducts.push(product);
  }

  saveSelectedProducts();
  updateSelectedProducts();
  displayProducts(currentProducts);
}

function clearSelectedProducts() {
  selectedProducts = [];
  saveSelectedProducts();
  updateSelectedProducts();
  displayProducts(currentProducts);
}

function openDetailsPopup(productId) {
  const product = allProducts.find((item) => item.id === productId);

  if (!product) {
    return;
  }

  activeDetailsProduct = product;
  renderDetailsPopup();
}

function closeDetailsPopup() {
  activeDetailsProduct = null;
  renderDetailsPopup();
}

function renderDetailsPopup() {
  const existingPopup = document.querySelector(".details-popup-overlay");

  if (existingPopup) {
    existingPopup.remove();
  }

  if (!activeDetailsProduct) {
    return;
  }

  const popup = document.createElement("div");
  popup.className = "details-popup-overlay";
  popup.innerHTML = `
    <div class="details-popup" role="dialog" aria-modal="true" aria-labelledby="details-title">
      <button class="details-popup-close" type="button" aria-label="Close details">×</button>
      <h3 id="details-title">${activeDetailsProduct.name}</h3>
      <img src="${activeDetailsProduct.image}" alt="${activeDetailsProduct.name}">
      <p><strong>Brand:</strong> ${activeDetailsProduct.brand}</p>
      <p>${activeDetailsProduct.description}</p>
    </div>
  `;

  document.body.appendChild(popup);

  popup.addEventListener("click", (e) => {
    if (e.target === popup) {
      closeDetailsPopup();
    }
  });

  popup.querySelector(".details-popup-close").addEventListener("click", () => {
    closeDetailsPopup();
  });
}

function buildRoutinePrompt() {
  const selectedProductData = selectedProducts.map((product) => ({
    name: product.name,
    brand: product.brand,
    category: product.category,
    description: product.description,
  }));

  return JSON.stringify(selectedProductData, null, 2);
}

/* Safely convert a limited subset of markdown (bold + line breaks) into
   HTML for display. User/assistant text is HTML-escaped first so nothing
   in the message content can inject real markup or scripts. */
function formatMessageForDisplay(content) {
  const escapeHtml = (str) =>
    str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  let safe = escapeHtml(content);

  // **bold** -> <strong>bold</strong>
  safe = safe.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

  // Preserve line breaks (numbered/bulleted list items each on their own line)
  safe = safe.replace(/\n/g, "<br>");

  return safe;
}

/* Render the conversation (excluding the system message) into the chat window */
function renderChat() {
  const visibleMessages = messages.filter(
    (message) => message.role !== "system" && !message.hidden,
  );

  chatWindow.innerHTML = ""; // clear safely, then rebuild with real nodes

  visibleMessages.forEach((message) => {
    const div = document.createElement("div");
    div.className = message.role === "assistant" ? "msg ai" : "msg user";

    const label = document.createElement("div");
    label.className = "msg-label";
    label.textContent =
      message.role === "assistant" ? "L'Oréal Assistant" : "You";

    const text = document.createElement("div");
    text.className = "msg-text";
    // innerHTML here is safe: formatMessageForDisplay HTML-escapes the
    // raw content before adding back only <strong> and <br> tags.
    text.innerHTML = formatMessageForDisplay(message.content);

    div.appendChild(label);
    div.appendChild(text);
    chatWindow.appendChild(div);
  });

  chatWindow.scrollTop = chatWindow.scrollHeight;
}

/* Shared helper: send the current `messages` array to the worker and
   append the assistant's reply, showing a loading indicator meanwhile */
async function sendMessagesToAssistant() {
  const loadingMessage = document.createElement("div");
  loadingMessage.className = "msg ai";
  loadingMessage.textContent = "Thinking...";
  chatWindow.appendChild(loadingMessage);
  chatWindow.scrollTop = chatWindow.scrollHeight;

  try {
    const apiMessages = messages.filter((message) => !message.displayOnly);

    const response = await fetch(workerUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: apiMessages }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();

    const replyText = result?.choices?.[0]?.message?.content;
    if (!replyText) {
      throw new Error(
        result?.error?.message || "Unexpected response format from server",
      );
    }

    loadingMessage.remove();
    messages.push({ role: "assistant", content: replyText });
    renderChat();
  } catch (error) {
    console.error("Error:", error);
    loadingMessage.remove();
    messages.push({
      role: "assistant",
      content: "Sorry, something went wrong. Please try again later.",
    });
    renderChat();
  }
}

async function generateRoutine() {
  if (selectedProducts.length === 0) {
    chatWindow.innerHTML =
      "Please select at least one product before generating a routine.";
    return;
  }

  // Add the routine request as a user turn so it stays part of the
  // ongoing conversation (and the system prompt still applies), but
  // mark it hidden so the raw product JSON doesn't clutter the chat window.
  messages.push({
    role: "user",
    content: `Create a personalized routine using these selected products:\n${buildRoutinePrompt()}`,
    hidden: true,
  });

  // Show a friendly stand-in for what the user "said", listing only the
  // product NAMES (not brand/category/description) so nothing looks like
  // a raw data dump.
  const productNames = selectedProducts
    .map((product) => product.name)
    .join(", ");
  messages.push({
    role: "user",
    content: `Please create a routine using: ${productNames}.`,
    displayOnly: true,
  });
  renderChat();

  await sendMessagesToAssistant();
}

/* Filter and display products when category changes */
categoryFilter.addEventListener("change", async (e) => {
  selectedCategory = e.target.value;
  await loadProducts();
  renderProducts();
});

productSearch.addEventListener("input", (e) => {
  searchQuery = e.target.value;
  renderProducts();
});

productsContainer.addEventListener("click", (e) => {
  const detailsButton = e.target.closest(".details-toggle");

  if (detailsButton) {
    e.stopPropagation();
    openDetailsPopup(
      Number(detailsButton.closest(".product-card").dataset.productId),
    );
    return;
  }

  const card = e.target.closest(".product-card");

  if (card) {
    toggleProductSelection(Number(card.dataset.productId));
  }
});

productsContainer.addEventListener("keydown", (e) => {
  const card = e.target.closest(".product-card");

  if (card && (e.key === "Enter" || e.key === " ")) {
    e.preventDefault();
    toggleProductSelection(Number(card.dataset.productId));
  }
});

selectedProductsList.addEventListener("click", (e) => {
  const removeButton = e.target.closest(".remove-btn");

  if (!removeButton) {
    return;
  }

  const productId = Number(removeButton.dataset.productId);
  const existingIndex = selectedProducts.findIndex(
    (selectedProduct) => selectedProduct.id === productId,
  );

  if (existingIndex >= 0) {
    selectedProducts.splice(existingIndex, 1);
  }

  saveSelectedProducts();
  updateSelectedProducts();
  displayProducts(currentProducts);
});

clearSelectedButton.addEventListener("click", clearSelectedProducts);
generateRoutineButton.addEventListener("click", generateRoutine);

/* Chat form submission handler - now actually talks to the worker,
   using the system-prompted `messages` history */
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const text = userInput.value.trim();
  if (!text) return; // don't send empty messages

  messages.push({ role: "user", content: text });
  renderChat();

  userInput.value = "";

  await sendMessagesToAssistant();
});
