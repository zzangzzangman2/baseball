export const GAMECAST2_DESIGN_W = 960;
export const GAMECAST2_DESIGN_H = 720;

const FIELD_ROOT = "./assets/gamecast2";
export const GAMECAST2_ASSET_REVISION = "20260715-force-clarity-5";

export function gamecast2AssetUrl(url) {
  const separator = String(url).includes("?") ? "&" : "?";
  const qaToken = typeof window === "undefined"
    ? ""
    : String(new URLSearchParams(window.location.search).get("qa") ?? "").trim();
  const revision = qaToken ? `${GAMECAST2_ASSET_REVISION}-${qaToken}` : GAMECAST2_ASSET_REVISION;
  return `${url}${separator}v=${encodeURIComponent(revision)}`;
}

export const GAMECAST2_FIELDS = [
  {
    id: "field-jamsil-day",
    label: "잠실 낮",
    imageUrl: gamecast2AssetUrl(`${FIELD_ROOT}/field-jamsil-day.png`),
    anchorsUrl: gamecast2AssetUrl(`${FIELD_ROOT}/field-jamsil-day.anchors.json`)
  },
  {
    id: "field-jamsil-night",
    label: "잠실 밤",
    imageUrl: gamecast2AssetUrl(`${FIELD_ROOT}/field-jamsil-night.png`),
    anchorsUrl: gamecast2AssetUrl(`${FIELD_ROOT}/field-jamsil-night.anchors.json`)
  },
  {
    id: "field-gocheok-dome",
    label: "고척 돔",
    imageUrl: gamecast2AssetUrl(`${FIELD_ROOT}/field-gocheok-dome.png`),
    anchorsUrl: gamecast2AssetUrl(`${FIELD_ROOT}/field-gocheok-dome.anchors.json`)
  }
];

export function getGamecast2UrlOptions() {
  if (typeof window === "undefined") {
    return { debugAnchors: false, fieldId: "" };
  }
  const params = new URLSearchParams(window.location.search);
  const debugParts = String(params.get("debug") ?? "").split(",").map((part) => part.trim().toLowerCase());
  return {
    debugAnchors: debugParts.includes("anchors") || params.get("anchors") === "1",
    fieldId: String(params.get("field") ?? params.get("park") ?? "").trim()
  };
}

export function selectGamecast2Field(ballparkProfile = null, overrideId = "") {
  const override = GAMECAST2_FIELDS.find((field) => field.id === overrideId);
  if (override) return override;

  const id = String(ballparkProfile?.id ?? "").toLowerCase();
  const label = String(ballparkProfile?.label ?? ballparkProfile?.name ?? "").toLowerCase();
  if (id.includes("gocheok") || label.includes("고척") || ballparkProfile?.roofed) {
    return GAMECAST2_FIELDS.find((field) => field.id === "field-gocheok-dome") ?? GAMECAST2_FIELDS[0];
  }
  if (id.includes("night") || label.includes("night") || label.includes("밤")) {
    return GAMECAST2_FIELDS.find((field) => field.id === "field-jamsil-night") ?? GAMECAST2_FIELDS[0];
  }
  return GAMECAST2_FIELDS.find((field) => field.id === "field-jamsil-day") ?? GAMECAST2_FIELDS[0];
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
