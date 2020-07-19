# cep
A simple complex event processing system

[![CodeFactor](https://www.codefactor.io/repository/github/3beca/cep/badge)](https://www.codefactor.io/repository/github/3beca/cep)
![Node.js CI](https://github.com/3beca/cep/workflows/Node.js%20CI/badge.svg?branch=master)
[![Dependabot Status](https://api.dependabot.com/badges/status?host=github&repo=3beca/cep)](https://dependabot.com)
[![codecov](https://codecov.io/gh/3beca/cep/branch/master/graph/badge.svg)](https://codecov.io/gh/3beca/cep)

## Getting Started

Clone the repo. Install dependencies:

```
npm ci
```

After this is done, run the application in watch mode

```
npm run start-watch
```

## Introduction

Cep is very simple. It is modeled in 3 main concepts:
* **Event Type**: define a type of event where you can send event payload to a given url
* **Target**: web hook urls to send event payload based on rule matching
* **Rule**: a rule is created for an event type, with a filter that will be evaluated for each event payload received and a target that will be called whenever the filter matches the event payload

### Create an Event Type

First of all we want tell cep that an event type exists. To create an event type we just need to provide an unique name:

```
curl -X POST "http://localhost:8888/event-types/" -H "accept: application/json" -H "Content-Type: application/json" -d "{ \"name\": \"sensor foo\"}"
```
The result will give us an url where we will submit http post with json event payload:
```
{
  "name": "sensor foo",
  "id": "5db3730cb2684d3d135f20a4",
  "url": "http://localhost:8888/events/5db3730cb2684d3d135f20a4",
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

### Send event payload

To send an event palyoad just make an http post request to the event type url

```
curl -X POST "http://localhost:8888/events/5db3730cb2684d3d135f20a4" -H "accept: application/json" -H "Content-Type: application/json" -d "{ \"value\": 43 }"
```

This event payload will make the rule "value greater than 42" match, so the target will be called.

## Docker Compose

We provide a docker compose to quickly have cep up and running.

```
docker-compose up
```

## Swagger

Swagger UI, json and yaml are available at the following urls

- http://localhost:8888/documentation
- http://localhost:8888/documentation/json
- http://localhost:8888/documentation/yaml

## Test

Run the test suite with the following command:

```
npm test
```

## License

MIT
