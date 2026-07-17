export const GAMECAST2_DESIGN_W = 960;
export const GAMECAST2_DESIGN_H = 720;

const FIELD_ROOT = "./assets/gamecast2";
export const GAMECAST2_ASSET_REVISION = "20260716-jamsil-defense-7";
export const GAMECAST2_FIXED_FIELD_ID = "field-jamsil-day";

export function gamecast2AssetUrl(url) {
  const separator = String(url).includes("?") ? "&" : "?";
  const qaToken = typeof window === "undefined"
    ? ""
    : String(new URLSearchParams(window.location.search).get("qa") ?? "").trim();
  const revision = qaToken ? `${GAMECAST2_ASSET_REVISION}-${qaToken}` : GAMECAST2_ASSET_REVISION;
  return `${url}${separator}v=${encodeURIComponent(revision)}`;
}

// Other authored fields stay on disk for future work, but they are deliberately
// not registered while all gameplay coordinates are tuned against Jamsil.
export const GAMECAST2_FIELDS = Object.freeze([
  {
    id: GAMECAST2_FIXED_FIELD_ID,
    label: "잠실 낮",
    imageUrl: gamecast2AssetUrl(`${FIELD_ROOT}/field-jamsil-day.png`),
    anchorsUrl: gamecast2AssetUrl(`${FIELD_ROOT}/field-jamsil-day.anchors.json`)
  }
]);

export function getGamecast2UrlOptions() {
  if (typeof window === "undefined") {
    return { debugAnchors: false, fieldId: GAMECAST2_FIXED_FIELD_ID };
  }
  const params = new URLSearchParams(window.location.search);
  const debugParts = String(params.get("debug") ?? "").split(",").map((part) => part.trim().toLowerCase());
  return {
    debugAnchors: debugParts.includes("anchors") || params.get("anchors") === "1",
    fieldId: GAMECAST2_FIXED_FIELD_ID
  };
}

export function selectGamecast2Field(_ballparkProfile = null, _overrideId = "") {
  return GAMECAST2_FIELDS[0];
}

export function normalizeGamecast2Anchors(payload) {
  const raw = payload?.anchors && typeof payload.anchors === "object" ? payload.anchors : {};
  const anchors = {};
  for (const [key, value] of Object.entries(raw)) {
    anchors[key] = {
      x: Number(value?.x ?? 0),
      y: Number(value?.y ?? 0),
      scale: Number(value?.scale ?? 1)
    };
  }
  return {
    fieldId: String(payload?.fieldId ?? ""),
    name: String(payload?.name ?? payload?.fieldId ?? ""),
    design: {
      width: Number(payload?.design?.width ?? GAMECAST2_DESIGN_W),
      height: Number(payload?.design?.height ?? GAMECAST2_DESIGN_H)
    },
    anchors,
    paths: payload?.paths && typeof payload.paths === "object" ? payload.paths : {}
  };
}
