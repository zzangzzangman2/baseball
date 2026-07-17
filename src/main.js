import { createInitialState } from "./data.js";
import { mountApp } from "./ui.js?v=gamecast-ai-kinematics-20260717-r31";

const state = createInitialState();
mountApp(document.getElementById("app"), state);
