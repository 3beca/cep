# cep
A simple complex event processing system.

[![CodeFactor](https://www.codefactor.io/repository/github/3beca/cep/badge)](https://www.codefactor.io/repository/github/3beca/cep)
![Node.js CI](https://github.com/3beca/cep/workflows/Node.js%20CI/badge.svg?branch=master)
[![Dependabot Status](https://api.dependabot.com/badges/status?host=github&repo=3beca/cep)](https://dependabot.com)
[![codecov](https://codecov.io/gh/3beca/cep/branch/master/graph/badge.svg)](https://codecov.io/gh/3beca/cep)

**Table of Contents**

- [Introduction](#introduction)
- [Getting Started](#getting-started)
- [Admin Http API](#admin-http-api)
  - [Create an Event Type](#create-an-event-type)
  - [Create a Target](#create-a-target)
  - [Create a Rule](#create-a-rule)
- [Event Processing Http API](#event-processing-http-api)
  - [Send an event](#send-an-event)
- [Configuration](#configuration)
- [Admin User Interface](#admin-user-interface)
- [Docker Compose](#docker-compose)
- [Swagger](#swagger)
- [Test](#test)
- [License](#license)

## Introduction

C.E.P. stays for Complex Event Processing. Its main goal is to allow you to process events. Some common use cases are create alerts, automate processes, and perform stream analytics.

It is modeled in 3 main concepts:
* **Event Type**: define a type of event. This can represent a sensor (i.e.: sensor X temperature).
* **Target**: web hook urls to forward events payload based on rule matching.
* **Rule**: a rule is created for an event type, with a filter that will be evaluated for each event payload received and a target that will be called whenever the filter matches the event payload.

## Getting Started

Install the [NodeJs](https://nodejs.org) runtime. Latest LTS is recommended.

Clone the repo. Install dependencies:

```
npm ci
```

Now, run the application prompting the following command:

```
npm run build && npm run start
```

or run it in watch mode prompting the following command:

```
npm run start-watch
```

**NOTE**: in order to run, a mongod server must be listening at http://localhost:27017. See [Configuration](#configuration) to change the default database connection url.

# Admin Http API

Cep provides an admin http api to manage event types, targets and rules.

### Create an Event Type

First of all we want tell cep that an event type exists. To create an event type we just need to provide an unique name:

```
curl -X POST "http://localhost:8888/event-types/" -H "accept: application/json" -H "Content-Type: application/json" -d "{ \"name\": \"sensor foo\"}"
```
The result will give us an url of the [Event Processing Http API](#event-processing-http-api) where we will submit http post with json event payload:
```
{
  "name": "sensor foo",
  "id": "5db3730cb2684d3d135f20a4",
  "url": "http://localhost:8889/events/5db3730cb2684d3d135f20a4",
  "createdAt": "2019-10-25T22:11:24.289Z",
  "updatedAt": "2019-10-25T22:11:24.289Z"
}
```

### Create a Target

A target represents an external system that will be called based on certain rules.

To create a target we just need to provide an unique name and an url.

```
curl -X POST "http://localhost:8888/targets/" -H "accept: application/json" -H "Content-Type: application/json" -d "{ \"name\": \"target bar\", \"url\": \"https://example.org\"}"
```

### Create a Rule

Rules allow to create a relationship between event types and targets.

A rule can be of the following types:
* **realtime**: on event payload of a given type, each rule will be evaluated to determinate if the event payload match the rule filter or does not. If it matches, then an http POST request will be done against the target url with the event payload as request body
* **sliding**: on event payload of a given type, sliding rule evaluates a filter match based on an aggregation of a given time window. Aggregation operators supported are max, min, count, avg, stdDevPop, stdDevSample. If the rule matches, then an http POST request will be done against the target url with the aggregation result as request body
* **tumbling**: as sliding rules, tumbling rules perform an aggregation of a given time window. However, in spite of realtime and slinding rules, tumbling rules got executed on a given time interval. This time interval matches the time window. If the rule matches, then an http POST request will be done against the target url with the aggregation result as request body

To create a realtime rule we must provide an unique name, a target id, an event type id and a filter (this last one is optional).

```
curl -X POST "http://localhost:8888/rules/" -H "accept: application/json" -H "Content-Type: application/json" -d "{ \"name\": \"value greater than 42\", \"type\": \"realtime\",\"targetId\": \"5db373aeb2684dc2105f20a5\", \"eventTypeId\": \"5db3730cb2684d3d135f20a4\", \"filters\": { \"value\": { \"_gt\": 42 } }}"
```

## Event Processing Http API

This API provides an http endpoint to ingest events into the cep system.

### Send an event

To send an event palyoad just make an http post request to the event type url

```
curl -X POST "http://localhost:8889/events/5db3730cb2684d3d135f20a4" -H "accept: application/json" -H "Content-Type: application/json" -d "{ \"value\": 43 }"
```

This event payload will make the rule "value greater than 42" match, so the target will be called.

# Configuration

The environment variable to configure your cep instance:

|ENV|Description|Type|Default|
|---|-----------|----|-------|
|NODE_ENV|the application environment.|string|development|
|CEP_EVENT_PROCESSING_HTTP_HOST|The host ip address to bind the event processsing http api.|string|localhost|
|CEP_EVENT_PROCESSING_HTTP_PORT|The port to bind the event processing http api.|port|8889|
|CEP_EVENT_PROCESSING_HTTP_ENABLE_SWAGGER|It indicates if Swagger UI is enabled for the event processing http api.|boolean|false|
|CEP_EVENT_PROCESSING_HTTP_TRUST_PROXY|It indicates if the event processing http api is served behind a trusted proxy.|boolean|false|
|CEP_EVENT_PROCESSING_HTTP_BASE_URL|The base url of the event processing http api. This info is used to build the event processing url of a given event type|string|http://localhost:8889|
|CEP_ADMIN_HTTP_HOST|The host ip address to bind the admin http api.|string|localhost|
|CEP_ADMIN_HTTP_PORT|The port to bind the admin http api.|port|8888|
|CEP_ADMIN_HTTP_TRUST_PROXY|It indicates if the admin http api is served behind a trusted proxy.|boolean|false|
|CEP_ADMIN_HTTP_ENABLE_CORS|It indicates if cors requests are enabled for the admin http api.|boolean|false|
|CEP_ADMIN_HTTP_ENABLE_SWAGGER|It indicates if Swagger UI is enabled for the admin http api.|boolean|false|
|CEP_METRICS_HTTP_HOST|The host ip address to bind the metrics http api.|string|localhost|
|CEP_METRICS_HTTP_PORT|The port to bind the metrics http api.|port|8890|
|CEP_MONGODB_URL|The MongoDB connection string url.|string|mongodb://localhost:27017|
|CEP_MONGODB_DATABASE_NAME|The MongoDB database name.|string|tribeca-cep|

## Admin User Interface

The repository [3beca/cep-ui](https://github.com/3beca/cep-ui) hosts an awesome admin web user interface. From your favorite browser you can easily manage event types, target and rules.

## Docker Compose

We provide a docker compose to quickly have cep up and running.

```
docker-compose up
```

The docker compose includes a mongodb standalone instance, the cep-ui served at http://localhost:8080, grafana and prometheus for monitoring the cep instance.

## Swagger

When enabled, you can find the Swagger UI, json and yaml at the following urls

**admin http api**

- http://localhost:8888/documentation
- http://localhost:8888/documentation/json
- http://localhost:8888/documentation/yaml

**event processing http api**

- http://localhost:8889/documentation
- http://localhost:8889/documentation/json
- http://localhost:8889/documentation/yaml

## Test

Run the test suite with the following command:

```
npm test
```

**Note**: to execute the test suite you must have a mongodb 3.x or greater listening at localhost:27017.

## License

MIT
