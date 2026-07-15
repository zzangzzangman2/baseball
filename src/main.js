import { createInitialState } from "./data.js";
import { mountApp } from "./ui.js?v=gamecast-arm-pitch-20260715-r15";

const state = createInitialState();
mountApp(document.getElementById("app"), state);
