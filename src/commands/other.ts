import { Message, MessageEmbed } from "discord.js";
import axios from "axios";
import pm2 from "pm2";
import QueueManager from "../QueueManager";
import { logError, getConfig, setPrefix } from "../db";
import { getArgs } from "../util";

export default {
  dc: handleDisconnect,
  disconnect: handleDisconnect,
  h: handleHelp,
  help: handleHelp,
  reboot: handleReboot,
  prefix: handlePrefix,
  config: handleConfig,
  // extras
  corona: handleCorona,
  roll: handleRoll,
  holiday: handleHoliday,
};

function handleHelp(message: Message) {
  const response = new MessageEmbed()
    .setColor("#ffffff")
    .setTitle("Command list").setDescription(`
**q**, **queue** : Show queue or add any new song into the queue.
**qn**: Add new song next to current song being played.
**qid**, **qnid** : Add new song using youtube id.
**qurl**, **qnurl** : Add new song using youtube url.
**n**, **next** : Skip current song being played.
**d**, **delete**: Delete song entry {number} from queue.
**s**, **stop** : Stop streaming song.
**r**, **resume**: Resume streaming song.
**j**, **jump**: Jump to song {number} in queue.
**m**, **mix**, **shuffle**: Randomize the order of songs in queue.
**c**, **clear** : Clear current queue.
**dc**, **disconnect** : Kick bot from voice channel.
**np**, **nowplaying** : Show current song being played.
**sq** : Show saved/available playlist.
**sql** : Load playlist {number} to current queue.
**sqs** : Save current queue {name} into a new playlist.
**sqd** : Delete playlist {number}.
**lq** : Set mode to loop current queue.
**ls** : Set mode to loop current song.
**la** : Set mode to autoplayed based on youtube recommendation.
**ld** : Disable loop/autoplay mode.
**v**, **volume** : Set/get current volume.
**prefix** : Set bot's prefix.
**config** : Show current bot configuration.

**corona** : Show latest corona stats in Indonesia.
**roll** : Roll a number.
**holiday** : Link to Indonesia's public holiday calendar.
**reboot** : Have you tried turning it off and on again.

PR for bug fix or new feature welcomed at [github](https://github.com/sthobis/jigglypuff).
`);
  message.channel.send(response);
}

function handleDisconnect(message: Message, serverQueue: QueueManager) {
  message.react("👌");
  serverQueue.disconnect();
}

function handleReboot(message: Message, serverQueue: QueueManager) {
  pm2.connect((err: Error) => {
    if (err) {
      message.channel.send(`Failed to connect to pm2.`, {
        code: "",
      });
      logError(err.message);
    }

    message.react("👌");
    handleDisconnect(message, serverQueue);
    pm2.restart("jigglypuff", (err: Error) => {
      if (err) {
        message.channel.send(`Failed to restart pm2 process.`, {
          code: "",
        });
        logError(err.message);
      }
      pm2.disconnect();
    });
  });
}

function handlePrefix(message: Message) {
  const args = getArgs(message.content);
  if (args) {
    setPrefix(args);
    message.channel.send(`Bot prefix set to ${args}`, {
      code: "",
    });
  } else {
    const config = getConfig();
    message.channel.send(`Bot prefix is ${config.prefix}`, { code: "" });
  }
}

function handleConfig(message: Message) {
  const config = getConfig();
  message.channel.send(
    `Mode is "${
      config.loop === "autoplay" ? config.loop : `loop ${config.loop}`
    }"\nVolume is on ${config.volume}%\nPrefix is "${config.prefix}"`,
    { code: "" }
  );
}

async function handleCorona(message: Message) {
  try {
    const { meninggal, sembuh, perawatan, jumlahKasus } = (
      await axios.get("https://indonesia-covid-19.mathdro.id/api")
    ).data;
    const response = new MessageEmbed()
      .setColor("#ffffff")
      .setTitle("🇮🇩  Corona Tracker").setDescription(`
Jumlah kasus: ${jumlahKasus}
Perawatan: ${perawatan}
Sembuh: ${sembuh}
Meninggal: ${meninggal}
\n[Data source](https://indonesia-covid-19.mathdro.id/api)
`);
    message.channel.send(response);
  } catch (err) {
    message.channel.send(
      `Failed to request data from https://indonesia-covid-19.mathdro.id/api\nTry again later`,
      { code: "" }
    );
  }
}

function handleRoll(message: Message) {
  const args = getArgs(message.content);
  const max = args ? parseInt(args) : 100;

  const rolled = Math.round(Math.random() * (max - 0) + 0);
  message.channel.send(`${message.member.displayName} rolled a ${rolled}`, {
    code: "",
  });
}

function handleHoliday(message: Message) {
  const response = new MessageEmbed()
    .setColor("#ffffff")
    .setTitle("🇮🇩  Public Holiday").setDescription(`
[Google calendar](https://calendar.google.com/calendar/u/0/embed?src=en.indonesian%23holiday@group.v.calendar.google.com&ctz=Asia/Jakarta)
`);
  message.channel.send(response);
}
