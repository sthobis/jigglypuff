import { VoiceChannel, VoiceConnection, TextChannel } from "discord.js";

export type LoopTypes = "queue" | "song" | "autoplay" | "disabled";

export interface Song {
  title: string;
  id: string;
  url: string;
  duration: string;
  requestedBy: string;
}

export interface ServerSongQueue {
  textChannel: TextChannel;
  voiceChannel: VoiceChannel;
  voiceConnection: VoiceConnection;
  songs: Song[];
  nowPlayingIndex: number;
  isPlaying: boolean;
}
