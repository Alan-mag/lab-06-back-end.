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
app.get('/yelp', getYelps);
app.get('/movies', getMovies);

// ---------------------- LOCATION //

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

// ---------------------- WEATHER //

function Weather(day) {
  this.forecast = day.summary;
  this.time = new Date(day.time * 1000).toString().slice(0, 15);
}

Weather.prototype.save = function(id) {
  const SQL = `INSERT INTO weathers (forecast, time, location_id) VALUES ($1, $2, $3);`;
  const values = Object.values(this);
  values.push(id);
  client.query(SQL, values);
}

Weather.lookup = function(handler) {
  const SQL = `SELECT * FROM weathers WHERE location_id=$1;`;
  client.query(SQL, [handler.location_id])
    .then(result => {
      if(result.rowCount > 0) {
        console.log('Got data from SQL');
        handler.cacheHit(result);
      } else {
        console.log('Got data from API');
        handler.cacheMiss();
      }
    })
    .catch(error => handleError(error));
};

// test url 
// http://localhost:3000/weather?data[latitude]=44.60&data[longitude]=-122.72
Weather.fetch = function(location) {
  const _URL = `https://api.darksky.net/forecast/${process.env.DARK_SKY}/${location.latitude},${location.longitude}`;
  return superagent.get(_URL)
    .then(result => {
      const weatherSummaries = result.body.daily.data.map(day => {
        const summary = new Weather(day);
        console.log(summary);
        console.log(location);
        summary.save(location.id);
        return summary;
      });
      return weatherSummaries;
    })
    .catch((err) => {
      handleError(err);
    })
}

function getWeather(request, response) {
  const handler = {
    location: request.query.data,

    cacheHit: function(result) {
      response.send(result.rows);
    },

    cacheMiss: function() {
      Weather.fetch(request.query.data)
        .then(results => response.send(results))
        .catch(console.error);
    },
  };
  Weather.lookup(handler);
}

// ---------------------- RESTAURANTS //

function Restaurant(data) {
  this.name = data.name;
  this.image_url = data.image_url;
  this.price = data.price;
  this.rating = data.rating;
  this.bus_url = data.url;
}

Restaurant.prototype.save = function() {
  let SQL = `
    INSERT INTO yelps
    (name, image_url, price, rating, url, created_at, location_id)
    VALUES($1, $2, $3, $4, $5, $6, $7)
  `;
  let values = (Object.values(this));
  client.query(SQL, values);
}

Restaurant.lookup = function(handler) {
  const SQL = `SELECT * FROM yelps WHERE location_id=$1;`;
  client.query(SQL, [handler.location.id])
    .then(result => {
      if(result.rowCount > 0) {
        console.log('Got data from SQL');
        handler.cacheHit(result);
      } else {
        console.log('Got data from API');
        handler.cacheMiss();
      }
    })
    .catch(error => handleError(error));
}

Restaurant.fetch = (location) => {
  const _URL = `https://api.yelp.com/v3/businesses/search?term=restaurants&latitude=${location.latitude}&longitude=${location.longitude}`;
  return superagent.get(_URL)
    .set('Authorization', `Bearer ${process.env.YELP_KEY}`)
    .then(result => {
      const restaurantSummaries = result.body.businesses.map((restaurant) => {
        return new Restaurant(restaurant);
      })
      return restaurantSummaries;
    })
    .catch(err => {
      handleError(err);
    })
}

function getYelps(request, response) {
  const yelpHandler = {
    query: request.query.data,

    cacheHit: (results) => {
      console.log('Got data from SQL');
      response.send(results.rows)
    },

    cacheMiss: function() {
      Restaurant.fetch(request.query.data)
        .then(results => response.send(results))
        .catch(console.error)
    },
  };
  Restaurant.lookup(handler);
}

// function getYelp(request, response) {
//   const _URL = `https://api.yelp.com/v3/businesses/search?term=restaurants&latitude=${request.query.latitude}&longitude=${request.query.longitude}`;
//   return superagent.get(_URL)
//     .set('Authorization', `Bearer ${process.env.YELP_KEY}`)
//     .then(result => {
//       const restaurantSummaries = result.body.businesses.map((restaurant) => {
//         return new Restaurant(restaurant);
//       })
//       response.send(restaurantSummaries);
//     })
//     .catch(err => {
//       handleError(err);
//     })
// }

// ---------------------- MOVIES //

function Movie(data) {
  this.title = data.title;
  this.overview = data.overview;
  this.average_votes = data.vote_average;
  this.total_votes = data.vote_count;
  this.image_url = data.poster_path;
  this.popularity = data.popularity;
  this.released_on = data.release_date;
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

// ERROR HANDLER //
function handleError(err, response) {
  console.error('ERR', err);
  if (response) {
    response.status(500).send('Sorry you got this error, maybe break time?');
  }
}

app.use('*', (request, response) => response.send('Sorry, that route does not exist.'))
app.listen(PORT,() => console.log(`Listening on port ${PORT}`));