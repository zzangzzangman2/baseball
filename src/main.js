import { createInitialState } from "./data.js";
import { mountApp } from "./ui.js?v=gamecast-short-result-roll-20260716-r26";

const state = createInitialState();
mountApp(document.getElementById("app"), state);
