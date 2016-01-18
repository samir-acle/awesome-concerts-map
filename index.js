var express = require('express');
var request = require('request');

var app = express();
var port = process.env.PORT || 3000;

if (!process.env.API) {
  var env = require('./env.js');
}

app.use(express.static(__dirname));

app.get('/', function(req,res){
  res.sendFile('index.html');
});

app.get('/concerts', function(req,res){
  var key = process.env.API || env.apiKey;
  var options = req.query;
  var baseUrl = 'http://api.eventful.com/json/events/search?app_key=' + key;
  var url = baseUrl;

  Object.keys(options).forEach(function(key){
    url += '&' + key + '=' + options[key];
  });

//ajax request to eventful api
  request(url, function(err, response, body) {
    res.json(JSON.parse(body));
  });
});

app.listen(port);
