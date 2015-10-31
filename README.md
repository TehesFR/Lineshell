** Not yet ready for use **

# Lineshell [![Build Status](https://travis-ci.org/TehesFR/Lineshell.svg?branch=master)](https://travis-ci.org/TehesFR/Lineshell)

Lineshell is an open source project to manage servers and execute scripts on them, keeping a complete history of all executions results.
It is based on Node.js and Mongodb.

You can use the Lineshell Docker container, packed with everything you need, at https://hub.docker.com/r/tehes/lineshell-docker/
This container will pulled sources from the master branch of this repository.

![Docker L](https://raw.githubusercontent.com/docker/docker/master/docs/static_files/docker-logo-compressed.png "Docker")

```bash
docker run -it -d --name lineshell -p 8080:8080 -e MONGODB_USERNAME=lineshell_user -e MONGODB_PASSWORD=lineshell_pass -e MONGODB_DBNAME=admin tehes/lineshell-docker
```

============================

## Features

  * *Easy install on your server using Docker*
  * *Create multiple accounts*
  * *Dashboard page*
  * *Servers, Groups, and Scripts management pages*
  * *Use arguments in scripts*
  * *Asynchronous executions on multiple servers*
  * *Executions details, including duration, stdout, stderr*
  * *Rerun past executions in just one click*
  * *History of all executions*
  * *Timezones settings*
  * *Two-factor authentication with Google Authenticator*
  * *4096 bits SSH keys*
  * *More features to come...*

## Dashboard section with a complete overview
![dashboard](https://cloud.githubusercontent.com/assets/5724684/10742517/ea942bba-7c2d-11e5-8d17-e57e8070fe90.png)

## Connect to your servers using SSH keys, and organize them into groups
![servers](https://cloud.githubusercontent.com/assets/5724684/10742518/ea95f60c-7c2d-11e5-8bbf-6b3f2e2d1022.png)

## Create shell scripts, with or without arguments
![scripts](https://cloud.githubusercontent.com/assets/5724684/10742519/ea988d4a-7c2d-11e5-805e-727948c08614.png)

## Execute scripts on individual server or group of servers, and visualize results for each server
![exec](https://cloud.githubusercontent.com/assets/5724684/10742516/ea9290b6-7c2d-11e5-9815-395df8f30b89.png)
