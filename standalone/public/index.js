const createKeyBtn = document.querySelector(".new-keys");

createKeyBtn.addEventListener("click", async () => {
  const modal = document.createElement("div");
  modal.classList.add("dialog-wrapper");
  modal.innerHTML = `
    <div class="dialog key-creation-dialog">
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="close-button"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>

      <h2>Create a new key</h2>
      <div class="key-creation-form">
        <label for="keyName">Key name</label>
        <input type="text" id="keyName" placeholder="E.g. Blog comments" />
      </div>

      <div class="key-creation-form">
        <label for="challengesCount">Challenges count</label>
        <input type="number" id="challengesCount" placeholder="18" value="18" min="1"/>
      </div>

      <div class="key-creation-form">
        <label for="challengeSize">Challenge size</label>
        <input type="number" id="challengeSize" placeholder="32" value="32" min="1" />
      </div>

      <div class="key-creation-form">
        <label for="challengeDifficulty">Target size</label>
        <input type="number" id="challengeDifficulty" placeholder="4" value="4" min="1" />
      </div>

      <div class="key-creation-form">
        <label for="expiresMs">Challenge expiration (ms)</label>
        <input type="number" id="expiresMs" placeholder="600000" value="600000" min="1" />
      </div>


      <div class="actions">
        <button class="create-key btn" disabled>Create key</button>
      </div>
    </div>`;

  document.body.appendChild(modal);

  const inputs = [
    "keyName",
    "challengesCount",
    "challengeSize",
    "challengeDifficulty",
    "expiresMs",
  ];

  const createKeyBtn = modal.querySelector(".create-key");

  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });

  const closeButton = modal.querySelector(".close-button");
  closeButton.addEventListener("click", () => {
    modal.remove();
  });

  modal.querySelector("#keyName").focus();

  inputs.forEach((input) => {
    input = modal.querySelector(`#${input}`);
    input.addEventListener("input", () => {
      createKeyBtn.disabled = !inputs.every((i) => {
        const inputEl = modal.querySelector(`#${i}`);
        return inputEl.value.trim() !== "";
      });
    });
  });

  createKeyBtn.addEventListener("click", async () => {
    createKeyBtn.disabled = true;
    let props = {};

    inputs.forEach((i) => {
      i.disabled = true;
      props[i] = modal.querySelector(`#${i}`).value;
    });
    createKeyBtn.innerText = "Creating key...";
    const { message, publicKey, privateKey } = await (
      await fetch("/internal/createKey", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(props),
      })
    ).json();

    createKeyBtn.disabled = false;
    inputs.forEach((i) => {
      i.disabled = false;
    });
    createKeyBtn.innerText = "Create key";

    if (message) return alert(message);

    modal.remove();
    reloadKeysList();

    const newModal = document.createElement("div");
    newModal.classList.add("dialog-wrapper");
    newModal.innerHTML = `
  <div class="dialog key-creation-dialog">
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="close-button"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
    <h2>Key details</h2>
    <p>Make sure to copy your secret key — it's required to validate tokens and you won't be able to see it again.</p>
    
    <div class="key-creation-form">
      <label for="public-key">Key ID</label>
      <input type="text" id="public-key" value="${publicKey}" readonly style="opacity: 1;user-select: all;"/>
    </div>
    
    <div class="key-creation-form">
      <label for="private-key">Secret key</label>
      <input type="text" id="private-key" value="${privateKey}" readonly style="opacity: 1;user-select: all;"/>
    </div>
  </div>`;

    document.body.appendChild(newModal);

    const newCloseButton = newModal.querySelector(".close-button");
    newCloseButton.addEventListener("click", () => {
      newModal.remove();
    });
  });
});

