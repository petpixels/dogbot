// bot.js
var bot = function () {}

// When it says secret, it really kind of means secret...
// so let's put it right at the top of this file here
const bot_secret = require('./bot-secret')

var bot_name
var bot_greeting
var bot_rating
var bot_reply
var bot_keywords
var bot_odds
var bot_channel
var bot_platform

const MongoClient = require('mongodb').MongoClient

const fs = require('fs')
const request = require('request')

const { createLogger, format, transports } = require('winston')
const env = process.env.NODE_ENV || 'development'

require('winston-daily-rotate-file')

const conf_dir = "conf" // log directory
const log_dir = "logs" // log directory
const log_file = "bot" // log file name

// Create the log & conf directories if it does not exist
if (!fs.existsSync(log_dir)) { fs.mkdirSync(log_dir) }
if (!fs.existsSync(conf_dir)) { fs.mkdirSync(conf_dir) }

// const filename = path.join(log_dir, 'emuji.log')
const dailyRotateFileTransport = new transports.DailyRotateFile({
  filename: `${log_dir}/${log_file}-%DATE%.log`,
  datePattern: 'YYYY-MM-DD'
})

const logger = createLogger({
  // change level if in dev environment versus production
  level: env === 'development' ? 'debug' : 'info',
  format: format.combine(
    format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    format.printf(info => `${info.timestamp} ${info.level}: ${info.message}`)
  ),
  transports: [
    new transports.Console({
      level: 'info',
      format: format.combine(
        format.colorize(),
        format.printf(
          info => `${info.timestamp} ${info.level}: ${info.message}`
        )
      )
    }),
    dailyRotateFileTransport
    //new transports.File({ filename })
  ]
})

bot.prototype.name = function(name) {
  bot.bot_name = name
  logger.info("@" + bot.bot_name + ": Hello, my name is " + bot.bot_name)
}

bot.prototype.keywords = function(input) {
  bot.keywords = input.toLowerCase()
  logger.info("@" + bot.bot_name + ": Keywords changed to " + bot.keywords)
}

bot.prototype.default_reply = function(reply) {
  bot.bot_reply = reply
  logger.info("@" + bot.bot_name + ": Default reply changed to " + bot.bot_reply)
}

bot.prototype.odds = function(percent) {
  bot.bot_odds = percent
  logger.info("@" + bot.bot_name + ": Odds set to " + bot.bot_odds * 100 + "%")
}

bot.prototype.channel = function(channel) {
	if (channel) {
		bot.bot_channel = channel
		logger.info("@" + bot.bot_name + ": Bot channel set to #" + channel.name)
	} else {
		logger.info("@" + bot.bot_name + ": 404 channel not found")
	}
}

bot.prototype.say = function(input, channel = bot_channel) {

	// default input, if empty
	if (input) {
		msg = input
	} else {
		msg = bot.bot_reply
	}

	if (channel) {
		console.log("channel id: " + channel.id)
		channel.send(msg)
		logger.info("@" + bot.bot_name + ": <" + channel.id + ":" +channel.name + "> " + msg)
	} else {
		console.log("Error: Channel not specified")
		console.log(channel)
	}
}


bot.prototype.reply = function(channel, input = "") {
  var retString = bot.bot_reply

  if (!(input)) {
    // set default odds to 25%
    if (!(bot.bot_odds)) {
      bot.bot_odds = .25
      logger.info("@" + bot.bot_name + ": Odds defaulted to " + (bot.bot_odds * 100) + "%")
    }

    var roll = Math.random()
    if (roll < bot.bot_odds) {
      var nowPlaying = []
      var fileReplies = "./" + conf_dir + "/reply.txt"
      var retString = bot.bot_reply

      var replies = fs.readFileSync(fileReplies).toString().split("\n")
      var randomReply = Math.floor(Math.random() * replies.length)

      for (i in replies) {
        //console.log(nowPlaying[i])
        if (i == randomReply) {
          retString = replies[randomReply]
        }
      }

      if (!(retString)) { retString = bot.bot_reply }
    } else {
			retString = bot.bot_reply
		}
  } else {
    // process input
  }

	if (channel) {
		//channel.send(retString)
	} else {
		// error
	}

  logger.info("@" + bot.bot_name + ": " + retString)
  return retString
}

bot.prototype.rating = function(rating) {
  bot.bot_rating = rating
  logger.info("@" + bot.bot_name + ": Rating changed to " + bot.bot_rating)
}

bot.prototype.log = function(msg) {
  logger.info("@" + bot.bot_name + ": " + msg)
}

