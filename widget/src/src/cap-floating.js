(() => {
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

    const offset =
      parseInt(element.getAttribute("data-cap-floating-offset")) || 8;
    const position =
      element.getAttribute("data-cap-floating-position") || "top";
    const rect = element.getBoundingClientRect();

    Object.assign(capWidget.style, {
      display: "block",
      position: "absolute",
      zIndex: "99999",
      opacity: "0",
      transform: "scale(0.98)",
      marginTop: "-4px",
      boxShadow: "rgba(0, 0, 0, 0.05) 0px 6px 24px 0px",
      borderRadius: "14px",
      transition: "opacity 0.15s, margin-top 0.2s, transform 0.2s",
    });

    setTimeout(() => {
      capWidget.style.transform = "scale(1)";
      capWidget.style.opacity = "1";
      capWidget.style.marginTop = "0";
    }, 5);

    const centerX = rect.left + (rect.width - capWidget.offsetWidth) / 2;
    const safeX = Math.min(centerX, window.innerWidth - capWidget.offsetWidth);

    if (position === "top") {
      capWidget.style.top = `${Math.max(
        window.scrollY,
        rect.top - capWidget.offsetHeight - offset + window.scrollY
      )}px`;
    } else {
      capWidget.style.top = `${Math.min(
        rect.bottom + offset + window.scrollY,
        window.innerHeight - capWidget.offsetHeight + window.scrollY
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
        capWidget.style.transform = "scale(0.98)";
        capWidget.style.opacity = "0";
        capWidget.style.marginTop = "-4px";
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
    if (!document.contains(capWidget) && !capWidget.solve) {
      throw new Error(
        `[cap floating] "${capWidgetSelector}" doesn't exist or isn't a Cap widget`
      );
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
    }

    element.addEventListener("click", (e) => {
      e.stopImmediatePropagation();
      e.preventDefault();
      handleClick(e, element, capWidget, handlers);
    });
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
