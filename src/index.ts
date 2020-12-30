import Discord, { Message, TextChannel } from "discord.js";
import dotenv from "dotenv";
import { getConfig } from "./db";
import QueueManager from "./QueueManager";
import MusicCommands from "./commands/music";
import OtherCommands from "./commands/other";

dotenv.config();

const client = new Discord.Client();
const ServerQueueMap = new Map<string, QueueManager>();

client.once("ready", () => {
  console.log("Ready!");
  updatePresence();
});

client.once("reconnecting", () => {
  console.log("Reconnecting!");
});

client.once("disconnect", () => {
  console.log("Disconnect!");
});

if (process.env.DEBUG) {
  client.on("debug", console.log);
}

client.on("message", async (message) => {
  const config = getConfig();

  // message sent by the bot itself, ignores it
  if (message.author.bot) return;
  // regular message, not intended to the bot, ignores it
  if (!message.content.startsWith(config.prefix)) return;
  // only usable in regular text channel
  if (message.channel.type !== "text") return;

  let serverQueue = ServerQueueMap.get(message.guild.id);
  if (!serverQueue) {
    serverQueue = new QueueManager({
      botId: client.user.id,
      loop: config.loop,
      volume: config.volume,
    });

    ServerQueueMap.set(message.guild.id, serverQueue);
  }
  serverQueue.textChannel = message.channel as TextChannel;

  const command = message.content.split(" ")[0].replace(config.prefix, "");
  if (Object.keys(MusicCommands).includes(command)) {
    const permissionLegit = await checkMusicPermission(message, serverQueue);
    if (permissionLegit) {
      const handler = MusicCommands[command];
      handler(message, serverQueue);
    }
  } else if (Object.keys(OtherCommands).includes(command)) {
    const handler = OtherCommands[command];
    handler(message, serverQueue);
    if (command === "prefix") {
      updatePresence();
    }
  } else {
    const config = getConfig();
    message.channel.send(
      `You need to enter a valid command! Type ${config.prefix}help for more info.`,
      { code: "" }
    );
  }
});

function updatePresence() {
  const config = getConfig();

  client.user.setPresence({
    activity: {
      name: `${config.prefix}help`,
      type: "LISTENING",
    },
  });
}

async function checkMusicPermission(
  message: Message,
  serverQueue: QueueManager
): Promise<boolean> {
  const voiceChannel = message.member.voice.channel;
  if (!voiceChannel) {
    message.channel.send(
      "You need to be in a voice channel to use this command!",
      { code: "" }
    );
    return false;
  }

  const permissions = voiceChannel.permissionsFor(client.user);
  if (!permissions.has("CONNECT") || !permissions.has("SPEAK")) {
    message.channel.send(
      "I need the permissions to join and speak in your voice channel!",
      { code: "" }
    );
    return false;
  }

  // if bot is on different voice channel,
  // join user's voice channel
  if (voiceChannel !== serverQueue.voiceChannel) {
    serverQueue.voiceChannel = voiceChannel;
    serverQueue.voiceConnection = await voiceChannel.join();
  }
  return true;
}

// START THE BOT
(async () => {
  const result = await client.login(process.env.DISCORD_TOKEN);
  console.log("Discord login", result);
})();
