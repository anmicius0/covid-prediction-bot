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

// Import my own functions
const { record, respond } = require("./basic")

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

    // Respond
    if (res) {
      respond(pgClient, message)
    }
  }
})

client.login(process.env.BOT_TOKEN)