bot.prototype.gif = function(channel, q) {
  if (!(q)) { q = "" } // default to empty string

  var aGif = q.replace(",", " ").split(" ")
  var gifRating = bot.bot_rating
  var gifTag = bot.bot_name.replace("bot","")
  var gifLoc = 0
  var gif

  // filter out !gif command
  for (var i = 0; i < aGif.length; i++) {
    if (aGif[i] == "!gif") {
      gifLoc = i+1
    }
  }

  // build giphy query URL
  for (var i = gifLoc; i < aGif.length; i++) {
    gifTag = gifTag + "%20" + aGif[i]
  }

  // default to G-Rated
  if (!(gifRating)) { gifRating = "G" }

  var url = "https://api.giphy.com/v1/gifs/random?api_key=" + bot_secret.giphy_api_key + "&tag=" + gifTag + "&rating=" + gifRating;
  logger.info("@" + bot.bot_name + ": " + "Giphy request URL: " + url)

  request.get({
    url: url,
    json: true,
    headers: {'User-Agent': 'request'}
  }, (err, res, data) => {
    if (err) {
      logger.debug("@" + bot.bot_name + ": " + "Giphy request failed")
    } else if (res.statusCode !== 200) {
      logger.debug("@" + bot.bot_name + ": " + "Giphy request succeeded")
    } else {
      // data is already parsed as JSON:
      var received = data
      // loop through each data object because there can be more than one
      for (var data in received) {
        var giphy = received[data]
        gif = giphy.embed_url

        if (gif) {
          logger.info("@" + bot.bot_name + ": " + gif)

          channel.send(gif)
        }
      }
    }
  })
}

bot.prototype.sticker = function(channel, q) {
  if (!(q)) { q = "" } // default to empty string

	var aSticker = q.replace(",", " ").split(" ")
  var stickerRating = bot.bot_rating
  var stickerTag = bot.bot_name.replace("bot","")
  var stickerLoc = 0
  var sticker

  // filter out !gif command
  for (var i = 0; i < aSticker.length; i++) {
    if (aSticker[i] == "!sticker") {
      stickerLoc = i+1
    }
  }

  // build giphy query URL
  for (var i = stickerLoc; i < aSticker.length; i++) {
    stickerTag = stickerTag + "%20" + aSticker[i]
  }

  // default to G-Rated
  if (!(stickerRating)) { stickerRating = "G" }

  var url = "https://api.giphy.com/v1/stickers/random?api_key=" + bot_secret.giphy_api_key + "&tag=" + stickerTag + "&rating=" + stickerRating;
  logger.info("@" + bot.bot_name + ": " + "Giphy request URL: " + url)

  request.get({
    url: url,
    json: true,
    headers: {'User-Agent': 'request'}
  }, (err, res, data) => {
    if (err) {
      logger.debug("@" + bot.bot_name + ": " + "Giphy request failed")
    } else if (res.statusCode !== 200) {
      logger.debug("@" + bot.bot_name + ": " + "Giphy request succeeded")
    } else {
      // data is already parsed as JSON:
      var received = data
      // loop through each data object because there can be more than one
      for (var data in received) {
        var giphy = received[data]
        sticker = giphy.embed_url

        if (sticker) {
          logger.info("@" + bot.bot_name + ": " + sticker)
          channel.send(sticker)
        }
      }
    }
  })
}

bot.prototype.play = function(msg) {

  var nowPlaying

  if (msg) {
    nowPlaying = msg
  } else {
    var nowPlaying = this.randomPlaying()
  }

  logger.info("@" + bot.bot_name + ": " + "Now Playing: " + nowPlaying)
  return nowPlaying
}

bot.prototype.randomPlaying = function() {

  var nowPlaying = []
  var filePlaying = "./" + conf_dir + "/play.txt"
  var retString

  var nowPlaying = fs.readFileSync(filePlaying).toString().split("\n")
  var randomPlayingNum = Math.floor(Math.random() * nowPlaying.length -1)

  for (i in nowPlaying) {
    if (i == randomPlayingNum) {
      retString = nowPlaying[randomPlayingNum]
    }
  }

  if (!(retString)) { retString = bot.bot_reply }
  return retString
}

bot.prototype.randomReply = function() {
  // atMeow[24] = this.randomCatEmoji()

  var fileReplies = "./" + conf_dir + "/reply.txt"
  var retString

  var replies = fs.readFileSync(fileReplies).toString().split("\n")
  var randomReplyNum = Math.floor(Math.random() * replies.length -1)

  for (i in replies) {
    //console.log(nowPlaying[i])
    if (i == randomReplyNum) {
      retString = replies[randomReplyNum]
    }
  }

  return retString
}

bot.prototype.getDataMongo = function(database, collection, options = {}, formatting = {}) {
	console.log("DATABASE: " + database)
	// Return new promise
	if (database) {
		if (collection) {
			return new Promise(function(resolve, reject) {
				MongoClient.connect(bot_secret.mongo_url, function(err, db) {
					if (err) {
						throw err
					}

					var dbo = db.db(database)
					var coll = dbo.collection(collection)

					if (coll) {
						coll.find(options,formatting).toArray(function(err, result) {
							if (err) {
								throw err
							} else {
								resolve(result)
							}
							db.close()
						})

					}

				})
			})
		}
	}
}

bot.prototype.insertDataMongo = function(json, database, collection) {
	if (json) {
		// Return new promise
		return new Promise(function(resolve, reject) {
			// Do async job
			MongoClient.connect(bot_secret.mongo_url, function(err, db) {

				var dbo = db.db(database)
				var coll = dbo.collection(collection)

				coll.insertOne(json, function(err,result) {
					if (err) {
						throw err
					} else {
						resolve(result)

						console.log("Saved: ")
						console.log(json)
						db.close()
					}

					return
				})
			})
		})
	}
}

module.exports = bot
