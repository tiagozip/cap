import { mount } from "svelte";
import "./app.css";
import "./lib/ui.svelte.js";
import Share from "./views/share/Share.svelte";

mount(Share, { target: document.getElementById("app") });
