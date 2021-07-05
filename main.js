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
const { record, respond, get_cases } = require("./basic")

// On ready
client.on("ready", async () => {
  console.log("Hello, world")
  let cases = await get_cases(fetch)
  console.log(cases)
})

// On message
client.on("message", async (message) => {
  // If it's a pure integer
  const original = message.content
  const parsed = parseInt(message.content)
  if (original == parsed && parsed >= 0) {
    // Record to DB
    let res = await record(pgClient, message)

    // Respond
    if (res) {
      respond(pgClient, message)
    }
  }
})

// Reveal the result everyday
cron.schedule("20 14 * * *", () => {
  // Fetch cases
  // Fetch DB
  // Announce
})

client.login(process.env.BOT_TOKEN)
