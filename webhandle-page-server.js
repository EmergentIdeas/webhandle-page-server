const path = require('path')
const filog = require('filter-log')
const commingle = require('commingle')
const FileSink = require('file-sink')

let log = filog('webhandle:page-server')

function removeExt(name) {
	let parts = name.split('.')
	parts.pop()
	return parts.join('.')
}


let createPageServer = function(sourceDirectory) {
	let pagesSink = new FileSink(sourceDirectory)
	let locator
	import('@webhandle/page-locator').then(mod => {
		let PageLocator = mod.default
		locator = new PageLocator({
			sink: pagesSink
		})
	})
	
	let server = function(req, res, next) {
		let requestedPath = req.pagePath || req.path
		server.findPageInfo(requestedPath, (err, info) => {
			if(!info) {
				return next()
			}
			server.prerenderSetup(req, res, info, (templatePath) => {
				res.render(templatePath)
			})	
		}, {
			languages: res.languages
		})
	}

	server.preRun = []
	server.searchAlternates = true
	server.prerenderSetup = (req, res, info = {}, next) => {
		if(!res.locals.page) {
			res.locals.page = info.pageInfo || {}
		}
		else {
			res.locals.page = Object.assign({}, info.pageInfo || {}, res.locals.page)
		}
		
		commingle([...server.preRun])(req, res, () => {
			let requestedPath = req.pagePath || req.path
			let reqParms = {
				message: 'Serving page for: ' + requestedPath,
				path: req.path,
				method: req.method,
				hostname: req.hostname,
				ip: req.ip,
				protocol: req.protocol,
				userAgent: req.headers['user-agent'],
				type: 'page-view'
			}
			if(info.containingPath && info.item) {
				reqParms.fileName = path.join(info.containingPath, info.item)
			}
			log.debug(reqParms)

			res.set('Content-Type', 'text/html; charset=UTF-8')
			return next(info.templatePath)
		})
	}

	
	server.findPageInfo = async function(requestedPath, callback, options = {}) {
		try {
			let info = await locator.locate(requestedPath)
			let renderSpec
			if(server.searchAlternates && info.alternatives && options.languages) {
				for(let alternate of options.languages) {
					let currentAlt = info.alternatives[alternate.toLowerCase()]
					if(currentAlt) {
						renderSpec = Object.assign({}, currentAlt)
						if(!renderSpec.metadataExists && info.metadataExists) {
							// If we have no metadata for this variation but we do have
							// metadata for the main page, use that
							renderSpec.metadata = info.metadata
							renderSpec.metadataExists = true
						}

						break
					}
				}
			}
			if(!renderSpec) {
				renderSpec = info
			}
			if(!info.pageInfo && renderSpec.metadata && renderSpec.metadataExists) {
				info.pageInfo = JSON.parse(await pagesSink.read(renderSpec.metadata))
			}
			if(!info.templatePath) {
				info.templatePath = removeExt(renderSpec.template)
			}
			
			callback(null, info)
		}
		catch(e) {
			// no page found. that's fine
			if(callback) {
				return callback()

			}
		}
	}
	
	return server
}



module.exports = createPageServer