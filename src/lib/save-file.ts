// Låter användaren välja var filen sparas (t.ex. OneDrive).
// 1) Datorn: "Spara som"-dialog. 2) Mobil: dela-menyn (välj OneDrive). 3) Vanlig nedladdning.
export async function saveFile(blob: Blob, name: string, mime: string, ext: string) {
  const w = window as unknown as { showSaveFilePicker?: (o: unknown) => Promise<{ createWritable: () => Promise<{ write: (b: Blob) => Promise<void>; close: () => Promise<void> }> }> };
  if (w.showSaveFilePicker) {
    try {
      const h = await w.showSaveFilePicker({ suggestedName: name, types: [{ description: name, accept: { [mime]: [ext] } }] });
      const s = await h.createWritable();
      await s.write(blob);
      await s.close();
      return;
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
    }
  }
  const file = new File([blob], name, { type: mime });
  const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
  if (nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: name });
      return;
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
    }
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
