import { createInitialState } from "./data.js";
import { mountApp } from "./ui.js?v=gamecast-hq-80-runner-depth-20260715-r5";

const state = createInitialState();
mountApp(document.getElementById("app"), state);
