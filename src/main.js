import { createInitialState } from "./data.js";
import { mountApp } from "./ui.js?v=gamecast-jamsil-only-20260716-r25";

const state = createInitialState();
mountApp(document.getElementById("app"), state);
