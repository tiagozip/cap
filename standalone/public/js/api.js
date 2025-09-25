export default async (method, path, body) => {
  try {
    const { token, hash } = JSON.parse(localStorage.getItem("cap_auth"));

    const requestInit = {
      method,
      headers: {
        Authorization: `Bearer ${btoa(
          JSON.stringify({
            token,
            hash,
          })
        )}`,
      },
    };

    if (body) {
      requestInit.headers["Content-Type"] = "application/json";
      requestInit.body = JSON.stringify(body);
    }

    // Extract base path from current URL
    const currentPath = window.location.pathname;
    const basePath = currentPath === '/' ? '' : currentPath.replace(/\/$/, '');
    const json = await (await fetch(`${basePath}/server${path}`, requestInit)).json();

    if (json?.error === "Unauthorized") {
      localStorage.removeItem("cap_auth");
      document.cookie =
        "cap_authed=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
      location.reload();
    }

    return json;
  } catch (e) {
    return {
      error: e.message,
    };
  }
};
