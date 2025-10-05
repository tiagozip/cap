import sendApiRequest from "./api.js";
import initHomepage from "./homepage.js";
import { openSettings } from "./settings.js";
import setState from "./state.js";
import { createModal } from "./utils.js";

import "./createKey.js";
import "./createApiKey.js";

initHomepage();

document.querySelectorAll(".logo, .keypage-back").forEach((el) =>
  el.addEventListener("click", () => {
    setState("homepage");
    initHomepage();
  })
);

document.querySelector(".settings").addEventListener("click", openSettings);

document.querySelector(".logout").addEventListener("click", async () => {
  const modal = createModal(
    "Logout?",
    `<button class="logout-confirm-button primary" style="margin-bottom:8px">Yes, log out</button>
     <button class="logout-cancel-button primary secondary">Cancel</button>`
  );

  modal
    .querySelector(".logout-confirm-button")
    .addEventListener("click", async () => {
      modal.querySelector(".logout-confirm-button").disabled = true;
      await sendApiRequest("POST", "/logout");

      localStorage.removeItem("cap_auth");

      // biome-ignore lint/suspicious/noDocumentCookie: n/a
      document.cookie =
        "cap_authed=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
      location.reload();
    });

  modal.querySelector(".logout-cancel-button").addEventListener("click", () => {
    document.body.removeChild(modal);
  });
});

if (!localStorage.getItem("cap_auth")) {
  // biome-ignore lint/suspicious/noDocumentCookie: n/a
  document.cookie =
    "cap_authed=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
}
