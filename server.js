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
  const locationData = searchToLatLng(request.query.data);
  response.send(locationData);
});

function searchToLatLng(query) {
  // call geo api from google
  const location = new Location();
  return location;
}

function Location(data) {
  this.formatted_query = data.formatted_address;
  this.latitude = data.geometry.location.lat;
  this.longitude = data.geometry.location.lng;

}

app.use('*', (request, response) => response.send('Sorry, that route does not exist.'))

app.listen(PORT,() => console.log(`Listening on port ${PORT}`));
