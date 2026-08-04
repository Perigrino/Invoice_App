function svgToDataUrl(svg: string): string {
  const base64 = btoa(unescape(encodeURIComponent(svg)));
  return `data:image/svg+xml;base64,${base64}`;
}

export function imageToSvg(dataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    if (dataUrl.startsWith("data:image/svg")) {
      fetch(dataUrl)
        .then((r) => r.text())
        .then((svg) => resolve(svgToDataUrl(svg)))
        .catch(() => resolve(dataUrl));
      return;
    }
    const img = new Image();
    img.onload = () => {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${img.naturalWidth}" height="${img.naturalHeight}"><image src="${dataUrl}" width="${img.naturalWidth}" height="${img.naturalHeight}"/></svg>`;
      resolve(svgToDataUrl(svg));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}
