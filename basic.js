module.exports = {
  record: async (pgClient, message) => {
    /**
     * Store the prediction to DB
     * @param {node-postgres client} pgClient - The connection to the database
     * @param {message} message - The user message (the prediction)
     * @return {boolean} result - Indicating whether the process was successful
     */

    // Check
    // Check time
    const date = new Date()
    if (date.getUTCHours() === 6) {
      if (date.getUTCMinutes() >= 0 && date.getUTCMinutes() <= 30) {
        // Invalid
        message.react("🚫")
        message.channel.send(
          "🚫 Guesses between 14:00 to 14:30 are not allowed."
        )
        return false
      }
    }

    // Add
    // Check if there is previous prediction
    const guild = message.channel.id
    const user = message.author.id
    const cases = parseInt(message.content)
    const name = message.author.username

    let query = await pgClient.query(
      `SELECT * FROM "prediction" WHERE "guild"=$1 AND "user"=$2 AND "date"=$3`,
      [guild, user, date]
    )

    // If there is one record, update it
    if (query.rows.length === 1) {
      await pgClient.query(`UPDATE "prediction" SET "cases"=$1 WHERE "id"=$2`, [
        cases,
        query.rows[0].id,
      ])
    }
    // Else, insert the record
    else {
      await pgClient.query(
        `INSERT INTO "prediction" ("guild", "user", "name", "cases", "date")
          VALUES ($1, $2, $3, $4, $5)`,
        [guild, user, name, cases, date]
      )
    }

    return true
  },

  reply: async (pgClient, message) => {
    /**
     * Reply the current status of that channel
     * @param {node-postgres client} pgClient - The connection to the database
     * @param {message} message - The user message (the prediction)
     */

    // Validate the prediction
    message.react("✅")

    // Show the board
    const date = new Date()
    const guild = message.channel.id
    const { rows } = await pgClient.query(
      `SELECT * FROM "prediction" WHERE "guild"=$1 AND "date"=$2 ORDER BY "name" ASC`,
      [guild, date]
    )

    let content = `js\nCurrent prediction for tomorrow:\n`
    rows.forEach(
      (row) => (content += `${row.name}  ${row.cases.slice(0, -3)}\n`)
    )

    message.channel.send(`\`\`\`${content}\`\`\``)
  },

  get_cases: async (fetch) => {
    /**
     * Return the latest local case number
     * @param {fetch object} fetch
     * @return {int} cases - Case number
     */

    // Fetch Yahoo! News
    const res = await fetch(
      "https://news.campaign.yahoo.com.tw/2019-nCoV/index.php"
    )

    // With the magic of regexp
    const pattern = /本土病例[^境]+<div class="num _small">(\d+)<\/div>/gs
    const cases = pattern.exec(await res.text())[1]
    return parseInt(cases)
  },

  get_predictions: async (pgClient) => {
    /**
     * Get predictions of all channels from DB
     * @param {node-postgres client} pgClient - The connection to the database
     * @return {dictionary} channels - {guild: [predictions...] ...}
     */

    // Get all the channel
    const date = new Date()
    let { rows } = await pgClient.query(
      `SELECT * FROM "prediction" WHERE "date"=$1`,
      [date]
    )

    // Build records for each channel
    let channels = {}
    rows.forEach((row) => {
      const guild = row.guild
      if (!channels[guild]) {
        channels[guild] = [row]
      } else {
        channels[guild].push(row)
      }
    })
    return channels
  },

  announce: (client, cases, channels) => {
    /**
     * Get predictions of all channels from DB
     * @param {Discord client} client - Connection to Discord
     * @param {int} cases - Current case number
     * @param {dictionary} channels - predictions from different channels
     */

    Object.keys(channels).forEach((guild) => {
      // Establish the connection to the channel
      const channel = client.channels.cache.find(
        (channel) => channel.id === guild
      )

      // Parsing the message
      const date = new Date()
      let content = `js\n${date.getFullYear()}-${date.getMonth()}-${date.getDate()}\n`

      // Get max name length
      let length = 0
      channels[guild].forEach((prediction) => {
        if (prediction.name.length > length) {
          length = prediction.name.length
        }
      })
      length += 3

      let winners = []
      let counter = 9999
      channels[guild].forEach((prediction) => {
        // Username
        content += `${prediction.name}`
        // Padding
        for (let i = 0; i < length - prediction.name.length; i++) {
          content += ` `
        }
        // Case and count
        content += `${prediction.cases.slice(0, -3)}(${
          prediction.cases - cases
        })\n`

        // Store winner
        if (Math.abs(prediction.cases - cases) < counter) {
          counter = Math.abs(prediction.cases - cases)
          winners = [prediction.name]
        } else if (Math.abs(prediction.cases - cases) === counter) {
          winners.push(prediction.name)
        }
      })

      content += `result: ${cases},  `
      winners.forEach((winner) => (content += `${winner} `))
      content += `wins`

      // Send <3
      channel.send(`\`\`\`${content}\`\`\``)
    })
  },

  cleanUp: (pgClient) => {
    /**
     * Remove all previous prediction
     * @param {PG client} pgClient - Connection to DB
     */

    const date = new Date()
    pgClient.query(`DELETE FROM prediction WHERE "date"=$1`, [date])
  },

  updateLeaderBoard: function (pgClient, cases, channels) {
    /**
     * Show leader board
     * @param {node-postgres client} pgClient - The connection to the database
     * @param {int} cases - Current case number
     * @param {dictionary} channels - predictions from different channels
     */

    Object.keys(channels).forEach((guild) => {
      let first = []
      let second = []
      let other = []

      // Determine the number standard of each level
      let standards = new Set()
      channels[guild].forEach((prediction) => {
        standards.add(Math.abs(prediction.cases - cases))
      })
      standards = Array.from(standards).sort().slice(0, 3)

      // add prediction to its level
      channels[guild].forEach((prediction) => {
        switch (Math.abs(prediction.cases - cases)) {
          case standards[0]:
            first.push(prediction)
            break
          case standards[1]:
            second.push(prediction)
            break
          default:
            other.push(prediction)
        }
      })

      // update balance
      first.forEach((prediction) => {
        module.exports.updateBalance(
          pgClient,
          prediction.guild,
          prediction.user,
          prediction.name,
          20
        )

        module.exports.updateBalance(
          pgClient,
          prediction.guild,
          prediction.user,
          prediction.name,
          20
        )
      })

      second.forEach((prediction) => {
        module.exports.updateBalance(
          pgClient,
          prediction.guild,
          prediction.user,
          prediction.name,
          15
        )
      })

      other.forEach((prediction) => {
        module.exports.updateBalance(
          pgClient,
          prediction.guild,
          prediction.user,
          prediction.name,
          10
        )
      })

      // Update cases
      first
        .concat(second)
        .concat(other)
        .forEach((prediction) => {
          module.exports.updateCases(
            pgClient,
            prediction.guild,
            prediction.user,
            Math.abs(prediction.cases - cases)
          )
        })
    })
  },

  updateBalance: async (pgClient, guild, user, name, change) => {
    /**
     * Update balance
     * @param {node-postgres client} pgClient - The connection to the database
     * @param {text} guild
     * @param {text} user - user id
     * @param {text} name - user name
     * @param {int} change - Amount of balance change
     */

    const { rows } = await pgClient.query(
      `SELECT * FROM account WHERE "guild"=$1 AND "user"=$2`,
      [guild, user]
    )

    // If no account, create one
    if (rows.length === 0) {
      await pgClient.query(
        `INSERT INTO account("guild", "user", "name", "balance") VALUES ($1, $2, $3, $4)`,
        [guild, user, name, change]
      )
    }
    // If have account, update the balance
    else {
      await pgClient.query(
        `UPDATE account SET "balance"=$1 WHERE "guild"=$2 AND "user"=$3`,
        [rows[0].balance + change, guild, user]
      )
    }
  },

  updateCases: async (pgClient, guild, user, cases) => {
    /**
     * Update cases and times
     * @param {node-postgres client} pgClient - The connection to the database
     * @param {text} guild
     * @param {text} user - user id
     * @param {int} cases - Amount of cases added
     */

    const { rows } = await pgClient.query(
      `SELECT * FROM account WHERE "guild"=$1 AND "user"=$2`,
      [guild, user]
    )

    // If no account, create one
    if (rows.length === 0) {
      return false
    }
    // If have account, update the balance
    else {
      await pgClient.query(
        `UPDATE account SET "cases"=$1, "times"=$2 WHERE "guild"=$3 AND "user"=$4`,
        [rows[0].cases + cases, rows[0].times + 1, guild, user]
      )
    }
  },
}
