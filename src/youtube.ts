import youtubeApi from "youtube-search";
import miniget from "miniget";
import { logError } from "./db";

interface VideoResult {
  id: string;
  title: string;
  url: string;
  duration: string;
}

export async function searchYoutube(
  query: string
): Promise<VideoResult | null> {
  try {
    const videos = await search(query, {
      filter: "video",
    });

    if (!videos.length) {
      return null;
    }

    const video = videos[0];

    if (video.type === "video") {
      return {
        id: video.identifier,
        title: video.title,
        url: video.uri,
        duration: video.length,
      };
    }

    return null;
  } catch (err) {
    logError("searchYoutube" + JSON.stringify(err.message));
    return null;
  }
}

interface ScrapedVideo {
  type: "video";
  identifier: string;
  uri: string;
  title: string;
  length: string;
  isStream: boolean;
}

interface ScrapedPlaylist {
  type: "playlist";
  identifier: string;
  uri: string;
  title: string;
  count: number;
}

type ScrapeResult = ScrapedVideo | ScrapedPlaylist;

// based on https://github.com/kimcore/simpleYT
async function search(
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

/**
 * Get metadata of a single video
 * @param videoId youtube video id
 */
export async function getRelatedYoutubeVideo(
  videoId: string
): Promise<VideoResult[]> {
  try {
    const opts = {
      maxResults: 5,
      key: process.env.GOOGLE_API_KEY,
      part: "snippet",
      relatedToVideoId: videoId,
      type: "video",
    };

    const { results } = await youtubeApi(videoId, opts);
    return results.map((item) => ({
      id: item.id,
      title: item.title,
      url: item.link,
      duration: "", // we need to do more request for this, it's not worth the API quota
    }));
  } catch (err) {
    // most probaby error.response.status === 403 API QUOTA LIMIT
    console.log("getRelatedYoutubeVideo", err.response.status);
    if (err.response.status === 403) {
      console.log("Hitting youtube API quota limit");
    }

    const videos = await search(videoId, {
      filter: "video",
    });

    if (!videos.length) {
      return [];
    }

    return videos.slice(1, 6).map((video) => ({
      id: video.identifier,
      title: video.title,
      url: video.uri,
      duration: (video as ScrapedVideo).length,
    }));
  }
}
