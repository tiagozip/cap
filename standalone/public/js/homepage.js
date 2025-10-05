import sendApiRequest from "./api.js";
import loadKeyPage from "./keyPage.js";
import setState from "./state.js";

const initHomepage = async () => {
  setState("loading");

  let keys;

  try {
    keys = await sendApiRequest("GET", "/keys");
  } catch {
    setState("homepage");

    document.querySelector(".keys-list").classList.add("no-keys");
    document.querySelector(
      ".keys-list"
    ).innerHTML = `<p>An error occurred while fetching your keys. Please try again later.</p>`;
    return;
  }

  setState("homepage");

  document.querySelector(".keys-list").classList.remove("no-keys");
  document.querySelector(".keys-list").innerHTML = "";

  if (keys.length === 0) {
    document.querySelector(".keys-list").classList.add("no-keys");
    document.querySelector(
      ".keys-list"
    ).innerHTML = `<p>You don't have any keys</p>`;
    return;
  }

  keys.forEach((key) => {
    const keyEl = document.createElement("div");
    keyEl.classList.add("key");

    let differenceItem = "〰";
    if (key.difference.direction === "up") {
      differenceItem = `<span style='color:rgb(34 197 94)'><svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" width="12" height="12"><path fill-rule="evenodd" d="M8.25 3.75H19.5a.75.75 0 01.75.75v11.25a.75.75 0 01-1.5 0V6.31L5.03 20.03a.75.75 0 01-1.06-1.06L17.69 5.25H8.25a.75.75 0 010-1.5z" clip-rule="evenodd">
    </path></svg></span>`;
    } else if (key.difference.direction === "down") {
      differenceItem = `<span style='color:rgb(248 113 113)'><svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" width="12" height="12"><path fill-rule="evenodd" d="M3.97 3.97a.75.75 0 011.06 0l13.72 13.72V8.25a.75.75 0 011.5 0V19.5a.75.75 0 01-.75.75H8.25a.75.75 0 010-1.5h9.44L3.97 5.03a.75.75 0 010-1.06z" clip-rule="evenodd"></path></svg></span>`;
    }

    keyEl.innerHTML = `
      <div class="key-text">
        <h2>${key.name}</h2>
        <p><b>${key.solvesLast24h}</b> solves in last 24h • ${differenceItem} ${key.difference.value}%</p>
      </div>
      <div class="key-actions">
        <button class="open-key" title="Open key"><svg alt="Right arrow" xmlns="http://www.w3.org/2000/svg"  width="24"  height="24"  viewBox="0 0 24 24"  fill="none"  stroke="currentColor"  stroke-width="2"  stroke-linecap="round"  stroke-linejoin="round"  class="icon icon-tabler icons-tabler-outline icon-tabler-arrow-right"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M5 12l14 0" /><path d="M13 18l6 -6" /><path d="M13 6l6 6" /></svg></button>
      </div>
    `;
    document.querySelector(".keys-list").appendChild(keyEl);

    keyEl.addEventListener("click", () => {
      keyEl.querySelector(".open-key").click();
    });

    keyEl.querySelector(".open-key").addEventListener("click", () => {
      loadKeyPage(key.siteKey);
    });
  });
};

document.querySelector(".keys-top input").addEventListener("input", (event) => {
  const searchTerm = event.target.value.toLowerCase();
  const keys = document.querySelectorAll(".keys-list .key");

  keys.forEach((key) => {
    const keyName = key.querySelector("h2").innerText.toLowerCase();
    if (keyName.includes(searchTerm)) {
      key.style.display = "flex";
    } else {
      key.style.display = "none";
    }
  });
});

export default initHomepage;
