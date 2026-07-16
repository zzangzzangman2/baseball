import { createInitialState } from "./data.js";
import { mountApp } from "./ui.js?v=gamecast-motion-ai-20260716-r16";

const state = createInitialState();
mountApp(document.getElementById("app"), state);
