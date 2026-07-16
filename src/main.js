import { createInitialState } from "./data.js";
import { mountApp } from "./ui.js?v=gamecast-trajectory-20260716-r23";

const state = createInitialState();
mountApp(document.getElementById("app"), state);
