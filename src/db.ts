import low from "lowdb";
import FileSync from "lowdb/adapters/FileSync";
import { Playlist, BotConfigProps, ValueOf } from "./types";

interface DB {
  playlists: Playlist[];
  config: BotConfigProps;
  errors: string[];
}

const adapter = new FileSync<DB>("./db/db.json");
const db = low(adapter);
db._.mixin({
  pushWithId: (array: Playlist[], newItem: Playlist) => {
    const newArray = array.slice();
    const newId = newArray.length ? newArray[newArray.length - 1].id + 1 : 0;
    array.push({
      ...newItem,
      id: newId
    });
    return newArray;
  }
});
db.defaults({
  playlists: [],
  config: {
    prefix: "!",
    volume: 50,
    loop: "autoplay"
  },
  errors: []
}).write();

export function getPlaylist(): Playlist[] {
  return db
    .get("playlists")
    .sortBy("id")
    .value();
}

export function addPlaylist(newPlaylist: Playlist) {
  db.get("playlists")
    // @ts-ignore
    .pushWithId(newPlaylist)
    .write();
}

export function removePlaylist(playlistId: number) {
  db.get("playlists")
    .remove({ id: playlistId })
    .write();
}

export function loadPlaylist(playlistId: number): Playlist {
  return db
    .get("playlists")
    .find({ id: playlistId })
    .value();
}

export function getConfig(): BotConfigProps {
  return db.get("config").value();
}

export function setPrefix(prefix: BotConfigProps["prefix"]) {
  setConfig("config.prefix", prefix);
}

export function setVolume(volume: BotConfigProps["volume"]) {
  setConfig("config.volume", volume);
}

export function setLoop(loop: BotConfigProps["loop"]) {
  setConfig("config.loop", loop);
}

function setConfig(key: string, value: ValueOf<BotConfigProps>) {
  db.set(key, value).write();
}

export function logError(message: string) {
  db.get("errors")
    .push(message)
    .write();
}
