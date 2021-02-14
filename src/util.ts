import fs from "fs";

export function getArgs(text: string): string {
  if (text.indexOf(" ") < 0) {
    return null;
  }
  return text.substring(text.indexOf(" ") + 1, text.length);
}

export async function logToFile(
  text: string,
  filepath: string = "result.html"
) {
  return new Promise((resolve, reject) => {
    fs.writeFile(filepath, text, (err) => {
      if (err) {
        reject(err);
      }
      resolve(true);
    });
  });
}
