const readMethods = new Set(["GET", "HEAD"]);

export const scopeGuard = ({ scope, request, params, set, route }) => {
  if (!scope) return;
  if (scope.readonly && !readMethods.has(request.method)) {
    set.status = 403;
    return { success: false, error: "Forbidden. This API key is read-only." };
  }
  if (!scope.siteKeys) return;
  if (params?.siteKey) {
    if (scope.siteKeys.includes(params.siteKey)) return;
  } else if (readMethods.has(request.method) && route === "/server/keys") {
    return;
  }
  set.status = 403;
  return {
    success: false,
    error: "Forbidden. This API key is not scoped to this site key.",
  };
};
