/**
 * rewritten based on https://github.com/talmobi/yt-search
 */

import cheerio from "cheerio";
import request from "request";
import youtubeApi from "youtube-search";
import simpleYT from "simpleyt";
import { logError } from "./db";
import fs from "fs";

interface VideoResult {
  id: string;
  title: string;
  url: string;
  duration: string;
}

export async function searchYoutube(query: string): Promise<VideoResult> {
  const videos = await simpleYT(query, {
    filter: "video",
  });

  if (!videos.length) {
    return null;
  }

  const video = videos[0];

  return {
    id: video.identifier,
    title: video.title,
    url: video.uri,
    duration: video.length.sec,
  };
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
    const videos = await simpleYT(videoId, {
      filter: "video",
    });

    if (!videos.length) {
      return [];
    }

    return videos.slice(1, 6).map((video) => ({
      id: video.identifier,
      title: video.title,
      url: video.uri,
      duration: video.length.sec,
    }));
  }
}
