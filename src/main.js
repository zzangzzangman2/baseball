import { createInitialState } from "./data.js";
import { mountApp } from "./ui.js?v=gamecast-wall-impact-20260716-r24";

const state = createInitialState();
mountApp(document.getElementById("app"), state);
