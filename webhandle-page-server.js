const path = require('path')
const filog = require('filter-log')
const fs = require('fs')
const commingle = require('commingle')

let log = filog('webhandle:page-server')

const allowedPath = function(path) {
	if(path.indexOf('..') > -1 ) {
		return false
	}
	
	return true
}


function trimStartingSlashes(str) {
	if(str) {
		while(str.startsWith('/')) {
			str = str.substring(1)
		}
	}
	return str
}


let createPageServer = function(sourceDirectory) {
	
	let server = function(req, res, next) {
		let requestedPath = req.pagePath || req.path
		if(!allowedPath(requestedPath)) {
			return next()
		}
		
		server.findPageInfo(requestedPath, (err, info) => {
			if(!info) {
				return next()
			}
			server.prerenderSetup(req, res, info, (templatePath) => {
				res.render(templatePath)
			})	
		})
	}

	server.preRun = []
	server.indexNames = ['index']
	server.searchAlternates = false
	server.prerenderSetup = (req, res, info, next) => {
		if(!res.locals.page) {
			res.locals.page = info.pageInfo || {}
		}
		else {
			res.locals.page = Object.assign({}, info.pageInfo || {}, res.locals.page)
		}
		
		info = info || {}
		
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
			if(server.searchAlternates && res.languages) {
				for(let alternate of res.languages) {
					if(info.alternates[alternate.toLowerCase()]) {
						return next(info.alternates[alternate.toLowerCase()])
					}
				}
			}
			else {
				return next(info.templatePath)
			}
		})
	}

	
	
	let findPageInfo = function(reqpath, callback) {
		let fullPath = path.join(sourceDirectory, decodeURI(reqpath))
		fs.stat(fullPath, function(err, data) {
			let isDirectory = data && data.isDirectory()
			
			let parsedPath = path.parse(fullPath)
			let containingPath = isDirectory ? fullPath : parsedPath.dir
			
			if(containingPath.toString().indexOf(sourceDirectory.toString()) != 0) {
				log.error("Attacking detected for path: " + reqpath)
				return res.setStatus(404)
			}
			
			fs.readdir(containingPath, function(err, items) {
				if(err) {
					log.error('No page found for: ' + reqpath)
					if(callback) {
						callback()
					}
					return 
				}

				for(let currentName of ( isDirectory ? server.indexNames : [parsedPath.name])) {
					for(let item of items) {
						if((currentName + '.tri') === item || (currentName + '.html') === item) {
							
							
							fs.readFile(containingPath + '/' + currentName + '.json', function(err, data) {
								let info = {
									currentName: currentName,
									containingPath: containingPath,
									item: item,
									isDirectory: isDirectory,
									templatePath: (isDirectory ? decodeURI(reqpath) : path.dirname(decodeURI(reqpath))) + '/' + currentName
								}
								if(!err) {
									log.debug('Found page meta information for: ' + reqpath)
									try {
										info.pageInfo = JSON.parse(data.toString())
									}
									catch(e) {}
								}
								
								
								// Search for alternate versions
								if(server.searchAlternates) {
									info.alternates = {}
									if(server.defaultPageLang) {
										info.alternates[server.defaultPageLang] = info.templatePath
									}
									try {
										for(let posAlt of items) {
											if(posAlt.startsWith(currentName) && (posAlt.endsWith('.tri') || posAlt.endsWith('.html')) && posAlt !== item ) {
												let lastDot = posAlt.lastIndexOf('.')
												let variation = posAlt.substring(currentName.length + 1, lastDot)
												info.alternates[variation.toLowerCase()] = (isDirectory ? decodeURI(reqpath) : path.dirname(decodeURI(reqpath))) + '/' + posAlt.substring(0, lastDot)
											}
											
										}
									}
									catch(e) {}
									for(let key of Object.keys(info.alternates)) {
										info.alternates[key] = trimStartingSlashes(info.alternates[key])
									}
								}
								info.templatePath = trimStartingSlashes(info.templatePath)
								
								if(callback) {
									callback(null, info)
								}
								return
							})
							return
						}
					}
				}
				
				if(callback) {
					callback()
				}
				return
			})
			
		})
		
	}
	
	
	
	server.findPageInfo = findPageInfo
	
	
	
	return server
}



module.exports = createPageServer