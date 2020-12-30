import spotify from "spotify-web-api-node";
import axios from "axios";
import btoa from "btoa";
import { Song } from "../types";

const spotifyApi = new spotify({
  clientId: process.env.SPOTIFY_CLIENT_ID,
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
});

async function refreshAccessToken() {
  spotifyApi.setAccessToken(
    await requestSpotifyAccessToken(
      process.env.SPOTIFY_CLIENT_ID,
      process.env.SPOTIFY_CLIENT_SECRET
    )
  );
}

export async function requestSpotifyAccessToken(
  clientId: string,
  clientSecret: string
): Promise<string> {
  const result = axios.post<{
    access_token: string;
    token_type: string;
    expires_in: number;
  }>(
    "https://accounts.spotify.com/api/token",
    "grant_type=client_credentials",
    {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${btoa(clientId + ":" + clientSecret)}`,
      },
    }
  );
  return (await result).data.access_token;
}

export async function getSpotifyPlaylistTracks(
  playlistUrl: string,
  requestBy: string
): Promise<Song[]> {
  try {
    // https://open.spotify.com/playlist/37i9dQZF1E8OlPnfO1dcLJ?si=bcr6bO3DRAaXPh1LxnVdvQ
    let playlistId = playlistUrl.split("/playlist/")[1];
    if (playlistId.includes("?")) {
      playlistId = playlistId.split("?")[0];
    }
    const response = await spotifyApi.getPlaylistTracks(playlistId, {
      fields: "items(track(name, artists))",
    });
    const tracks = await response.body;
    return tracks.items.map((item) => {
      const artists = item.track.artists.map((artist) => artist.name).join(" ");
      const title = item.track.name;
      return {
        title: `${artists} - ${title}`,
        id: "",
        url: "",
        duration: "",
        requestedBy: requestBy,
      };
    });
  } catch (err) {
    if (err.statusCode === 401) {
      console.log("Access token expired, refreshing a new one.");
      await refreshAccessToken();
      return getSpotifyPlaylistTracks(playlistUrl, requestBy);
    } else {
      throw err;
    }
  }
}
