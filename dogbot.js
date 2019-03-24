const bot_secret = require('./lib/bot-secret')
const dogbot = require('./lib/bot')
const dog = new dogbot()
const dog_functions = require('./lib/dogbot-functions')

const MongoClient = require('mongodb').MongoClient
const db_url = bot_secret.mongo_url

const discord = require('discord.js')
const client = new discord.Client()

// channels (probably shouldn't be hardcoded)
// maybe create a clever algorithm that searches for a channel named dogbot
const chan_general = "421090801393598466"
const chan_dogbot = "553675620660543540"

const dclassify = require('dclassify')

var Sentiment = require('sentiment')
var Classifier = dclassify.Classifier
var DataSet    = dclassify.DataSet
var Document   = dclassify.Document

// create a classifier
var classifier
var sentiment = new Sentiment()
var sentiment_options = {
	//applyInverse: true
	extras: {
		'🐶': 3,
		'💩': -5,
		'🦆': -5,
		'🍑': -5,
		'🐈': -5,
		'🍍': -5,
		'cat': -5,
		'cats': -5,
		'dog': 1,
		'no': 0,
		'agree': 5
	}
}

//var global_training = []
var global_training_good = []
var global_training_bad = []

loadTraining()

client.on('ready', () => {
	classifierTrain()
	var sayHello = false

	dog.name("Dog")
	dog.default_reply("Bark")
	dog.keywords("dog,pup")
	dog.rating("G")
	dog.odds(.5)
	dog.log("Connected as " + client.user.tag)

	// locate dogbot channel
	client.guilds.forEach((guild) => {
		guild.channels.forEach((channel) => {
			console.log(` -- ${channel.name} (${channel.type}) - ${channel.id}`)
			if (channel.name.includes("dogbot")) {
				// set dogbot channel
				dog.bot_channel = channel.id
			} else {
				// fail over to general channel if there's not a dogbot channel
				if (channel.name.includes("general")) {
					dog.bot_channel = channel.id
				}
			}
		})
	})
	if (!(dog.bot_channel)) { dog.bot_channel = chan_dogbot }

	// set discord client "now playing"
	client.user.setActivity(dog.play())

	//console.log(dogBias("408701272343052290"))

	// say hello on the dogbot channel
	var broadcast_channel = client.channels.get(dog.bot_channel)
	if ((sayHello) && (!(dog_functions.isBanned(dog.bot_channel)))) { dog.say("Woof", broadcast_channel) }
	// technically the dog can be banned from its own channel
})

client.on('messageDelete', (receivedMessage) => { }) // not the dog's job

// Welcome new members
client.on('guildMemberAdd', msg => {
	// lodoge dogbot channel
	var genChannel
	client.guilds.forEach((guild) => {
		guild.channels.forEach((channel) => {
			//console.log(` -- ${channel.name} (${channel.type}) - ${channel.id}`)
			if (channel.name.includes("general")) {
				genChannel = channel
				// dog.channel(channel) // this doesn't work and I don't know why
			}
		})
	})

	//console.log(client.user.id)

	//dog.reply(msg.guild.channels.get(chan_general))

  //dog.log("New User: " + msg)
  //dog.log("<" + receivedMessage.channel.id + "> @dogbot: " + newUserGreeting)

})

