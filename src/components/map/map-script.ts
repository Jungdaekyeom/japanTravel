export type GoogleMapsLibraries = {
  maps: google.maps.MapsLibrary;
  marker: google.maps.MarkerLibrary;
};

let loading: Promise<GoogleMapsLibraries> | null = null;

type GoogleApiBoundary = { maps?: { importLibrary?: (name: string) => Promise<unknown> } };

function googleApi() {
  return (window as unknown as { google?: GoogleApiBoundary }).google;
}

async function importLibraries(): Promise<GoogleMapsLibraries> {
  const api = googleApi();
  if (!api?.maps?.importLibrary) throw new Error("Google Maps 스크립트를 불러오지 못했습니다.");
  const [maps, marker] = await Promise.all([
    api.maps.importLibrary("maps") as Promise<google.maps.MapsLibrary>,
    api.maps.importLibrary("marker") as Promise<google.maps.MarkerLibrary>,
  ]);
  return { maps, marker };
}

export function loadGoogleMaps(apiKey: string): Promise<GoogleMapsLibraries> {
  if (loading) return loading;
  if (googleApi()?.maps?.importLibrary) {
    loading = importLibraries().catch((error) => {
      loading = null;
      throw error;
    });
    return loading;
  }

  const script = document.createElement("script");
  const url = new URL("https://maps.googleapis.com/maps/api/js");
  url.search = new URLSearchParams({
    key: apiKey,
    loading: "async",
    v: "weekly",
    language: "ko",
    region: "JP",
    auth_referrer_policy: "origin",
  }).toString();
  script.src = url.toString();
  script.async = true;
  script.dataset.googleMapsScript = "true";

  loading = new Promise<void>((resolve, reject) => {
    script.addEventListener("load", () => resolve(), { once: true });
    script.addEventListener("error", () => reject(new Error("Google Maps 스크립트를 불러오지 못했습니다.")), { once: true });
    document.head.append(script);
  })
    .then(importLibraries)
    .catch((error) => {
      script.remove();
      loading = null;
      throw error;
    });

  return loading;
}
