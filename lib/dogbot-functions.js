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

module.exports = {

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
