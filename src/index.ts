import Discord, { Message, TextChannel, RichEmbed } from "discord.js";
import dotenv from "dotenv";
import unescape from "lodash.unescape";
// For youtube search, we use cheerio(scraper) based library
// to prevent being limited by api rate limiter
import { LoopTypes } from "./types";
import { search } from "./youtube";
import QueueManager from "./QueueManager";

dotenv.config();

const prefix = "!";
const client = new Discord.Client();
const ServerQueueMap = new Map<string, QueueManager>();

// in-memory bot settings
interface BotConfigProps {
  volume: number;
  loop: LoopTypes;
}
const BotConfig: BotConfigProps = {
  volume: 100,
  loop: "autoplay"
};

client.once("ready", () => {
  console.log("Ready!");
});

client.once("reconnecting", () => {
  console.log("Reconnecting!");
});

client.once("disconnect", () => {
  console.log("Disconnect!");
});

client.on("message", async message => {
  // message sent by the bot itself, ignores it
  if (message.author.bot) return;
  // regular message, not intended to the bot, ignores it
  if (!message.content.startsWith(prefix)) return;
  // only usable in regular text channel
  if (message.channel.type !== "text") return;

  let serverQueue = ServerQueueMap.get(message.guild.id);
  if (!serverQueue) {
    serverQueue = new QueueManager({
      botId: client.user.id,
      loop: BotConfig.loop,
      volume: BotConfig.volume
    });

    ServerQueueMap.set(message.guild.id, serverQueue);
  }
  serverQueue.textChannel = message.channel as TextChannel;

  const command = message.content.split(" ")[0].replace(prefix, "");
  let args;
  switch (command) {
    case "q":
    case "queue":
      handleQueue(message);
      return;
    case "n":
    case "next":
      message.react("👌");
      handleNext(message);
      return;
    case "d":
    case "delete":
      handleDelete(message);
      return;
    case "s":
    case "stop":
      message.react("👌");
      handleStop(message);
      return;
    case "r":
    case "resume":
      message.react("👌");
      handleResume(message);
      return;
    case "j":
    case "jump":
      handleJump(message);
      return;
    case "c":
    case "clear":
      message.react("👌");
      handleClear(message);
      return;
    case "dc":
    case "disconnect":
      message.react("👌");
      handleDisconnect(message);
      return;
    case "np":
    case "nowplaying":
      handleNowPlaying(message);
      return;
    case "sq":
      // TODO
      // show available shared playlist - need to persist this somewhere
      return;
    case "sql":
      // TODO
      // load saved queue
      return;
    case "lq":
      BotConfig.loop = "queue";
      serverQueue.loop = "queue";
      message.channel.send(`Mode set to loop \`queue\``, { code: "" });
      return;
    case "ls":
      BotConfig.loop = "song";
      serverQueue.loop = "song";
      message.channel.send(`Mode set to loop \`song\``, { code: "" });
      return;
    case "la":
      BotConfig.loop = "autoplay";
      serverQueue.loop = "autoplay";
      message.channel.send(
        `Mode set to \`autoplay\` (recommended song by youtube)`,
        { code: "" }
      );
      return;
    case "ld":
      BotConfig.loop = "disabled";
      serverQueue.loop = "disabled";
      message.channel.send(`Mode set to loop \`disabled\``, { code: "" });
      return;
    case "v":
    case "volume":
      args = getArgs(message.content);
      if (args) {
        BotConfig.volume = parseInt(args);
        serverQueue.volume = parseInt(args);
        message.channel.send(`Volume set to ${BotConfig.volume}%`, {
          code: ""
        });
      } else {
        message.channel.send(`Volume is on ${BotConfig.volume}%`, { code: "" });
      }
      return;
    case "config":
      message.channel.send(
        `Mode is \`${
          BotConfig.loop === "autoplay"
            ? BotConfig.loop
            : `loop ${BotConfig.loop}`
        }\`\nVolume is on ${BotConfig.volume}%`,
        { code: "" }
      );
      return;
    case "command":
    case "commands":
      const response = new RichEmbed()
        .setColor("#ffffff")
        .setTitle("Command list").setDescription(`
**q**, **queue** : Show queue or add any new song into the queue.
**n**, **next** : Skip current song being played.
**d**, **delete**: Delete song entry {number} from queue.
**s**, **stop** : Stop streaming song.
**r**, **resume**: Resume streaming song.
**j**, **jump**: Jump to song {number} in queue.
**c**, **clear** : Clear current queue.
**dc**, **disconnect** : Kick bot from voice channel.
**np**, **nowplaying** : Show current song being played.
**lq** : Set mode to loop current queue.
**ls** : Set mode to loop current song.
**la** : Set mode to autoplayed based on youtube recommendation.
**ld** : Disable loop/autoplay mode.
**v**, **volume** : Set/get current volume.
**config** : Show current bot configuration.
\nPR for bug fix or new feature welcomed at [github](https://github.com/sthobis/jigglypuff).
`);
      message.channel.send(response);
      return;
    default:
      message.channel.send(
        "You need to enter a valid command! Type !commands fore more info.",
        { code: "" }
      );
  }
});

function getArgs(text: string): string {
  if (text.indexOf(" ") < 0) {
    return null;
  }
  return text.substring(text.indexOf(" ") + 1, text.length);
}

