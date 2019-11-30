const bot_secret = require('./lib/bot-secret')
const dog_functions = require('./lib/dogbot-functions')
const dogbot = require('./lib/bot')
const dog = new dogbot()

const MongoClient = require('mongodb').MongoClient
const db_url = bot_secret.mongo_url

const slack_api_key = bot_secret.slack

//const catbot = require("./lib/catbot-functions")
const catbotUserID = "UH0QETX3K"

// channels (probably shouldn't be hardcoded)
// maybe create a clever algorithm that searches for a channel named dogbot
const chan_general = "421090801393598466"
const chan_dogbot = "CH72RSLQ1"

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

function onInstallation(bot, installer) {
  if (installer) {
    bot.startPrivateConversation({user: installer}, function (err, convo) {
      if (err) {
        console.log(err)
      } else {
        convo.say('Woof')
        convo.say('<< You must /invite dogbot to a channel >>')
      }
    })
  }
}

/**
 * Configure the persistence options
 */

var config = {};
if (process.env.MONGOLAB_URI) {
  var BotkitStorage = require('botkit-storage-mongo');
  config = {
    storage: BotkitStorage({mongoUri: process.env.MONGOLAB_URI}),
  }
} else {
  config = {
    json_file_store: ((process.env.TOKEN)?'./db_slack_bot_ci/':'./db_slack_bot_a/'), //use a different name if an app or CI
  }
}

/**
 * Are being run as an app or a custom integration? The initialization will differ, depending
 */

if (process.env.TOKEN || process.env.SLACK_TOKEN || slack_api_key) {
  //Treat this as a custom integration
  var customIntegration = require('./lib/custom_integrations');
  var token = (process.env.TOKEN) ? process.env.TOKEN : process.env.SLACK_TOKEN;
	if (slack_api_key) { token = slack_api_key }
  var controller = customIntegration.configure(token, config, onInstallation);

} else if (process.env.CLIENT_ID && process.env.CLIENT_SECRET && process.env.PORT) {
  //Treat this as an app
  var app = require('./lib/apps');
  var controller = app.configure(process.env.PORT, process.env.CLIENT_ID, process.env.CLIENT_SECRET, config, onInstallation);
} else {
  console.log('Error: If this is a custom integration, please specify TOKEN in the environment. If this is an app, please specify CLIENTID, CLIENTSECRET, and PORT in the environment');
  process.exit(1);
}


controller.on('rtm_open', function (bot) {
	var tmp_classifier = loadDogTraining(bot)

	var sayHello = true

	dog.bot_name = "Dog"
	dog.bot_reply = "Bark!"
	dog.bot_keywords = "dog,pup"
	dog.bot_rating = "G"
	dog.bot_odds = .5
	dog.bot_channel = chan_dogbot
	dog.bot_platform = "slack"
	console.log("Connected as " + dog.bot_name)

	// say hello
	if (sayHello) {
		var tmp_msg = {}
		tmp_msg.channel = chan_dogbot
		var msg = {}
		msg.text = "Hello"
		//console.log(db_reply)

//		reply: function(dog,classifier,sentiment,channel,input,user) {

		//bot.reply(tmp_msg,db_reply)

		//cat.say("Meow", catChannel)
	}

	// technically the dog can be banned from its own channel
})

controller.on('rtm_close', function (bot) {
    console.log('** The RTM api just closed');
    // you may want to attempt to re-open
})

controller.on('bot_channel_join', function (bot, message) {
	console.log(dog.bot_reply)
  bot.reply(message, dog.bot_reply)
})

controller.hears('', ['direct_mention', 'message', 'mention', 'direct_message'], function(bot, message) {
	// reply to all direct messages
	console.log("Message: " + message)
	console.log(message)
	var output = dog_functions.reply(dog,classifier,sentiment,message.channel,message.text,message.user)
	//		reply: function(dog,classifier,sentiment,channel,input,user) {

	console.log("OUTPUT: " + output)

	if (!(output)) { output = dog.bot_reply }
	bot.reply(message, output)

})

controller.hears('', ['ambient'], function(bot, message) {
	// reply to ambient messages but only in catbot channel
	console.log("AMBIENT: ")
	console.log(message)
	if (message.channel == chan_dogbot) {
		console.log("Message: " + message.text)
		console.log(message)
		//var output = dog_functions.reply(dog,bot,message)
		var output = dog_functions.reply(dog,classifier,sentiment,message.channel,message.text,message.user)

		//var db_reply = dog_functions.reply(dog,classifier,sentiment,message.channel,message,receivedMessage.author.id)

		console.log(output)
		if (output) {
			bot.reply(message, output)
		}
	}
})

/*
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
				var db_reply = dog_functions.reply(dog,classifier,sentiment,receivedMessage.channel.id,receivedMessage.content,receivedMessage.author.id)
					// send message to the channel
				if (!(silent)) {
					receivedMessage.channel.fetchMessages({ limit: 1 }).then(messages => {
						lastMessage = messages.first();
						if (!(lastMessage.author.bot)) {
							// send message to the channel
							if (db_reply) {
								receivedMessage.channel.send(db_reply)
							}
							silent = true
						}
					})
					.catch(console.error)

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

/* React to reactions

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
		  lastMessage = messages.last();

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

*/


function loadDogTraining(bot) {
	var tmpBot = bot

	var query = { }
	var formatting = { user:1,sentiment:1, _id:0 }
		var initializePromise = dog.getDataMongo("dogbot","sentiment",query,formatting)
		initializePromise.then(function(result,bot) {
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


			return classifier
			resolve(classifier)
		}, function(err) {
				console.log(err);
		}).then(function(bot) {
			// Say hello
			var tmp_msg = {}
			tmp_msg.channel = chan_dogbot

			tmpBot.reply(tmp_msg,dog.bot_reply)

		})
}
