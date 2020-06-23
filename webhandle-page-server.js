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
	
	
	let server = function(req, res, next) {
		if(!allowedPath(req.path)) {
			return next()
		}
		
		findPageInfo(req.path, (err, info) => {
			if(!info) {
				return next()
			}
			
			res.locals.page = info.pageInfo || {}
			
			
			
			
			commingle([...server.preRun])(req, res, () => {
				log.debug({
					message: 'Serving page for: ' + req.path,
					path: req.path,
					method: req.method,
					hostname: req.hostname,
					ip: req.ip,
					protocol: req.protocol,
					userAgent: req.headers['user-agent'],
					fileName: path.join(info.containingPath, info.item),
					type: 'page-view'
				})

				res.set('Content-Type', 'text/html; charset=UTF-8')
				res.render(info.templatePath)
			})
		})
		
	}
	server.findPageInfo = findPageInfo
	
	server.preRun = []
	server.indexNames = ['index']
	
	
	return server
}



module.exports = createPageServer