async function handleQueue(message: Message) {
  const voiceChannel = message.member.voiceChannel;
  if (!voiceChannel)
    return message.channel.send(
      "You need to be in a voice channel to use this command!",
      { code: "" }
    );

  const permissions = voiceChannel.permissionsFor(client.user);
  if (!permissions.has("CONNECT") || !permissions.has("SPEAK")) {
    return message.channel.send(
      "I need the permissions to join and speak in your voice channel!",
      { code: "" }
    );
  }

  const serverQueue = ServerQueueMap.get(message.guild.id);
  // if bot is on different voice channel,
  // join user's voice channel
  if (voiceChannel !== serverQueue.voiceChannel) {
    serverQueue.voiceChannel = voiceChannel;
    serverQueue.voiceConnection = await voiceChannel.join();
  }

  const songQuery = getArgs(message.content);

  // !queue command
  // shows current queue without adding anything
  if (!songQuery) {
    if (serverQueue.songs.length) {
      message.channel.send(
        serverQueue.songs
          .map((song, index) => {
            if (index === serverQueue.nowPlayingIndex) {
              return `    ⬐ current track
${index}) ${unescape(song.title)}
    ⬑ current track`;
            } else {
              return `${index}) ${unescape(song.title)}`;
            }
          })
          .join("\n"),
        { code: "" }
      );
    } else {
      message.channel.send("Queue is empty.", { code: "" });
    }
    return;
  }

  // !queue <query> command
  // add new song into queue
  const searchResult = await search(songQuery);
  const song = { ...searchResult, requestedBy: message.author.id };
  serverQueue.queue(song);
}

async function handleNext(message: Message) {
  const voiceChannel = message.member.voiceChannel;
  if (!voiceChannel)
    return message.channel.send(
      "You need to be in a voice channel to use this command!",
      { code: "" }
    );

  const serverQueue = ServerQueueMap.get(message.guild.id);
  // if bot is on different voice channel,
  // join user's voice channel
  if (voiceChannel !== serverQueue.voiceChannel) {
    serverQueue.voiceChannel = voiceChannel;
    serverQueue.voiceConnection = await voiceChannel.join();
  }

  serverQueue.next();
}

async function handleDelete(message: Message) {
  const voiceChannel = message.member.voiceChannel;
  if (!voiceChannel)
    return message.channel.send(
      "You need to be in a voice channel to use this command!",
      { code: "" }
    );

  const serverQueue = ServerQueueMap.get(message.guild.id);
  // if bot is on different voice channel,
  // join user's voice channel
  if (voiceChannel !== serverQueue.voiceChannel) {
    serverQueue.voiceChannel = voiceChannel;
    serverQueue.voiceConnection = await voiceChannel.join();
  }

  const deleteIndex = parseInt(getArgs(message.content));
  serverQueue.delete(deleteIndex);
}

async function handleStop(message: Message) {
  const voiceChannel = message.member.voiceChannel;
  if (!voiceChannel)
    return message.channel.send(
      "You need to be in a voice channel to use this command!",
      { code: "" }
    );

  const serverQueue = ServerQueueMap.get(message.guild.id);
  // if bot is on different voice channel,
  // join user's voice channel
  if (voiceChannel !== serverQueue.voiceChannel) {
    serverQueue.voiceChannel = voiceChannel;
    serverQueue.voiceConnection = await voiceChannel.join();
  }

  serverQueue.stop();
}

async function handleResume(message: Message) {
  const voiceChannel = message.member.voiceChannel;
  if (!voiceChannel)
    return message.channel.send(
      "You need to be in a voice channel to use this command!",
      { code: "" }
    );

  const serverQueue = ServerQueueMap.get(message.guild.id);
  // if bot is on different voice channel,
  // join user's voice channel
  if (voiceChannel !== serverQueue.voiceChannel) {
    serverQueue.voiceChannel = voiceChannel;
    serverQueue.voiceConnection = await voiceChannel.join();
  }

  serverQueue.resume();
}

async function handleJump(message: Message) {
  const voiceChannel = message.member.voiceChannel;
  if (!voiceChannel)
    return message.channel.send(
      "You need to be in a voice channel to use this command!",
      { code: "" }
    );

  const serverQueue = ServerQueueMap.get(message.guild.id);
  // if bot is on different voice channel,
  // join user's voice channel
  if (voiceChannel !== serverQueue.voiceChannel) {
    serverQueue.voiceChannel = voiceChannel;
    serverQueue.voiceConnection = await voiceChannel.join();
  }

  const jumpIndex = parseInt(getArgs(message.content));
  console.log("Jump index", jumpIndex);
  serverQueue.jump(jumpIndex);
}

async function handleClear(message: Message) {
  const voiceChannel = message.member.voiceChannel;
  if (!voiceChannel)
    return message.channel.send(
      "You need to be in a voice channel to use this command!",
      { code: "" }
    );

  const serverQueue = ServerQueueMap.get(message.guild.id);
  // if bot is on different voice channel,
  // join user's voice channel
  if (voiceChannel !== serverQueue.voiceChannel) {
    serverQueue.voiceChannel = voiceChannel;
    serverQueue.voiceConnection = await voiceChannel.join();
  }

  serverQueue.clear();
}

async function handleNowPlaying(message: Message) {
  const serverQueue = ServerQueueMap.get(message.guild.id);
  serverQueue.showNowPlaying();
}

function handleDisconnect(message: Message) {
  const serverQueue = ServerQueueMap.get(message.guild.id);
  serverQueue.disconnect();
}

// RELEASE THE KRAKEN
(async () => {
  const result = await client.login(process.env.DISCORD_TOKEN);
  console.log("Login", result);
})();
