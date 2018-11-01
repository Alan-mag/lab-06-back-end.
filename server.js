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
  })
}

function Location(data) {
  this.formatted_query = data.formatted_address;
  this.latitude = data.geometry.location.lat;
  this.longitude = data.geometry.location.lng;
}

app.use('*', (request, response) => response.send('Sorry, that route does not exist.'))

app.listen(PORT,() => console.log(`Listening on port ${PORT}`));

