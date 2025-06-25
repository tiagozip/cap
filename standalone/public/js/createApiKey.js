import sendApiRequest from "./api.js";

import { openSettings } from "./settings.js";
import { createModal } from "./utils.js";

async function openCreateApiKey() {
  const modal = createModal(
    "Add a key",
    `<div class="content">
      <label for="key-name">Key name</label>
      <input type="text" name="key-name" class="key-name-input" max-length="200" required>
     </div>

     <button class="create-key-button primary" disabled>Create API key</button>`
  );
  modal.querySelector(".key-name-input").focus();

  modal.querySelector(".key-name-input").addEventListener("input", (event) => {
    modal.querySelector(".create-key-button").disabled =
      !event.target.value.trim();
  });

  modal
    .querySelector(".key-name-input")
    .addEventListener("keydown", (event) => {
      if (event.target.value.trim() && event.key === "Enter") {
        modal.querySelector(".create-key-button").click();
      }
    });

  modal.querySelector(".close-button").addEventListener("click", () => {
    document.body.removeChild(modal);
  });

  modal
    .querySelector(".create-key-button")
    .addEventListener("click", async () => {
      const name = modal.querySelector(".key-name-input").value.trim();

      modal.querySelector(".create-key-button").disabled = true;

      try {
        const { apiKey } = await sendApiRequest("POST", "/settings/apikeys", {
          name,
        });

        document.body.removeChild(modal);

        const successModal = createModal(
          "Key created",
          `<div class="content">
            <label for="api-key">API key</label>
            <input type="text" name="api-key" value="${apiKey}" readonly>

            <p class="small-text">Make sure to copy your API key as it will not be shown again later.</p>
          </div>

          <button class="close-small-button primary secondary">Close</button>`
        );

        successModal
          .querySelector(".close-small-button")
          .addEventListener("click", () => {
            document.body.removeChild(successModal);
          });

        openSettings();
      } catch (error) {
        createModal(
          "Error",
          `<div class="content"><p>Failed to create API key: ${error.message}</p></div>`
        );
        modal.querySelector(".create-key-button").disabled = false;
      }
    });
}

document
  .querySelector(".create-api-key")
  .addEventListener("click", openCreateApiKey);

export default openCreateApiKey;
