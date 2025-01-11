(function (root, factory) {
  if (!window.Cap) {
    console.warn(
      "[Cap floating] window.Cap not found, this might cause issues"
    );
  }
  if (typeof define === "function" && define.amd) {
    define([], factory);
  } else {
    root.capInterstitial = factory();
    window.capInterstitial = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  return function () {
    return new Promise((resolve, reject) => {
      const wrapper = document.createElement("div");
      wrapper.style.position = "fixed";
      wrapper.style.top = "0";
      wrapper.style.left = "0";
      wrapper.style.right = "0";
      wrapper.style.bottom = "0";
      wrapper.style.zIndex = "9999";
      wrapper.style.display = "flex";
      wrapper.style.justifyContent = "center";
      wrapper.style.alignItems = "center";
      wrapper.style.backgroundColor = "rgba(0, 0, 0, 0.5)";
      wrapper.style.flexDirection = "column";
      wrapper.style.padding = "5px";

      const modal = document.createElement("div");
      modal.style.backgroundColor = "white";
      modal.style.padding = "40px";
      modal.style.borderRadius = "18px";
      modal.style.textAlign = "center";
      modal.style.display = "flex";
      modal.style.flexDirection = "column";
      modal.style.alignItems = "center";
      modal.style.maxWidth = "-webkit-fill-available";
      modal.style.width = "350px";

      const title = document.createElement("h2");
      title.style.fontSize = "18px";
      title.style.fontFamily =
        'system,-apple-system,"BlinkMacSystemFont",".SFNSText-Regular","San Francisco","Roboto","Segoe UI","Helvetica Neue","Lucida Grande","Ubuntu","arial",sans-serif';
      title.style.fontWeight = "500";
      title.style.marginBottom = "20px";
      title.style.marginTop = "0px";
      title.textContent = "We're verifying your browser...";

      modal.style.transform = "scale(.95)";
      modal.style.transition = "transform .15s ease-in-out";
      wrapper.style.opacity = "0";
      wrapper.style.transition = "opacity .15s ease-in-out";

      modal.appendChild(title);

      const interstitial = document.createElement("cap-widget");

      setTimeout(() => {
        wrapper.style.opacity = "1";
        modal.style.transform = "scale(1)";
        interstitial.solve();
      }, 1);

      interstitial.addEventListener("solve", function (e) {
        const token = e.detail.token;
        resolve(token);

        setTimeout(function () {
          wrapper.style.opacity = "0";
          modal.style.transform = "scale(.95)";
        }, 300);
        setTimeout(function () {
          wrapper.remove();
        }, 450)
      });

      modal.appendChild(interstitial);
      wrapper.appendChild(modal);
      document.body.appendChild(wrapper);
    });
  };
});
