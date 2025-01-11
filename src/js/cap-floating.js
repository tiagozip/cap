(() => {
  if (!window.Cap) {
    console.warn(
      "[Cap floating] window.Cap not found, this might cause issues"
    );
  }

  const handleClick = (evt, element, capWidget, handlers) => {
    const trigger = () => {
      handlers.forEach((h) => {
        element.addEventListener("click", h);
        h.call(element, evt);
      });

      setTimeout(() => {
        element.onclick = null;
        handlers.forEach((h) => element.removeEventListener("click", h));
        element.onclick = (e) => handleClick(e, element, capWidget, handlers);
      }, 50);
    };

    element.onclick = null;

    const offset = parseInt(element.getAttribute("data-cap-floating-offset")) || 8;
    const position =
      element.getAttribute("data-cap-floating-position") || "top";
    const rect = element.getBoundingClientRect();

    Object.assign(capWidget.style, {
      display: "block",
      position: "absolute",
    });

    const centerX = rect.left + (rect.width - capWidget.offsetWidth) / 2;
    const safeX = Math.min(centerX, window.innerWidth - capWidget.offsetWidth);

    if (position === "top") {
      capWidget.style.top = `${Math.max(
        0,
        rect.top - capWidget.offsetHeight - offset
      )}px`;
    } else {
      capWidget.style.top = `${Math.min(
        rect.bottom + offset,
        window.innerHeight - capWidget.offsetHeight
      )}px`;
    }
    capWidget.style.left = `${Math.max(safeX, 2)}px`;

    capWidget.solve();
    capWidget.addEventListener("solve", ({ detail }) => {
      element.setAttribute("data-cap-token", detail.token);
      element.setAttribute("data-cap-progress", "done");
      setTimeout(() => {
        trigger();
      }, 500);
      setTimeout(() => {
        capWidget.style.display = "none";
      }, 700);
    });
  };

  const setupElement = (element) => {
    const capWidgetSelector = element.getAttribute("data-cap-floating");
    if (!capWidgetSelector) return;

    const capWidget = document.querySelector(capWidgetSelector);
    if (!document.contains(capWidget)) {
      throw new Error("[Cap floating] Element doesn't exist");
    }

    capWidget.style.display = "none";
    const handlers = [element.onclick].filter(Boolean);

    if (typeof getEventListeners === "function") {
      handlers.push(
        ...(getEventListeners(element).click || []).map((l) => l.listener)
      );
    }

    if (handlers.length) {
      element.onclick = null;
      handlers.forEach((h) => element.removeEventListener("click", h));
      element.addEventListener("click", (e) => {
        e.stopImmediatePropagation();
        e.preventDefault();
        handleClick(e, element, capWidget, handlers);
      });
    }
  };

  const init = (root) => {
    setupElement(root);
    root.querySelectorAll("[data-cap-floating]").forEach(setupElement);
  };

  init(document.body);

  new MutationObserver((mutations) =>
    mutations.forEach((mutation) =>
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) init(node);
      })
    )
  ).observe(document.body, { childList: true, subtree: true });
})();
