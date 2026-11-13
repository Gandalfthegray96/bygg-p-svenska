import { expect, test } from "bun:test";
import { droppedImportFiles, walkImportEntry, type FsEntry } from "./import-files";

function fileEntry(path: string): FsEntry {
  return {
    isFile: true, isDirectory: false, name: path.split("/").at(-1) ?? "", fullPath: path,
    file(resolve) {
      if (this.fullPath !== path) throw new TypeError("Illegal invocation");
      resolve(new File(["example"], this.name));
    },
  };
}

test("nested folder files retain the native file method receiver", async () => {
  const child = fileEntry("/Kunder/Saltex/AV/avtal.pdf");
  let read = false;
  const folder: FsEntry = {
    isFile: false, isDirectory: true, name: "AV", fullPath: "/Kunder/Saltex/AV",
    createReader() { return { readEntries(resolve) { resolve(read ? [] : [child]); read = true; } }; },
  };
  const out: { file: File; path: string }[] = [];
  await walkImportEntry(folder, out);
  expect(out.map((item) => item.path).join(",")).toBe("Kunder/Saltex/AV/avtal.pdf");
});

test("all dropped entries are captured before async reading clears the drop data", async () => {
  const first = fileEntry("/A/avtal.pdf");
  const second = fileEntry("/B/kalkyl.xlsx");
  const items = [first, second].map((entry) => ({ kind: "file", webkitGetAsEntry: () => entry }));
  first.file = function (resolve) { items.length = 0; resolve(new File(["example"], this.name)); };
  const transfer = { items, files: [] } as unknown as DataTransfer;
  expect((await droppedImportFiles(transfer)).map((item) => item.path).join(",")).toBe("A/avtal.pdf,B/kalkyl.xlsx");
});

test("ordinary supported files work without filesystem entries", async () => {
  const transfer = { items: [], files: [new File(["pdf"], "avtal.pdf"), new File(["image"], "bild.jpg")] } as unknown as DataTransfer;
  expect((await droppedImportFiles(transfer)).map((item) => item.path).join(",")).toBe("avtal.pdf");
});