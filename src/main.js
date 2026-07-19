import { createInitialState } from "./data.js";
import { mountApp } from "./ui.js?v=gamecast-ai-realism-20260719-r32";

const state = createInitialState();
mountApp(document.getElementById("app"), state);
