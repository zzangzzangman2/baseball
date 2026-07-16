import { createInitialState } from "./data.js";
import { mountApp } from "./ui.js?v=gamecast-ground-role-20260716-r22";

const state = createInitialState();
mountApp(document.getElementById("app"), state);
