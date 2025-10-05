import sendApiRequest from "./api.js";
import initHomepage from "./homepage.js";
import loadKeyPage from "./keyPage.js";
import setState from "./state.js";
import { createModal } from "./utils.js";

async function openCreateKey(namePrefill = "") {
  const modal = createModal(
    "Add a key",
    `<div class="content">
      <label for="key-name">Key name</label>
      <input type="text" name="key-name" class="key-name-input" placeholder="Blog comments" value="${namePrefill}" max-length="200" required>
     </div>

     <button class="create-key-button primary">Create key</button>`
  );
  modal.querySelector(".key-name-input").focus();

  if (!namePrefill)
    document.querySelector(".create-key-button").disabled = true;

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
        const { siteKey, secretKey } = await sendApiRequest("POST", "/keys", {
          name,
        });

        document.body.removeChild(modal);

        const successModal = createModal(
          "Key created",
          `<div class="content">
            <label for="site-key">Site key</label>
            <input type="text" name="site-key" value="${siteKey}" readonly>

            <label for="secret-key">Secret key</label>
            <input type="text" name="secret-key" value="${secretKey}" readonly>

            <p class="small-text">Make sure to copy your secret key as it will not be shown again later.</p>
          </div>

          <button class="open-key-button primary" style="margin-bottom:8px">Open key</button>
          <button class="close-small-button primary secondary">Close</button>`
        );

        successModal
          .querySelector(".open-key-button")
          .addEventListener("click", () => {
            document.body.removeChild(successModal);
            loadKeyPage(siteKey, secretKey);
          });
        successModal
          .querySelector(".close-small-button")
          .addEventListener("click", () => {
            document.body.removeChild(successModal);
          });

        await initHomepage();
        setState("homepage");
      } catch (error) {
        setState("homepage");

        createModal(
          "Error",
          `<div class="content"><p>Failed to create key: ${error.message}</p></div>`
        );
        modal.querySelector(".create-key-button").disabled = false;
      }
    });
}

document.querySelector(".create-key").addEventListener("click", () => {
  openCreateKey(document.querySelector(".search-input").value?.trim());
});

export default openCreateKey;
