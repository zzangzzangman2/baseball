import { createInitialState } from "./data.js";
import { mountApp } from "./ui.js";

const state = createInitialState();
mountApp(document.getElementById("app"), state);
