import {
  TextChannel,
  VoiceChannel,
  VoiceConnection,
  StreamDispatcher,
  RichEmbed
} from "discord.js";
import ytdl from "ytdl-core";
import { LoopTypes, Song } from "./types";
import { searchYoutube, getRelatedYoutubeVideo } from "./youtube";

class QueueManager {
  textChannel: TextChannel;
  voiceChannel: VoiceChannel;
  voiceConnection: VoiceConnection;
  botId: string;
  loop: LoopTypes;
  private _volume: number;
  private _songs: Song[];
  private _nowPlayingIndex: number;
  private _isPlaying: boolean;
  private _dispatcher: StreamDispatcher;

  constructor({ botId, loop, volume }) {
    this.textChannel = null;
    this.voiceChannel = null;
    this.voiceConnection = null;
    this.botId = botId;
    this.loop = loop;
    this._volume = volume;
    this._songs = [];
    this._nowPlayingIndex = 0;
    this._isPlaying = false;
    this._dispatcher = null;
  }

  get volume(): number {
    return this._volume;
  }

  set volume(newVolume: number) {
    this._volume = newVolume;
    if (this._dispatcher) {
      this._dispatcher.setVolume(this._volume / 100);
    }
  }

  get songs(): Song[] {
    return this._songs;
  }

  get nowPlayingIndex(): number {
    return this._nowPlayingIndex;
  }

  get isPlaying(): boolean {
    return this._isPlaying;
  }

  queue(song: Song | Song[]) {
    if (Array.isArray(song)) {
      this._sendMessage(`${song.length} songs added to queue`);
      this._songs.push(...song);
    } else {
      this._sendMessage(`${song.title} added to queue`);
      this._songs.push(song);
    }
    if (!this._isPlaying) {
      this.play();
    }
  }

  delete(index: number) {
    // send optimistic message
    this._sendMessage(`${this._songs[index].title} removed from queue`);
    if (index === this._nowPlayingIndex) {
      // Delete songs that currently being played
      // Remove it from queue and skip to next song
      if (this._isPlaying) {
        this.stop();
        this._songs.splice(index, 1);
        this.play();
      } else {
        this._songs.splice(index, 1);
      }
    } else if (index < this._nowPlayingIndex) {
      // Delete songs from previous entry
      // Remove it from queue and reduce current nowplaying index by 1
      this._songs.splice(index, 1);
      this._nowPlayingIndex--;
    } else {
      // Delete songs from next entry
      this._songs.splice(index, 1);
    }
  }

  async play() {
    if (!this.voiceConnection) {
      throw new Error("Bot is not connected to voice channel!");
    }
    if (this._nowPlayingIndex >= this._songs.length) {
      if (this.loop === "disabled") {
        this._isPlaying = false;
        return;
      } else {
        await this._prepareNextSong();
      }
    }

    if (!this.songs[this._nowPlayingIndex].url) {
      // this song is loaded from spotify without complete metadata
      // missing id & url
      // search this song on youtube first
      const searchResult = await searchYoutube(
        this.songs[this._nowPlayingIndex].title
      );
      this.songs[this._nowPlayingIndex] = {
        ...searchResult,
        requestedBy: this.songs[this._nowPlayingIndex].requestedBy,
        title: this.songs[this._nowPlayingIndex].title
      };
    }

    this.showNowPlaying();

    this._isPlaying = true;
    this._dispatcher = this.voiceConnection
      .playStream(
        await ytdl(this.songs[this._nowPlayingIndex].url, {
          filter: "audioonly",
          highWaterMark: 1 << 25
        })
      )
      .on("end", () => {
        this._onSongEnded();
      })
      .on("error", err => {
        this._onError(err);
      });
    this._dispatcher.setVolume(this._volume / 100);
  }

  stop() {
    if (this._dispatcher) {
      this._dispatcher.removeAllListeners();
      this._dispatcher.end();
      this._dispatcher = null;
    }
    this._isPlaying = false;
  }

  resume() {
    if (!this._isPlaying) {
      this.play();
    }
  }

  next() {
    if (this._isPlaying) {
      this.stop();
    }
    this._nowPlayingIndex++;
    this.play();
  }

  jump(index: number) {
    if (this._isPlaying) {
      this.stop();
    }
    this._nowPlayingIndex = index;
    this.play();
  }

  clear() {
    this.stop();
    this._songs = [];
    this._nowPlayingIndex = 0;
  }

  disconnect() {
    this.clear();
    this.voiceConnection.disconnect();
  }

  showNowPlaying() {
    const response = new RichEmbed()
      .setColor("#ffffff")
      .setTitle("Now playing")
      .setDescription(
        `[${unescape(this._songs[this._nowPlayingIndex].title)}](${
          this._songs[this._nowPlayingIndex].url
        }) - ${this._songs[this._nowPlayingIndex].duration}\nadded by <@${
          this._songs[this._nowPlayingIndex].requestedBy
        }>`
      );
    this.textChannel.send(response);
  }

  private _sendMessage(message: string) {
    if (this.textChannel) {
      this.textChannel.send(message, { code: "" });
    }
  }

  private _onSongEnded() {
    this._nowPlayingIndex++;
    this.play();
  }

  private _onError(err) {
    if (this.textChannel) {
      this.textChannel.send(err, { code: "js" });
    } else {
      console.log(err);
      throw err;
    }
  }

  private async _prepareNextSong() {
    if (this.loop === "song") {
      // play previous song again
      this._nowPlayingIndex--;
    } else if (this.loop === "queue") {
      // restart from the beginning;
      this._nowPlayingIndex = 0;
    } else if (this.loop === "autoplay") {
      // add new song
      const relatedSong = await getRelatedYoutubeVideo(
        this._songs[this._nowPlayingIndex - 1].id
      );
      const nextSong: Song = {
        ...relatedSong,
        requestedBy: this.botId
      };
      this._songs.push(nextSong);
    } else {
      throw new Error("Undefined loop mode.");
    }
  }
}

export default QueueManager;
