import { mount } from "svelte";
import "./app.css";
import "./lib/ui.svelte.js";
import Login from "./views/login/Login.svelte";

mount(Login, { target: document.getElementById("app") });
