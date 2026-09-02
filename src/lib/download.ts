// 生成文件名
function filenameGenerator(fileExt = "") {
  const filename = `${Date.now()}_${Math.random().toString(16).substring(2)}`;
  return fileExt ? `${filename}.${fileExt}` : filename;
}

// 触发下载
export function triggerDownload(target: Blob | URL, filename: string) {
  const linkId = "for-emit-download";
  const isBlob = target instanceof Blob;
  const url = isBlob ? URL.createObjectURL(target) : target.toString();

  let link: HTMLAnchorElement = document.getElementById(linkId) as HTMLAnchorElement;
  if (!link) {
    link = document.createElement("a");
  }
  link.id = linkId;
  link.href = url;
  link.download = filename;
  link.target = "_blank";
  link.style.display = "none";
  document.body.appendChild(link);
  link.click(); // start download
  // isBlob && setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// 下载文本数据
export function downloadText(text: string, customFilename = "") {
  if (typeof text !== "string") {
    throw new Error("[downloadText]text must be a string");
  }
  const filename = customFilename || filenameGenerator(".txt");
  const blob = new Blob([text], { type: "text/plain" });
  triggerDownload(blob, filename);
}

// 下载 blob 对象
export function downloadBlob(blob: Blob, customFilename: string) {
  if (typeof blob !== "object" || !(blob instanceof Blob)) {
    throw new Error("[downloadBlob]blob must be a Blob object");
  }
  const fileExt = blob.type.split("/").pop();
  const filename = customFilename || filenameGenerator(fileExt);
  triggerDownload(blob, filename);
}
