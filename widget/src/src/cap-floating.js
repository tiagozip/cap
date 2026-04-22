(() => {
  const showWidget = (element, capWidget) => {
    const offset = parseInt(element.getAttribute("data-cap-floating-offset")) || 8;
    const position = element.getAttribute("data-cap-floating-position") || "top";

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

    // `position: absolute` is resolved against the nearest positioned ancestor (capWidget.offsetParent),
    // but getBoundingClientRect() returns viewport-relative coords, convert to container-relative coords.
    const triggerRect = element.getBoundingClientRect();
    const containerRect = (capWidget.offsetParent ?? document.documentElement).getBoundingClientRect();

    const centeredLeft = triggerRect.left + (triggerRect.width - capWidget.offsetWidth) / 2;
    const clampedLeft = Math.max(2, Math.min(centeredLeft, window.innerWidth - capWidget.offsetWidth));
    capWidget.style.left = `${clampedLeft - containerRect.left}px`;

    if (position === "top") {
      const idealTop = triggerRect.top - capWidget.offsetHeight - offset;
      const clampedTop = Math.max(0, idealTop);
      capWidget.style.top = `${clampedTop - containerRect.top}px`;
    } else {
      const idealTop = triggerRect.bottom + offset;
      const clampedTop = Math.min(idealTop, window.innerHeight - capWidget.offsetHeight);
      capWidget.style.top = `${clampedTop - containerRect.top}px`;
    }

    capWidget.solve();
  };

  const hideWidget = (capWidget) => {
    setTimeout(() => {
      capWidget.style.transform = "scale(0.98)";
      capWidget.style.opacity = "0";
      capWidget.style.marginTop = "-4px";
    }, 500);

    setTimeout(() => {
      capWidget.style.display = "none";
    }, 700);
  };

  const setupElement = (element) => {
    const capWidgetSelector = element.getAttribute("data-cap-floating");
    if (!capWidgetSelector) return;

    const capWidget = document.querySelector(capWidgetSelector);
    if (!document.contains(capWidget) && !capWidget.solve) {
      throw new Error(`[cap floating] "${capWidgetSelector}" doesn't exist or isn't a Cap widget`);
    }

    capWidget.style.display = "none";
    let bypass = false;

    element.addEventListener(
      "click",
      (e) => {
        if (bypass) {
          bypass = false;
          return;
        }

        e.stopImmediatePropagation();
        e.preventDefault();

        showWidget(element, capWidget);

        const onSolve = ({ detail }) => {
          capWidget.removeEventListener("solve", onSolve);
          element.setAttribute("data-cap-token", detail.token);
          element.setAttribute("data-cap-progress", "done");

          setTimeout(() => {
            bypass = true;
            element.click();
          }, 500);

          hideWidget(capWidget);
        };

        capWidget.addEventListener("solve", onSolve);
      },
      true,
    );
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
      }),
    ),
  ).observe(document.body, { childList: true, subtree: true });
})();