client.on('messageReactionAdd', (reaction, user) => {
	var silent = false

	//reaction.channel.send("Bark!")
	var reactDo = false
	var channel = client.channels.get(reaction.message.channel.id)

	var isBot = reaction.message.author.bot
	var isEmu = reaction.message.author.username
	isEmu = (isEmu == "Emuji")

	var dogSentiment = sentiment.analyze(reaction.emoji.name, sentiment_options)

	// dog log based on emoji
	if (dogSentiment) {
		var db_reply = dogReply(reaction.message.channel.id,reaction.emoji.name,reaction.message.author.id)

		if (db_reply) {
			var lowerCaseReply = db_reply.toLowerCase()
			silent = false
		} else {
			silent = true // no reply
		}

		var logString = reaction.message.author.id // + "\t" + dogSentiment.score

		if (dogSentiment.score > 0) {
			// console.log("logging good")
			dogTrain(reaction.message.author.id,dogSentiment.score)

			//good.info(logString)

			// suppress output most of the time
			var suppress = Math.random()
			if (suppress > .25) {
				silent = true
			}
		}
		if (dogSentiment.score < 0) {
			// console.log("logging bad")
			dogTrain(reaction.message.author.id,dogSentiment.score)
			//bad.info(logString)
		}

		// console.log("Last message: ")
		//console.log(channel.messages)
		channel.fetchMessages({ limit: 1 }).then(messages => {
		  lastMessage = messages.first();

		  if (!(lastMessage.author.bot)) {
		    // The author of the last message wasn't a bot

				// send message to the channel
				if ((!(silent)) && (!(dog_functions.isBanned(reaction.message.channel.id)))) {
					var randomBark = Math.random()
					if (dogSentiment.score > 0) {
						if (randomBark > .25) {
							channel.send(db_reply)
						}
					} else {
						channel.send(db_reply)
					}
				}

		  }
		})
		.catch(console.error)

	}
})


client.on('messageReactionRemove', (reaction, user) => {
    console.log('a reaction has been removed')
})

