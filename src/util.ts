export function getArgs(text: string): string {
  if (text.indexOf(" ") < 0) {
    return null;
  }
  return text.substring(text.indexOf(" ") + 1, text.length);
}
