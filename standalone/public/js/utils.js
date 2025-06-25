export const createModal = (title, content) => {
  if (document.querySelector(".modal"))
    document.querySelector(".modal").remove();

  const modal = document.createElement("div");
  modal.classList.add("modal");
  modal.innerHTML = `
    <div class="modal-content">
      <header>
        <h2>${title}</h2>
        <button class="close-button" title="Close"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-x-icon lucide-x"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg></button>
      </header>

      ${content}
    </div>
  `;

  document.body.appendChild(modal);
  modal.querySelector(".close-button").addEventListener("click", () => {
    document.body.removeChild(modal);
  });

  document.body.addEventListener("click", (event) => {
    if (event.target === modal) {
      document.body.removeChild(modal);
    }
  });

  document.body.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      document.body.removeChild(modal);
    }
  });

  return modal;
};