// Reply to messages
client.on('message', (receivedMessage) => {
	var silent = false

	// reply inside of the dogbot channel
	if ((receivedMessage.channel.id == dog.bot_channel) || (!(dog_functions.isBanned(receivedMessage.channel.id)))) {
		console.log("Replying in: " + receivedMessage.channel.name + " (" + receivedMessage.channel.id + ")")
		var msg = receivedMessage.content

		if (receivedMessage.author == client.user) { return } // catch and release
		if (receivedMessage.author !== client.user) {

			// log input message
			//dog.log("#dogbot: " + receivedMessage.content)
			//dog.log("<" + receivedMessage.channel.id + "> @dogbot: " + retString)

			var isBot = receivedMessage.author.bot
			if (!(isBot)) {
				// don't log the dog
				// ignore bots for now
				var db_input = receivedMessage.content.toLowerCase()
				var db_reply = dogReply(receivedMessage.channel.id,db_input,receivedMessage.author.id)

				// dog log based on replies
				if (db_reply) {
					//console.log("DB_REPLY: " + db_reply)

					var lowerCaseReply = db_reply.toLowerCase()
					var logString = receivedMessage.author.id // + "\t" + dogSentiment.score

					if (lowerCaseReply.includes("woo")) {
						//console.log("logging good")
						dogTrain(receivedMessage.author.id,1)

						//good.info(logString)

						// suppress output most of the time
						var suppress = Math.random()
						if (suppress > .25) {
							silent = true
						}
					}
					if ((lowerCaseReply.includes("grr")) || (lowerCaseReply.includes("bark"))) {
						//console.log("logging bad")
						dogTrain(receivedMessage.author.id,-1)

						//bad.info(logString)

						// suppress output some of the time
						var suppress = Math.random()
						if (suppress > .75) {
							silent = true
						}
					}

					// remove silent for a few positive commands
					var lcMsg = msg.toLowerCase().replace(/[.,\/#!\\?$%\^&\*;:{}=\-_`~()]/g,"").replace(/\n/g," ")
					var commands = [
						"good dog",
						"good boy",
						"good girl",
						"good pup",
						"🐶",
						"pineapple"
					]

					for (cmd in commands) {
						if (lcMsg.includes(commands[cmd])) {
							silent = false
						}
					}

					// send message to the channel
					if (!(silent)) {
						receivedMessage.channel.fetchMessages({ limit: 1 }).then(messages => {
							lastMessage = messages.first();
							if (!lastMessage.author.bot) {
								// send message to the channel
								receivedMessage.channel.send(db_reply)
							}
						})
						.catch(console.error)
					}
				} else {
					// randomly bark sometimes, 5% chance
					// but not if the author of the last message was a bot
					var chance = Math.floor(Math.random() * 100)
					if (chance < .05) {
						receivedMessage.channel.fetchMessages({ limit: 1 }).then(messages => {
							lastMessage = messages.first();
							if (!lastMessage.author.bot) {
								// send message to the channel
								receivedMessage.channel.send("Bark!")
							}
						})
						.catch(console.error)
					}
				}
			}
		}
	}

	// Check if the bot's user was tagged in the message
	// Always reply to messages from any channel
	if (receivedMessage.isMentioned(client.user)) {
		// Get acknowledgement message from dogbot
		var direct_input = receivedMessage.content.toLowerCase()
		var direct_output = "Woof"

		// Log acknowledgement message
		var msg = receivedMessage.content.toLowerCase()

		// Really need to modularize this function... (Done!)
		if (msg.includes("!gif")) {
			silent = true
			dog.gif(receivedMessage.channel, msg)
		}

		if (msg.includes("!sticker")) {
			silent = true
			dog.sticker(receivedMessage.channel, msg)
		}

		if (msg.includes("!play")) {
			silent = true
			dog.play(msg)
		}

		if (msg.includes("!good")) {
			silent = true
		}

		if (!(silent)) {
			//console.log(receivedMessage.author)
			//dog.say(dog.reply(receivedMessage.content),receivedMessage.channel)
		}
	} else {
	}

})

function dogReply(channel,input,user) {
	var db_input = input.toLowerCase()

	//console.log("Channel: " + channel)
	//console.log("User: " + user)

	var testDoc = new Document('testDoc', user)
  var dogAnalysis = classifier.classify(testDoc)

	var dogLikesUser = dogAnalysis.category
	//console.log(dogLikesUser)

	var retString = dog.bot_reply
	var silent = false

	var db_output = []

	// incoming message cannot be blank
	if (db_input) {
		var dogSentiment = sentiment.analyze(db_input, sentiment_options)
		//console.log(dogSentiment)

		//var dogString = "Bark!"
		var wordScore = 0
		var bias = dogBias(user)

		// negative emotions
		if (dogSentiment.score < 0) {
			dogString = "Grrr"
			wordScore = (dogSentiment.score * -1)
		}

		//positive emotions
		if (dogSentiment.score > 0) {
			dogString = "Woo"
			wordScore = dogSentiment.score
		}

		if (wordScore) {

			// positivity is amplified by a
			// positive dog affinity while
			var biasScore = wordScore
			if (bias.dog_affinity == "good") {
				// word is positive
				// dog likes you so positive effect is amplified
				if (dogSentiment.score > 0) {
					biasScore = dogSentiment.score + bias.dog_bias
				}
				// word is negative
				// dog likes you, negative effect is softened
				if (dogSentiment.score < 0) {
					biasScore = dogSentiment.score + bias.dog_bias
				}
			}
			// negativity is amplified by a
			// negative dog affinity
			if (bias.dog_affinity == "bad") {
				// word is positive
				if (dogSentiment.score > 0) {
					// dog dislikes you so positive effect is weakened
					biasScore = dogSentiment.score - bias.dog_bias
				}
				// word is negative
				if (dogSentiment.score < 0) {
					biasScore = dogSentiment.score - bias.dog_bias
				}
			}

			// inverts to positive
			if (biasScore < 0) { biasScore *= -1 }

			//console.log("wordScore: " + wordScore)
			// console.log("biasScore: " + biasScore)
			//console.log("Bias: " + bias.dog_bias)
			//console.log("Affinity: " + bias.dog_affinity)

			var range_score = 0

			var dog_total = biasScore
			var dog_like = dogSentiment.score
			if (dog_total < 0) { dog_total *= -1 } // if negative make positive
			if (dog_like < 0) { dog_like *= -1 } // if negative make positive

			//console.log("Range total: " + dog_total)

			for (var i = 0; i < dog_total; i++) {
				if (!(i % 5)) { // divisible by 5
					//console.log("modulo")
					range_score++
				}
			}

			range_score-- // subtract one to balance the zero
			console.log("Range total: " + range_score)

			// dog bias adds one or more exclamation points
			retString = dogString

			var randomBark = Math.random()
			if (randomBark > .75) {
				if (dogSentiment.score < 0) {
					retString = "Bark!"
				}
			}

			var tmpString = retString.toLowerCase()
			for (var i = 0; i < range_score - 1; i++) {
				if (tmpString.startsWith("gr")) {
					retString += "r"
				}
				if (tmpString.startsWith("wo")) {
					retString += "o"
				}
				if (tmpString.startsWith("bark")) {
					retString += "!"
				}
			}

			// excited dog
			if (tmpString.startsWith("woo")) { retString += "f" } // close the string if necessary
			if ((tmpString.startsWith("bark")) && (range_score >= 1)) { retString += "!" }
			if ((tmpString.startsWith("woo")) && (range_score >= 2)) { retString += "!" }
			if ((tmpString.startsWith("grr")) && (range_score <= 2)) { retString += "..." }
			if (range_score >= 3) { retString = retString.toUpperCase() }

			if ((retString) && (!(silent))) {
				return retString
			}

			// log suppressed message
			if (retString && (silent)) {
				// receivedMessage.channel.id
				//dog.log("<" + "channel_id" + "> @dogbot: (Message Suppressed) " + retString)
			}
		}
	}
}

function classifierTrain() {
	// train the classifier

	// create some test items (name, array of characteristics)
	var item_good = new Document('itemA', global_training_good)
	var item_bad = new Document('item1', global_training_bad)

	// create a DataSet and add test items to appropriate categories
	// this is 'curated' data for training
	var data = new DataSet()
	data.add('good', [item_good])
	data.add('bad', [item_bad])

	// an optimisation for working with small vocabularies

	classifier = new Classifier()
	classifier.train(data)

	return classifier
}


function dogBias(user) {
	var dog_likes_user = "good" // the dog likes you by default
	var dog_bias = 0

	// check to see if the dog likes the user
	var testDoc = new Document('testDoc', user)
  var dogAnalysis = classifier.classify(testDoc)

	dog_likes_user = dogAnalysis.category
	dog_bias = Math.round((dogAnalysis.probability * 10))

	var dog_emo = 0
	if (dog_likes_user == "bad") {
		dog_emo = dog_bias * -1
	}

	if (dog_likes_user == "good") {
		dog_emo = dog_bias
	}

	var ret_val = {}
	ret_val.dog_bias = dog_emo
	ret_val.dog_affinity = dog_likes_user

	return ret_val
}

function loadTraining() {
	var retVal
	console.log("Loading training data")
	MongoClient.connect(db_url, function(err, db) {

		var dog_db = db.db("dogbot")
		var dog_sentiment = dog_db.collection("sentiment")

		//user_training.find().toArray(function(err, items) {})

		dog_sentiment.find({},{ user:1,sentiment:1, _id:0}).toArray(function(err, result) {
    	if (err) throw err

			//console.log(tmp.user)

			result.forEach(function(item) {
				//console.log(item.user + " : " + item.sentiment)

				if (item.sentiment < 0) {
					//console.log("BAD")
					for (var i = 0; i < (item.sentiment * -1); i++) {
						global_training_bad.push(item.user)
					}
				}

				if (item.sentiment > 0) {
					//console.log("GOOD")
					for (var i = 0; i < item.sentiment; i++) {
						global_training_good.push(item.user)
					}
				}
			})
	    db.close()
	  })
	})
}

function dogTrain(user, sentiment) {
	console.log(user)
	console.log(sentiment)

	if (user) {
		if (sentiment) {

			MongoClient.connect(db_url, function(err, client) {
				if (err) throw err

				//var dictionary_db = db.db("emuji")
				const collection = client.db("dogbot").collection("sentiment")
				var dogLike = {}
				dogLike.user = user
				dogLike.sentiment = sentiment

				var result = collection.insertOne(dogLike, function(err,result) {
					if (err) throw err

					//console.log(mongo_library)
					console.log("Dog trained: " + dogLike.user + " : " + dogLike.sentiment)
					return
				})
			})
		}
	}
}

client.login(bot_secret.bot_secret_token)
