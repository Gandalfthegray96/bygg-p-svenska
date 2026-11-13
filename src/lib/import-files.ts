export type ImportFile = { file: File; path: string };
export type FsEntry = {
  isFile: boolean;
  isDirectory: boolean;
  name: string;
  fullPath: string;
  file?: (cb: (file: File) => void, err: (error: unknown) => void) => void;
  createReader?: () => { readEntries: (cb: (entries: FsEntry[]) => void, err: (error: unknown) => void) => void };
};

export const supportedFile = (name: string) => /\.(pdf|xlsx|xls)$/i.test(name) && !name.startsWith("~$");

export async function walkImportEntry(entry: FsEntry, out: ImportFile[]): Promise<void> {
  if (entry.isFile && supportedFile(entry.name) && entry.file) {
    // Native FileSystemEntry methods require their original receiver.
    const file = await new Promise<File>((resolve, reject) => entry.file?.(resolve, reject));
    out.push({ file, path: entry.fullPath.replace(/^\//, "") });
  } else if (entry.isDirectory && entry.createReader) {
    const reader = entry.createReader();
    for (;;) {
      const batch = await new Promise<FsEntry[]>((resolve, reject) => reader.readEntries(resolve, reject));
      if (!batch.length) break;
      for (const child of batch) await walkImportEntry(child, out);
    }
  }
}

export async function droppedImportFiles(transfer: DataTransfer): Promise<ImportFile[]> {
  // Capture every entry while the drop event still owns the browser's data store.
  const entries = Array.from(transfer.items)
    .filter((item) => item.kind === "file")
    .map((item) => item.webkitGetAsEntry() as FsEntry | null);
  const fallback = Array.from(transfer.files).filter((file) => supportedFile(file.name));
  const out: ImportFile[] = [];
  for (const entry of entries) if (entry) await walkImportEntry(entry, out);
  return out.length ? out : fallback.map((file) => ({ file, path: file.webkitRelativePath || file.name }));
}