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

export function getDurationString(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds - hours * 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours ? hours + ":" : ""}${
    hours && minutes < 10 ? `0${minutes}` : minutes
  }:${seconds < 10 ? `0${seconds}` : seconds}`;
}
