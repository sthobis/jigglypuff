import low from "lowdb";
import FileSync from "lowdb/adapters/FileSync";
import { Playlist } from "./types";

interface DB {
  playlists: Playlist[];
}

const adapter = new FileSync<DB>("./db/db.json");
const db = low(adapter);
db._.mixin({
  pushWithId: (array: Playlist[], newItem: Playlist) => {
    const newArray = array.slice();
    const newId = newArray[newArray.length - 1].id + 1;
    array.push({
      ...newItem,
      id: newId
    });
    return newArray;
  }
});
db.defaults({ playlists: [] }).write();

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
