const path = require('path')
const filog = require('filter-log')
const fs = require('fs')

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
		let parsedPath = path.parse(fullPath)
		fs.readdir(parsedPath.dir, function(err, items) {
			if(err) {
				log.debug('No page found for: ' + req.path)
				return next()
			}
			
			// serve an exact file match
			for(let item of items) {
				if((parsedPath.name + '.tri') === item) {
					fs.readFile(parsedPath.dir + '/' + parsedPath.name + '.json', function(err, data) {
						if(!err) {
							log.debug('Found page meta information for: ' + req.path)
							res.locals.page = JSON.parse(data.toString())
						}
						log.debug('Serving page for: ' + req.path)
						res.render(path.dirname(req.path) + '/' + parsedPath.name)
					})
					return
				}
			}
			
			return next()
		})
	}
	
	return server
}

module.exports = createPageServer