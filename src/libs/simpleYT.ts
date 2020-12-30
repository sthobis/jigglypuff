// modified from https://github.com/kimcore/simpleYT
import miniget from "miniget";

export interface ScrapedVideo {
  type: "video";
  identifier: string;
  uri: string;
  title: string;
  length: string;
  isStream: boolean;
}

export interface ScrapedPlaylist {
  type: "playlist";
  identifier: string;
  uri: string;
  title: string;
  count: number;
}

export type ScrapeResult = ScrapedVideo | ScrapedPlaylist;

export default async function simpleYT(
  query: string,
  options: any = {}
): Promise<ScrapeResult[]> {
  const response = await miniget(
    "https://www.youtube.com/results?search_query=" + encodeURIComponent(query),
    { ...options, ...{ filter: undefined } }
  ).text();
  let match = response.match(/window\["ytInitialData"]\s*=\s*(.*?);\s*/);
  if (!match) match = response.match(/var\s*ytInitialData\s*=\s*(.*?);\s*/);
  const line = match[0].trim();
  const json = JSON.parse(line.substring(line.indexOf("{"), line.length - 1));
  const result =
    json["contents"]["twoColumnSearchResultsRenderer"]["primaryContents"][
      "sectionListRenderer"
    ]["contents"][0]["itemSectionRenderer"]["contents"];
  return result
    .filter((video) => {
      const type = Object.keys(video)[0].replace("Renderer", "");
      if (options.filter === "video") return type === "video";
      else if (options.filter === "playlist") return type === "playlist";
      else return ["video", "playlist"].includes(type);
    })
    .map((video) => {
      const type = Object.keys(video)[0].replace("Renderer", "");
      const data = video[type + "Renderer"];
      const identifier = data[type + "Id"];
      if (type === "video") {
        const isStream = !Object.keys(data).includes("lengthText");
        const length = data?.lengthText?.simpleText ?? "";

        return {
          type,
          identifier,
          uri: "https://www.youtube.com/watch?v=" + identifier,
          title: data["title"]["runs"][0]["text"],
          length,
          isStream,
        };
      } else
        return {
          type,
          identifier,
          uri: "https://www.youtube.com/playlist?list=" + identifier,
          title: data["title"]["simpleText"],
          count: Number(data["videoCount"]),
        };
    });
}
