export const ipdbUnsupported =
  "An IP database isn't needed on Cloudflare Workers. Country and network come from Cloudflare.";

export const loadIPDB = async () => {};
export const downloadDB = async () => {
  throw new Error(ipdbUnsupported);
};
export const deleteDB = downloadDB;
export const getDownloadProgress = () => ({ active: false, error: null });
export const clearDownloadError = () => {};
export const lookup = async () => ({ country: null, asn: null, org: null });
export const isLoaded = () => false;

export const getStatus = () => ({
  mode: "cloudflare",
  maxmindAccountId: "",
  maxmindKey: "",
  ipinfoToken: "",
  lastUpdated: "",
  country: { exists: true, size: 0 },
  asn: { exists: true, size: 0 },
  loaded: { country: true, asn: true },
  error: null,
});
