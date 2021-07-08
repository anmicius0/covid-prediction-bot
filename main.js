require("dotenv").config()

// connect Discord
const Discord = require("discord.js")
const client = new Discord.Client()

// connect database
const pg = require("pg")
const pgClient = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
})
pgClient.connect()

// Cron job
var cron = require("node-cron")
const fetch = require("node-fetch")
process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = "0"

// Import my own functions
const {
  record,
  reply,
  get_cases,
  get_predictions,
  announce,
  cleanUp,
  updateLeaderBoard,
} = require("./basic")

// On ready
client.on("ready", async () => {
  console.log("Hello, world")
})

// On message
client.on("message", async (message) => {
  // If it's a pure integer
  const original = message.content
  const parsed = parseInt(message.content)
  if (original == parsed && parsed >= 0) {
    // Record to DB
    let res = await record(pgClient, message)

    // Reply
    if (res) {
      reply(pgClient, message)
    }
  }
})

// Reveal the result everyday
cron.schedule("20 14 * * *", async () => {
  // Fetch cases
  const cases = await get_cases(fetch)

  // Fetch DB
  const channels = await get_predictions(pgClient)

  // Announce
  announce(client, cases, channels)

  // Show leader board
  updateLeaderBoard(client, cases, channels)

  // Clean up the DB
  cleanUp(pgClient)
})

client.login(process.env.BOT_TOKEN)
