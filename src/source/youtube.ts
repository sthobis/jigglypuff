import unescape from "lodash.unescape";
import axios from "axios";
import youtubeSearch from "../libs/youtube-search";
import youtubeScrape, { ScrapedVideo } from "../libs/simpleYT";
import { logError } from "../db";

interface VideoResult {
  id: string;
  title: string;
  url: string;
  duration: string;
}

const getTimestamp = (date) =>
  `${date.getDate()}-${date.getMonth()}-${date.getFullYear()}`;
let timestamp = getTimestamp(new Date());

export async function searchYoutubeByOembed({
  id,
  url,
}: {
  id?: string;
  url?: string;
}): Promise<VideoResult> {
  try {
    const fullUrl = url ? url : `https://www.youtube.com/watch?v=${id}`;
    const { data } = await axios.get(
      `https://www.youtube.com/oembed?url=${fullUrl}&format=json`
    );
    return {
      id,
      title: unescape(data.title),
      url: fullUrl,
      duration: "",
    };
  } catch (err) {
    return null;
  }
}

export async function searchYoutube(query: string): Promise<VideoResult> {
  if (timestamp === getTimestamp(new Date())) {
    let video = await searchYoutubeByAPI(query);
    if (!video) {
      console.log("Youtube API limit for today is reached");
      timestamp = getTimestamp(new Date(Date.now() + 24 * 60 * 60 * 1000));
      video = await searchYoutubeByScraping(query);
    }
    return video;
  } else {
    console.log("Youtube API limit for today is reached");
    let video = await searchYoutubeByScraping(query);
    return video;
  }
}

async function searchYoutubeByAPI(query: string): Promise<VideoResult> {
  try {
    const opts: youtubeSearch.YouTubeSearchOptions = {
      maxResults: 5,
      type: "video",
      part: "snippet",
      key: process.env.GOOGLE_API_KEY,
    };

    const { results } = await youtubeSearch(query, opts);
    if (results && results.length) {
      return {
        id: results[0].id,
        title: unescape(results[0].title),
        url: results[0].link,
        duration: "", // we need to do more request for this, it's not worth the API quota
      };
    }
  } catch (err) {
    logError("searchYoutubeByAPI" + JSON.stringify(err.message));
    return null;
  }
}

async function searchYoutubeByScraping(query: string): Promise<VideoResult> {
  try {
    const videos = await youtubeScrape(query, {
      filter: "video",
    });

    if (!videos.length) {
      return null;
    }

    const video = videos[0];

    if (video.type === "video") {
      return {
        id: video.identifier,
        title: unescape(video.title),
        url: video.uri,
        duration: video.length,
      };
    }

    return null;
  } catch (err) {
    console.log(err);
    logError("searchYoutube" + JSON.stringify(err.message));
    return null;
  }
}

/**
 * Get metadata of a single video
 * @param videoId youtube video id
 */
export async function getRelatedYoutubeVideo(
  videoId: string
): Promise<VideoResult[]> {
  try {
    const opts: youtubeSearch.YouTubeSearchOptions = {
      maxResults: 5,
      key: process.env.GOOGLE_API_KEY,
      part: "snippet",
      relatedToVideoId: videoId,
      type: "video",
    };

    const { results } = await youtubeSearch(videoId, opts);
    return results.map((item) => ({
      id: item.id,
      title: unescape(item.title),
      url: item.link,
      duration: "", // we need to do more request for this, it's not worth the API quota
    }));
  } catch (err) {
    // most probaby error.response.status === 403 API QUOTA LIMIT
    console.log("getRelatedYoutubeVideo", err);
    if (err.response.status === 403) {
      console.log("Hitting youtube API quota limit");
    }

    const videos = await youtubeScrape(videoId, {
      filter: "video",
    });

    if (!videos.length) {
      return [];
    }

    return videos.slice(1, 6).map((video) => ({
      id: video.identifier,
      title: unescape(video.title),
      url: video.uri,
      duration: (video as ScrapedVideo).length,
    }));
  }
}
