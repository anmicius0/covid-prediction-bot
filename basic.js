module.exports = {
  record: async (pgClient, message) => {
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

  respond: async (pgClient, message) => {
    // Validate the prediction
    message.react("✅")

    // Show the board
    const date = new Date()
    const guild = message.channel.id
    const { rows } = await pgClient.query(
      `SELECT * FROM "prediction" WHERE "guild"=$1 AND "date"=$2 ORDER BY "name" ASC`,
      [guild, date]
    )

    let content = `js\n明日確診人數\n`
    rows.forEach(
      (row) =>
        (content += `${row.name}  ${row.cases.slice(
          0,
          row.cases.length - 3
        )}\n`)
    )
    console.log(content)

    message.channel.send(`\`\`\`${content}\`\`\``)
  },

  get_cases: async (fetch) => {
    // Fetch Yahoo! News
    const res = await fetch(
      "https://news.campaign.yahoo.com.tw/2019-nCoV/index.php"
    )

    // With the magic of regexp
    const pattern = /本土病例[^境]+<div class="num _small">(\d+)<\/div>/gs
    const cases = pattern.exec(await res.text())[1]
    return cases
  },
}
