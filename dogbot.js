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
var sentiment_options = require("./conf/sentiment.json")
console.log(sentiment_options)

//var global_training = []
var global_training_good = []
var global_training_bad = []

loadTraining()

client.on('ready', () => {
	var sayHello = true

	dog.bot_name = "Dog"
	dog.bot_reply = "Bark"
	dog.bot_keywords = "dog,pup"
	dog.bot_rating = "G"
	dog.bot_odds = .5
	dog.bot_channel = chan_dogbot
	dog.bot_platform = "discord"
	dog.log("Connected as " + client.user.tag)

	console.log(dog)

	// locate dogbot channel
	client.guilds.forEach((guild) => {
		guild.channels.forEach((channel) => {
			//console.log(` -- ${channel.name} (${channel.type}) - ${channel.id}`)
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
		var db_reply = dog_functions.reply(dog,classifier,sentiment,reaction.message.channel.id,reaction.emoji.name,reaction.message.author.id)

		if (db_reply) {
			var lowerCaseReply = db_reply.toLowerCase()
			silent = false
		} else {
			silent = true // no reply
		}

		var logString = reaction.message.author.id // + "\t" + dogSentiment.score

		if (dogSentiment.score > 0) {
			// console.log("logging good")
			dog_functions.train(dog,reaction.message.author.id,dogSentiment.score)

			//good.info(logString)

			// suppress output most of the time
			var suppress = Math.random()
			if (suppress > .25) {
				silent = true
			}
		}
		if (dogSentiment.score < 0) {
			// console.log("logging bad")
			dog_functions.train(dog,reaction.message.author.id,dogSentiment.score)
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
					// clip happy output
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
				console.log(classifier)
				var db_reply = dog_functions.reply(dog,classifier,sentiment,receivedMessage.channel.id,db_input,receivedMessage.author.id)

				// dog log based on replies
				if (db_reply) {
					//console.log("DB_REPLY: " + db_reply)

					var lowerCaseReply = db_reply.toLowerCase()
					var logString = receivedMessage.author.id // + "\t" + dogSentiment.score

					if (lowerCaseReply.includes("woo")) {
						//console.log("logging good")
						dog_functions.train(dog,receivedMessage.author.id,1)

						//good.info(logString)

						// suppress output most of the time
						var suppress = Math.random()
						if (suppress > .25) {
							silent = true
						}
					}
					if ((lowerCaseReply.includes("grr")) || (lowerCaseReply.includes("bark"))) {
						//console.log("logging bad")
						dog_functions.train(dog,receivedMessage.author.id,-1)

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
							if (!(lastMessage.author.bot)) {
								// send message to the channel
								receivedMessage.channel.send(db_reply)
								silent = true
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
							if (!(lastMessage.author.bot)) {
								// send message to the channel
								receivedMessage.channel.send("Bark!")
								silent = true
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


function loadTraining() {
	var query = { }
	var formatting = { user:1,sentiment:1, _id:0 }
	console.log('here')
		var initializePromise = dog.getDataMongo("dogbot","sentiment",query,formatting)
		initializePromise.then(function(result) {
			console.log("Dog training loaded");
			// Use user details from here
			//console.log(catsMeow)
			result.forEach(function(item) {
				//console.log(item.user + " : " + item.sentiment)
				//console.log(item)

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

			classifier = dog_functions.classifierTrain(global_training_good,global_training_bad)

			return result
			resolve(result)
		}, function(err) {
				console.log(err);
		})
}

client.login(bot_secret.bot_secret_token)
