import { Message } from "discord.js";
import unescape from "lodash.unescape";
import { searchYoutube, searchYoutubeByOembed } from "../source/youtube";
import { getSpotifyPlaylistTracks } from "../source/spotify";
import {
  getPlaylist,
  addPlaylist,
  removePlaylist,
  loadPlaylist,
  setLoop,
  setVolume,
  getConfig,
} from "../db";
import { Playlist, LoopTypes } from "../types";
import QueueManager from "../QueueManager";
import { getArgs } from "../util";

const SONG_PER_PAGE = 10;

export default {
  q: handleQueue,
  queue: handleQueue,
  qn: (message: Message, serverQueue: QueueManager) =>
    handleQueue(message, serverQueue, { next: true }),
  qid: (message: Message, serverQueue: QueueManager) =>
    handleQueue(message, serverQueue, { format: "id" }),
  qnid: (message: Message, serverQueue: QueueManager) =>
    handleQueue(message, serverQueue, { format: "id", next: true }),
  qurl: (message: Message, serverQueue: QueueManager) =>
    handleQueue(message, serverQueue, { format: "url" }),
  qnurl: (message: Message, serverQueue: QueueManager) =>
    handleQueue(message, serverQueue, { format: "url", next: true }),
  n: handleNext,
  next: handleNext,
  d: handleDelete,
  delete: handleDelete,
  s: handleStop,
  stop: handleStop,
  r: handleResume,
  resume: handleResume,
  j: handleJump,
  jump: handleJump,
  shuffle: handleShuffle,
  c: handleClear,
  clear: handleClear,
  np: handleNowPlaying,
  nowplaying: handleNowPlaying,
  sq: handleGetPlaylist,
  sql: handleLoadPlaylist,
  sqs: handleSavePlaylist,
  sqd: handleRemovePlaylist,
  lq: (message: Message, serverQueue: QueueManager) =>
    handleLoop(message, serverQueue, "queue"),
  ls: (message: Message, serverQueue: QueueManager) =>
    handleLoop(message, serverQueue, "song"),
  la: (message: Message, serverQueue: QueueManager) =>
    handleLoop(message, serverQueue, "autoplay"),
  ld: (message: Message, serverQueue: QueueManager) =>
    handleLoop(message, serverQueue, "disabled"),
  v: handleVolume,
  volume: handleVolume,
};

async function handleQueue(
  message: Message,
  serverQueue: QueueManager,
  opts: {
    next?: boolean;
    format?: "id" | "url";
  } = {}
) {
  const songQuery = getArgs(message.content);

  // !queue command
  // shows current queue without adding anything
  if (!songQuery) {
    displayQueue(message, serverQueue);
    return;
  }

  // !queue <query> command
  // add new song(s) into queue
  const index = opts.next ? serverQueue.nowPlayingIndex + 1 : undefined;
  if (opts.format) {
    // search by youtube id/url
    const searchOpts = { [opts.format]: songQuery };
    const searchResult = await searchYoutubeByOembed(searchOpts);
    if (!searchResult) {
      return message.channel.send(
        `Failed to find song "${songQuery}", try using 'q' command.`,
        { code: "" }
      );
    }
    const song = { ...searchResult, requestedBy: message.author.id };
    serverQueue.queue(song, index);
  } else if (songQuery.startsWith("https://open.spotify.com/playlist/")) {
    // spotify playlist
    try {
      const songs = await getSpotifyPlaylistTracks(
        songQuery,
        message.author.id
      );
      serverQueue.queue(songs, index);
    } catch (err) {
      console.log(err);
    }
  } else {
    // regular youtube search
    const searchResult = await searchYoutube(songQuery);
    if (!searchResult) {
      return message.channel.send(
        `Failed to find song "${songQuery}", try again.`,
        { code: "" }
      );
    }
    const song = { ...searchResult, requestedBy: message.author.id };
    serverQueue.queue(song, index);
  }
}

function getSongListByPage(serverQueue: QueueManager, page: number): string {
  const startIndex = page * SONG_PER_PAGE;
  const songs = serverQueue.songs.slice(startIndex, startIndex + SONG_PER_PAGE);

  return (
    songs
      .map((song, index) => {
        const actualIndex = index + startIndex;
        if (actualIndex === serverQueue.nowPlayingIndex) {
          return `    ⬐ current track
${actualIndex}) ${unescape(song.title)}
  ⬑ current track`;
        } else {
          return `${actualIndex}) ${unescape(song.title)}`;
        }
      })
      .join("\n") + `\n\n Total songs on queue: ${serverQueue.songs.length}`
  );
}

