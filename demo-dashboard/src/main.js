import { mount } from "svelte";
import "./main.css";
import App from "../../capd/dashboard/src/App.svelte";

if (!location.hash)
  history.replaceState(null, "", "#/keys/c4f1a9e27b/activity");

mount(App, { target: document.getElementById("app") });
