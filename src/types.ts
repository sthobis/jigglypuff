import { VoiceChannel, VoiceConnection, TextChannel } from "discord.js";

export type LoopTypes = "queue" | "song" | "autoplay" | "disabled";

export type Nullable<T> = T | undefined | null;

export type ValueOf<T> = T[keyof T];

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

export interface Playlist {
  id?: number;
  name: string;
  queue: Song[];
  addedBy: string;
}

export interface BotConfigProps {
  prefix: string;
  volume: number;
  loop: LoopTypes;
}
