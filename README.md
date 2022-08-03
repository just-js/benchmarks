# Javscript Benchmarks

A set of benchmarks for various common scenarios in JS development.

## Run locally with Docker

- Build the benchmark docker image

```
docker build -t benchmark .
```

- Build the docker image for the SQLite benchmark
```
cd 02-sqlite
docker build -t benchmark-02-sqlite .
```

- Run the SQLite benchmark shell
```
docker run -it --rm --privileged -v $(pwd)/out:/bench/out benchmark-02-sqlite
```

- Run the benchmark inside the docker shell
```
just run.js 10 10000000
```
you should see results in `02-sqlite/out/results.json` when benchmark is complete. 

- View the Results

run a local web server from 02-sqlite/out to view the report.html file. e.g.

```
cd 02-sqlite/out
python3 -m http.server 8080
xdg-open http://127.0.0.1:8080/results.html
```

## Run in Gitpod

# Just [![Gitpod ready-to-code](https://img.shields.io/badge/Gitpod-ready--to--code-908a85?logo=gitpod)](https://gitpod.io/#https://github.com/just-js/benchmark)
