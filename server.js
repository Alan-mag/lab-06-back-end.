'use strict';

const express = require('express');
const cors = require('cors');
const request = require('superagent');
const app = express();

require('dotenv').config();

const PORT = process.env.PORT || 3000;

app.use(cors());

app.get('/', (request, response) => {
  response.sendFile('index.html', {root: './'});
});

app.get('/location', (request, response) => {
  searchToLatLng(request.query.data).then((locationData) => {
    console.log(locationData)
    response.send(locationData);
  })
});

app.get('/weather', (request, response) => {
  console.log(request.query.data)
  let weatherDataFormatted = searchWeatherInfo(request.query.data);
  response.send(weatherDataFormatted);
})

// helpers //
// function searchWeatherInfo(query, lat, lng) {
//   lat = 47.6062;
//   lng = -122.3321;
//   let weatherApiKey = process.env.DARK_SKY;
//   return new Promise((resolve, reject) => {
//     request
//       .get(`https://api.darksky.net/forecast/${weatherApiKey}/${lat},${lng}`)
//       .then(res => {
//         let jsonData = res.body;
//         console.log(JSON.stringify(res.body));
//         // let weather = new Weather()
//         resolve(jsonData);
//       })
//       .catch(err => {
//         console.log(err);
//       })
//   })
// }

function searchWeatherInfo(query) {
  let weeklyForecast = [];
  const weatherData = require('./data/darksky.json');
  weatherData.daily.data.forEach(day => {
    const dayForecast = new Weather(day.summary, day.time);
    weeklyForecast.push(dayForecast);
    dayForecast.search_query = query;
  })
  return weeklyForecast;
}

// https://api.darksky.net/forecast/6a1861445b9e34e6bf54191b93a27016/37.8267,-122.4233

function searchToLatLng(query) {
  let apiKey = process.env.GEO_API;
  return new Promise((resolve, reject) => {
    request
      .get(`https://maps.googleapis.com/maps/api/geocode/json?address=${query}&key=${apiKey}`)
      .then(res => {
        let jsonData = res.body;
        const location = new Location(jsonData.results[0]);
        resolve(location);
      })
      .catch(err => {
        handleError(err);
      })
  })
}

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

/************ Error Handler */
function handleError(err, response) {
  console.error('ERR', err);
  if (response) {
    response.status(500).send('Sorry you got this error, maybe break time?');
  }
}

app.use('*', (request, response) => response.send('Sorry, that route does not exist.'))

app.listen(PORT,() => console.log(`Listening on port ${PORT}`));