const reloadKeysList = async () => {
  const { keys } = await (await fetch("/internal/listKeys")).json();

  const keysEl = document.querySelector(".keys");
  if (!keys.length) {
    keysEl.innerHTML = "<p>You don't have any keys.</p>";
    return;
  }

  keysEl.innerHTML = "";

  keys.forEach((key) => {
    const keyEl = document.createElement("div");
    keyEl.innerHTML = `<span class="key-name"></span><button class="edit-key" title="Edit key"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-pencil-icon lucide-pencil"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/></svg></button> <button class="copy-key" title="Copy key ID"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-clipboard-icon lucide-clipboard"><rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/></svg> <span>Copy key</span></button>`;
    keyEl.querySelector("span.key-name").innerText = key.name;
    keyEl.title = key.publicKey;
    keyEl.classList.add("key");

    keyEl.querySelector(".copy-key").addEventListener("click", () => {
      navigator.clipboard.writeText(key.publicKey);
      keyEl.querySelector(
        ".copy-key"
      ).innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-check-icon lucide-check"><path d="M20 6 9 17l-5-5"/></svg> <span>Copied</span>`;
      setTimeout(() => {
        keyEl.querySelector(
          ".copy-key"
        ).innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-clipboard-icon lucide-clipboard"><rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/></svg> <span>Copy key</span>`;
      }, 1000);
    });

    keyEl.querySelector(".edit-key").addEventListener("click", () => {
      const modal = document.createElement("div");
      modal.classList.add("dialog-wrapper");
      modal.innerHTML = `
          <div class="dialog key-creation-dialog">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="close-button"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
      
            <h2>Edit key</h2>
            <div class="key-creation-form">
              <label for="keyName">Key name</label>
              <input type="text" id="keyName" placeholder="E.g. Blog comments" />
            </div>
      
            <div class="key-creation-form">
              <label for="challengesCount">Challenges count</label>
              <input type="number" id="challengesCount" placeholder="18" value="18" min="1"/>
            </div>
      
            <div class="key-creation-form">
              <label for="challengeSize">Challenge size</label>
              <input type="number" id="challengeSize" placeholder="32" value="32" min="1" />
            </div>
      
            <div class="key-creation-form">
              <label for="challengeDifficulty">Target size</label>
              <input type="number" id="challengeDifficulty" placeholder="4" value="4" min="1" />
            </div>
      
            <div class="key-creation-form">
              <label for="expiresMs">Challenge expiration (ms)</label>
              <input type="number" id="expiresMs" placeholder="600000" value="600000" min="1" />
            </div>
      
            <div class="actions actions-col">
              <button class="rotate-key action-secundary"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-rotate-cw-icon lucide-rotate-cw"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg> Rotate secret key</button>
              <button class="delete-key action-secundary"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-trash2-icon lucide-trash-2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg> Delete key</button>
              <button class="create-key btn">Save changes</button>
            </div>
          </div>`;

      document.body.appendChild(modal);

      modal.querySelector(".delete-key").addEventListener("click", async () => {
        modal.remove();

        const newModal = document.createElement("div");
        newModal.classList.add("dialog-wrapper");
        newModal.innerHTML = `
          <div class="dialog key-creation-dialog">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="close-button"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
      
            <h2>Delete key?</h2>
            <p style="line-height:1.4;font-size:15px;">This is permanent. Once your key is deleted, you'll no longer be able to interact with it through the API</p>
            <div class="actions">
              <button class="confirm-delete btn">Delete</button>
            </div>
          </div>`;

        document.body.appendChild(newModal);

        const confirmDeleteBtn = newModal.querySelector(".confirm-delete");

        newModal.addEventListener("click", (e) => {
          if (e.target === newModal) {
            newModal.remove();
          }
        });

        const closeButton = newModal.querySelector(".close-button");
        closeButton.addEventListener("click", () => {
          newModal.remove();
        });

        confirmDeleteBtn.addEventListener("click", async () => {
          confirmDeleteBtn.disabled = true;
          await fetch("/internal/deleteKey", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              publicKey: key.publicKey,
            }),
          });
          await reloadKeysList();
          newModal.remove();
        });

        confirmDeleteBtn.focus();
      });

      modal.querySelector(".rotate-key").addEventListener("click", async () => {
        modal.remove();

        const newModal = document.createElement("div");
        newModal.classList.add("dialog-wrapper");
        newModal.innerHTML = `
          <div class="dialog key-creation-dialog">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="close-button"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
      
            <h2>Rotate secret key</h2>
            <p style="line-height:1.4;font-size:15px;">This will rotate your secret key while keeping your key ID, invalidating the old one.</p>
            <div class="actions">
              <button class="confirm-rotate btn">Rotate</button>
            </div>
          </div>`;

        document.body.appendChild(newModal);

        const confirmRotateBtn = newModal.querySelector(".confirm-rotate");

        newModal.addEventListener("click", (e) => {
          if (e.target === newModal) {
            newModal.remove();
          }
        });

        const closeButton = newModal.querySelector(".close-button");
        closeButton.addEventListener("click", () => {
          newModal.remove();
        });

        confirmRotateBtn.addEventListener("click", async () => {
          confirmRotateBtn.disabled = true;

          const { privateKey } = await (await fetch("/internal/rotateKey", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              publicKey: key.publicKey,
            }),
          })).json();
          await reloadKeysList();
          newModal.remove();

          const successModal = document.createElement("div");
          successModal.classList.add("dialog-wrapper");
          successModal.innerHTML = `
  <div class="dialog key-creation-dialog">
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="close-button"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg> 
    <h2>Secret key rotated</h2>

    <p>Make sure to copy your new secret key — it's required to validate tokens and you won't be able to see it again.</p>
    
    <div class="key-creation-form">
      <label for="public-key">Key ID</label>
      <input type="text" id="public-key" value="${key.publicKey}" readonly style="opacity: 1;user-select: all;"/>
    </div>
    
    <div class="key-creation-form">
      <label for="private-key">Secret key</label>
      <input type="text" id="private-key" value="${privateKey}" readonly style="opacity: 1;user-select: all;"/>
      </div>
    </div>`;

          document.body.appendChild(successModal);

          const newCloseButton = successModal.querySelector(".close-button");
          newCloseButton.addEventListener("click", () => {
            successModal.remove();
          });
        });

        confirmRotateBtn.focus();
      });

      const inputs = [
        "keyName",
        "challengesCount",
        "challengeSize",
        "challengeDifficulty",
        "expiresMs",
      ];

      const createKeyBtn = modal.querySelector(".create-key");

      modal.addEventListener("click", (e) => {
        if (e.target === modal) {
          modal.remove();
        }
      });

      const closeButton = modal.querySelector(".close-button");
      closeButton.addEventListener("click", () => {
        modal.remove();
      });

      modal.querySelector("#keyName").focus();

      inputs.forEach((input) => {
        modal.querySelector(`#${input}`).value =
          key[input === "keyName" ? "name" : input];
        input = modal.querySelector(`#${input}`);
        input.addEventListener("input", () => {
          createKeyBtn.disabled = !inputs.every((i) => {
            const inputEl = modal.querySelector(`#${i}`);
            return inputEl.value.trim() !== "";
          });
        });
      });

      createKeyBtn.addEventListener("click", async () => {
        createKeyBtn.disabled = true;
        let props = {};

        inputs.forEach((i) => {
          i.disabled = true;
          props[i] = modal.querySelector(`#${i}`).value;
        });
        createKeyBtn.innerText = "Saving changes...";
        const { message } = await (
          await fetch("/internal/editKey", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              publicKey: key.publicKey,
              ...props,
            }),
          })
        ).json();

        createKeyBtn.disabled = false;
        inputs.forEach((i) => {
          i.disabled = false;
        });
        createKeyBtn.innerText = "Save changes";

        if (message) return alert(message);

        modal.remove();
        reloadKeysList();
      });
    });

    keysEl.appendChild(keyEl);
  });
};

reloadKeysList();
