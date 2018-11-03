'use strict';

const express = require('express');
const cors = require('cors');
const superagent = require('superagent');
const app = express();

require('dotenv').config();

const PORT = process.env.PORT || 3000;

app.use(cors());

app.get('/', (request, response) => {
  response.sendFile('index.html', {root: './'});
});



// ROUTES //

app.get('/location', getLocation);
app.get('/weather', getWeather);


// HELPER METHODS //

// test url 
// http://localhost:3000/weather?data[latitude]=44.60&data[longitude]=-122.72
function getWeather(request, response) {
  const _URL = `https://api.darksky.net/forecast/${process.env.DARK_SKY}/${request.query.data.latitude},${request.query.data.longitude}`;
  return superagent.get(_URL)
    .then(result => {
      const weatherSummaries = [];
      result.body.daily.data.forEach(day => {
        const summary = new Weather(day);
        weatherSummaries.push(summary);
      });
      response.send(weatherSummaries);
    })
    .catch(error => handleError(error, response));
}

function getLocation(request, response) {
  console.log(request);
  const _URL = `https://maps.googleapis.com/maps/api/geocode/json?address=${request.query.data}&key=${process.env.GEO_API}`;
  return superagent.get(_URL)
    .then(result => {
      const jsonData = result.body;
      const location = new Location(jsonData.results[0]);
      response.send(location);
    })
    .catch(err => {
      handleError(err);
    })
}

// CONSTRUCTORS //

function Location(data) {
  this.formatted_query = data.formatted_address;
  this.latitude = data.geometry.location.lat;
  this.longitude = data.geometry.location.lng;
  this.search_query = data.address_components[0].long_name;
}

function Weather(forecast, timeMilliseconds) {
  let date = new Date(timeMilliseconds*1000).toString();
  let dateString = date.toString().slice(0, 15);
  this.forecast = forecast;
  this.time = dateString;
}

// ERROR HANDLER //
function handleError(err, response) {
  console.error('ERR', err);
  if (response) {
    response.status(500).send('Sorry you got this error, maybe break time?');
  }
}

app.use('*', (request, response) => response.send('Sorry, that route does not exist.'))
app.listen(PORT,() => console.log(`Listening on port ${PORT}`));