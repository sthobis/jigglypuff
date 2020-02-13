/**
 * rewritten based on https://github.com/talmobi/yt-search
 */

import cheerio from "cheerio";
import request from "request";
import querystring from "querystring";

const YT_SEARCH_URL = "https://www.youtube.com/results?search_query=";

interface VideoResult {
  id: string;
  title: string;
  url: string;
  duration: string;
}

interface RelatedVideoResult {
  id: string;
  title: string;
  url: string;
}

export function search(query: string): Promise<VideoResult> {
  return new Promise((resolve, reject) => {
    const q = querystring.escape(query).split(/\s+/);
    const uri = YT_SEARCH_URL + q.join("+");

    request(uri, function(err, res, body) {
      if (err) {
        reject(err);
      }
      if (res.statusCode !== 200) {
        reject(new Error("http status: " + res.statusCode));
      }

      try {
        resolve(parseSearchBody(body));
      } catch (err) {
        reject(err);
      }
    });
  });
}

// parse the plain text response body with cheerio to pin point video information
function parseSearchBody(body): VideoResult {
  const $ = cheerio.load(body);

  const sections = $(".yt-lockup");

  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    const content = $(".yt-lockup-content", section);
    const title = $(".yt-lockup-title", content);

    const a = $("a", title);

    const href = a.attr("href") || "";

    const qs = querystring.parse(href.split("?", 2)[1]);

    // make sure the url is correct ( skip ad urls etc )
    // ref: https://github.com/talmobi/yt-search/issues/3
    if (
      href.indexOf("/watch?") !== 0 &&
      href.indexOf("/user/") !== 0 &&
      href.indexOf("/channel/") !== 0
    )
      continue;

    const videoId = qs.v;

    /* Standard watch?v={videoId} url's without &list=
     * query string variables
     */
    if (videoId) {
      // video result
      // ex: https://youtube.com/watch?v=e9vrfEoc8_g
      return parseVideoResult($, section);
    }
  }
}

/**
 * Parse result section of html containing a video result.
 *
 * @param {object} section - cheerio object
 */
function parseVideoResult(
  $: CheerioStatic,
  section: CheerioElement
): VideoResult {
  const content = $(".yt-lockup-content", section);
  const title = $(".yt-lockup-title", content);

  const a = $("a", title);
  const span = $("span", title);
  const duration = parseDuration(span.text());

  const href = a.attr("href") || "";

  const qs = querystring.parse(href.split("?", 2)[1]);

  const videoId = qs.v;

  const result = {
    title: a.text().trim(),
    url: "https://youtube.com/watch?v=" + videoId,
    id: videoId as string,
    duration: duration.timestamp
  };

  return result;
}

function parseDuration(timestampText: string) {
  var a = timestampText.split(/\s+/);
  var lastword = a[a.length - 1];

  // ex: Duration: 2:27, Kesto: 1.07.54
  // replace all non :, non digits and non .
  var timestamp = lastword.replace(/[^:.\d]/g, "");

  if (!timestamp)
    return {
      toString: function() {
        return a[0];
      },
      seconds: 0,
      timestamp: "0"
    };

  // remove trailing junk that are not digits
  while (timestamp[timestamp.length - 1].match(/\D/)) {
    timestamp = timestamp.slice(0, -1);
  }

  // replaces all dots with nice ':'
  timestamp = timestamp.replace(/\./g, ":");

  var t = timestamp.split(/[:.]/);

  var seconds = 0;
  var exp = 0;
  for (var i = t.length - 1; i >= 0; i--) {
    if (t[i].length <= 0) continue;
    var number = t[i].replace(/\D/g, "");
    // var exp = (t.length - 1) - i;
    seconds += parseInt(number) * (exp > 0 ? Math.pow(60, exp) : 1);
    exp++;
    if (exp > 2) break;
  }

  return {
    toString: function() {
      return seconds + " seconds (" + timestamp + ")";
    },
    seconds: seconds,
    timestamp: timestamp
  };
}

/**
 * Get metadata of a single video
 */
export function getRelatedVideo(videoId: string): Promise<RelatedVideoResult> {
  return new Promise((resolve, reject) => {
    const uri = "https://www.youtube.com/watch?v=" + videoId;

    request(uri, function(err, res, body) {
      if (err) {
        reject(err);
      }
      if (res.statusCode !== 200) {
        reject(new Error("http status: " + res.statusCode));
      }

      try {
        resolve(parseVideoBody(body));
      } catch (err) {
        reject(err);
      }
    });
  });
}

function parseVideoBody(body): RelatedVideoResult {
  const $ = cheerio.load(body);

  const ctx = $("#content");
  const videoId = $("meta[itemprop=videoId]", ctx).attr("content");

  if (!videoId) {
    throw new Error("video unavailable");
  }

  const autoplayNode = $(".autoplay-bar .content-wrapper a");

  return {
    id: videoId,
    title: autoplayNode.attr("title"),
    url: "https://youtube.com" + autoplayNode.attr("href")
  };
}
