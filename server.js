'use strict';

const express = require('express');
const cors = require('cors');
const superagent = require('superagent');
const pg = require('pg');
const app = express();

require('dotenv').config();

const PORT = process.env.PORT || 3000;

const client = new pg.Client(process.env.DATABASE_URL);
client.connect();
client.on('err', err => console.log(err));

app.use(cors());

app.get('/', (request, response) => {
  response.sendFile('index.html', {root: './'});
});



// ROUTES //

app.get('/location', getLocation);
app.get('/weather', getWeather);
app.get('/yelp', getYelp);
app.get('/movies', getMovies);


// HELPER METHODS //

// test url 
// http://localhost:3000/weather?data[latitude]=44.60&data[longitude]=-122.72
function getWeather(request, response) {
  const _URL = `https://api.darksky.net/forecast/${process.env.DARK_SKY}/${request.query.data.latitude},${request.query.data.longitude}`;
  return superagent.get(_URL)
    .then(result => {
      const weatherSummaries = result.body.daily.data.map((day) => {
        return new Weather(day);
      })
      response.send(weatherSummaries);
    })
    .catch(error => handleError(error, response));
}

// function getLocation(request, response) {
//   const _URL = `https://maps.googleapis.com/maps/api/geocode/json?address=${request.query.data}&key=${process.env.GEO_API}`;
//   return superagent.get(_URL)
//     .then(result => {
//       const jsonData = result.body;
//       const location = new Location(jsonData.results[0]);
//       response.send(location);
//     })
//     .catch(err => {
//       handleError(err);
//     })
// }

function getYelp(request, response) {
  const _URL = `https://api.yelp.com/v3/businesses/search?term=restaurants&latitude=${request.query.latitude}&longitude=${request.query.longitude}`;
  return superagent.get(_URL)
    .set('Authorization', `Bearer ${process.env.YELP_KEY}`)
    .then(result => {
      const restaurantSummaries = result.body.businesses.map((restaurant) => {
        return new Restaurant(restaurant);
      })
      response.send(restaurantSummaries);
    })
    .catch(err => {
      handleError(err);
    })
}

// https://api.themoviedb.org/3/movie/550?api_key=
function getMovies(request, response) {
  const _URL = `https://api.themoviedb.org/3/search/movie?api_key=${process.env.MOVIE_KEY}&query=${request.query.city}`;
  return superagent.get(_URL)
    .then((val) => {
      let movieSummary = val.body.results.map((movieData) => {
        return new Movie(movieData)
      });
      movieSummary = movieSummary.slice(0, 51);
      response.send(movieSummary);
    })
    .catch(err => {
      handleError(err);
    })
}

// CONSTRUCTORS //

function Location(query, data) {
  this.search_query = query
  this.formatted_query = data.formatted_address;
  this.latitude = data.geometry.location.lat;
  this.longitude = data.geometry.location.lng;
  this.search_query = data.address_components[0].long_name;
}

Location.prototype.save = function() {
  let SQL = `
    INSERT INTO locations
    (search_query,formatted_query,latitude,longitude)
    VALUES($1,$2,$3,$4)
  `;
  let values = (Object.values(this));
  client.query(SQL, values);
}

Location.fetchLocation = (query) => {
  const _URL = `https://maps.googleapis.com/maps/api/geocode/json?address=${query}&key=${process.env.GEO_API}`;
  return superagent.get(_URL)
    .then(result => {
      console.log('Got data from API');
      if ( ! result.body.results.length ) { throw 'No Data'; }
      else {
        const location = new Location(query, result.body.results[0]);
        location.save();
        return location;
      }
    })
    .catch(err => {
      handleError(err);
    })
}

function getLocation(request, response) {
  const locationHandler = {
    query: request.query.data,

    cacheHit: (results) => {
      console.log('Got data from SQL');
      response.send(results.rows[0]);
    },

    cacheMiss: () => {
      Location.fetchLocation(request.query.data)
        .then(data => response.send(data));
    },
  }

  Location.lookupLocation(locationHandler);
}

Location.lookupLocation = (handler) => {
  const SQL = `SELECT * FROM locations WHERE search_query=$1`;
  const values = [handler.query];

  return client.query(SQL, values)
    .then( results => {
      if (results.rowCount > 0) {
        handler.cacheHit(results);
      }
      else {
        handler.cacheMiss();
      }
    })
    .catch(console.error);
};

function Weather(forecast, timeMilliseconds) {
  let date = new Date(timeMilliseconds*1000).toString();
  let dateString = date.toString().slice(0, 15);
  this.forecast = forecast;
  this.time = dateString;
}

function Restaurant(data) {
  this.name = data.name;
  this.image_url = data.image_url;
  this.price = data.price;
  this.rating = data.rating;
  this.url = data.url;
}

function Movie(data) {
  this.title = data.title;
  this.overview = data.overview;
  this.average_votes = data.vote_average;
  this.total_votes = data.vote_count;
  this.image_url = data.poster_path;
  this.popularity = data.popularity;
  this.released_on = data.release_date;
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