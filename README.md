# Discord Bot

Personalized for my group's Discord channel.

## Installation

```bash
git clone https|//github.com/sthobis/jigglypuff.git
cd jigglypuff
yarn
```

## Development

```
yarn dev
```

Requires every entry on the `.env` file to be specified. For `GOOGLE_API_KEY` make sure you have enabled Youtube Api usage on your google console.

## Production

```
yarn start
```

## Available commands

| Command                     | Description                                             |
| --------------------------- | ------------------------------------------------------- |
| **q**, **queue**            | Show queue or add any new song into the queue.          |
| **n**, **next**             | Skip current song being played.                         |
| **d**, **delete**           | Delete song entry {number} from queue.                  |
| **s**, **stop**             | Stop streaming song.                                    |
| **r**, **resume**           | Resume streaming song.                                  |
| **j**, **jump**             | Jump to song {number} in queue.                         |
| **m**, **mix**, **shuffle** | Randomize the order of songs in queue.                  |
| **c**, **clear**            | Clear current queue.                                    |
| **dc**, **disconnect**      | Kick bot from voice channel.                            |
| **np**, **nowplaying**      | Show current song being played.                         |
| **sq**                      | Show saved/available playlist.                          |
| **sql**                     | Load playlist {number} to current queue.                |
| **sqs**                     | Save current queue {name} into a new playlist.          |
| **sqd**                     | Delete playlist {number}.                               |
| **lq**                      | Set mode to loop current queue.                         |
| **ls**                      | Set mode to loop current song.                          |
| **la**                      | Set mode to autoplayed based on youtube recommendation. |
| **ld**                      | Disable loop/autoplay mode.                             |
| **v**, **volume**           | Set/get current volume.                                 |
| **prefix**                  | Set bot's prefix.                                       |
| **config**                  | Show current bot configuration.                         |
