/* Global Imports */
var fs = require('fs.extra')
	, file_utils = require('../../lib/utils/file-utils')
	, app_cache_handler = require('../../lib/handlers/app-cache-handler')
	, colors = require('colors')
    , os = require('os')
	, config = require('../../lib/handlers/configuration-handler').getConfiguration();

/* Constants */
var SUPPORTED_FILETYPES = new RegExp("\.(avi|mkv|mpeg|mov|mp4)","g");

exports.initMovieDb = function() {
    // Init Database
    var dblite = require('dblite')
    if(config.binaries === 'packaged'){
        if(config.platform === 'OSX'){
            dblite.bin = "./bin/sqlite3/osx/sqlite3";
        }else {
            dblite.bin = "./bin/sqlite3/sqlite3";
        }
    }
    var db = dblite('./lib/database/mcjs.sqlite');
    db.on('info', function (text) { console.log(text) });
    db.on('error', function (err) {
        if(config.binaries !== 'packaged'){
            console.log('You choose to use locally installed binaries instead of the binaries included. /n Please install them. Eg type "apt-get install sqlite3"');
        }
        console.error('Database error: ' + err)
    });

    db.query("CREATE TABLE IF NOT EXISTS movies (local_name TEXT PRIMARY KEY,original_name VARCHAR, poster_path VARCHAR, backdrop_path VARCHAR, imdb_id INTEGER, rating VARCHAR, certification VARCHAR, genre VARCHAR, runtime VARCHAR, overview TEXT, cd_number VARCHAR)");
    return db;
}; 

exports.loadItems = function (req, res){
	file_utils.getLocalFiles(config.moviepath, SUPPORTED_FILETYPES, function(err, files) {
		var movies = [];
		for(var i = 0, l = files.length; i < l; ++i){
			var movieFiles = files[i].file;
			var movieTitles = movieFiles.substring(movieFiles.lastIndexOf("/")).replace(/^\/|\/$/g, '');

			//single
			if(movieTitles === '' && files[i].file !== undefined){
				movieTitles = files[i].file;
			}

			movies.push(movieTitles.split("/").pop());
		}

		res.json(movies);
	});
};

exports.playMovie = function (req, res, platform, movieRequest){
 
	file_utils.getLocalFile(config.moviepath, movieRequest, function(err, file) {
		if (err) console.log(err .red);
		if (file) {
			var movieUrl = file.href
			, stat = fs.statSync(movieUrl)
            , ExecConfig
            , outputPath = "./public/data/movies/output.mp4";
            
            if(config.binaries === 'packaged'){
                if(os.platform() === 'win32'){
                    var ffmpegPath = './bin/ffmpeg/ffmpeg.exe'
                }else{
                    var ffmpegPath = './bin/ffmpeg/ffmpeg'
                }
                
                var ExecConfig = { env: process.env.ffmpegPath };
            }
    
            if(fs.existsSync(outputPath) === true){
                fs.unlinkSync(outputPath);
            };       

            var probe = require('node-ffprobe');

            probe(movieUrl, function(err, probeData) {
                
                var data = { 
                       'platform': platform,
                       'duration':probeData.streams[0].duration
                }
                res.json(data);  
                
                var ffmpeg = 'ffmpeg -i "'+movieUrl+'" -g 52  -threads 0 -vcodec libx264 -coder 0 -flags -loop -pix_fmt yuv420p -crf 22 -subq 0 -preset ultraFast -acodec copy -sc_threshold 0 -movflags +frag_keyframe+empty_moov '+outputPath
                , exec = require('child_process').exec
                , child = exec(ffmpeg, ExecConfig, function(err, stdout, stderr) {
                    if (err) {
                        console.log('FFMPEG error: ',err) ;
                    } else{
                        console.log('Transcoding complete');
                    }
                });

                child.stdout.on('data', function(data) { console.log(data.toString()); });
                child.stderr.on('data', function(data) { console.log(data.toString()); });
                    
            });
            
            
          
    
		} else {
			console.log("File " + movieRequest + " could not be found!" .red);
		}
	});
};

exports.handler = function (req, res, movieRequest){
	//Modules
	var downloader = require('downloader');
	var metadata_fetcher = require('./metadata-fetcher');

	this.initMovieDb();

	console.log('Searching for ' + movieRequest + ' in database');
	metadata_fetcher.fetchMetadataForMovie(movieRequest, function(metadata) {
		res.json(metadata);
	});
};

exports.getGenres = function (req, res){
	var db = this.initMovieDb();
	db.query('SELECT genre FROM movies', function(rows) {
		if (typeof rows !== 'undefined' && rows.length > 0){
			var allGenres = rows[0][0].replace(/\r\n|\r|\n| /g,","),
				genreArray = allGenres.split(',');
			res.json(genreArray);
		}
	});
};

exports.filter = function (req, res, movieRequest){
	var db = this.initMovieDb();
	db.query('SELECT * FROM movies WHERE genre =?', [movieRequest], { local_name: String }, function(rows) {
		if (typeof rows !== 'undefined' && rows.length > 0) {
			res.json(rows);
		}
	});
};
