const states = {
  loading: document.querySelector(".state-loading"),
  homepage: document.querySelector(".state-homepage"),
  keyPage: document.querySelector(".state-key-page"),
  settings: document.querySelector(".state-settings"),
};

export default function setState(stateName) {
  for (const [name, element] of Object.entries(states)) {
    if (name === stateName) {
      element.style.display = "flex";
    } else {
      element.style.display = "none";
    }
  }
}
