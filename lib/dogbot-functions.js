const dclassify = require('dclassify')

var Sentiment = require('sentiment')
var Classifier = dclassify.Classifier
var DataSet    = dclassify.DataSet
var Document   = dclassify.Document

var banned_channels = [
	"551534978417295410", // bot-design
	"556599504225173526", // urzas-playground
	"546640535591321601", // pet pixels
	"546640420474585088", // underwood-associates
	"547350390069264395", // business-plan
	"546639371726487566", // business
	"546640519728463880", // smart-purse
	"547185764505747481", // prosthetics
	"546641021484793866", // ella-fit
	"550852692688240661", // dub-dub
	"556006295539417089" // fabio
]

var sentiment_options = require("../conf/sentiment.json")

module.exports = {
	reply: function(dog,classifier,sentiment,channel,input,user) {
		console.log(channel)
		console.log(input)
		console.log(user)

		console.log("CLASSIFIER")
		console.log(classifier)

		var db_input = input.toLowerCase()

		//console.log("Channel: " + channel)
		//console.log("User: " + user)

		var testDoc = new Document('dogUser', user)
		console.log("TEST DOC:")
		console.log(testDoc)

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
			var bias = this.bias(user)

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
	},
	classifierTrain: function(good,bad) {
		// train the classifier

		// create some test items (name, array of characteristics)
		var item_good = new Document('itemA', good)
		var item_bad = new Document('item1', bad)

		console.log("CLASSIFER TRAIN: ")
		console.log(good)
		console.log(bad)

		// create a DataSet and add test items to appropriate categories
		// this is 'curated' data for training
		var data = new DataSet()
		data.add('good', [item_good])
		data.add('bad', [item_bad])

		// an optimisation for working with small vocabularies

		classifier = new Classifier()
		classifier.train(data)

		console.log("Classifier trained")
		return classifier
	},
	train: function(dog, user, sentiment) {
		var query = { }
		var formatting = { }

		console.log(dog)

		var dogLike = {}
		dogLike.user = user
		dogLike.sentiment = sentiment
		dogLike.platform = dog.bot_platform
		dog.insertDataMongo(dogLike,"dogbot","sentiment")
		/*
			var initializePromise = dog.insertDataMongo(dogLike,"dogbot","sentiment")
			initializePromise.then(function(result) {
					console.log("Dog trained: " + dogLike.user + " : " + dogLike.sentiment)
					// Use user details from here
					//console.log(catsMeow)
					return result
					resolve(result)
			}, function(err) {
					console.log(err)
			})
			*/
	},

	bias: function(user) {
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
	},
	isBanned: function(channel_id) {
		var banned = false
		for (var i in banned_channels) {
			if (channel_id == banned_channels[i]) {
				banned = true
			}
		}
		return banned
	}

}
