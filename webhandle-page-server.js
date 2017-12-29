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

let createPageServer = function(sourceDirectory) {
	let server = function(req, res, next) {
		if(!allowedPath(req.path)) {
			return next()
		}
		
		let fullPath = path.join(sourceDirectory, req.path)
		fs.stat(fullPath, function(err, data) {
			let isDirectory = data && data.isDirectory()
			
			let parsedPath = path.parse(fullPath)
			let containingPath = isDirectory ? fullPath : parsedPath.dir
			
			if(containingPath.toString().indexOf(sourceDirectory.toString()) != 0) {
				log.error("Attacking detected for path: " + req.path)
				return res.setStatus(404)
			}
			
			fs.readdir(containingPath, function(err, items) {
				if(err) {
					log.debug('No page found for: ' + req.path)
					return next()
				}

				for(let currentName of ( isDirectory ? server.indexNames : [parsedPath.name])) {
					for(let item of items) {
						if((currentName + '.tri') === item) {
							log.debug('Serving page for: ' + req.path)
							fs.readFile(containingPath + '/' + currentName + '.json', function(err, data) {
								if(!err) {
									log.debug('Found page meta information for: ' + req.path)
									try {
										res.locals.page = JSON.parse(data.toString())
									}
									catch(e) {}
								}
								res.locals.page = res.locals.page || {}
								
								
								commingle([...server.preRun])(req, res, () => {
									res.render((isDirectory ? req.path : path.dirname(req.path)) + '/' + currentName)
								})
							})
							return
						}
					}
				}
				
				return next()
			})
			
		})
	}
	
	server.preRun = []
	server.indexNames = ['index']
	
	
	return server
}



module.exports = createPageServer