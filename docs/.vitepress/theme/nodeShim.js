const unavailable = () => {
  throw new Error("Not available in the browser");
};

export const randomBytes = unavailable;
export const randomInt = unavailable;
export const deflateRawSync = unavailable;
export const createPublicKey = unavailable;
export const verify = unavailable;

export const createHash = () => {
  let seen = "";
  const hash = {
    update: (v) => {
      seen += v;
      return hash;
    },
    digest: () => `${seen.length}`,
  };
  return hash;
};

export default {};