async function displayQueue(message: Message, serverQueue: QueueManager) {
  if (!serverQueue.songs.length) {
    message.channel.send("Queue is empty.", { code: "" });
  } else {
    let page = Math.floor(serverQueue.nowPlayingIndex / SONG_PER_PAGE);
    const lastPage = Math.floor((serverQueue.songs.length - 1) / SONG_PER_PAGE);

    const sentMessage = (await message.channel.send(
      getSongListByPage(serverQueue, page),
      {
        code: "",
      }
    )) as Message;

    sentMessage.react("⏫").then(() => sentMessage.react("⏬"));
    const filter = (reaction, user) => {
      return (
        ["⏫", "⏬"].includes(reaction.emoji.name) &&
        user.id === message.author.id
      );
    };

    const collector = sentMessage.createReactionCollector(filter, {
      time: 60000,
    });
    collector.on("collect", (reaction) => {
      if (reaction.emoji.name === "⏫" && page > 0) {
        page--;
        sentMessage.edit(getSongListByPage(serverQueue, page), { code: "" });
      } else if (reaction.emoji.name === "⏬" && page < lastPage) {
        page++;
        sentMessage.edit(getSongListByPage(serverQueue, page), { code: "" });
      }
    });
  }
}

function handleNext(message: Message, serverQueue: QueueManager) {
  serverQueue.next();
}

function handleDelete(message: Message, serverQueue: QueueManager) {
  const deleteIndex = parseInt(getArgs(message.content));
  serverQueue.delete(deleteIndex);
}

function handleStop(message: Message, serverQueue: QueueManager) {
  serverQueue.stop();
}

function handleResume(message: Message, serverQueue: QueueManager) {
  serverQueue.resume();
}

function handleJump(message: Message, serverQueue: QueueManager) {
  const jumpIndex = parseInt(getArgs(message.content));
  serverQueue.jump(jumpIndex);
}

function handleClear(message: Message, serverQueue: QueueManager) {
  serverQueue.clear();
}

function handleShuffle(message: Message, serverQueue: QueueManager) {
  serverQueue.shuffle();
}

function handleNowPlaying(message: Message, serverQueue: QueueManager) {
  serverQueue.showNowPlaying();
}

function getPlaylistByPage(savedPlaylist: Playlist[], page: number): string {
  const startIndex = page * SONG_PER_PAGE;
  const playlist = savedPlaylist.slice(startIndex, startIndex + SONG_PER_PAGE);

  return playlist
    .map((item) => `${item.id}) ${item.name} by ${item.addedBy}`)
    .join("\n");
}

async function handleGetPlaylist(message: Message, serverQueue: QueueManager) {
  const savedPlaylist = getPlaylist();

  if (!savedPlaylist.length) {
    message.channel.send("No saved playlist. Add one using 'sqs' command.", {
      code: "",
    });
  } else {
    let page = 0;
    const lastPage = Math.floor((savedPlaylist.length - 1) / SONG_PER_PAGE);

    const sentMessage = (await message.channel.send(
      getPlaylistByPage(savedPlaylist, page),
      {
        code: "",
      }
    )) as Message;

    sentMessage.react("⏫").then(() => sentMessage.react("⏬"));
    const filter = (reaction, user) => {
      return (
        ["⏫", "⏬"].includes(reaction.emoji.name) &&
        user.id === message.author.id
      );
    };

    const collector = sentMessage.createReactionCollector(filter, {
      time: 60000,
    });
    collector.on("collect", (reaction) => {
      if (reaction.emoji.name === "⏫" && page > 0) {
        page--;
        sentMessage.edit(getPlaylistByPage(savedPlaylist, page), { code: "" });
      } else if (reaction.emoji.name === "⏬" && page < lastPage) {
        page++;
        sentMessage.edit(getPlaylistByPage(savedPlaylist, page), { code: "" });
      }
    });
  }
}

function handleLoadPlaylist(message: Message, serverQueue: QueueManager) {
  const args = getArgs(message.content);
  const playlistId = parseInt(args);
  const playlist = loadPlaylist(playlistId);
  if (!playlist) {
    return message.channel.send(
      `Playlist '${args}' not found, try it again by inserting a correct playlist index!`,
      { code: "" }
    );
  }
  serverQueue.queue(playlist.queue);
}

function handleSavePlaylist(message: Message, serverQueue: QueueManager) {
  const playlistName = getArgs(message.content);

  addPlaylist({
    addedBy: message.author.username,
    name: playlistName,
    queue: serverQueue.songs.slice(),
  });

  message.channel.send(`Playlist ${playlistName} is now saved.`, { code: "" });
}

function handleRemovePlaylist(message: Message, serverQueue: QueueManager) {
  const playlistId = parseInt(getArgs(message.content));
  removePlaylist(playlistId);

  message.channel.send(`Playlist has been removed.`, { code: "" });
}

function handleLoop(
  message: Message,
  serverQueue: QueueManager,
  mode: LoopTypes
) {
  serverQueue.loop = mode;
  setLoop(mode);
  message.channel.send(`Mode set to loop \`${mode}\``, { code: "" });
}

function handleVolume(message: Message, serverQueue: QueueManager) {
  const args = getArgs(message.content);
  if (args) {
    const newVolume = parseInt(args);
    serverQueue.volume = newVolume;
    setVolume(newVolume);
    message.channel.send(`Volume set to ${newVolume}%`, {
      code: "",
    });
  } else {
    const config = getConfig();
    message.channel.send(`Volume is on ${config.volume}%`, { code: "" });
  }
}
