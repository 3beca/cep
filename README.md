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
  - [Rule Options](#rule-options)
  - [Rule Filters](#rule-filters)
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
* **Event Type**: define a type of event. This can represent a sensor (i.e.: sensor foo emitting temperature values).
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

## Admin Http API

Cep provides an Admin Http API to manage event types, targets and rules. Also can be used to list the events payloads processed and list the corresponding rules executions. More info of the endpoints of this API can be found in the [Swagger](#swagger) definition.

### Create an Event Type

To create an event type we just need to provide an unique name:

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

A target represents an external system that will be called whenever a rule match.

To create a target we just need to provide an **unique name** and an **url**.

```
curl -X POST "http://localhost:8888/targets/" -H "accept: application/json" -H "Content-Type: application/json" -d "{ \"name\": \"target bar\", \"url\": \"https://example.org\"}"
```

### Create a Rule

Rules allow to create a relationship between event types and targets.

A rule can be of the following types:
* **realtime**: on event payload of a given type, each rule will be evaluated to determinate if the event payload match the rule filter or does not. If it matches, then an http POST request will be done against the target url with the event payload as request body.
* **sliding**: on event payload of a given type, sliding rule evaluates a filter match based on an aggregation of a given time window. Aggregation operators supported are max, min, count, avg, stdDevPop, stdDevSample. If the rule matches, then an http POST request will be done against the target url with the aggregation result as request body.
* **tumbling**: as sliding rules, tumbling rules perform an aggregation of a given time window. However, in spite of realtime and slinding rules, tumbling rules got executed on a given time interval. This time interval matches the time window. If the rule matches, then an http POST request will be done against the target url with the aggregation result as request body.

i.e.: to create a realtime rule we must provide an unique name, a type, a target id, an event type id and a filter (this last one is optional).

```
curl -X POST "http://localhost:8888/rules/" -H "accept: application/json" -H "Content-Type: application/json" -d "{ \"name\": \"value greater than 42\", \"type\": \"realtime\",\"targetId\": \"5db373aeb2684dc2105f20a5\", \"eventTypeId\": \"5db3730cb2684d3d135f20a4\", \"filters\": { \"value\": { \"_gt\": 42 } }}"
```

### Rule Options

|field name|Description|Type|Default|
|----------|-----------|----|-------|
|name|unique name that identifies a rule|string||
|type|define the rule behavior, possible values are realtime, sliding and tumbling|string||
|eventTypeId|event type identifier|string||
|targetId|target identifier|string||
|skipOnConsecutivesMatches|when set to true the rule will invoke the target only on the first match after a no matching execution, consecutives matches will be skipped and the target won't be invoked. This option can be useful in use case as alerts.|boolean|false|
|filters|It represents a condition over the data of the event payload. When filters is not set, the rule will always match and so invoke the target.|[Object](#rule-filters)|{}|
|group|It represents a group expression. This field is only allowed and required in windowing rules: sliding and tumbling.|Object||
|windowSize|It represents the time window to evaluate the group expression. As group field, it is only allowed and required in windowing rules: sliding and tumbling. It is composed by two fields: unit and value, where unit can be 'second', 'minute', 'hour', and value is a positive integer. i.e.: ```{ 'unit': 'minute', 'value': 5 }``` means 5 minutes.|Object||

### Rule Filters

It represents a condition over the data of the event payload for realtime rules or a condition over the result group expression in case of rules of type slinding or tumbling.

The sintax has been inspired by mongodb query expression language. The operator supported are the following:

|Operator|Description|Examples|
|--------|-----------|--------|
|_eq|equal operator|```{ 'foo': { '_eq': 5 } }``` match if the field foo has value equal to 5. Same condition can be expressed as ```{ 'foo': 5 }```.|
|_gt|greater than operator|```{ 'foo': { '_gt': 5 } }``` match if the field foo has value greater than 5.|
|_gte|greater or equal operator|```{ 'foo': { '_gte': 5 } }``` match if the field foo has value greater or equal to 5.|
|_lt|less than operator|```{ 'foo': { '_lt_': 5 } }``` match if the field foo has value less to 5.|
|_lte|less or equal than operator|```{ 'foo': { '_lte_': 5 } }``` match if the field foo has value less or equal to 5.|
|_near|geo operator. This field only apply to field with value in GeoJSON coordinates array, like: ```[long, lat]```.|```{ 'foo': { '_near': { '_geometry': { 'type': 'Point', 'coordinates': [ 37.992340, -1.130654 ] }, '_minDistance': 10, '_maxDistance': 12 } } }``` match if the distance between the value of the field foo and [ 37.992340, -1.130654 ] is between 10 and 12 meters.|
|_and|and operator to compose more complex condition with AND logic|```{ '_and': [{ 'foo': { '_lt': 5 } }, { 'foo': { '_gt': 0 } }] }``` match if the field foo has value is greater than 0 and less than 5.|
|_or|or operator to compose more complex condition with OR logic|```{ '_or': [{ 'foo': 5 }, { 'foo': 4}] }``` match if the field foo has value equal to 5 or 4.|


## Event Processing Http API

This API provides an http endpoint to ingest events into the cep system.

### Send an event

To send an event palyoad just make an http post request to the event type url

```
curl -X POST "http://localhost:8889/events/5db3730cb2684d3d135f20a4" -H "accept: application/json" -H "Content-Type: application/json" -d "{ \"value\": 43 }"
```

This event payload will make the rule "value greater than 42" match, so the target will be called.

## Configuration

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

**Note**: to execute the test suite you must have a mongodb 3.x or greater listening at localhost:27017. However, you can change the database connection string establishing the env variable **CEP_MONGODB_URL**.

## License

MIT
