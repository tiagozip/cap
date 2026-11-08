import { api } from "../../lib/api.js";
import { app } from "../../lib/state.svelte.js";
import { toast } from "../../lib/ui.svelte.js";

const blank = () => ({
  siteKey: null,
  value: null,
  error: "",
  revealed: false,
  busy: false,
});

export const secret = $state({ entry: blank() });

export const currentSecret = () =>
  secret.entry.siteKey === app.key?.siteKey ? secret.entry : blank();

export const setSecret = (value) => {
  secret.entry = { ...blank(), siteKey: app.key.siteKey, value };
};

export const loadSecret = async () => {
  const entry = currentSecret();
  if (entry.value) return entry.value;
  const siteKey = app.key.siteKey;
  secret.entry = { ...blank(), siteKey, busy: true };
  const res = await api("GET", `/keys/${siteKey}/secret`);
  if (res?.secretKey) {
    secret.entry = { ...blank(), siteKey, value: res.secretKey };
    return res.secretKey;
  }
  if (res?.error?.startsWith("This secret can't be shown")) {
    secret.entry = {
      ...blank(),
      siteKey,
      error: "Cap can't show this secret. Reset it to get one you can reveal.",
    };
    return null;
  }
  secret.entry = { ...blank(), siteKey };
  toast(res?.error || "Couldn't load the secret key", "error");
  return null;
};

export const toggleSecret = async () => {
  if (currentSecret().revealed) {
    secret.entry.revealed = false;
    return;
  }
  if (await loadSecret()) secret.entry.revealed = true;
};
